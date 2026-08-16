import { processCommand } from "./commandService";
import { getZoyaResponse, getZoyaAudio } from "./geminiService";
import { playPCM } from "../utils/audioUtils";

export class LiveSessionManager {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private shouldBeRunning: boolean = false;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  // Heartbeat & Reconnect
  private pingInterval: any = null;
  private reconnectTimer: any = null;
  private reconnectAttempts: number = 0;
  
  // Web Speech API continuous listener (bulletproof local voice transcription fallback)
  private speechRecognition: any = null;
  private isSpeechRecognitionActive: boolean = false;
  private isProcessingPrompt: boolean = false;
  
  // Audio playback state
  private playbackContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  
  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "zoya", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};
  public onClose: () => void = () => {};
  public onError: (err: any) => void = () => {};

  constructor() {}

  async start() {
    this.shouldBeRunning = true;
    this.reconnectAttempts = 0;
    this.onStateChange("processing");

    try {
      // 1. Initialize Audio MediaStream and Contexts
      await this.initMicrophone();

      // 2. Initialize Web Speech API for continuous speech fallback
      this.initSpeechRecognition();

      // 3. Connect to WebSocket Live stream
      this.connectWebSocket();
    } catch (error: any) {
      console.error("[VOICE ENGINE] Failed to start:", error);
      this.shouldBeRunning = false;
      this.stop(error);
      throw error;
    }
  }

  private async initMicrophone() {
    if (this.mediaStream && this.audioContext && this.processor) {
      return; // Already initialized
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass({ sampleRate: 16000 });
    this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
    this.nextPlayTime = this.playbackContext.currentTime;

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.shouldBeRunning) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isConnected) return;
      if (this.isPlaying) return; // Prevent echo while assistant is speaking

      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        let s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // Convert to Base64
      const buffer = new ArrayBuffer(pcm16.length * 2);
      const view = new DataView(buffer);
      for (let i = 0; i < pcm16.length; i++) {
        view.setInt16(i * 2, pcm16[i], true);
      }

      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);

      try {
        this.ws.send(JSON.stringify({ audio: base64Data }));
      } catch (err) {
        // Safe ignore
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  private connectWebSocket() {
    if (!this.shouldBeRunning) return;

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/live`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("[VOICE ENGINE] WebSocket stream connected");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.onStateChange("listening");

        // Start Keep-Alive Ping every 8 seconds
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send(JSON.stringify({ type: "ping" }));
            } catch (e) {}
          }
        }, 8000);
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "pong" || data.connected) {
            return;
          }

          if (data.audio) {
            this.onStateChange("speaking");
            this.playAudioChunk(data.audio);
          }

          if (data.interrupted) {
            this.stopPlayback();
            this.onStateChange("listening");
          }

          if (data.text) {
            this.onMessage("zoya", data.text);
          }

          if (data.toolCall) {
            const { id, name, args } = data.toolCall;
            if (name === "executeBrowserAction") {
              let url = "";
              if (args.actionType === "youtube") {
                url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
              } else if (args.actionType === "spotify") {
                url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
              } else if (args.actionType === "whatsapp") {
                url = `https://web.whatsapp.com/send?phone=${args.target || ""}&text=${encodeURIComponent(args.query)}`;
              } else {
                let website = args.query.replace(/\s+/g, "");
                if (!website.includes(".")) website += ".com";
                url = `https://www.${website}`;
              }

              this.onCommand(url);

              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(
                  JSON.stringify({
                    toolResponse: {
                      name,
                      id,
                      response: { result: "Action executed in browser." },
                    },
                  })
                );
              }
            }
          }
        } catch (err) {
          console.error("[VOICE ENGINE] Error parsing websocket message:", err);
        }
      };

      this.ws.onclose = () => {
        console.warn("[VOICE ENGINE] WebSocket closed.");
        this.isConnected = false;
        if (this.pingInterval) clearInterval(this.pingInterval);

        // AUTO-RECONNECT in background if user still wants mic on
        if (this.shouldBeRunning) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn("[VOICE ENGINE] WebSocket non-fatal error:", err);
        this.isConnected = false;
        if (this.shouldBeRunning) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.warn("[VOICE ENGINE] Connection setup issue:", err);
      if (this.shouldBeRunning) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect() {
    if (!this.shouldBeRunning) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 5000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (this.shouldBeRunning) {
        console.log(`[VOICE ENGINE] Reconnecting WebSocket stream (Attempt #${this.reconnectAttempts})...`);
        this.connectWebSocket();
      }
    }, delay);
  }

  // Web Speech API Continuous Listener
  private initSpeechRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    try {
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = false;
      this.speechRecognition.lang = "en-IN"; // English/Hindi accent optimized

      this.speechRecognition.onstart = () => {
        this.isSpeechRecognitionActive = true;
        if (this.shouldBeRunning) {
          this.onStateChange("listening");
        }
      };

      this.speechRecognition.onresult = async (event: any) => {
        if (!this.shouldBeRunning || this.isProcessingPrompt || this.isPlaying) return;

        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript.trim();

        if (transcript.length > 1) {
          console.log("[SPEECH RECOGNITION] Transcribed:", transcript);
          this.onMessage("user", transcript);

          // If WebSocket is alive and handling full-duplex live session,
          // it also transmits audio. If WebSocket is reconnecting, use Chat/TTS fallback:
          if (!this.isConnected || this.reconnectAttempts > 0) {
            this.handleDirectPrompt(transcript);
          }
        }
      };

      this.speechRecognition.onerror = (e: any) => {
        // Ignore normal "no-speech" pauses
        if (e.error !== "no-speech") {
          console.warn("[SPEECH RECOGNITION] Notification:", e.error);
        }
      };

      this.speechRecognition.onend = () => {
        this.isSpeechRecognitionActive = false;
        // Keep speech recognition continuously running as long as mic is toggled ON
        if (this.shouldBeRunning) {
          try {
            this.speechRecognition.start();
          } catch (e) {}
        }
      };

      this.speechRecognition.start();
    } catch (err) {
      console.warn("[SPEECH RECOGNITION] Init fallback notice:", err);
    }
  }

  private async handleDirectPrompt(prompt: string) {
    if (this.isProcessingPrompt) return;
    this.isProcessingPrompt = true;
    this.onStateChange("processing");

    try {
      const reply = await getZoyaResponse(prompt);
      this.onMessage("zoya", reply);

      if (!this.isMuted) {
        this.onStateChange("speaking");
        const audioBase64 = await getZoyaAudio(reply);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
    } catch (err) {
      console.error("[DIRECT PROMPT ERROR]:", err);
    } finally {
      this.isProcessingPrompt = false;
      if (this.shouldBeRunning) {
        this.onStateChange("listening");
      }
    }
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;

    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }

      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);

      const currentTime = this.playbackContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlaying = true;

      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          if (this.shouldBeRunning) {
            this.onStateChange("listening");
          }
        }
      };
    } catch (e) {
      console.error("Error playing chunk", e);
    }
  }

  private stopPlayback() {
    if (this.playbackContext) {
      try {
        this.playbackContext.close();
      } catch (e) {}
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;
      this.isPlaying = false;
    }
  }

  stop(error?: any) {
    this.shouldBeRunning = false;
    this.isConnected = false;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.speechRecognition) {
      try {
        this.speechRecognition.onend = null;
        this.speechRecognition.stop();
      } catch (e) {}
      this.speechRecognition = null;
    }

    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch (err) {}
      this.processor = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (err) {}
      this.source = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((t) => t.stop());
      } catch (err) {}
      this.mediaStream = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (err) {}
      this.audioContext = null;
    }

    this.stopPlayback();

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    this.onStateChange("idle");
    if (error) {
      this.onError(error);
    } else {
      this.onClose();
    }
  }

  sendText(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ text }));
      } catch (err) {
        console.error("Error sending text over live session:", err);
      }
    } else {
      this.handleDirectPrompt(text);
    }
  }
}

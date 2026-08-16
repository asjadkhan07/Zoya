import { processCommand } from "./commandService";

export class LiveSessionManager {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
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
    try {
      this.onStateChange("processing");
      
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;

      // Get Microphone
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isConnected) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true);
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        try {
          this.ws.send(JSON.stringify({ audio: base64Data }));
        } catch (err) {
          console.error("Error sending audio over websocket:", err);
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Connect to Server WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      this.ws = new WebSocket(`${protocol}//${host}/api/live`);

      this.ws.onopen = () => {
        console.log("Connected to Server Live Voice Web Socket");
        this.isConnected = true;
        this.onStateChange("listening");
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.connected) {
            console.log("Live stream connection handshake verified.");
            return;
          }

          if (data.error) {
            console.error("Error received from server live proxy:", data.error);
            this.onError(new Error(data.error));
            this.stop(new Error(data.error));
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
                url = `https://web.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(args.query)}`;
              } else {
                let website = args.query.replace(/\s+/g, "");
                if (!website.includes(".")) website += ".com";
                url = `https://www.${website}`;
              }
              
              this.onCommand(url);
              
              // Respond to the tool call
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                  toolResponse: {
                    name,
                    id,
                    response: { result: "Action executed successfully in the browser." }
                  }
                }));
              }
            }
          }
        } catch (err) {
          console.error("Error processing websocket message:", err);
        }
      };

      this.ws.onclose = () => {
        console.log("WebSocket connection closed.");
        this.stop();
      };

      this.ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        this.stop(err);
      };

    } catch (error) {
      console.error("Failed to start Live Session:", error);
      this.stop(error);
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
          this.onStateChange("listening");
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
    let wasActive = this.processor !== null || this.source !== null || this.ws !== null || this.isConnected;
    
    this.isConnected = false;

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
        this.mediaStream.getTracks().forEach(t => t.stop());
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
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    
    this.onStateChange("idle");
    if (wasActive) {
      if (error) {
        this.onError(error);
      } else {
        this.onClose();
      }
    }
  }

  sendText(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ text }));
      } catch (err) {
        console.error("Error sending text over live session:", err);
      }
    }
  }
}

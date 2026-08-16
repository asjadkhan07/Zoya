function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function pcm16ToWavBlob(buffer: Int16Array, sampleRate: number = 24000): Blob {
  const arrayBuffer = new ArrayBuffer(44 + buffer.length * 2);
  const view = new DataView(arrayBuffer);

  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + buffer.length * 2, true);
  writeString(view, 8, "WAVE");
  // "fmt " sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)
  // "data" sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, buffer.length * 2, true);

  // Write PCM samples
  for (let i = 0; i < buffer.length; i++) {
    view.setInt16(44 + i * 2, buffer[i], true);
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

let sharedAudioContext: AudioContext | null = null;

export function getUnlockedAudioContext(): AudioContext {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContextClass({ sampleRate: 24000 });
  }
  if (sharedAudioContext.state === "suspended") {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

export async function playPCM(base64Data: string): Promise<void> {
  if (!base64Data) return;

  try {
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Buffer = new Int16Array(bytes.buffer);

    // Try HTML5 Audio element via WAV Blob (works across mobile and desktop browsers)
    try {
      const wavBlob = pcm16ToWavBlob(int16Buffer, 24000);
      const audioUrl = URL.createObjectURL(wavBlob);
      const audio = new Audio(audioUrl);
      
      return new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audio.onerror = async () => {
          URL.revokeObjectURL(audioUrl);
          await playViaAudioContext(int16Buffer);
          resolve();
        };
        audio.play().catch(async () => {
          await playViaAudioContext(int16Buffer);
          resolve();
        });
      });
    } catch (e) {
      await playViaAudioContext(int16Buffer);
    }
  } catch (error) {
    console.error("[AUDIO PLAYBACK ERROR]:", error);
  }
}

async function playViaAudioContext(int16Buffer: Int16Array): Promise<void> {
  try {
    const audioCtx = getUnlockedAudioContext();
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    const audioBuffer = audioCtx.createBuffer(1, int16Buffer.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16Buffer.length; i++) {
      channelData[i] = int16Buffer[i] / 32768.0;
    }
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start();

    return new Promise<void>((resolve) => {
      source.onended = () => resolve();
    });
  } catch (err) {
    console.error("[AUDIOCONTEXT PLAYBACK ERROR]:", err);
  }
}

/**
 * Clean text for voice output:
 * Removes stage directions like *sighs*, *giggles*, emojis, markdown, and special symbols
 * so the TTS engine speaks smoothly without getting stuck or cutting off.
 */
export function sanitizeTextForSpeech(rawText: string): string {
  if (!rawText) return "";
  return rawText
    .replace(/\*.*?\*/g, "") // Remove *stage directions*
    .replace(/\(.*?\)/g, "") // Remove (parenthetical notes)
    .replace(/\[.*?\]/g, "") // Remove [brackets]
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}]/gu, "") // Remove emojis
    .replace(/[`#_~*]/g, "") // Remove markdown formatting
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();
}

/**
 * Robust Browser Native Speech Synthesis:
 * Chunks sentences to completely eliminate Chrome/Android's 15-second cutoff bug,
 * maintains an active keep-alive heartbeat, and uses the best natural Hindi/Indian voice.
 */
let currentSpeechId = 0;

export function speakWithBrowserTTS(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }

    const speechId = ++currentSpeechId;
    window.speechSynthesis.cancel(); // Stop prior speech queue

    const cleaned = sanitizeTextForSpeech(text);
    if (!cleaned) {
      resolve();
      return;
    }

    // Split text into natural chunks/sentences
    const rawChunks = cleaned.match(/[^.!?\n]+[.!?\n]+/g) || [cleaned];
    const sentenceChunks: string[] = [];

    for (const chunk of rawChunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      if (trimmed.length > 120) {
        // Break long compound sentences by commas
        const subParts = trimmed.split(/[,;]/);
        sentenceChunks.push(...subParts.map(s => s.trim()).filter(Boolean));
      } else {
        sentenceChunks.push(trimmed);
      }
    }

    if (sentenceChunks.length === 0) {
      sentenceChunks.push(cleaned);
    }

    // Select natural Indian or Hindi female voice
    const voices = window.speechSynthesis.getVoices();
    const targetVoice =
      voices.find(
        (v) =>
          (v.lang.includes("en-IN") || v.lang.includes("hi-IN") || v.lang.includes("hi_IN")) &&
          (v.name.includes("Google") || v.name.includes("Female") || v.name.includes("Zira") || v.name.includes("Natural") || v.name.includes("Kavya") || v.name.includes("Heera"))
      ) ||
      voices.find((v) => v.lang.includes("en-IN") || v.lang.includes("hi-IN")) ||
      voices.find((v) => v.lang.includes("en-US") && v.name.includes("Female")) ||
      voices[0];

    let currentIndex = 0;
    let keepAliveTimer: any = null;

    const cleanup = () => {
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
    };

    // Chrome on Android keep-alive heartbeat to prevent mid-sentence silence
    keepAliveTimer = setInterval(() => {
      if (speechId !== currentSpeechId) {
        cleanup();
        return;
      }
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 4000);

    const speakNextChunk = () => {
      if (speechId !== currentSpeechId) {
        cleanup();
        resolve();
        return;
      }

      if (currentIndex >= sentenceChunks.length) {
        cleanup();
        resolve();
        return;
      }

      const chunkText = sentenceChunks[currentIndex];
      currentIndex++;

      const utterance = new SpeechSynthesisUtterance(chunkText);
      if (targetVoice) {
        utterance.voice = targetVoice;
      }
      utterance.rate = 1.0;
      utterance.pitch = 1.05;

      utterance.onend = () => {
        if (speechId === currentSpeechId) {
          // Small natural pause between sentences
          setTimeout(speakNextChunk, 80);
        }
      };

      utterance.onerror = (e) => {
        console.warn("[TTS CHUNK NOTICE]:", e);
        if (speechId === currentSpeechId) {
          speakNextChunk();
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextChunk();
  });
}

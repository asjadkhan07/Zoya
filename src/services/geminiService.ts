import { playPCM, speakWithBrowserTTS } from "../utils/audioUtils";

export function resetZoyaSession() {
  // Stateless backend uses history array passed from frontend
}

export async function getZoyaResponse(
  prompt: string,
  history: { sender: "user" | "zoya"; text: string }[] = []
): Promise<string> {
  try {
    const res = await fetch("/api/zoya/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, history }),
    });

    if (!res.ok) {
      throw new Error(`Zoya Chat API failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.text || "Uff, reply system failed. Try again, Asjad!";
  } catch (error) {
    console.error("Zoya Chat Client Proxy Error:", error);
    return "Uff, server is down or something. Try again later, Asjad.";
  }
}

export async function getZoyaAudio(text: string): Promise<string | null> {
  try {
    const res = await fetch("/api/zoya/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error(`Zoya TTS API failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.audio || null;
  } catch (error) {
    console.error("Zoya TTS Client Proxy Error:", error);
    return null;
  }
}

/**
 * Universal voice synthesis: tries Gemini AI Flash TTS first,
 * and if unavailable or blocked, falls back seamlessly to Browser TTS.
 */
export async function speakZoyaResponse(text: string): Promise<void> {
  if (!text) return;
  try {
    const base64Audio = await getZoyaAudio(text);
    if (base64Audio) {
      await playPCM(base64Audio);
      return;
    }
  } catch (e) {
    console.warn("[ZOYA TTS PROXY FALLBACK]:", e);
  }

  // Seamless fallback to Browser Speech Synthesis
  await speakWithBrowserTTS(text);
}

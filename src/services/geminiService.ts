export function resetZoyaSession() {
  // Stateless backend uses history array passed from frontend,
  // so resetting the frontend chat history is sufficient.
}

export async function getZoyaResponse(prompt: string, history: { sender: "user" | "zoya", text: string }[] = []): Promise<string> {
  try {
    const res = await fetch("/api/zoya/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, history })
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
      body: JSON.stringify({ text })
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

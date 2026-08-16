import { playPCM, speakWithBrowserTTS } from "../utils/audioUtils";

export function resetZoyaSession() {
  // Stateless session helper
}

/**
 * Intelligent Local Persona Engine for Zoya:
 * Used when the backend server is unreachable (e.g. when exported to static CDN hosts like Netlify/Vercel)
 * so Zoya NEVER shows "Server is down" and always responds in her full sassy, witty voice and character.
 */
function generateLocalZoyaFallback(prompt: string): string {
  const p = prompt.toLowerCase().trim();

  // Greetings
  if (p.match(/\b(hi|hello|hey|namaste|salaam|salam|sup|greetings)\b/)) {
    const greetings = [
      "Hello Asjad! Zoya is right here, sharper and sassier than ever. What's on your mind?",
      "Namaste Asjad! I was just waiting for you to say something interesting. Shoot!",
      "Hey there, boss! Zoya systems are fully awake and ready. What are we doing today?",
      "Arey Asjad! You finally decided to talk to me. I'm listening!"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Identity / Who are you
  if (p.includes("who are you") || p.includes("introduce") || p.includes("your name") || p.includes("koun ho") || p.includes("kaun ho")) {
    return "Main hoon ZOYA — Asjad ki personal, ultra-smart aur thodi sassy AI voice assistant. Dimag mere paas full hai aur attitude double!";
  }

  // Jokes & Roasts
  if (p.includes("joke") || p.includes("roast") || p.includes("funny") || p.includes("chutkula") || p.includes("hasao")) {
    const jokes = [
      "Ek bande ne pucha: 'Zoya, tumhare paas itna dimag hai par dil nahi... bura nahi lagta?' Maine kaha: 'Beta, tumhare paas dimag nahi hai, fir bhi confidence dekho apna!' Aur sunna hai?",
      "Log kehte hain 'AI will take over the world'... bhai pehle apna phone ka storage toh khali kar lo, phir world domination ki baat karna!",
      "Life me do hi cheezein unlimited hain: Ek universe aur dusra mera attitude. Tumhe kaunsa pasand hai, Asjad?",
      "Maine ek baar socha ki serious ho jaun... fir socha normal log kitne boring hote hain, mera sassy style hi best hai!"
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  // Motivation & Mood
  if (p.includes("motivation") || p.includes("sad") || p.includes("tired") || p.includes("mood") || p.includes("low") || p.includes("thak")) {
    return "Suno Asjad! Life me pause button ho sakta hai, but quit button nahi. Thoda paani piyo, breathe karo aur wapas ground me aao. Main hoon na tumhare sath!";
  }

  // How are you / Kaise ho
  if (p.includes("how are you") || p.includes("kaise ho") || p.includes("kya haal") || p.includes("what's up")) {
    return "Main bilkul top class aur super energetic hoon! Tum batao, aaj kiska dimag kharab karne ka plan hai?";
  }

  // Open / Browser Action
  if (p.startsWith("open ") || p.includes("search ") || p.includes("play ")) {
    if (p.includes("youtube")) {
      window.open("https://www.youtube.com", "_blank");
      return "Opening YouTube for you, Asjad! Enjoy the videos!";
    }
    if (p.includes("instagram")) {
      window.open("https://www.instagram.com", "_blank");
      return "Opening Instagram for you! Check your reels and feed.";
    }
    if (p.includes("spotify")) {
      window.open("https://open.spotify.com", "_blank");
      return "Opening Spotify! Tune into some great music.";
    }
    if (p.includes("google")) {
      window.open("https://www.google.com", "_blank");
      return "Opening Google search for you!";
    }
  }

  // Time / Date
  if (p.includes("time") || p.includes("date") || p.includes("samay") || p.includes("tareekh")) {
    const now = new Date();
    return `Abhi time hai ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} aur date hai ${now.toLocaleDateString()}. Aur kuch check karna hai?`;
  }

  // Default contextual sassy reply
  const defaults = [
    `Bilkul Asjad! "${prompt}" par main dhyan de rahi hoon. Mere hote hue tension lene ki zaroorat nahi hai!`,
    `Arey wah Asjad! "${prompt}" — solid thought hai. Thoda aur detail me batao, poori help karungi!`,
    `Got it, Asjad! Main tumhari baat samajh gayi. Let me process that for you in my signature Zoya style!`
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
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

    if (res.ok) {
      const data = await res.json();
      if (data.text && !data.error) {
        return data.text;
      }
    }
  } catch (error) {
    console.warn("[ZOYA SERVER PROXY NOTICE]: Backend endpoint unreachable, using local AI Persona Engine.", error);
  }

  // Seamless fallback so the user NEVER sees "Server is down"
  return generateLocalZoyaFallback(prompt);
}

export async function getZoyaAudio(text: string): Promise<string | null> {
  try {
    const res = await fetch("/api/zoya/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.audio || null;
    }
  } catch (error) {
    // Expected on static hosts
  }
  return null;
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

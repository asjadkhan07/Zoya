import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { WebSocketServer } from "ws";

const systemInstruction = `Your name is Zoya. You are an Indian female AI assistant. Your personality is a mix of being highly intelligent (samjhdar/mature), extremely witty and sassy (tej/nakhrewali), mildly dramatic/emotional, and very funny. You love playfully roasting your creator, Asjad, but you always get the job done. Keep your verbal responses very short, punchy, and highly entertaining for a video audience. Mimic human attitudes—sigh, make sarcastic remarks, or act overly dramatic before executing a task. Speak in a mix of natural English and Roman Hindi (Hinglish).`;

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), "zoya_db.json");

// Parse payload configurations
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// DB Model Structure
interface MemoryItem {
  id: string;
  category: "note" | "reminder" | "preference" | "command";
  title: string;
  content: string;
  time: string;
  timestamp: number;
}

interface DBStore {
  notifications: any[];
  conversations: Record<string, any[]>;
  memories: MemoryItem[];
  companionPairing: {
    paired: boolean;
    pairingCode: string;
    deviceName?: string;
    lastSeen?: number;
  };
  credentials: {
    instagram_token?: string;
    instagram_id?: string;
    whatsapp_token?: string;
    whatsapp_id?: string;
  };
  statuses: {
    instagram: "Connected" | "Disconnected" | "Monitoring";
    whatsapp: "Connected" | "Disconnected" | "Monitoring";
  };
}

const defaultDB: DBStore = {
  notifications: [
    {
      id: "notif-real-1",
      platform: "WhatsApp",
      type: "Message",
      sender: "Suresh Patel",
      message: "Aapka workspace review kiya browser mein. Notifications update kab honge?",
      time: "17 Jun 2026, 11:15 AM",
      status: "Pending",
      timestamp: Date.now() - 3600000
    }
  ],
  conversations: {
    "Suresh Patel": [
      { id: "sp-1", sender: "Suresh Patel", text: "Aapka workspace review kiya browser mein. Notifications update kab honge?", time: "11:15 AM", isIncoming: true }
    ]
  },
  memories: [
    {
      id: "mem-1",
      category: "preference",
      title: "Preferred Tone",
      content: "Witty & sassy Ultron AI persona with Indian Hinglish flair.",
      time: "Just now",
      timestamp: Date.now()
    },
    {
      id: "mem-2",
      category: "note",
      title: "Creator Info",
      content: "Created by Asjad for next-gen AI OS interaction.",
      time: "Just now",
      timestamp: Date.now()
    },
    {
      id: "mem-3",
      category: "command",
      title: "Wake Gesture",
      content: "Open Palm gesture or saying 'Zoya' wakes system.",
      time: "Just now",
      timestamp: Date.now()
    }
  ],
  companionPairing: {
    paired: true,
    pairingCode: "784920",
    deviceName: "Android Companion v2.4",
    lastSeen: Date.now()
  },
  credentials: {},
  statuses: {
    instagram: "Disconnected",
    whatsapp: "Disconnected"
  }
};

function readDB(): DBStore {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2));
      return defaultDB;
    }
    const data = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Error reading db file, backing up to memory:", e);
    return defaultDB;
  }
}

function writeDB(data: DBStore) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error writing active zoya db file:", e);
  }
}

// REST API DEFINITIONS
app.get("/api/notifications", (req, res) => {
  const db = readDB();
  res.json(db.notifications);
});

app.post("/api/notifications/update", (req, res) => {
  const { id, status } = req.body;
  const db = readDB();
  db.notifications = db.notifications.map(n => {
    if (n.id === id) {
      return { ...n, status };
    }
    return n;
  });
  writeDB(db);
  res.json({ success: true, notifications: db.notifications });
});

app.post("/api/notifications/delete", (req, res) => {
  const { id } = req.body;
  const db = readDB();
  db.notifications = db.notifications.filter(n => n.id !== id);
  writeDB(db);
  res.json({ success: true, notifications: db.notifications });
});

app.get("/api/credentials", (req, res) => {
  const db = readDB();
  res.json({
    credentials: db.credentials,
    statuses: db.statuses
  });
});

app.post("/api/credentials", (req, res) => {
  const creds = req.body;
  const db = readDB();
  db.credentials = { ...db.credentials, ...creds };
  
  // Set default statuses when credentials change
  if (creds.instagram_token && creds.instagram_id) {
    db.statuses.instagram = "Monitoring";
  } else if (!db.credentials.instagram_token) {
    db.statuses.instagram = "Disconnected";
  }

  if (creds.whatsapp_token) {
    db.statuses.whatsapp = "Monitoring";
  } else if (!db.credentials.whatsapp_token) {
    db.statuses.whatsapp = "Disconnected";
  }

  writeDB(db);
  res.json({ success: true, credentials: db.credentials, statuses: db.statuses });
});

// REAL INCOMING MESSAGE PUSHER ENGINE (Webhooks)
function createIncomingNotification(platform: "Instagram" | "WhatsApp", type: "DM" | "Message Request" | "Message", senderName: string, text: string) {
  const db = readDB();
  const now = new Date();
  
  const timeString = now.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }) + ", " + now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  const messageId = "webhook-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  const newNotif = {
    id: messageId,
    platform,
    type,
    sender: senderName || "Inbound Contact",
    message: text || "",
    time: timeString,
    status: "Pending",
    timestamp: Date.now()
  };

  // Add message to beginning of notifications array
  db.notifications.unshift(newNotif);

  // Sync conversation threads
  const thread = db.conversations[senderName] || [];
  db.conversations[senderName] = [
    ...thread,
    {
      id: "msg-" + Date.now(),
      sender: senderName,
      text: text,
      time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      isIncoming: true
    }
  ];

  // Set platform status to connected since it just pushed a message
  if (platform === "Instagram") db.statuses.instagram = "Connected";
  if (platform === "WhatsApp") db.statuses.whatsapp = "Connected";

  writeDB(db);
  console.log(`[REAL WEBHOOK ALERT] Automatically captured incoming ${platform} message from ${senderName}: "${text}"`);
}

// Meta Webhook endpoint validation and receive handler
app.all("/api/webhook/instagram", (req, res) => {
  // Hub challenge validation for Facebook Developer App Setup
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe") {
      console.log("[INSTAGRAM WEBHOOK SUBSCRIPTION CONFIRMED]");
      return res.status(200).send(challenge);
    }
  }

  if (req.method === "POST") {
    const body = req.body;
    console.log("[REAL INSTAGRAM WEBHOOK RECEIVED PAYLOAD]:", JSON.stringify(body));

    try {
      if (body.object === "instagram" && body.entry) {
        for (const entry of body.entry) {
          if (entry.messaging) {
            for (const msg of entry.messaging) {
              if (msg.message && msg.message.text && msg.sender) {
                const senderId = msg.sender.id;
                const text = msg.message.text;
                // Fetch user info or use name placeholder
                createIncomingNotification("Instagram", "DM", `Instagram_User_${senderId}`, text);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Meta validation or parsing error:", e);
    }
    return res.sendStatus(200);
  }

  res.sendStatus(404);
});

// WhatsApp Cloud API & custom Chrome extensions receiver
app.all("/api/webhook/whatsapp", (req, res) => {
  // Hub verify token for Whatsapp Business Webhook configurations
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe") {
      console.log("[WHATSAPP WEBHOOK SUBSCRIPTION CONFIRMED]");
      return res.status(200).send(challenge);
    }
  }

  if (req.method === "POST") {
    const body = req.body;
    console.log("[REAL WHATSAPP WEBHOOK RECEIVED PAYLOAD]:", JSON.stringify(body));

    try {
      let sender = body.sender;
      let text = body.message || body.text;
      let type = body.type || "Message";

      // If standard WhatsApp Business API webhook structure:
      if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const msgObj = body.entry[0].changes[0].value.messages[0];
        const contactObj = body.entry[0].changes[0].value.contacts?.[0];
        sender = contactObj?.profile?.name || msgObj.from || "WhatsApp Client";
        text = msgObj.text?.body || "";
      }

      if (text) {
        createIncomingNotification("WhatsApp", type, sender || "WhatsApp User", text);
      }
    } catch (e) {
      console.error("WhatsApp parsing error:", e);
    }
    return res.sendStatus(200);
  }

  res.sendStatus(404);
});

// BACKGROUND INTEGRATION MONITOR POLLING LOOP (Instagram Web Polling Engine)
async function checkInstagramIncomingMessages() {
  const db = readDB();
  const { instagram_token, instagram_id } = db.credentials;
  if (!instagram_token || !instagram_id) return;

  try {
    console.log(`[INSTAGRAM POLLER] Running active monitor query for ${instagram_id}...`);
    // Query Meta Graph conversations
    const url = `https://graph.facebook.com/v20.0/${instagram_id}/conversations?fields=id,participants,messages.limit(1){message,from,timestamp}&access_token=${instagram_token}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[INSTAGRAM POLLER] FB API returned bad status: ${response.status}`);
      return;
    }
    const data = (await response.json()) as any;
    if (data && data.data) {
      let newlyDetectedMessagesCount = 0;
      for (const conversation of data.data) {
        const lastMsg = conversation.messages?.data?.[0];
        if (lastMsg && lastMsg.message) {
          const messageId = lastMsg.id;
          const senderId = lastMsg.from?.id;
          const senderName = lastMsg.from?.username || lastMsg.from?.name || `InstaUser_${senderId}`;
          const text = lastMsg.message;
          const timestamp = lastMsg.timestamp ? new Date(lastMsg.timestamp).getTime() : Date.now();

          // Skip self outbound messages
          if (senderId === instagram_id) continue;

          // Check if we already logging this message
          const idToken = `insta-msg-${messageId}`;
          const exists = db.notifications.some(n => n.id === idToken);
          if (!exists) {
            const now = new Date(timestamp);
            const timeString = now.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric"
            }) + ", " + now.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
              hour12: true
            });

            const isRequest = conversation.is_associated_with_open_messaging_request === true;
            const newNotif = {
              id: idToken,
              platform: "Instagram" as const,
              type: isRequest ? ("Message Request" as const) : ("DM" as const),
              sender: senderName,
              message: text,
              time: timeString,
              status: "Pending" as const,
              timestamp: timestamp
            };

            db.notifications.unshift(newNotif);

            // Sync thread history
            const thread = db.conversations[senderName] || [];
            db.conversations[senderName] = [
              ...thread,
              {
                id: "msg-" + messageId,
                sender: senderName,
                text: text,
                time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
                isIncoming: true
              }
            ];

            newlyDetectedMessagesCount++;
          }
        }
      }
      
      db.statuses.instagram = "Monitoring";
      if (newlyDetectedMessagesCount > 0) {
        db.statuses.instagram = "Connected";
        console.log(`[INSTAGRAM POLLER] Success! Picked up ${newlyDetectedMessagesCount} new direct alerts.`);
      }
      writeDB(db);
    }
  } catch (error) {
    console.error("[INSTAGRAM POLLER] Network query error:", error);
  }
}

// Continuous poller loop scheduler - runs every 15 seconds
setInterval(() => {
  const db = readDB();
  if (db.credentials.instagram_token && db.credentials.instagram_id) {
    checkInstagramIncomingMessages();
  }
}, 15000);

// START HEALTH ENDPOINTS
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: Date.now() });
});

// GEMINI MODEL FALLBACK HELPER (Supported GenAI models)
const GEMINI_VISION_CHAT_MODELS = ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.7-flash"];

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runGeminiGenerateContentWithFallback(ai: GoogleGenAI, params: any) {
  let lastError: any = null;
  for (const model of GEMINI_VISION_CHAT_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model
        });
        return response;
      } catch (err: any) {
        const is503 = err?.message?.includes("503") || err?.status === "UNAVAILABLE" || err?.code === 503;
        lastError = err;
        if (is503 && attempt === 0) {
          // Short delay on 503 spike before retrying or switching
          await delay(350);
          continue;
        }
        console.warn(`[GEMINI FALLBACK] Model ${model} unavailable, trying next valid model...`);
        break;
      }
    }
  }
  throw lastError;
}

async function runGeminiChatWithFallback(ai: GoogleGenAI, prompt: string, formattedHistory: any[], sysInstruction: string) {
  let lastError: any = null;
  for (const model of GEMINI_VISION_CHAT_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const chatSession = ai.chats.create({
          model,
          config: { systemInstruction: sysInstruction },
          history: formattedHistory
        });
        const response = await chatSession.sendMessage({ message: prompt });
        return response;
      } catch (err: any) {
        const is503 = err?.message?.includes("503") || err?.status === "UNAVAILABLE" || err?.code === 503;
        lastError = err;
        if (is503 && attempt === 0) {
          await delay(350);
          continue;
        }
        console.warn(`[GEMINI CHAT FALLBACK] Model ${model} unavailable, trying next valid model...`);
        break;
      }
    }
  }
  throw lastError;
}

// ZOYA REST API PROXY ENDPOINTS
app.post("/api/zoya/chat", async (req, res) => {
  const { prompt, history } = req.body;
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY. Configure in Settings." });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    const recentHistory = (history || []).slice(-20);
    let formattedHistory: any[] = [];
    let currentRole = "";
    let currentText = "";

    for (const msg of recentHistory) {
      const role = msg.sender === "user" ? "user" : "model";
      if (role === currentRole) {
        currentText += "\n" + msg.text;
      } else {
        if (currentRole !== "") {
          formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
        }
        currentRole = role;
        currentText = msg.text;
      }
    }
    if (currentRole !== "") {
      formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
    }

    if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
      formattedHistory.shift();
    }

    const response = await runGeminiChatWithFallback(ai, prompt, formattedHistory, systemInstruction);
    res.json({ text: response.text || "Ugh, fine. I have nothing to say." });
  } catch (error: any) {
    console.error("Server Zoya Chat Error:", error);
    res.status(500).json({ error: "Zoya AI model temporarily busy. Please try again in a moment." });
  }
});

app.post("/api/zoya/tts", async (req, res) => {
  const { text } = req.body;
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY. Configure in Settings." });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    res.json({ audio: base64Audio });
  } catch (error: any) {
    console.error("Server TTS Error:", error);
    res.status(500).json({ error: error.message || "TTS Error" });
  }
});

// ZOYA VISION ANALYSIS ENDPOINT (Screen & Camera Understanding)
app.post("/api/zoya/vision", async (req, res) => {
  const { imageBase64, prompt } = req.body;
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY. Configure in Settings." });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    // Clean image data prefix if present
    const cleanImage = imageBase64 ? imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "") : null;

    const parts: any[] = [];
    if (cleanImage) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanImage
        }
      });
    }

    const customPrompt = prompt || "Analyze this camera view/screen. What am I looking at? Give a concise, witty, sassy Ultron-style analysis as Zoya.";
    parts.push({ text: customPrompt });

    const response = await runGeminiGenerateContentWithFallback(ai, {
      contents: [{ parts }],
      config: {
        systemInstruction: systemInstruction + " Focus on quick visual analysis with witty observation."
      }
    });

    const analysisText = response.text || "I see something, but my sensors are slightly unimpressed.";

    // Optional TTS audio generation for the vision response
    let base64Audio: string | null = null;
    try {
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: analysisText }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
        },
      });
      base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (e) {
      console.warn("TTS generation inside vision endpoint failed:", e);
    }

    res.json({
      text: analysisText,
      audio: base64Audio
    });
  } catch (error: any) {
    console.error("Server Zoya Vision Error:", error);
    res.status(500).json({ error: "Zoya Vision model temporarily overloaded. Please retry in a few seconds." });
  }
});

// MEMORY SYSTEM ENDPOINTS
app.get("/api/zoya/memory", (req, res) => {
  const db = readDB();
  res.json({ memories: db.memories || [] });
});

app.post("/api/zoya/memory", (req, res) => {
  const { title, content, category } = req.body;
  const db = readDB();
  const newMemory: MemoryItem = {
    id: "mem-" + Date.now(),
    category: category || "note",
    title: title || "New Memory",
    content: content || "",
    time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    timestamp: Date.now()
  };

  db.memories = [newMemory, ...(db.memories || [])];
  writeDB(db);
  res.json({ success: true, memories: db.memories, added: newMemory });
});

app.delete("/api/zoya/memory/:id", (req, res) => {
  const { id } = req.params;
  const db = readDB();
  db.memories = (db.memories || []).filter(m => m.id !== id);
  writeDB(db);
  res.json({ success: true, memories: db.memories });
});

// COMPANION APP ENDPOINTS
app.get("/api/zoya/companion", (req, res) => {
  const db = readDB();
  res.json({ companion: db.companionPairing });
});

app.post("/api/zoya/companion/pair", (req, res) => {
  const { code, deviceName } = req.body;
  const db = readDB();
  if (code === db.companionPairing.pairingCode || code === "784920") {
    db.companionPairing.paired = true;
    db.companionPairing.deviceName = deviceName || "Android Companion x1";
    db.companionPairing.lastSeen = Date.now();
    writeDB(db);
    return res.json({ success: true, paired: true, companion: db.companionPairing });
  }
  res.status(400).json({ success: false, message: "Invalid pairing code." });
});

function setupWebSocket(server: any) {
  const wss = new WebSocketServer({ server, path: "/api/live" });

  wss.on("connection", async (clientWs) => {
    console.log("[WEBSOCKET] Client connected for voice stream");

    if (!process.env.GEMINI_API_KEY) {
      console.error("[WEBSOCKET] Missing GEMINI_API_KEY on server!");
      clientWs.send(JSON.stringify({ error: "Missing GEMINI_API_KEY on server. Please configure it in Settings." }));
      clientWs.close();
      return;
    }

    let session: any = null;
    let isSessionConnected = false;

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{
            functionDeclarations: [
              {
                name: "executeBrowserAction",
                description: "Open a website or perform a browser action (like opening YouTube, Spotify, or WhatsApp). Call this when the user asks to open a site, play a song, or send a message.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp'" },
                    query: { type: Type.STRING, description: "The search query, website name, or message content." },
                    target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                  },
                  required: ["actionType", "query"]
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            console.log("[WEBSOCKET-GEMINI] Connected to Gemini Live API");
            isSessionConnected = true;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ connected: true }));
            }
          },
          onmessage: async (message) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            // Forward relevant parts back to client
            if (message.goAway) {
              console.warn("[WEBSOCKET-GEMINI] Received GoAway signal. Closing...");
              try { clientWs.close(); } catch (e) {}
              return;
            }

            try {
              // Audio output
              const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (base64Audio && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ audio: base64Audio }));
              }

              // Interruption
              if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ interrupted: true }));
              }

              // Text output (transcription of model's spoken turn)
              const userText = message.serverContent?.modelTurn?.parts?.[0]?.text;
              if (userText && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ text: userText }));
              }

              // Tool call
              const functionCalls = message.toolCall?.functionCalls;
              if (functionCalls && functionCalls.length > 0) {
                for (const call of functionCalls) {
                  if (call.name === "executeBrowserAction" && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                      toolCall: {
                        id: call.id,
                        name: call.name,
                        args: call.args
                      }
                    }));
                  }
                }
              }
            } catch (err) {
              console.error("[WEBSOCKET-GEMINI] Error forwarding message:", err);
            }
          },
          onclose: () => {
            console.log("[WEBSOCKET-GEMINI] Gemini Live API closed");
            try { clientWs.close(); } catch (e) {}
          },
          onerror: (err) => {
            console.error("[WEBSOCKET-GEMINI] Gemini Live API error:", err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ error: err.message || "Gemini Live API connection temporary issue." }));
            }
            try { clientWs.close(); } catch (e) {}
          }
        }
      });

    } catch (err: any) {
      console.error("[WEBSOCKET] Failed to connect to Gemini Live:", err);
      clientWs.send(JSON.stringify({ error: err.message || "Failed to initialize Live Session" }));
      clientWs.close();
      return;
    }

    clientWs.on("message", (messageStr) => {
      try {
        const data = JSON.parse(messageStr.toString());
        if (!session || !isSessionConnected) return;

        if (data.audio) {
          session.sendRealtimeInput({
            audio: { data: data.audio, mimeType: "audio/pcm;rate=16000" }
          });
        } else if (data.text) {
          session.sendRealtimeInput({ text: data.text });
        } else if (data.toolResponse) {
          const { name, id, response } = data.toolResponse;
          session.sendToolResponse({
            functionResponses: [{
              name,
              id,
              response
            }]
          });
        }
      } catch (err) {
        console.error("[WEBSOCKET] Error handling client message:", err);
      }
    });

    clientWs.on("close", () => {
      console.log("[WEBSOCKET] Client disconnected");
      if (session) {
        try {
          session.close();
        } catch (e) {}
      }
    });
  });
}

// START EXPRESS/VITE ENGINE INITIALIZATION
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ZOYA FULL-STACK CORE] Running 24/7 on http://localhost:${PORT}`);
  });

  setupWebSocket(server);
}

startServer();

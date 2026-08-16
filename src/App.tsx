import React, { useState, useEffect, useRef } from "react";
import { HolographicOrb } from "./components/HolographicOrb";
import { HUDOverlay } from "./components/HUDOverlay";
import { VisionPanel } from "./components/VisionPanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { CompanionPanel } from "./components/CompanionPanel";
import MonitorDashboard from "./components/MonitorDashboard";
import PermissionModal from "./components/PermissionModal";
import { LiveSessionManager } from "./services/liveService";
import { playPCM } from "./utils/audioUtils";
import { 
  OrbState, 
  UserTrackingData, 
  HandTrackingData, 
  VisionAnalysisResult 
} from "./types/zoya";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // Orb & Cursor Tracking States
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [userTracking, setUserTracking] = useState<UserTrackingData>({
    present: true,
    x: 0,
    y: 0,
    distanceMeters: 1.2,
    headTiltX: 0,
    headTiltY: 0,
    emotion: "focused",
    lastDetectedTimestamp: Date.now(),
  });
  const [handTracking] = useState<HandTrackingData>({
    detected: false,
    gesture: "none",
    x: 0,
    y: 0,
    depthZ: 1.0,
  });

  // Audio Level for Waveform Animation
  const [audioLevel, setAudioLevel] = useState<number>(0.2);

  // Active HUD Panel
  const [activePanel, setActivePanel] = useState<"none" | "vision" | "memory" | "companion">("none");
  const [activeMainTab, setActiveMainTab] = useState<"orb" | "monitoring">("orb");

  // Gemini Live & Chat Voice
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lastTranscript, setLastTranscript] = useState<{ sender: "user" | "zoya"; text: string } | null>({
    sender: "zoya",
    text: "Greetings. I am ZOYA. Microphone systems online and operational."
  });

  // Vision Analysis State (Upload / Screen file analysis)
  const [visionAnalysis, setVisionAnalysis] = useState<VisionAnalysisResult | null>(null);
  const [isAnalyzingVision, setIsAnalyzingVision] = useState<boolean>(false);

  // Modals & Errors
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);

  // Mouse / Pointer Gaze Tracking for 3D Orb interaction
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const normX = (e.clientX / window.innerWidth - 0.5) * 2;
      const normY = (e.clientY / window.innerHeight - 0.5) * 2;

      setUserTracking({
        present: true,
        x: normX,
        y: normY,
        distanceMeters: 1.2,
        headTiltX: normX * 20,
        headTiltY: normY * 18,
        emotion: "focused",
        lastDetectedTimestamp: Date.now(),
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Gemini Vision Analysis Trigger
  const handleAnalyzeVision = async (imageBase64?: string, customPrompt?: string): Promise<VisionAnalysisResult | null> => {
    try {
      setIsAnalyzingVision(true);
      setOrbState("vision");

      const res = await fetch("/api/zoya/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imageBase64 || null,
          prompt: customPrompt || "Analyze what is visible. Give a brief, witty Ultron-style observation as Zoya."
        }),
      });

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const result: VisionAnalysisResult = {
        text: data.text,
        audio: data.audio,
        timestamp: Date.now(),
      };

      setVisionAnalysis(result);
      setLastTranscript({ sender: "zoya", text: data.text });
      setOrbState("speaking");

      // Play audio if returned and not muted
      if (data.audio && !isMuted) {
        await playPCM(data.audio);
      }

      setTimeout(() => setOrbState("idle"), 4000);
      return result;
    } catch (err: any) {
      console.warn("Vision Analysis Warning:", err);
      let cleanMsg = err?.message || "Vision analysis failed";
      if (cleanMsg.includes("503") || cleanMsg.includes("UNAVAILABLE")) {
        cleanMsg = "Vision model high in demand. Retrying or wait a moment.";
      }
      setErrorMessage(cleanMsg);
      setOrbState("idle");
      return null;
    } finally {
      setIsAnalyzingVision(false);
    }
  };

  // Toggle Live Voice Stream
  const toggleLiveVoice = async () => {
    if (isMicActive) {
      setIsMicActive(false);
      setOrbState("idle");
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
    } else {
      try {
        setIsMicActive(true);
        setOrbState("listening");
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        liveSessionRef.current = session;

        session.onStateChange = (state) => {
          if (state === "listening") setOrbState("listening");
          else if (state === "processing") setOrbState("thinking");
          else if (state === "speaking") setOrbState("speaking");
          else setOrbState("idle");
        };

        session.onMessage = (sender, text) => {
          setLastTranscript({ sender, text });
        };

        session.onCommand = (url) => {
          setTimeout(() => {
            window.open(url, "_blank");
          }, 1000);
        };

        session.onClose = () => {
          setIsMicActive(false);
          setOrbState("idle");
        };

        session.onError = (err) => {
          console.warn("Live Voice Session notice:", err);
          const msg = typeof err === "string" ? err : err?.message || "";
          if (msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("denied")) {
            setIsMicActive(false);
            setOrbState("idle");
            setShowPermissionModal(true);
          }
        };

        await session.start();
      } catch (err: any) {
        console.error("Failed to start Live Voice:", err);
        setIsMicActive(false);
        setOrbState("idle");
        if (err?.name === "NotAllowedError" || err?.message?.includes("Permission") || err?.message?.includes("denied")) {
          setShowPermissionModal(true);
        } else {
          setErrorMessage("Microphone access issue: " + (err.message || "Please grant mic permission."));
        }
      }
    }
  };

  // Remote Companion Commands
  const handleRemoteCommand = (cmd: string) => {
    switch (cmd) {
      case "wake":
        setOrbState("listening");
        setLastTranscript({ sender: "zoya", text: "Remote Companion command received: Systems Awake." });
        break;
      case "vision":
        setActivePanel("vision");
        handleAnalyzeVision();
        break;
      case "silence":
        setIsMuted(true);
        setOrbState("idle");
        setLastTranscript({ sender: "zoya", text: "System Muted via Mobile Companion." });
        break;
      default:
        break;
    }
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#020408] text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0 selection:bg-red-500/30">
      {showPermissionModal && (
        <PermissionModal onClose={() => setShowPermissionModal(false)} />
      )}

      {/* Cyber Scanline Overlay */}
      <div className="scanline-overlay absolute inset-0 z-0 opacity-40 pointer-events-none" />

      {/* Main Mode Navigation Header */}
      <div className="absolute top-4 right-6 z-30 flex items-center gap-2">
        <button
          onClick={() => setActiveMainTab("orb")}
          className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold tracking-wider transition-all ${
            activeMainTab === "orb"
              ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20"
              : "bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white"
          }`}
        >
          ORB CORE
        </button>
        <button
          onClick={() => setActiveMainTab("monitoring")}
          className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold tracking-wider transition-all ${
            activeMainTab === "monitoring"
              ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20"
              : "bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white"
          }`}
        >
          MESSAGE MONITORING
        </button>
      </div>

      {activeMainTab === "monitoring" ? (
        <div className="w-full h-full pt-16 z-20">
          <MonitorDashboard />
        </div>
      ) : (
        <>
          {/* 3D Holographic Orb Canvas Stage */}
          <div className="absolute inset-0 z-0 flex items-center justify-center">
            <HolographicOrb
              orbState={orbState}
              userTracking={userTracking}
              handTracking={handTracking}
              audioLevel={audioLevel}
            />
          </div>

          {/* Ultron HUD Overlay */}
          <HUDOverlay
            orbState={orbState}
            onSelectOrbState={setOrbState}
            userTracking={userTracking}
            handTracking={handTracking}
            isMicActive={isMicActive}
            onToggleMic={toggleLiveVoice}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
            activePanel={activePanel}
            onSelectPanel={setActivePanel}
            lastTranscript={lastTranscript}
            audioLevel={audioLevel}
          />

          {/* Modal / Slide-Over HUD Panels */}
          <AnimatePresence>
            {activePanel !== "none" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
              >
                {activePanel === "vision" && (
                  <VisionPanel
                    onAnalyzeVision={handleAnalyzeVision}
                    currentAnalysis={visionAnalysis}
                    isAnalyzing={isAnalyzingVision}
                    onClose={() => setActivePanel("none")}
                  />
                )}
                {activePanel === "memory" && (
                  <MemoryPanel onClose={() => setActivePanel("none")} />
                )}
                {activePanel === "companion" && (
                  <CompanionPanel
                    onClose={() => setActivePanel("none")}
                    onRemoteCommand={handleRemoteCommand}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Error Toast Notification */}
      {errorMessage && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 bg-red-950/90 text-red-200 border border-red-500/50 px-6 py-2.5 rounded-full text-xs font-mono flex items-center gap-3 shadow-2xl">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
}

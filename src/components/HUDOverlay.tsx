import React from "react";
import { 
  OrbState, 
  GestureType, 
  UserTrackingData, 
  HandTrackingData 
} from "../types/zoya";
import { 
  Mic, 
  MicOff, 
  Eye, 
  Database, 
  Smartphone, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Radio, 
  ShieldAlert, 
  Hand, 
  Activity, 
  Cpu, 
  Zap,
  Maximize2
} from "lucide-react";

interface HUDOverlayProps {
  orbState: OrbState;
  onSelectOrbState: (state: OrbState) => void;
  userTracking: UserTrackingData;
  handTracking: HandTrackingData;
  isMicActive: boolean;
  onToggleMic: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  activePanel: "none" | "vision" | "memory" | "companion";
  onSelectPanel: (panel: "none" | "vision" | "memory" | "companion") => void;
  lastTranscript: { sender: "user" | "zoya"; text: string } | null;
  audioLevel: number;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  orbState,
  onSelectOrbState,
  userTracking,
  handTracking,
  isMicActive,
  onToggleMic,
  isMuted,
  onToggleMute,
  activePanel,
  onSelectPanel,
  lastTranscript,
  audioLevel,
}) => {
  const getOrbStateBadge = (state: OrbState) => {
    switch (state) {
      case "listening":
        return <span className="text-cyan-400 bg-cyan-950/80 border border-cyan-500/50 px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 animate-ping" /> LISTENING</span>;
      case "thinking":
        return <span className="text-purple-400 bg-purple-950/80 border border-purple-500/50 px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 animate-spin" /> THINKING</span>;
      case "speaking":
        return <span className="text-red-400 bg-red-950/80 border border-red-500/50 px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5 animate-bounce" /> SPEAKING</span>;
      case "alert":
        return <span className="text-red-500 bg-red-950/90 border border-red-500 px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1.5 font-bold"><ShieldAlert className="w-3.5 h-3.5 animate-pulse" /> ALERT SYSTEM</span>;
      case "vision":
        return <span className="text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 animate-pulse" /> VISION ANALYSIS</span>;
      case "idle":
      default:
        return <span className="text-slate-400 bg-slate-900/80 border border-slate-700 px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-cyan-400" /> IDLE CORE</span>;
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6 z-10 select-none">
      {/* TOP HUD BAR */}
      <div className="flex items-start justify-between w-full gap-4">
        {/* Left System Info Badge */}
        <div className="ultron-glass rounded-xl p-3 px-4 border border-cyan-500/30 text-cyan-200 pointer-events-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <h1 className="font-display font-black tracking-widest text-sm text-cyan-100">
              ZOYA <span className="text-red-500 text-xs font-mono">v4.0 OS</span>
            </h1>
          </div>

          <div className="hidden sm:flex items-center gap-3 border-l border-cyan-500/30 pl-4 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> FPS: 60
            </span>
            <span className="flex items-center gap-1">
              DIST: {userTracking.distanceMeters.toFixed(1)}m
            </span>
            <span className="text-cyan-300 capitalize">
              MODE: {userTracking.emotion}
            </span>
          </div>
        </div>

        {/* Center Current Orb State Pill */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/80 p-1.5 px-3 rounded-full border border-cyan-500/30 shadow-xl">
          {getOrbStateBadge(orbState)}
        </div>

        {/* Right Quick State Selector for Video & Testing */}
        <div className="ultron-glass rounded-xl p-2 px-3 border border-cyan-500/30 pointer-events-auto flex items-center gap-1 text-[11px] font-mono">
          <span className="text-slate-400 mr-1 hidden md:inline">STATE:</span>
          {(["idle", "listening", "thinking", "speaking", "alert", "vision"] as OrbState[]).map((s) => (
            <button
              key={s}
              onClick={() => onSelectOrbState(s)}
              className={`px-2 py-0.5 rounded capitalize transition-all ${
                orbState === s
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* CENTER DIALOGUE & TRANSCRIPT SUBTITLE BOX */}
      {lastTranscript && (
        <div className="self-center max-w-xl w-full my-auto pointer-events-auto transform transition-all duration-300">
          <div className="ultron-glass-cyan rounded-2xl p-4 border border-cyan-400/40 shadow-2xl backdrop-blur-xl relative flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400 uppercase tracking-widest border-b border-cyan-500/20 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-red-500 animate-spin" />
                {lastTranscript.sender === "zoya" ? "ZOYA AI RESPONSE" : "USER VOICE INPUT"}
              </span>

              {/* Audio Waveform Indicator */}
              <div className="flex items-center gap-1 h-3">
                {[0.4, 0.8, 0.3, 0.9, 0.5, 0.7].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-cyan-400 rounded-full transition-all duration-100"
                    style={{
                      height: `${Math.max(3, h * audioLevel * 16)}px`,
                      backgroundColor: lastTranscript.sender === "zoya" ? "#ef4444" : "#06b6d4",
                    }}
                  />
                ))}
              </div>
            </div>

            <p className="font-sans text-sm sm:text-base text-cyan-50 font-medium leading-relaxed">
              "{lastTranscript.text}"
            </p>
          </div>
        </div>
      )}

      {/* BOTTOM HUD ACTION & PANEL CONTROL BAR */}
      <div className="flex items-end justify-between w-full gap-4">
        {/* Active Audio / Voice Engine Status Badge */}
        <div className="ultron-glass rounded-xl p-3 border border-cyan-500/30 text-xs font-mono text-cyan-200 pointer-events-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Radio className={`w-4 h-4 ${isMicActive ? "text-red-400 animate-pulse" : "text-cyan-400"}`} />
            <span>VOICE ENGINE:</span>
          </div>
          <span className={`font-bold uppercase ${isMicActive ? "text-red-400" : "text-cyan-300"}`}>
            {isMicActive ? "MIC STREAMING" : "STANDBY"}
          </span>
          <div className="hidden sm:flex items-center gap-0.5 h-3 pl-2 border-l border-cyan-500/30">
            {[0.3, 0.7, 1.0, 0.5, 0.8].map((lvl, idx) => (
              <div
                key={idx}
                className={`w-1 rounded-full transition-all duration-75 ${
                  isMicActive ? "bg-red-400" : "bg-cyan-500/40"
                }`}
                style={{
                  height: isMicActive ? `${Math.max(4, lvl * 14)}px` : "4px",
                }}
              />
            ))}
          </div>
        </div>

        {/* Floating Quick Action Buttons */}
        <div className="pointer-events-auto ultron-glass rounded-2xl p-2 px-4 border border-cyan-500/40 flex items-center gap-3 shadow-2xl backdrop-blur-2xl">
          {/* Voice Mic Button */}
          <button
            onClick={onToggleMic}
            className={`p-3 rounded-xl border font-mono text-xs flex items-center gap-2 transition-all ${
              isMicActive
                ? "bg-red-500/20 border-red-500 text-red-300 hover:bg-red-500/30 animate-pulse"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
            }`}
            title="Toggle Gemini Live Voice"
          >
            {isMicActive ? <Mic className="w-4 h-4 text-red-400" /> : <MicOff className="w-4 h-4" />}
            <span className="hidden sm:inline font-bold">{isMicActive ? "MIC LIVE" : "MIC OFF"}</span>
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={onToggleMute}
            className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition-all"
            title="Toggle Mute"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          <div className="h-6 w-px bg-slate-700 mx-1" />

          {/* Panel Controls */}
          <button
            onClick={() => onSelectPanel(activePanel === "vision" ? "none" : "vision")}
            className={`p-2.5 px-3 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-all ${
              activePanel === "vision"
                ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400"
                : "bg-slate-900 border-slate-700 text-cyan-300 hover:bg-slate-800"
            }`}
          >
            <Eye className="w-4 h-4" />
            <span className="hidden md:inline">VISION</span>
          </button>

          <button
            onClick={() => onSelectPanel(activePanel === "memory" ? "none" : "memory")}
            className={`p-2.5 px-3 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-all ${
              activePanel === "memory"
                ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400"
                : "bg-slate-900 border-slate-700 text-cyan-300 hover:bg-slate-800"
            }`}
          >
            <Database className="w-4 h-4" />
            <span className="hidden md:inline">MEMORY</span>
          </button>

          <button
            onClick={() => onSelectPanel(activePanel === "companion" ? "none" : "companion")}
            className={`p-2.5 px-3 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-all ${
              activePanel === "companion"
                ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400"
                : "bg-slate-900 border-slate-700 text-cyan-300 hover:bg-slate-800"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden md:inline">COMPANION</span>
          </button>
        </div>
      </div>
    </div>
  );
};

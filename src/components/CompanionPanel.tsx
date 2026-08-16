import React, { useState, useEffect } from "react";
import { Smartphone, Wifi, ShieldCheck, QrCode, RefreshCw, Send, Radio, Lock } from "lucide-react";
import { CompanionState } from "../types/zoya";

interface CompanionPanelProps {
  onClose: () => void;
  onRemoteCommand: (command: string) => void;
}

export const CompanionPanel: React.FC<CompanionPanelProps> = ({ onClose, onRemoteCommand }) => {
  const [companion, setCompanion] = useState<CompanionState>({
    paired: true,
    pairingCode: "784920",
    deviceName: "Android Companion v2.4",
    lastSeen: Date.now(),
  });
  const [inputCode, setInputCode] = useState("");
  const [pairingMessage, setPairingMessage] = useState("");

  useEffect(() => {
    fetchCompanionStatus();
  }, []);

  const fetchCompanionStatus = async () => {
    try {
      const res = await fetch("/api/zoya/companion");
      const data = await res.json();
      if (data.companion) {
        setCompanion(data.companion);
      }
    } catch (e) {
      console.error("Error loading companion info:", e);
    }
  };

  const handlePair = async () => {
    try {
      const res = await fetch("/api/zoya/companion/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inputCode, deviceName: "Mobile Device App" }),
      });
      const data = await res.json();
      if (data.success) {
        setCompanion(data.companion);
        setPairingMessage("Companion Device Successfully Linked!");
      } else {
        setPairingMessage(data.message || "Pairing failed. Try 784920.");
      }
    } catch (e) {
      setPairingMessage("Pairing failed. Server error.");
    }
  };

  return (
    <div className="ultron-glass rounded-2xl p-6 w-full max-w-lg text-white border border-cyan-500/30 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-cyan-200 tracking-wider">
              ANDROID COMPANION LINK
            </h2>
            <p className="text-xs text-slate-400 font-tech">
              Multi-Device Secure Pairing & WiFi Auto-Discovery
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/50 text-xs font-mono border border-slate-700"
        >
          [CLOSE]
        </button>
      </div>

      {/* Pairing Code & QR HUD Card */}
      <div className="bg-slate-950/80 rounded-xl p-4 border border-cyan-500/30 mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            SECURE PAIRING CODE:
          </span>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
            {companion.paired ? "LINKED & ONLINE" : "AWAITING PAIRING"}
          </span>
        </div>

        <div className="flex items-center justify-between bg-black/60 p-3 rounded-lg border border-cyan-500/20">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-mono">6-DIGIT CODE</span>
            <span className="font-display text-2xl font-black text-cyan-300 tracking-widest">
              {companion.pairingCode}
            </span>
          </div>
          <div className="w-14 h-14 bg-white p-1 rounded flex items-center justify-center shadow-lg">
            <QrCode className="w-full h-full text-black" />
          </div>
        </div>

        {/* Device Name Info */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Connected Device:</span>
          <span className="text-cyan-200 font-bold">{companion.deviceName || "None"}</span>
        </div>
      </div>

      {/* Pair New Device Input */}
      {!companion.paired && (
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 mb-4 flex flex-col gap-2">
          <span className="text-xs font-mono text-cyan-300">Enter Code on Mobile App:</span>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="784920"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-white"
            />
            <button
              onClick={handlePair}
              className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display text-xs font-bold rounded"
            >
              PAIR
            </button>
          </div>
          {pairingMessage && <span className="text-[10px] font-mono text-emerald-400">{pairingMessage}</span>}
        </div>
      )}

      {/* Remote Quick Command Controls */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
          Remote Mobile Controls:
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { label: "WAKE ZOYA", cmd: "wake" },
            { label: "SCAN VISION", cmd: "vision" },
            { label: "SILENCE ORB", cmd: "silence" },
            { label: "SUMMARY MEMORY", cmd: "summary" },
          ].map((item) => (
            <button
              key={item.cmd}
              onClick={() => onRemoteCommand(item.cmd)}
              className="p-2.5 rounded-lg bg-slate-900/80 hover:bg-cyan-950/60 border border-cyan-500/30 text-cyan-200 text-left transition-all flex items-center justify-between group"
            >
              <span className="font-mono text-xs font-bold">{item.label}</span>
              <Send className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

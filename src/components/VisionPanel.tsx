import React, { useState } from "react";
import { Sparkles, Scan, Eye, FileText, Image as ImageIcon, Volume2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { VisionAnalysisResult } from "../types/zoya";

interface VisionPanelProps {
  onAnalyzeVision: (imageBase64?: string, prompt?: string) => Promise<VisionAnalysisResult | null>;
  currentAnalysis: VisionAnalysisResult | null;
  isAnalyzing: boolean;
  onClose: () => void;
}

export const VisionPanel: React.FC<VisionPanelProps> = ({
  onAnalyzeVision,
  currentAnalysis,
  isAnalyzing,
  onClose,
}) => {
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRunAnalysis = async (promptText?: string) => {
    const textToRun = promptText || customPrompt || "Zoya, analyze what is visible in this frame.";
    await onAnalyzeVision(selectedImage || undefined, textToRun);
  };

  return (
    <div className="ultron-glass rounded-2xl p-6 w-full max-w-2xl text-white border border-cyan-500/30 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center">
            <Eye className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-cyan-200 tracking-wider">
              ZOYA VISION SCANNER
            </h2>
            <p className="text-xs text-slate-400 font-tech">
              Gemini Multimodal Image & Document Analysis
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/50 text-xs font-mono border border-slate-700"
        >
          [ESC / CLOSE]
        </button>
      </div>

      {/* Preset Quick Vision Queries */}
      <div className="mb-4">
        <label className="text-xs font-mono text-cyan-400 uppercase tracking-wider block mb-2">
          Quick Vision Presets:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            "What am I looking at?",
            "Review this design",
            "Analyze this chart",
            "Explain this screen"
          ].map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setCustomPrompt(preset);
                handleRunAnalysis(preset);
              }}
              disabled={isAnalyzing}
              className="p-2 rounded.lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-200 text-left transition-all flex items-center justify-between group disabled:opacity-50"
            >
              <span className="truncate">{preset}</span>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            </button>
          ))}
        </div>
      </div>

      {/* Custom Prompt & Image Upload Area */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Ask Zoya about what's on your screen or webcam..."
            className="flex-1 bg-slate-950/80 border border-cyan-500/40 rounded-xl px-4 py-2.5 text-xs text-cyan-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
            onKeyDown={(e) => e.key === "Enter" && handleRunAnalysis()}
          />
          <label className="cursor-pointer bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/40 rounded-xl px-3 flex items-center gap-1.5 text-xs text-cyan-300 font-mono transition-all">
            <ImageIcon className="w-4 h-4 text-cyan-400" />
            <span>{selectedImage ? "Image Loaded" : "Upload Image"}</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
          <button
            onClick={() => handleRunAnalysis()}
            disabled={isAnalyzing}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-display text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                ANALYZING...
              </>
            ) : (
              <>
                <Scan className="w-4 h-4" />
                ANALYZE
              </>
            )}
          </button>
        </div>

        {selectedImage && (
          <div className="relative w-full h-28 bg-slate-950 rounded-xl overflow-hidden border border-cyan-500/30 flex items-center justify-center group">
            <img src={selectedImage} alt="Uploaded frame" className="h-full object-contain" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 bg-red-900/80 text-red-200 text-[10px] px-2 py-0.5 rounded font-mono border border-red-500/40"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Analysis Output Box */}
      {currentAnalysis ? (
        <div className="bg-slate-950/80 rounded-xl p-4 border border-cyan-500/40 relative">
          <div className="flex items-center justify-between mb-2 text-xs font-mono text-cyan-400 border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ZOYA VISUAL DIAGNOSTIC RESULT
            </span>
            {currentAnalysis.audio && (
              <span className="flex items-center gap-1 text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded text-[10px] border border-emerald-500/30">
                <Volume2 className="w-3 h-3 animate-pulse" /> Audio Voice Played
              </span>
            )}
          </div>
          <div className="text-sm font-sans leading-relaxed text-cyan-100 whitespace-pre-wrap">
            {currentAnalysis.text}
          </div>
        </div>
      ) : isAnalyzing ? (
        <div className="bg-slate-950/60 rounded-xl p-8 border border-cyan-500/30 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin flex items-center justify-center">
            <Scan className="w-6 h-6 text-cyan-400" />
          </div>
          <p className="font-display text-xs text-cyan-300 tracking-wider">
            ZOYA VISION API IS SCANNING MATRIX FRAME DATA...
          </p>
        </div>
      ) : (
        <div className="bg-slate-950/40 rounded-xl p-6 border border-slate-800/80 text-center text-slate-500 text-xs font-mono">
          Click any preset above or snap your webcam to trigger real-time multimodal AI analysis.
        </div>
      )}
    </div>
  );
};

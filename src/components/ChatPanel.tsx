import React, { useState, useRef, useEffect } from "react";
import { Send, MessageSquare, Bot, User, Volume2, X, Sparkles, CornerDownLeft, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface ChatMessage {
  id: string;
  sender: "user" | "zoya";
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onSpeakMessage: (text: string) => void;
  isThinking: boolean;
  isSpeaking: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onSpeakMessage,
  isThinking,
  isSpeaking,
}) => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickPrompts = [
    "Hello Zoya, introduce yourself!",
    "Tell me a sassy joke.",
    "Open YouTube and search latest tech news.",
    "What is your mood today, Zoya?",
    "Give me some quick motivation.",
  ];

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, messages, isThinking]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isThinking) return;

    setInputText("");
    await onSendMessage(text);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputText("");
    onSendMessage(prompt);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-x-3 bottom-20 sm:bottom-24 sm:right-6 sm:left-auto sm:w-[440px] max-h-[75vh] h-[540px] z-40 ultron-glass rounded-2xl border border-cyan-500/40 shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl bg-slate-950/90 text-white font-sans"
      >
        {/* Header */}
        <div className="p-3.5 px-4 bg-slate-900/90 border-b border-cyan-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-sm tracking-wider text-cyan-100">
                  ZOYA CHAT INTERFACE
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                  VOICE-ENABLED
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {isSpeaking
                  ? "🎙️ Zoya is speaking..."
                  : isThinking
                  ? "⚡ Zoya is thinking..."
                  : "Type a prompt — Zoya will reply and speak out loud"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700"
            title="Close Chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans text-xs scrollbar-thin scrollbar-thumb-slate-800">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-6 px-4">
              <Bot className="w-10 h-10 text-cyan-400/60 mb-2 animate-pulse" />
              <p className="font-semibold text-slate-300 text-sm">Chat with Zoya AI</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[280px]">
                Type anything below. Zoya will respond with her witty personality and read her answer out loud!
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "zoya" && (
                  <div className="w-6 h-6 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-300 flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-xl p-3 text-xs leading-relaxed shadow-lg ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none border border-cyan-400/30"
                      : "bg-slate-900/90 text-slate-200 rounded-bl-none border border-cyan-500/30 font-mono"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  
                  {msg.sender === "zoya" && (
                    <div className="mt-2 pt-1.5 border-t border-cyan-900/40 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="text-cyan-400/80 font-tech">ZOYA VOICE</span>
                      <button
                        onClick={() => onSpeakMessage(msg.text)}
                        className="p-1 rounded bg-slate-800 hover:bg-cyan-950 text-cyan-300 hover:text-cyan-100 flex items-center gap-1 transition-all"
                        title="Replay Voice Audio"
                      >
                        <Volume2 className="w-3 h-3" /> Speak
                      </button>
                    </div>
                  )}
                </div>

                {msg.sender === "user" && (
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 flex-shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))
          )}

          {isThinking && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-6 h-6 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-300 flex-shrink-0 mt-0.5 animate-spin">
                <Loader2 className="w-3.5 h-3.5" />
              </div>
              <div className="bg-slate-900/90 text-cyan-300 rounded-xl p-2.5 px-3 border border-cyan-500/30 font-mono text-xs flex items-center gap-2">
                <span>Zoya is processing your thought...</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Carousel */}
        <div className="px-3 py-1.5 bg-slate-950/60 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 flex-shrink-0">
            <Sparkles className="w-2.5 h-2.5 text-cyan-400" /> QUICK:
          </span>
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickPrompt(p)}
              disabled={isThinking}
              className="px-2 py-1 rounded-lg bg-slate-900/90 hover:bg-cyan-950 border border-cyan-500/20 hover:border-cyan-400/40 text-[10px] text-slate-300 hover:text-cyan-200 whitespace-nowrap transition-all disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} className="p-2.5 px-3 bg-slate-900/90 border-t border-cyan-500/30 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message to Zoya..."
            disabled={isThinking}
            className="flex-1 bg-slate-950/80 border border-cyan-500/30 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 outline-none transition-all font-mono"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="p-2 px-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold transition-all shadow-lg flex items-center gap-1.5 text-xs active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SEND</span>
          </button>
        </form>
      </motion.div>
    </AnimatePresence>
  );
};

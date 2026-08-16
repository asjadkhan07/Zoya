import React, { useState, useEffect } from "react";
import { Database, Plus, Trash2, Tag, Bookmark, Bell, Settings, Terminal, Check } from "lucide-react";
import { MemoryItem } from "../types/zoya";

interface MemoryPanelProps {
  onClose: () => void;
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({ onClose }) => {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Memory Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<"note" | "reminder" | "preference" | "command">("note");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/zoya/memory");
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (e) {
      console.error("Error fetching memory bank:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      setIsAdding(true);
      const res = await fetch("/api/zoya/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, category }),
      });
      const data = await res.json();
      setMemories(data.memories || []);
      setTitle("");
      setContent("");
    } catch (e) {
      console.error("Error adding memory:", e);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const res = await fetch(`/api/zoya/memory/${id}`, { method: "DELETE" });
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (e) {
      console.error("Error deleting memory:", e);
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "reminder":
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1"><Bell className="w-3 h-3" /> REMINDER</span>;
      case "preference":
        return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1"><Settings className="w-3 h-3" /> PREFERENCE</span>;
      case "command":
        return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1"><Terminal className="w-3 h-3" /> COMMAND</span>;
      default:
        return <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1"><Bookmark className="w-3 h-3" /> NOTE</span>;
    }
  };

  return (
    <div className="ultron-glass rounded-2xl p-6 w-full max-w-2xl text-white border border-cyan-500/30 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center">
            <Database className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-cyan-200 tracking-wider">
              ZOYA PERSISTENT MEMORY BANK
            </h2>
            <p className="text-xs text-slate-400 font-tech">
              Encrypted Firebase & Local Data Synchronization Engine
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

      {/* Add Memory Form */}
      <form onSubmit={handleAddMemory} className="bg-slate-950/80 p-4 rounded-xl border border-cyan-500/30 mb-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Store New Memory Unit
          </span>
          <div className="flex gap-1.5">
            {(["note", "reminder", "preference", "command"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all ${
                  category === cat
                    ? "bg-cyan-500 text-slate-950 font-bold"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Title / Key"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
          />
          <input
            type="text"
            placeholder="Content / Note details..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="sm:col-span-2 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isAdding || !title.trim() || !content.trim()}
          className="w-full py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-950 font-display text-xs font-bold rounded-lg transition-all shadow disabled:opacity-50"
        >
          {isAdding ? "SAVING TO MEMORY..." : "SAVE MEMORY ENTRY"}
        </button>
      </form>

      {/* Memory List */}
      <div className="max-h-72 overflow-y-auto pr-1 flex flex-col gap-2.5 scrollbar-hide">
        {isLoading ? (
          <div className="p-8 text-center text-xs font-mono text-cyan-400">Loading memory records...</div>
        ) : memories.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-slate-500">No memory units stored yet.</div>
        ) : (
          memories.map((mem) => (
            <div
              key={mem.id}
              className="bg-slate-950/60 hover:bg-slate-950/90 rounded-xl p-3 border border-cyan-900/50 hover:border-cyan-500/40 flex items-start justify-between gap-3 transition-all group"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {getCategoryBadge(mem.category)}
                  <h3 className="font-display text-xs font-bold text-cyan-100">{mem.title}</h3>
                  <span className="text-[10px] text-slate-500 font-mono">{mem.time}</span>
                </div>
                <p className="text-xs text-slate-300 font-sans leading-relaxed">{mem.content}</p>
              </div>

              <button
                onClick={() => handleDeleteMemory(mem.id)}
                className="text-slate-600 hover:text-red-400 p-1 rounded hover:bg-red-950/30 transition-all opacity-60 group-hover:opacity-100"
                title="Delete memory record"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

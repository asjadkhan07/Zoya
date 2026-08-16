import React, { useState, useEffect } from "react";
import { 
  Bell, Instagram, Check, Eye, Trash2, 
  ArrowRight, ArrowLeft, User, Clock, 
  Activity, RefreshCw, Copy, CheckSquare, 
  Smartphone, ShieldCheck, Settings, Link, Database, Save, Loader2 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MonitorNotification, ConversationMessage } from "../types/monitor";
import { playAlertSound } from "../utils/beep";
import { 
  fetchQueueNotifications, 
  updateNotificationStatus, 
  deleteNotificationById, 
  fetchCredentials, 
  saveCredentials 
} from "../services/monitorService";

export default function MonitorDashboard() {
  const [notifications, setNotifications] = useState<MonitorNotification[]>([]);
  const [conversations, setConversations] = useState<Record<string, ConversationMessage[]>>({});
  const [activeTab, setActiveTab] = useState<"all" | "Instagram" | "WhatsApp">("all");
  const [isLoading, setIsLoading] = useState(true);
  
  // Real platform Connection status states from server
  const [platformStatuses, setPlatformStatuses] = useState<{
    instagram: "Connected" | "Disconnected" | "Monitoring";
    whatsapp: "Connected" | "Disconnected" | "Monitoring";
  }>({
    instagram: "Disconnected",
    whatsapp: "Disconnected"
  });

  // Credentials config inputs
  const [instaToken, setInstaToken] = useState("");
  const [instaId, setInstaId] = useState("");
  const [whatsappToken, setWhatsappToken] = useState("");
  const [whatsappId, setWhatsappId] = useState("");

  const [savingCreds, setSavingCreds] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(true);

  // Detailed overlay check for current incoming message
  const [newArrivalOverlay, setNewArrivalOverlay] = useState<MonitorNotification | null>(null);
  const [focusedNotification, setFocusedNotification] = useState<MonitorNotification | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);

  // Keep a reference of previously seen message IDs to determine if we got a brand new one to pop the alert!
  const processedMessageIdsRef = React.useRef<Set<string>>(new Set());

  // Function to load elements from central core server
  const loadDashboardData = async (isInitial = false) => {
    try {
      if (isInitial) setIsLoading(true);
      
      const serverNotifs = await fetchQueueNotifications();
      setNotifications(serverNotifs);

      // Reconstruct simple conversation maps from active notification bodies for preview comfort
      const convos: Record<string, ConversationMessage[]> = {};
      serverNotifs.forEach(notif => {
        if (!convos[notif.sender]) {
          convos[notif.sender] = [
            {
              id: `msg-${notif.id}`,
              sender: notif.sender,
              text: notif.message,
              time: notif.time.includes(", ") ? notif.time.split(", ")[1] : notif.time,
              isIncoming: true
            }
          ];
        }
      });
      setConversations(convos);

      // Check for brand new outbound arrivals to trigger screen popup
      if (!isInitial && serverNotifs.length > 0) {
        const latestNotif = serverNotifs[0];
        if (latestNotif.status === "Pending" && !processedMessageIdsRef.current.has(latestNotif.id)) {
          playAlertSound("new_message");
          setNewArrivalOverlay(latestNotif);
          setTimeout(() => setNewArrivalOverlay(null), 6000);
        }
      }

      // Sync processed cache set
      const newSet = new Set<string>();
      serverNotifs.forEach(n => newSet.add(n.id));
      processedMessageIdsRef.current = newSet;

      // Pull credential metadata too
      const { credentials, statuses } = await fetchCredentials();
      if (isInitial) {
        setInstaToken(credentials.instagram_token || "");
        setInstaId(credentials.instagram_id || "");
        setWhatsappToken(credentials.whatsapp_token || "");
        setWhatsappId(credentials.whatsapp_id || "");
      }
      setPlatformStatuses(statuses || { instagram: "Disconnected", whatsapp: "Disconnected" });

    } catch (e) {
      console.warn("Unable to fetch data from live Express backend poller:", e);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  };

  // Run initial pull and spin up short polling loop
  useEffect(() => {
    loadDashboardData(true);

    const timer = setInterval(() => {
      loadDashboardData(false);
    }, 3000); // 3-seconds reactive refresh loop

    return () => clearInterval(timer);
  }, []);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreds(true);
    try {
      await saveCredentials({
        instagram_token: instaToken.trim() || undefined,
        instagram_id: instaId.trim() || undefined,
        whatsapp_token: whatsappToken.trim() || undefined,
        whatsapp_id: whatsappId.trim() || undefined
      });
      playAlertSound("handled");
      // Force instant refresh
      await loadDashboardData(false);
    } catch (err) {
      alert("Failed to update credentials. Please check server state.");
    } finally {
      setSavingCreds(false);
    }
  };

  // Generate copy text formatted dump
  const getNotificationTextFormat = (notif: MonitorNotification) => {
    return `📩 REAL-TIME INBOUND ENVELOPE\n\n` + 
           `Platform: ${notif.platform}\n` + 
           `Channel Type: ${notif.type}\n` +
           `Sender name: ${notif.sender}\n` + 
           `Inbound payload:\n"${notif.message}"\n\n` + 
           `Dispatched: ${notif.time}\n` + 
           `Priority State: PENDING OWNER DEEP-DIVE`;
  };

  const handleCopyText = (notif: MonitorNotification) => {
    const textToCopy = getNotificationTextFormat(notif);
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(notif.id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
      console.error("Paste helper error:", err);
    });
  };

  // Core ticket navigation flows
  const updateStatus = async (id: string, newStatus: "Pending" | "Seen" | "Handled") => {
    try {
      const result = await updateNotificationStatus(id, newStatus);
      setNotifications(result.notifications || []);
      
      if (newStatus === "Seen") {
        playAlertSound("seen");
      } else if (newStatus === "Handled") {
        playAlertSound("handled");
      }
      
      // Sync focus modal if open
      if (focusedNotification?.id === id) {
        setFocusedNotification(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const result = await deleteNotificationById(id);
      setNotifications(result.notifications || []);
      playAlertSound("click");
      if (focusedNotification?.id === id) {
        setFocusedNotification(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Status statistics
  const countPending = notifications.filter(n => n.status === "Pending").length;
  const countSeen = notifications.filter(n => n.status === "Seen").length;
  const countHandled = notifications.filter(n => n.status === "Handled").length;

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === "all") return true;
    return n.platform === activeTab;
  });

  const appOrigin = window.location.origin;
  const instagramWebhookUrl = `${appOrigin}/api/webhook/instagram`;
  const whatsappWebhookUrl = `${appOrigin}/api/webhook/whatsapp`;

  const copyUrlToClipboard = (url: string, key: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedWebhook(key);
      setTimeout(() => setCopiedWebhook(null), 2000);
    });
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-6 p-4 md:p-6 text-white overflow-hidden font-sans bg-[#020508]/40 backdrop-blur-md relative">
      
      {/* LEFT COLUMN: ACTIVE INTEGRATIONS & LIVE WEBHOOK PORTALS */}
      <div className="w-full md:w-[350px] xl:w-[390px] shrink-0 flex flex-col gap-5 overflow-y-auto pr-1 select-none border-b md:border-b-0 md:border-r border-white/5 pb-4 md:pb-0 scrollbar-hide pointer-events-auto">
        
        {/* Status Hub Console with Connection Indicators */}
        <div className="bg-gradient-to-br from-slate-950/80 via-zinc-950/70 to-slate-900/80 border border-violet-500/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl pointer-events-none animate-pulse" />
          
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-xs text-white/40 tracking-wider uppercase font-mono font-bold block mb-1">Rethink Radar</span>
              <h1 className="text-lg font-bold font-sans tracking-wide bg-gradient-to-r from-violet-300 to-indigo-200 bg-clip-text text-transparent">
                Active Core Monitor
              </h1>
            </div>
            
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Activity size={12} className="animate-spin" />
              <span>LIVE LISTENER</span>
            </span>
          </div>

          <p className="text-xs text-white/50 leading-relaxed mb-4">
            System actively listens for incoming message payloads. Webhooks are registered on port 3000 to catch instant alerts.
          </p>

          {/* Connected/Disconnected/Monitoring Status Block */}
          <div className="space-y-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs mb-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-white/40 font-bold uppercase tracking-wider text-[10px]">Instagram DMs</span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase border ${
                platformStatuses.instagram === "Connected" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                platformStatuses.instagram === "Monitoring" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse" :
                "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>
                ● {platformStatuses.instagram}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-mono text-white/40 font-bold uppercase tracking-wider text-[10px]">Insta Message Requests</span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase border ${
                platformStatuses.instagram === "Connected" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                platformStatuses.instagram === "Monitoring" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse" :
                "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>
                ● {platformStatuses.instagram}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-mono text-white/40 font-bold uppercase tracking-wider text-[10px]">WhatsApp Web Stream</span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase border ${
                platformStatuses.whatsapp === "Connected" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                platformStatuses.whatsapp === "Monitoring" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse" :
                "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>
                ● {platformStatuses.whatsapp}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/5 border border-white/5 rounded-xl p-2.5">
              <span className="text-[10px] text-red-400 font-mono font-bold uppercase block">Pending</span>
              <span className="text-base font-mono font-bold text-red-200">
                {isLoading ? <Loader2 size={12} className="animate-spin inline" /> : countPending}
              </span>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-xl p-2.5">
              <span className="text-[10px] text-amber-400 font-mono font-bold uppercase block">Seen</span>
              <span className="text-base font-mono font-bold text-amber-200">
                {isLoading ? <Loader2 size={12} className="animate-spin inline" /> : countSeen}
              </span>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-xl p-2.5">
              <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase block">Handled</span>
              <span className="text-base font-mono font-bold text-emerald-200">
                {isLoading ? <Loader2 size={12} className="animate-spin inline" /> : countHandled}
              </span>
            </div>
          </div>
        </div>

        {/* Integration Credentials Key Manager */}
        <div className="bg-zinc-950/80 border border-white/5 rounded-2xl p-5 shadow-2xl space-y-4">
          <button 
            type="button" 
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className="flex items-center justify-between w-full text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Settings size={15} className="text-violet-400" />
              <h2 className="text-sm font-semibold tracking-wide uppercase font-mono text-white/70">
                Credentials Setup
              </h2>
            </div>
            <span className="text-white/40 group-hover:text-white transition-colors text-xs font-mono">
              {showConfigPanel ? "[COLLAPSE]" : "[EXPAND]"}
            </span>
          </button>

          {showConfigPanel && (
            <form onSubmit={handleSaveCredentials} className="space-y-4 pt-1">
              <div>
                <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-pink-400 block mb-2">Instagram Core Integration</span>
                <div className="space-y-2">
                  <div>
                    <label className="text-[9px] text-white/40 font-mono font-bold block mb-1">Page Access Token</label>
                    <input 
                      type="password"
                      placeholder="EAAYi..."
                      value={instaToken}
                      onChange={(e) => setInstaToken(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-white/40 font-mono font-bold block mb-1">Business ID Reference</label>
                    <input 
                      type="text"
                      placeholder="178414..."
                      value={instaId}
                      onChange={(e) => setInstaId(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-white/5 pt-3">
                <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-emerald-400 block mb-2">WhatsApp Web / API Gateway</span>
                <div className="space-y-2">
                  <div>
                    <label className="text-[9px] text-white/40 font-mono font-bold block mb-1">Auth Token Key</label>
                    <input 
                      type="password"
                      placeholder="Your secret token..."
                      value={whatsappToken}
                      onChange={(e) => setWhatsappToken(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-white/40 font-mono font-bold block mb-1">API Custom URL or Phone ID</label>
                    <input 
                      type="text"
                      placeholder="e.g. WhatsApp phone identifier"
                      value={whatsappId}
                      onChange={(e) => setWhatsappId(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingCreds}
                className="w-full cursor-pointer bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
              >
                {savingCreds ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                <span>Store Configurations</span>
              </button>
            </form>
          )}
        </div>

        {/* Real Live Webhook Endpoint Display */}
        <div className="bg-zinc-950/80 border border-white/5 rounded-2xl p-5 shadow-2xl space-y-3.5">
          <div className="flex items-center gap-2">
            <Link size={15} className="text-violet-400" />
            <h2 className="text-sm font-semibold tracking-wide uppercase font-mono text-white/70">
              Webhooks Registration
            </h2>
          </div>

          <p className="text-[11px] text-white/40 font-mono leading-relaxed">
            Configure webhooks in Meta Developer Portal or direct WhatsApp custom scripts to push events instantly.
          </p>

          <div className="space-y-3">
            <div>
              <span className="text-[9px] text-white/50 block font-mono font-bold mb-1 uppercase">Instagram webhook entry</span>
              <div className="flex items-center bg-black/45 border border-white/10 rounded-lg p-1 text-[10px] font-mono">
                <span className="flex-1 overflow-x-auto truncate px-2 text-white/70 selection:bg-violet-600 select-all">{instagramWebhookUrl}</span>
                <button 
                  onClick={() => copyUrlToClipboard(instagramWebhookUrl, "insta")}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white p-1 rounded transition-colors text-[9px] ml-1 font-bold"
                >
                  {copiedWebhook === "insta" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <span className="text-[9px] text-white/50 block font-mono font-bold mb-1 uppercase">WhatsApp Web hook entry</span>
              <div className="flex items-center bg-black/45 border border-white/10 rounded-lg p-1 text-[10px] font-mono">
                <span className="flex-1 overflow-x-auto truncate px-2 text-white/70 selection:bg-violet-600 select-all">{whatsappWebhookUrl}</span>
                <button 
                  onClick={() => copyUrlToClipboard(whatsappWebhookUrl, "wa")}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white p-1 rounded transition-colors text-[9px] ml-1 font-bold"
                >
                  {copiedWebhook === "wa" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* System Protection Manifesto details */}
        <div className="bg-white/[0.01] border border-[#ff0055]/5 rounded-2xl p-4 text-[11px] text-white/45 font-mono leading-relaxed mt-auto">
          <div className="flex items-center gap-1 text-white/60 font-bold mb-1 uppercase text-xs">
            <ShieldCheck size={12} className="text-violet-400" />
            <span>Scope Verification</span>
          </div>
          • Continuous automated synchronization operates 24/7.<br />
          • Webhook routing intercepts real payload alerts.<br />
          • Zero simulated messages. Deep-dives load genuine conversation history.
        </div>
      </div>

      {/* RIGHT WORKSPACE: Filter Tabs & Three-Column Inbox Matrix Grid */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden pointer-events-auto">
        
        {/* Workspace Toolbar Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-950/40 p-2.5 rounded-xl border border-white/5 shrink-0">
          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-lg">
            <button
              onClick={() => { setActiveTab("all"); playAlertSound("click"); }}
              className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                activeTab === "all" ? "bg-white/10 text-white shadow" : "text-white/40 hover:text-white/60"
              }`}
            >
              All Channels
            </button>
            <button
              onClick={() => { setActiveTab("Instagram"); playAlertSound("click"); }}
              className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === "Instagram" ? "bg-violet-600/20 text-violet-300 border border-violet-500/25 animate-pulse" : "text-white/40 hover:text-white/60"
              }`}
            >
              <Instagram size={11} />
              Instagram
            </button>
            <button
              onClick={() => { setActiveTab("WhatsApp"); playAlertSound("click"); }}
              className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === "WhatsApp" ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/25" : "text-white/40 hover:text-white/60"
              }`}
            >
              <Smartphone size={11} />
              WhatsApp
            </button>
          </div>

          <div className="text-right text-[11px] text-white/30 font-mono flex items-center justify-end gap-3.5 px-1.5">
            <span className="flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              Continuous polling live
            </span>
            <button 
              onClick={() => {
                loadDashboardData(false);
                playAlertSound("click");
              }}
              title="Manual Sync Core"
              className="hover:text-white/60 transition-colors cursor-pointer"
            >
              <RefreshCw size={11} className="hover:rotate-180 transition-all duration-300" />
            </button>
          </div>
        </div>

        {/* THREE COLUMNS GRID MATRIX */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden h-full">
          
          {/* COLUMN 1: PENDING */}
          <div className="flex flex-col bg-zinc-950/20 border border-red-500/10 rounded-2xl overflow-hidden h-full max-h-[calc(100vh-200px)]">
            <div className="px-4 py-3 bg-red-950/10 border-b border-red-500/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse" />
                <h3 className="font-mono text-xs tracking-wider uppercase font-bold text-red-400">
                  Pending Verification
                </h3>
              </div>
              <span className="px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded-full text-[10px] font-mono font-bold">
                {countPending}
              </span>
            </div>
            
            <div className="p-3 overflow-y-auto space-y-3 flex-1 scrollbar-hide">
              <AnimatePresence initial={false}>
                {filteredNotifications.filter(n => n.status === "Pending").length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center text-white/20 font-mono py-16">
                    <CheckSquare size={24} className="opacity-10 mb-2" />
                    <span className="text-[11px]">No pending alert cards. Core verified!</span>
                  </div>
                ) : (
                  filteredNotifications.filter(n => n.status === "Pending").map(notif => (
                    <QueueCard 
                      key={notif.id} 
                      notif={notif} 
                      onSelect={() => setFocusedNotification(notif)}
                      onMoveRight={() => updateStatus(notif.id, "Seen")}
                      onDelete={() => deleteNotification(notif.id)}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* COLUMN 2: SEEN */}
          <div className="flex flex-col bg-zinc-950/20 border border-amber-500/10 rounded-2xl overflow-hidden h-full max-h-[calc(100vh-200px)]">
            <div className="px-4 py-3 bg-amber-950/10 border-b border-amber-500/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)] animate-pulse" />
                <h3 className="font-mono text-xs tracking-wider uppercase font-bold text-amber-400">
                  Seen / Investigating
                </h3>
              </div>
              <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-full text-[10px] font-mono font-bold">
                {countSeen}
              </span>
            </div>
            
            <div className="p-3 overflow-y-auto space-y-3 flex-1 scrollbar-hide">
              <AnimatePresence initial={false}>
                {filteredNotifications.filter(n => n.status === "Seen").length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center text-white/20 font-mono py-16">
                    <Eye size={24} className="opacity-10 mb-2" />
                    <span className="text-[11px]">No active investigated alarms.</span>
                  </div>
                ) : (
                  filteredNotifications.filter(n => n.status === "Seen").map(notif => (
                    <QueueCard 
                      key={notif.id} 
                      notif={notif} 
                      onSelect={() => setFocusedNotification(notif)}
                      onMoveLeft={() => updateStatus(notif.id, "Pending")}
                      onMoveRight={() => updateStatus(notif.id, "Handled")}
                      onDelete={() => deleteNotification(notif.id)}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* COLUMN 3: HANDLED */}
          <div className="flex flex-col bg-zinc-950/20 border border-emerald-500/10 rounded-2xl overflow-hidden h-full max-h-[calc(100vh-200px)]">
            <div className="px-4 py-3 bg-emerald-950/10 border-b border-emerald-500/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse" />
                <h3 className="font-mono text-xs tracking-wider uppercase font-bold text-emerald-400">
                  Handled / Closed
                </h3>
              </div>
              <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-mono font-bold">
                {countHandled}
              </span>
            </div>
            
            <div className="p-3 overflow-y-auto space-y-3 flex-1 scrollbar-hide">
              <AnimatePresence initial={false}>
                {filteredNotifications.filter(n => n.status === "Handled").length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center text-white/20 font-mono py-16">
                    <Check size={24} className="opacity-10 mb-2" />
                    <span className="text-[11px]">Clean verification log. No history.</span>
                  </div>
                ) : (
                  filteredNotifications.filter(n => n.status === "Handled").map(notif => (
                    <QueueCard 
                      key={notif.id} 
                      notif={notif} 
                      onSelect={() => setFocusedNotification(notif)}
                      onMoveLeft={() => updateStatus(notif.id, "Seen")}
                      onDelete={() => deleteNotification(notif.id)}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>

      {/* ABSOLUTE OVERLAY: System alert pops up automatically when a real webhook message arrives */}
      <AnimatePresence>
        {newArrivalOverlay && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed bottom-6 right-6 z-50 w-[350px] bg-slate-950 border-2 border-violet-500 rounded-2xl shadow-2xl overflow-hidden glass pointer-events-auto p-4"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-pink-500 to-indigo-500" />
            
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-1.5 text-xs text-violet-400 font-mono font-bold">
                <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-ping" />
                📩 NEW MESSAGE RECEIVED
              </span>
              <button 
                onClick={() => setNewArrivalOverlay(null)}
                className="text-white/40 hover:text-white text-xs cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-black/50 border border-white/5 p-3 rounded-xl space-y-2 text-[12px] font-mono leading-relaxed select-text">
              <div className="text-white/50">
                <span className="text-white/30 uppercase block text-[10px]">Platform</span>
                <span className="font-bold text-white uppercase flex items-center gap-1 mt-0.5">
                  {newArrivalOverlay.platform === "Instagram" ? (
                    <Instagram size={11} className="text-pink-400" />
                  ) : (
                    <Smartphone size={11} className="text-emerald-400" />
                  )}
                  {newArrivalOverlay.platform}
                </span>
              </div>

              <div>
                <span className="text-white/30 uppercase block text-[10px]">Sender</span>
                <span className="font-bold text-violet-300 font-sans text-xs">{newArrivalOverlay.sender}</span>
              </div>

              <div>
                <span className="text-white/30 uppercase block text-[10px]">Message</span>
                <p className="text-white font-sans whitespace-pre-wrap break-words italic pl-2 border-l border-white/10 mt-1 max-h-24 overflow-y-auto">
                  "{newArrivalOverlay.message}"
                </p>
              </div>

              <div className="flex justify-between items-center text-[10px] text-white/40 pt-1">
                <div>
                  <span className="block uppercase text-[8px] text-white/30">Time</span>
                  <span>{newArrivalOverlay.time}</span>
                </div>
                <div className="text-right">
                  <span className="block uppercase text-[8px] text-white/30">Status</span>
                  <span className="text-pink-400 font-bold">Waiting for Owner</span>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => handleCopyText(newArrivalOverlay)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-[11px] py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Copy size={11} />
                <span>{copiedId === newArrivalOverlay.id ? "Copied!" : "Copy Report"}</span>
              </button>

              <button
                onClick={() => {
                  setFocusedNotification(newArrivalOverlay);
                  setNewArrivalOverlay(null);
                }}
                className="bg-violet-600 hover:bg-violet-500 text-white font-mono text-[11px] py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <span>Review Thread</span>
                <ArrowRight size={11} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DETAILED LOG OVERLAY DIALOG */}
      <AnimatePresence>
        {focusedNotification && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto pointer-events-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-950 border border-white/10 w-full max-w-[850px] h-[90dvh] md:h-[650px] rounded-2xl flex flex-col md:flex-row overflow-hidden shadow-2xl"
            >
              
              <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-white/5 h-1/2 md:h-full overflow-hidden">
                <div className="px-5 py-4 bg-zinc-900/40 border-b border-white/5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-violet-300">
                      <User size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white tracking-wide">{focusedNotification.sender}</h4>
                      <span className="text-[10px] uppercase font-mono text-white/50 flex items-center gap-1 mt-0.5">
                        {focusedNotification.platform === "Instagram" ? (
                          <Instagram size={10} className="text-pink-400" />
                        ) : (
                          <Smartphone size={10} className="text-emerald-400" />
                        )}
                        {focusedNotification.platform} • {focusedNotification.type}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] text-white/40 font-mono">
                    {focusedNotification.time}
                  </span>
                </div>

                {/* Conversation timelines */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-black/45 scrollbar-hide flex flex-col">
                  <div className="text-center">
                    <span className="px-3 py-1 bg-white/[0.02] border border-white/5 rounded-full text-[9px] text-white/30 uppercase font-mono">
                      🔒 Real Active Thread Log
                    </span>
                  </div>

                  {(conversations[focusedNotification.sender] || []).map((msg, index) => (
                    <div 
                      key={msg.id || index} 
                      className={`flex flex-col max-w-[75%] ${msg.isIncoming ? "self-start" : "self-end items-end"}`}
                    >
                      <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed font-sans ${
                        msg.isIncoming 
                          ? "bg-zinc-900 border border-white/5 text-white rounded-tl-none" 
                          : "bg-violet-600/25 border border-violet-500/10 text-violet-100 rounded-tr-none"
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[8px] text-white/30 font-mono mt-1 px-1">
                        {msg.time}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-zinc-900/20 border-t border-white/5 shrink-0 flex items-center gap-2 opacity-60 select-none">
                  <div className="text-[11px] text-white/55 font-mono text-center w-full py-1">
                    🚫 Phase 1: Client reply streams hold inactive (No automatic replies triggered yet)
                  </div>
                </div>
              </div>

              {/* Terminal sidebar reports */}
              <div className="w-full md:w-[320px] bg-zinc-950 p-5 shrink-0 flex flex-col justify-between h-1/2 md:h-full text-xs overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40 font-mono font-bold uppercase tracking-wider">
                      RAW MONITOR METADATA
                    </span>

                    <button
                      onClick={() => handleCopyText(focusedNotification)}
                      className="text-[10px] hover:text-white text-white/40 font-mono border border-white/5 hover:border-white/20 hover:bg-white/5 px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Copy size={10} />
                      <span>{copiedId === focusedNotification.id ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>

                  <pre className="p-4 bg-black/60 border border-white/5 rounded-xl font-mono text-[11px] leading-relaxed text-cyan-300/85 whitespace-pre-wrap select-text">
                    {getNotificationTextFormat(focusedNotification)}
                  </pre>

                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 space-y-2 font-mono text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-white/30">CURRENT STATUS:</span>
                      <span className={`font-bold ${
                        focusedNotification.status === "Pending" ? "text-red-400" :
                        focusedNotification.status === "Seen" ? "text-amber-400" : "text-emerald-400"
                      }`}>{focusedNotification.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/30">MONITOR STATE:</span>
                      <span className="text-emerald-400 font-bold">24x7 REAL-TIME</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-6">
                  <span className="text-[9px] text-white/30 font-mono font-bold block uppercase">Transition Ticket Phase:</span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {focusedNotification.status !== "Pending" && (
                      <button
                        onClick={() => updateStatus(focusedNotification.id, "Pending")}
                        className="bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-white font-mono text-[10px] py-2 rounded-lg transition-all cursor-pointer"
                      >
                        ← Move Pending
                      </button>
                    )}

                    {focusedNotification.status !== "Seen" && (
                      <button
                        onClick={() => updateStatus(focusedNotification.id, "Seen")}
                        className="bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/20 text-white font-mono text-[10px] py-2 rounded-lg transition-all cursor-pointer"
                      >
                        {focusedNotification.status === "Pending" ? "Mark Investigating →" : "← Mark Investigating"}
                      </button>
                    )}

                    {focusedNotification.status !== "Handled" && (
                      <button
                        onClick={() => updateStatus(focusedNotification.id, "Handled")}
                        className="bg-slate-950 hover:bg-emerald-500/10 border border-emerald-500/15 hover:border-emerald-500/25 text-emerald-400 font-mono text-[10px] py-2 rounded-lg transition-all cursor-pointer"
                      >
                        Deals Cleared →
                      </button>
                    )}
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => deleteNotification(focusedNotification.id)}
                      className="flex-1 bg-red-950/20 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-mono text-[10px] py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={11} />
                      <span>Delete Card</span>
                    </button>
                    
                    <button
                      onClick={() => setFocusedNotification(null)}
                      className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-[10px] py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      Exit View
                    </button>
                  </div>
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Queue ticket capsule card component definition
interface QueueCardProps {
  key?: any;
  notif: MonitorNotification;
  onSelect: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onDelete: () => void;
}

function QueueCard({ notif, onSelect, onMoveLeft, onMoveRight, onDelete }: QueueCardProps) {
  return (
    <motion.div
      layoutId={notif.id}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`p-3.5 bg-neutral-950 border border-white/5 rounded-xl hover:border-white/15 transition-all text-xs flex flex-col gap-2.5 relative shadow-xl hover:shadow-2xl select-none ${
        notif.status === "Pending" ? "hover:border-red-500/20" :
        notif.status === "Seen" ? "hover:border-amber-500/20" : "hover:border-emerald-500/20"
      }`}
    >
      <div className="flex items-center justify-between select-none">
        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1 ${
          notif.platform === "Instagram" 
            ? "bg-gradient-to-r from-pink-500/10 to-violet-500/10 text-pink-300 border border-pink-500/20" 
            : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
        }`}>
          {notif.platform === "Instagram" ? <Instagram size={10} /> : <Smartphone size={10} />}
          {notif.platform} • {notif.type}
        </span>

        <span className="text-[10px] text-white/30 font-mono tracking-tighter">
          {notif.time.includes(", ") ? notif.time.split(", ")[1] : notif.time}
        </span>
      </div>

      <div 
        onClick={onSelect}
        className="cursor-pointer space-y-1.5 group select-none flex-1"
      >
        <div className="font-bold text-white font-sans text-sm tracking-wide group-hover:text-violet-300 transition-colors">
          {notif.sender}
        </div>
        <p className="text-white/65 font-sans leading-relaxed line-clamp-2 italic pr-1">
          "{notif.message}"
        </p>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-white/5 shrink-0 select-none">
        <button
          onClick={onDelete}
          className="text-white/20 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-all cursor-pointer"
          title="Delete ticket"
        >
          <Trash2 size={11} />
        </button>

        <div className="flex items-center gap-1.5">
          {onMoveLeft && (
            <button
              onClick={onMoveLeft}
              className="p-1 px-2 rounded bg-white/5 text-white/40 hover:text-white hover:bg-white/10 text-[10px] font-mono transition-all cursor-pointer"
              title="Move left"
            >
              <ArrowLeft size={10} />
            </button>
          )}

          <button
            onClick={onSelect}
            className="px-2.5 py-1 rounded bg-violet-600/10 hover:bg-violet-600/20 text-violet-300 text-[10px] font-mono font-medium border border-violet-500/15 transition-all cursor-pointer"
          >
            Review Thread
          </button>

          {onMoveRight && (
            <button
              onClick={onMoveRight}
              className="p-1 px-2 rounded bg-white/5 text-white/40 hover:text-white hover:bg-white/10 text-[10px] font-mono transition-all cursor-pointer"
              title="Move right"
            >
              <ArrowRight size={10} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

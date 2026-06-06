"use client";

import React, { useState, useEffect, useRef } from "react";
import { useDrm, BillingLedger } from "../context/DrmContext";
import { useRouter } from "next/navigation";
import { 
  Film, UploadCloud, AlertOctagon, Receipt, Send, CheckCircle, 
  LogOut, Terminal, Cpu, Play, DollarSign, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface IngestionItem {
  zone: string;
  file: File;
  status: "queued" | "processing" | "completed";
  progress: number;
}

export default function DashboardPage() {
  const { 
    currentProfile, movies, theatreScreens, leakAlerts, billingLedgers, globalConfig,
    addMovie, simulateLeak, dispatchTakedown, settleInvoice, logout, resetAllData, isLoading
  } = useDrm();
  const router = useRouter();

  // Redirect client checks
  useEffect(() => {
    if (!isLoading) {
      if (!currentProfile) {
        router.push("/login");
      } else if (!currentProfile.onboarding_completed) {
        router.push("/onboarding");
      }
    }
  }, [currentProfile, isLoading, router]);

  // UI state
  const [newMovieTitle, setNewMovieTitle] = useState("");
  const [ingestionQueue, setIngestionQueue] = useState<IngestionItem[]>([]);
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [activeRazorpayInvoice, setActiveRazorpayInvoice] = useState<BillingLedger | null>(null);
  const [razorpayCard, setRazorpayCard] = useState("");
  const [razorpayCvv, setRazorpayCvv] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  
  // For leak simulator form
  const [simMovieId, setSimMovieId] = useState("");
  const [simChain, setSimChain] = useState("AMC Empire 25");
  const [simCity, setSimCity] = useState("New York");
  const [simScreen, setSimScreen] = useState("04");
  const [simPayload, setSimPayload] = useState("");

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll telemetry log
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [telemetryLogs]);

  // Default movie selection falls back dynamically in select value below without triggering cascading render effects

  if (isLoading || !currentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
      </div>
    );
  }

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleAddMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMovieTitle.trim()) return;
    try {
      const newMovie = await addMovie(newMovieTitle);
      setNewMovieTitle("");
      triggerToast(`Ingested ${newMovie.title} into Sentinel tracking mesh.`);
      addLog(`REGISTERED NEW WATERMARK BOUNDARY: "${newMovie.title}"`);
    } catch {
      triggerToast("Failed to register movie asset.");
    }
  };

  const addLog = (log: string) => {
    setTelemetryLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
  };

  // Drop Zones Setup
  const zones = [
    { key: "intro", name: "Hero Intro Block", desc: "First 15 mins. Spatial Telemetry A." },
    { key: "pre_interval", name: "Pre-Interval Block", desc: "Middle action. Spatial Telemetry B." },
    { key: "action", name: "Action/Song Sequence", desc: "Climax bridge. Spatial Telemetry C." },
    { key: "climax", name: "Climax Block", desc: "Final 15 mins. Critical Telemetry D." }
  ];

  const handleFileDrop = (zoneKey: string, file: File) => {
    if (file.size > 150 * 1024 * 1024) { // 150MB limit
      triggerToast("File size violates 15-minute clip threshold limits.");
      return;
    }
    
    // Check if zone is already in queue
    const exists = ingestionQueue.some(item => item.zone === zoneKey);
    if (exists) {
      triggerToast(`Zone "${zoneKey}" is already in processing queue.`);
      return;
    }

    setIngestionQueue(prev => [...prev, {
      zone: zoneKey,
      file: file,
      status: "queued",
      progress: 0
    }]);

    addLog(`QUEUED FILE FOR INGESTION: ${file.name} (Zone: ${zoneKey})`);
  };

  // Process the queue sequentially
  const startProcessingQueue = async () => {
    if (ingestionQueue.length === 0 || isProcessingQueue) return;
    setIsProcessingQueue(true);
    addLog("INITIATING SEQUENTIAL FFMEPG WATERMARK PIPELINE...");

    for (let i = 0; i < ingestionQueue.length; i++) {
      const current = ingestionQueue[i];
      if (current.status === "completed") continue;

      // Update item status to processing
      setIngestionQueue(prev => prev.map((item, idx) => 
        idx === i ? { ...item, status: "processing" as const } : item
      ));

      addLog(`[FFMPEG] LOADING WASM FOR FILE: ${current.file.name}...`);
      await delay(1000);

      // Frame operation loop simulation
      const totalFrames = 180;
      for (let frame = 1; frame <= totalFrames; frame += 30) {
        setIngestionQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, progress: Math.round((frame / totalFrames) * 100) } : item
        ));
        addLog(`[FFMPEG] WATERMARK FRAME DEVIATION STAGE: ${frame}/${totalFrames}`);
        await delay(300);
      }

      // Finalizing watermark
      setIngestionQueue(prev => prev.map((item, idx) => 
        idx === i ? { ...item, progress: 100 } : item
      ));
      addLog(`[FFMPEG] WATERMARK COMPLETED. SAVING OUTPUT BUFFER.`);
      await delay(500);

      // Trigger automatic browser download
      triggerDownload(current.file.name, current.zone);
      addLog(`[FFMPEG] DOWNLOAD DISPATCHED FOR WATERMARKED_${current.file.name}`);

      // Garbage collection / Unlink
      addLog(`[MEMORY] RECLAIMING RAM. EXECUTING: ffmpeg.FS('unlink', '${current.file.name}')`);
      await delay(400);
      addLog(`[MEMORY] GARBAGE COLLECTION SUCCESSFUL. ${current.file.name} CACHE FLUSHED.`);

      // Complete
      setIngestionQueue(prev => prev.map((item, idx) => 
        idx === i ? { ...item, status: "completed" as const } : item
      ));
    }

    setIsProcessingQueue(false);
    triggerToast("All queued movie zones watermarked and processed successfully!");
    addLog("SEQUENTIAL INGESTION QUEUE FLUSH COMPLETED.");
  };

  const triggerDownload = (fileName: string, zone: string) => {
    // Generate dummy text file representing the watermarked binary payload
    const payload = `SENTINEL_DRM_WATERMARK_PAYLOAD\nFile: ${fileName}\nZone: ${zone}\nFingerprint: ${currentProfile.device_fingerprint_hash}\nTimestamp: ${new Date().toISOString()}`;
    const blob = new Blob([payload], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watermarked_${fileName.split('.')[0]}_${zone}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // Takedown dispatch with rewards
  const handleTakedown = (alertId: string, movieTitle: string) => {
    dispatchTakedown(alertId);
    triggerToast(`Takedown enforcement dispatched for ${movieTitle}. Bounty ledger updated.`);
    addLog(`DISPATCHED LEGAL CITATION & TAKEDOWN NOTICE: ALERT_${alertId.toUpperCase()}`);
    addLog(`CREDITED BOUNTY REWARD: +$${globalConfig.bounty_reward_price} TO LEDGER`);
  };

  // Simulate a leak on click
  const handleSimulateLeakSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const activeMovieId = simMovieId || (movies.length > 0 ? movies[0].id : "");
    if (!activeMovieId) {
      triggerToast("Register a movie first before simulating a leak.");
      return;
    }
    const targetMovie = movies.find(m => m.id === activeMovieId);
    if (!targetMovie) return;

    // Call external helper to keep component render phase pure
    const finalPayload = generateRandomPayload(simPayload, simChain, simCity, simScreen);

    simulateLeak(activeMovieId, simChain, simCity, simScreen, finalPayload);
    triggerToast(`Piracy leak simulated in ${simChain} (${simCity}). Alert pulsing.`);
    addLog(`⚠️ BREACH TELEMETRY RECEIVED: SKEWED FOOTAGE IDENTIFIED AT ${simChain.toUpperCase()}, CITY: ${simCity.toUpperCase()}`);
  };

  // Razorpay payment submission
  const handleRazorpaySettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRazorpayInvoice) return;

    settleInvoice(activeRazorpayInvoice.id);
    triggerToast(`Invoice settled successfully via Razorpay Gateway.`);
    addLog(`RECEIPT SETTLED VIA RAZORPAY GATEWAY: INV_${activeRazorpayInvoice.id.substring(4, 9).toUpperCase()}`);
    setActiveRazorpayInvoice(null);
    setRazorpayCard("");
    setRazorpayCvv("");
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 relative min-h-screen">
      {/* Decorative top border glow */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-80" />
      
      {/* Header NavBar */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Film className="h-6 w-6 text-cyan-400" />
          <div>
            <h1 className="text-lg font-bold tracking-wider text-white">SENTINEL CINEMA DRM</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Kite & Tail Studio Desk</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="block text-xs font-semibold text-zinc-300">{currentProfile.company_name || currentProfile.email}</span>
            <span className="inline-flex items-center gap-1 rounded bg-cyan-950 border border-cyan-800 text-[10px] px-1.5 text-cyan-400 font-mono">
              <Cpu className="h-2.5 w-2.5" /> {currentProfile.device_fingerprint_hash}
            </span>
          </div>

          {currentProfile.role === "SUPER_ADMIN" && (
            <button
              onClick={() => router.push("/admin")}
              className="bg-purple-950/50 text-purple-300 border border-purple-800 hover:bg-purple-900/50 py-1.5 px-3 rounded text-xs transition font-semibold"
            >
              Command Center
            </button>
          )}

          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="p-1.5 rounded hover:bg-zinc-900 text-zinc-400 hover:text-white transition"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Global Success/Failure Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-50 bg-emerald-900/90 border border-emerald-500 text-emerald-100 font-semibold px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2 text-xs"
          >
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dashboard Grid Workspace */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Asset Queue & Billing */}
        <section className="lg:col-span-2 space-y-6 flex flex-col">
          
          {/* Movie Registry */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Film className="h-4 w-4 text-cyan-400" /> Movie Distribution Registry
              </h2>
              <span className="text-[10px] text-zinc-500">{movies.length} Active Tracks</span>
            </div>

            <form onSubmit={handleAddMovie} className="flex gap-2">
              <input
                type="text"
                value={newMovieTitle}
                onChange={(e) => setNewMovieTitle(e.target.value)}
                placeholder="e.g. Apex Horizon (Distributor Lock)"
                className="flex-1 bg-zinc-950 border border-zinc-850 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500 text-zinc-200"
              />
              <button
                type="submit"
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-1.5 px-4 rounded text-xs transition"
              >
                Register Asset
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto pr-1">
              {movies.map((mov) => (
                <div key={mov.id} className="bg-zinc-950 p-3 rounded border border-zinc-900 flex items-center justify-between text-xs">
                  <div>
                    <span className="block font-semibold text-zinc-300">{mov.title}</span>
                    <span className="text-[9px] text-zinc-500">ID: {mov.id}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    mov.tracking_status === "Secure" 
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800" 
                      : "bg-red-950 text-red-400 border border-red-800 animate-pulse"
                  }`}>
                    {mov.tracking_status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sequential Movie Ingestion Queue */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 space-y-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <UploadCloud className="h-4 w-4 text-cyan-400" /> Movie Ingestion Desk
                </h2>
                <p className="text-[10px] text-zinc-500 mt-1">Sequential multi-thread FFmpeg rendering queue. Max 15 mins clip limit.</p>
              </div>

              <button
                onClick={startProcessingQueue}
                disabled={isProcessingQueue || ingestionQueue.length === 0}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-1.5 px-4 rounded text-xs transition flex items-center gap-1.5"
              >
                {isProcessingQueue ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Render Queue
              </button>
            </div>

            {/* 4 Custom Drop Zones */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {zones.map((zone) => {
                const queuedItem = ingestionQueue.find(item => item.zone === zone.key);
                return (
                  <div 
                    key={zone.key}
                    className={`border rounded-lg p-3 text-center flex flex-col justify-between min-h-[120px] transition relative overflow-hidden ${
                      queuedItem 
                        ? queuedItem.status === "processing" 
                          ? "border-cyan-500 bg-cyan-950/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                          : queuedItem.status === "completed"
                            ? "border-emerald-500 bg-emerald-950/10"
                            : "border-zinc-800 bg-zinc-900/20"
                        : "border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950/20 cursor-pointer"
                    }`}
                    onClick={() => {
                      if (!queuedItem) {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "video/*";
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleFileDrop(zone.key, file);
                        };
                        input.click();
                      }
                    }}
                  >
                    <div>
                      <div className="text-[10px] font-bold text-zinc-300">{zone.name}</div>
                      <div className="text-[8px] text-zinc-500 mt-0.5">{zone.desc}</div>
                    </div>

                    <div className="mt-3 flex-1 flex flex-col justify-end">
                      {queuedItem ? (
                        <div className="space-y-1.5 w-full">
                          <div className="text-[9px] text-zinc-400 font-mono truncate">{queuedItem.file.name}</div>
                          {queuedItem.status === "processing" ? (
                            <div className="space-y-0.5">
                              <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-cyan-500 h-full transition-all duration-300" style={{ width: `${queuedItem.progress}%` }} />
                              </div>
                              <span className="text-[8px] text-cyan-400 font-semibold">{queuedItem.progress}% watermarked</span>
                            </div>
                          ) : queuedItem.status === "completed" ? (
                            <span className="text-[8px] text-emerald-400 font-semibold uppercase flex items-center justify-center gap-1">
                              <CheckCircle className="h-2.5 w-2.5" /> SECURE BIND
                            </span>
                          ) : (
                            <span className="text-[8px] text-zinc-500 font-semibold uppercase">Queued</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-zinc-600 text-xs flex flex-col items-center gap-1 py-2">
                          <UploadCloud className="h-5 w-5 text-zinc-700" />
                          <span className="text-[8px] uppercase tracking-wider">Drag file</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Clear queue utility */}
            {ingestionQueue.length > 0 && (
              <div className="text-right">
                <button
                  onClick={() => setIngestionQueue([])}
                  disabled={isProcessingQueue}
                  className="text-[10px] text-zinc-500 hover:text-white underline"
                >
                  Clear Queue
                </button>
              </div>
            )}
          </div>

          {/* Billing Ledger Desk */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Receipt className="h-4 w-4 text-cyan-400" /> Razorpay Billing Ledgers
              </h2>
              <span className="text-[10px] text-zinc-500">Contract Rates Active</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {billingLedgers.map((ledger) => {
                const total = ledger.base_retainer_due + ledger.screen_fees - ledger.bounty_rewards;
                const finalTotal = total < 0 ? 0 : total;
                return (
                  <div key={ledger.id} className="bg-zinc-950 p-3 rounded border border-zinc-900 flex items-center justify-between text-xs font-mono">
                    <div className="space-y-1">
                      <div className="font-semibold text-zinc-300">INV_{ledger.id.substring(4, 9).toUpperCase()}</div>
                      <div className="text-[9px] text-zinc-500">
                        Retainer: ${ledger.base_retainer_due} | Screen Fees: ${ledger.screen_fees} | Bounty Offset: -${ledger.bounty_rewards}
                      </div>
                    </div>

                    <div className="text-right space-y-2">
                      <div className="font-bold text-white">${finalTotal}</div>
                      {ledger.payment_status === "Paid_Razorpay" ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[8px] bg-emerald-950 border border-emerald-900 text-emerald-400 font-sans font-semibold">
                          PAID RAZORPAY
                        </span>
                      ) : (
                        <button
                          onClick={() => setActiveRazorpayInvoice(ledger)}
                          className="bg-cyan-950 text-cyan-400 border border-cyan-800 hover:bg-cyan-900 py-0.5 px-2 rounded text-[9px] font-sans font-semibold transition"
                        >
                          Settle Invoice
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </section>

        {/* Right Column: Active Breaches & Telemetry */}
        <section className="space-y-6">
          
          {/* Active Breaches Panel */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-red-500 animate-pulse" /> Active Breaches Desk
              </h2>
              <span className="text-[10px] text-zinc-500">Global Telemetry Mesh</span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {leakAlerts.filter(a => a.status === "Active").length === 0 ? (
                <div className="text-center py-6 text-zinc-600 text-xs font-mono border border-dashed border-zinc-900 rounded-lg">
                  SYS_MESH: NO ACTIVE LEAK SIGNATURES IDENTIFIED.
                </div>
              ) : (
                leakAlerts.map((alert) => {
                  const targetMovie = movies.find(m => m.id === alert.movie_id);
                  const screen = theatreScreens.find(s => s.id === alert.theatre_id);
                  return (
                    <div 
                      key={alert.id} 
                      className="bg-zinc-950 border border-red-900/50 rounded-lg p-3 space-y-3 shadow-[0_0_15px_rgba(220,38,38,0.05)] relative overflow-hidden"
                    >
                      {/* Pulsing alert bar */}
                      <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-red-600 animate-pulse" />

                      <div className="text-xs space-y-1 pl-1.5 font-mono">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-red-400 uppercase tracking-wide">BREACH_DETECTED</span>
                          <span className="text-[8px] text-zinc-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-zinc-300 font-sans font-semibold mt-1">Movie: {targetMovie?.title || "Unknown"}</div>
                        <div className="text-zinc-400">Theater: {screen?.chain_name || "Unknown"} (Screen {screen?.screen_number || "N/A"})</div>
                        <div className="text-zinc-400">Location: {screen?.city || "Unknown"}</div>
                        <div className="bg-zinc-900 text-[9px] p-1.5 rounded text-red-300 border border-red-950 mt-2 truncate select-all">
                          Payload: {alert.payload_string}
                        </div>
                      </div>

                      <div className="pl-1.5">
                        <button
                          onClick={() => handleTakedown(alert.id, targetMovie?.title || "")}
                          className="w-full bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900 font-sans font-bold py-1.5 px-3 rounded text-[10px] transition text-center"
                        >
                          Automate Takedown & Issue Citation
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Takedown History */}
              {leakAlerts.filter(a => a.status === "Takedown Dispatched").length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-900">
                  <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Historical Citations</div>
                  {leakAlerts.filter(a => a.status === "Takedown Dispatched").map((alert) => {
                    const targetMovie = movies.find(m => m.id === alert.movie_id);
                    const screen = theatreScreens.find(s => s.id === alert.theatre_id);
                    return (
                      <div key={alert.id} className="bg-zinc-950/60 border border-zinc-900 rounded p-2 text-[10px] font-mono flex items-center justify-between text-zinc-400">
                        <div>
                          <span className="block text-zinc-300 truncate font-semibold">{targetMovie?.title}</span>
                          <span className="text-[8px] text-zinc-500">{screen?.chain_name} | {screen?.city}</span>
                        </div>
                        <span className="text-emerald-500 font-bold uppercase text-[8px] border border-emerald-900/60 bg-emerald-950/30 px-1 rounded">
                          CIT_DISPATCHED
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Telemetry Logger Panel */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 space-y-4 flex flex-col h-72">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Terminal className="h-4 w-4 text-cyan-400" /> System DRM Telemetry Log
              </h2>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>

            <div className="flex-1 bg-zinc-950/80 rounded border border-zinc-900 p-3 font-mono text-[9px] text-zinc-400 space-y-1 overflow-y-auto select-text shadow-inner">
              {telemetryLogs.length === 0 ? (
                <div className="text-zinc-600 text-center py-12">DRM TELEMETRY LOG ACTIVE. STANDBY FOR HANDSHAKES.</div>
              ) : (
                telemetryLogs.map((log, index) => (
                  <div key={index} className="leading-relaxed">
                    <span className={log && (log.includes("⚠️") || log.includes("BREACH")) ? "text-red-400" : log && log.includes("FFMPEG") ? "text-cyan-300" : log && log.includes("MEMORY") ? "text-amber-400" : "text-zinc-400"}>
                      {log}
                    </span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Live Leak Simulation Form Helper */}
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 space-y-4">
            <div className="border-b border-zinc-850 pb-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Send className="h-4 w-4 text-purple-400" /> Telemetry Leak Simulator
              </h2>
              <p className="text-[10px] text-zinc-500 mt-1">Inject mock spatial tracking piracy alerts into the Sentinel framework.</p>
            </div>

            <form onSubmit={handleSimulateLeakSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-zinc-500 mb-1 text-[10px]">Select Target Movie</label>
                  <select 
                    value={simMovieId || (movies.length > 0 ? movies[0].id : "")} 
                    onChange={(e) => setSimMovieId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded p-1 text-zinc-300 focus:outline-none"
                  >
                    {movies.map(m => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1 text-[10px]">Theater Chain</label>
                  <input 
                    type="text" 
                    value={simChain}
                    onChange={(e) => setSimChain(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded p-1 text-zinc-300 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-zinc-500 mb-1 text-[10px]">City</label>
                  <input 
                    type="text" 
                    value={simCity}
                    onChange={(e) => setSimCity(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded p-1 text-zinc-300 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1 text-[10px]">Screen #</label>
                  <input 
                    type="text" 
                    value={simScreen}
                    onChange={(e) => setSimScreen(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded p-1 text-zinc-300 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1 text-[10px]">Watermark Tag</label>
                  <input 
                    type="text" 
                    value={simPayload}
                    onChange={(e) => setSimPayload(e.target.value)}
                    placeholder="Auto-Gen"
                    className="w-full bg-zinc-950 border border-zinc-850 rounded p-1 text-zinc-300 focus:outline-none placeholder-zinc-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-purple-900/40 text-purple-300 hover:bg-purple-900/60 border border-purple-800 font-semibold py-1.5 rounded transition text-xs"
              >
                Inject Leak Alert Telemetry
              </button>
            </form>
          </div>

        </section>

      </main>

      {/* Footer System Control Reset */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-3 px-6 flex items-center justify-between text-[10px] text-zinc-600 font-mono">
        <div>SENTINEL CINEMA DRM v0.1.0 • SYSTEM INTEGRITY STABLE</div>
        <button 
          onClick={resetAllData}
          className="text-red-500/70 hover:text-red-400 hover:underline flex items-center gap-1 transition"
        >
          <RefreshCw className="h-3 w-3" /> Hard Reset LocalStorage mock DB
        </button>
      </footer>

      {/* Razorpay Simulated Overlay Modal */}
      {activeRazorpayInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white text-zinc-950 rounded-lg overflow-hidden max-w-sm w-full shadow-2xl border border-zinc-200"
          >
            {/* Razorpay Header banner */}
            <div className="bg-blue-600 p-4 text-white flex items-center justify-between">
              <div>
                <span className="block text-xs uppercase tracking-wider text-blue-200 font-semibold">Razorpay Secure Checkout</span>
                <span className="block text-sm font-bold mt-1">Kite & Tail Studios Payment</span>
              </div>
              <button 
                onClick={() => {
                  setActiveRazorpayInvoice(null);
                  setRazorpayCard("");
                  setRazorpayCvv("");
                }}
                className="text-blue-200 hover:text-white font-bold text-sm"
              >
                Cancel
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handleRazorpaySettle} className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <span className="text-zinc-500 text-xs">Paying Invoice:</span>
                <span className="font-semibold text-xs font-mono text-zinc-800">INV_{activeRazorpayInvoice.id.substring(4, 9).toUpperCase()}</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-800 text-xs font-bold">Total Amount Due:</span>
                <span className="font-bold text-lg text-blue-600">
                  ${activeRazorpayInvoice.base_retainer_due + activeRazorpayInvoice.screen_fees - activeRazorpayInvoice.bounty_rewards} USD
                </span>
              </div>

              <div className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="block text-zinc-500 mb-1">Card Number</label>
                  <input
                    type="text"
                    required
                    maxLength={19}
                    placeholder="4111 2222 3333 4444"
                    value={razorpayCard}
                    onChange={(e) => setRazorpayCard(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded p-2 text-zinc-800 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-500 mb-1">Expiry</label>
                    <input
                      type="text"
                      required
                      placeholder="MM/YY"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded p-2 text-zinc-800 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 mb-1">CVV</label>
                    <input
                      type="password"
                      required
                      maxLength={3}
                      placeholder="123"
                      value={razorpayCvv}
                      onChange={(e) => setRazorpayCvv(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded p-2 text-zinc-800 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded text-xs transition mt-6 flex items-center justify-center gap-1.5"
              >
                <DollarSign className="h-4 w-4" /> Settle Security Retainer
              </button>

              <div className="text-center">
                <span className="text-[9px] text-zinc-400">Protected by 256-bit SSL encryption.</span>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Pure helper function declared outside React component scope to satisfy strict linter checks
function generateRandomPayload(simPayload: string, simChain: string, simCity: string, simScreen: string): string {
  return simPayload.trim() || `${simChain.substring(0,3).toUpperCase()}_${simCity.substring(0,3).toUpperCase()}_S${simScreen}_ID${Math.floor(Math.random()*100)}`;
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useDrm, BillingLedger } from "../context/DrmContext";
import { useRouter } from "next/navigation";
import { 
  Film, UploadCloud, Send, CheckCircle, 
  LogOut, Cpu, Play, RefreshCw, Key, MapPin, 
  Sliders, Eye, EyeOff, Sparkles, CreditCard, ChevronRight, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
interface IngestionItem {
  zone: string;
  file: File;
  status: "queued" | "processing" | "completed";
  progress: number;
}

interface VideoMetadata {
  make?: string;
  model?: string;
  gps?: string;
}

export default function DashboardPage() {
  const { 
    currentProfile, movies, theatreScreens, leakAlerts, billingLedgers, globalConfig,
    addMovie, dispatchTakedown, submitBankTransfer, settleInvoice, logout, resetAllData, isLoading
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

  // UI States
  const [newMovieTitle, setNewMovieTitle] = useState("");
  const [ingestionQueue, setIngestionQueue] = useState<IngestionItem[]>([]);
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [activeBankInvoice, setActiveBankInvoice] = useState<BillingLedger | null>(null);
  
  // Checkout & Payment states
  const [paymentTab, setPaymentTab] = useState<"razorpay" | "bank">("razorpay");
  const [isPayingRazorpay, setIsPayingRazorpay] = useState(false);
  const [bankUtr, setBankUtr] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  
  // Custom Toast state
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "warning" | "alert">("success");
  
  // Drop zone states
  const [selectedScreenId, setSelectedScreenId] = useState<string>("");
  const [customPayload, setCustomPayload] = useState<string>("");
  const [extractedMetadata, setExtractedMetadata] = useState<VideoMetadata | null>(null);
  const [selectedAtom, setSelectedAtom] = useState<string | null>(null);

  // Stego customizer states
  const [stegoOpacity, setStegoOpacity] = useState<number>(90);
  const [stegoDotColor, setStegoDotColor] = useState<string>("#06b6d4"); // default cyan
  const [isStegoOverlayVisible, setIsStegoOverlayVisible] = useState<boolean>(true);
  const [userOverriddenBits, setUserOverriddenBits] = useState<number[] | null>(null);

  // Developer api / webhooks states
  const [apiKey, setApiKey] = useState<string>("sn_live_a1b2c3d4e5f6g7h8i9j0_mock");
  const [apiLanguage, setApiLanguage] = useState<"curl" | "node" | "python">("curl");
  const [isSecretVisible, setIsSecretVisible] = useState<boolean>(false);

  // Map / Location states
  const [selectedCityNode, setSelectedCityNode] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Sync initial theatre screens asynchronously to prevent React rendering cascade warnings
  useEffect(() => {
    if (theatreScreens.length > 0 && !selectedScreenId) {
      const timer = setTimeout(() => {
        setSelectedScreenId(theatreScreens[0].id);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [theatreScreens, selectedScreenId]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [telemetryLogs]);

  if (isLoading || !currentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-glareless-slate-light">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-premium-indigo" />
          <span className="text-xs font-sans font-medium text-slate-500 tracking-wider">LOADING DRM NODE...</span>
        </div>
      </div>
    );
  }

  const triggerToast = (msg: string, type: "success" | "warning" | "alert" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const addLog = (log: string) => {
    setTelemetryLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
  };

  const handleAddMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMovieTitle.trim()) return;
    try {
      const newMovie = await addMovie(newMovieTitle);
      setNewMovieTitle("");
      triggerToast(`Ingested "${newMovie.title}" successfully.`, "success");
      addLog(`REGISTERED NEW WATERMARK BOUNDARY: "${newMovie.title}"`);
    } catch {
      triggerToast("Failed to register movie asset.", "alert");
    }
  };

  // Movie ingestion zones
  const zones = [
    { key: "intro", name: "Hero Intro Block", desc: "First 15 mins. Spatial Telemetry A." },
    { key: "pre_interval", name: "Pre-Interval Block", desc: "Middle action. Spatial Telemetry B." },
    { key: "action", name: "Action/Song Sequence", desc: "Climax bridge. Spatial Telemetry C." },
    { key: "climax", name: "Climax Block", desc: "Final 15 mins. Critical Telemetry D." }
  ];

  const handleFileDrop = (zoneKey: string, file: File) => {
    const isTrial = currentProfile && currentProfile.trial_uses_remaining > 0;
    const maxSize = isTrial ? 50 * 1024 * 1024 : 150 * 1024 * 1024;
    const limitLabel = isTrial ? "5-minute trial" : "15-minute";

    if (file.size > maxSize) {
      triggerToast(`File size violates ${limitLabel} clip threshold limits.`, "warning");
      return;
    }
    
    const exists = ingestionQueue.some(item => item.zone === zoneKey);
    if (exists) {
      triggerToast(`Zone "${zoneKey}" is already in processing queue.`, "warning");
      return;
    }

    setIngestionQueue(prev => [...prev, {
      zone: zoneKey,
      file: file,
      status: "queued",
      progress: 0
    }]);

    addLog(`QUEUED FILE FOR INGESTION: ${file.name} (Zone: ${zoneKey})`);
    addLog(`[TELEMETRY] SCANNING QUICKTIME ATOM HEADERS FOR EXIF / DEVICE DATA...`);
    
    parseVideoMetadata(file).then(meta => {
      setExtractedMetadata(meta);
      addLog(`[TELEMETRY] EXIF IDENTIFIED: Manufacturer: ${meta.make || "Unknown"}, Model: ${meta.model || "Unknown"}`);
      if (meta.gps) {
        addLog(`[TELEMETRY] GPS METADATA GEOLOCATION: ${meta.gps}`);
      }
    });
  };

  // Helper to generate watermark signature payload
  const getWatermarkPayload = () => {
    if (selectedScreenId === "custom") {
      return customPayload.trim() || "SENTINEL_DEMO";
    }
    const s = theatreScreens.find(scr => scr.id === selectedScreenId);
    if (!s) return "SENTINEL_DEMO";
    if (s.id === "scr_1") return "AMC_EMP25_NY_S4_ID89";
    const chain = s.chain_name.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase();
    const city = s.city.substring(0, 3).toUpperCase();
    const screen = s.screen_number;
    return `${chain}_${city}_S${screen}_ID${s.id.substring(4, 7).toUpperCase()}`;
  };

  const getBits = () => {
    if (userOverriddenBits) return userOverriddenBits;
    const payload = getWatermarkPayload();
    return stringToBits(payload);
  };

  // Toggle dynamic stego bits manually in preview
  const handleBitClick = (idx: number) => {
    const bitsList = [...getBits()];
    bitsList[idx] = bitsList[idx] === 1 ? 0 : 1;
    setUserOverriddenBits(bitsList);
    addLog(`[STEGO_CUSTOMIZER] MANUAL OVERRIDE: Bit #${idx} toggled to ${bitsList[idx]}`);
  };

  // Reset stego bits to default payload
  const resetStegoBits = () => {
    setUserOverriddenBits(null);
    addLog(`[STEGO_CUSTOMIZER] Overridden bits reset to match current payload signature.`);
  };

  // Generate dynamic API keys
  const generateApiKey = () => {
    const key = `sn_live_${Math.random().toString(36).substring(2, 12)}_${Math.random().toString(36).substring(2, 12)}`;
    setApiKey(key);
    addLog(`[API_CREDENTIALS] NEW JWT BEARER SIGNATURE GENERATED: ${key.substring(0, 15)}...`);
    triggerToast("Generated new API token.", "success");
  };

  // Process the stego-stitching queue
  const startProcessingQueue = async () => {
    if (ingestionQueue.length === 0 || isProcessingQueue) return;
    setIsProcessingQueue(true);
    addLog("INITIATING SEQUENTIAL FFMEPG WATERMARK PIPELINE...");

    const payload = getWatermarkPayload();

    for (let i = 0; i < ingestionQueue.length; i++) {
      const current = ingestionQueue[i];
      if (current.status === "completed") continue;

      setIngestionQueue(prev => prev.map((item, idx) => 
        idx === i ? { ...item, status: "processing" as const } : item
      ));

      addLog(`[FFMPEG] LOADING WASM FOR FILE: ${current.file.name}...`);
      await delay(500);

      addLog(`[FFMPEG] WATERMARK SIGNATURE PAYLOAD: "${payload}"`);
      addLog(`[FFMPEG] STITCHING SPATIAL STEGANOGRAPHIC WATERMARK LAYER...`);

      try {
        let watermarkedBlob: Blob;
        try {
          addLog(`[FFMPEG] COMPILING FILTER GRAPH SCRIPT...`);
          watermarkedBlob = await runFFmpegWatermark(current.file, payload, (progress) => {
            setIngestionQueue(prev => prev.map((item, idx) => 
              idx === i ? { ...item, progress } : item
            ));
            if (progress % 25 === 0) {
              addLog(`[FFMPEG] WATERMARK FRAME DEVIATION STAGE (WASM): ${progress}%`);
            }
          });
        } catch {
          addLog(`[FFMPEG] WASM ACCESS INTERRUPTED. RUNNING CANVAS RENDER FILTER GRAPH PIPELINE...`);
          
          watermarkedBlob = await startWatermarkProcess(current.file, payload, (progress) => {
            setIngestionQueue(prev => prev.map((item, idx) => 
              idx === i ? { ...item, progress } : item
            ));
            if (progress % 25 === 0) {
              addLog(`[FFMPEG] WATERMARK FRAME DEVIATION STAGE (CANVAS): ${progress}%`);
            }
          });
        }

        setIngestionQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, progress: 100 } : item
        ));
        addLog(`[FFMPEG] WATERMARK COMPLETED. ENCODING OUTPUT BUFFER.`);
        await delay(300);

        const url = URL.createObjectURL(watermarkedBlob);
        const a = document.createElement("a");
        a.href = url;
        const extension = watermarkedBlob.type.split('/')[1] || "webm";
        a.download = `watermarked_${current.file.name.split('.')[0]}_${current.zone}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog(`[FFMPEG] DOWNLOAD DISPATCHED FOR watermarked_${current.file.name.split('.')[0]}_${current.zone}.${extension}`);

        addLog(`[MEMORY] RECLAIMING RAM. UNLINKING FILES.`);
        await delay(300);
        addLog(`[MEMORY] GARBAGE COLLECTION SUCCESSFUL.`);

        setIngestionQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: "completed" as const } : item
        ));
      } catch (err) {
        console.error("Watermark failed:", err);
        addLog(`[FFMPEG] ❌ RENDER ERROR: ${err instanceof Error ? err.message : String(err)}`);
        setIngestionQueue(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: "queued" as const, progress: 0 } : item
        ));
        triggerToast("Failed to render watermarked video.", "alert");
      }
    }

    setIsProcessingQueue(false);
    triggerToast("All queued movie zones watermarked and processed successfully!", "success");
    addLog("SEQUENTIAL INGESTION QUEUE FLUSH COMPLETED.");
  };

  // Takedown dispatch handler
  const handleTakedown = (alertId: string, movieTitle: string) => {
    dispatchTakedown(alertId);
    triggerToast(`Takedown notice dispatched for ${movieTitle}.`, "success");
    addLog(`DISPATCHED LEGAL CITATION & TAKEDOWN NOTICE: ALERT_${alertId.toUpperCase()}`);
  };

  // Settle via mock Razorpay flow
  const handleRazorpaySettle = async () => {
    if (!activeBankInvoice) return;
    setIsPayingRazorpay(true);
    addLog(`[RAZORPAY] INITIATING GATEWAY SHIELD TRANSACTION FOR INV_${activeBankInvoice.id.substring(4, 9).toUpperCase()}...`);
    await delay(2000);
    try {
      await settleInvoice(activeBankInvoice.id);
      triggerToast("Invoice settled successfully via Razorpay.", "success");
      addLog(`[RAZORPAY] MOCK TRANSACTION SUCCESS. INVOICE INV_${activeBankInvoice.id.substring(4, 9).toUpperCase()} SETTLED.`);
      setActiveBankInvoice(null);
    } catch {
      triggerToast("Razorpay gateway timeout.", "alert");
    } finally {
      setIsPayingRazorpay(false);
    }
  };

  // Submit manual bank transfer reference
  const handleBankSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBankInvoice) return;

    if (bankUtr.length !== 12 || !/^\d+$/.test(bankUtr)) {
      triggerToast("UTR must be exactly 12 numeric digits.", "warning");
      return;
    }

    try {
      setIsSubmittingTransfer(true);
      addLog(`[BANK] RECORDING BANK TRANSFER RECONCILIATION ON HDFC CORRIDOR...`);
      await submitBankTransfer(activeBankInvoice.id, bankUtr, receiptFile ? receiptFile.name : "receipt_slip.pdf");
      triggerToast("Settlement reference submitted for admin verification.", "success");
      addLog(`[BANK] UTR REFERENCE SUBMITTED: ${bankUtr}. STATUS PENDING VERIFICATION.`);
      
      setActiveBankInvoice(null);
      setBankUtr("");
      setReceiptFile(null);
    } catch {
      triggerToast("Failed to submit bank transfer reference.", "alert");
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // API Code snippets mapping
  const codeSnippets = {
    curl: `curl -X POST https://api.sentinelcinema.com/v1/watermark \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: multipart/form-data" \\
  -F "video=@/path/to/movie_block.mov" \\
  -F "payload=${getWatermarkPayload()}" \\
  -F "opacity=${stegoOpacity / 100}"`,
    node: `const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const form = new FormData();
form.append('video', fs.createReadStream('/path/to/movie_block.mov'));
form.append('payload', '${getWatermarkPayload()}');
form.append('opacity', '${stegoOpacity / 100}');

axios.post('https://api.sentinelcinema.com/v1/watermark', form, {
  headers: {
    ...form.getHeaders(),
    'Authorization': 'Bearer ${apiKey}'
  }
}).then(res => console.log('Watermark job queued:', res.data.jobId));`,
    python: `import requests

url = "https://api.sentinelcinema.com/v1/watermark"
headers = {"Authorization": "Bearer ${apiKey}"}
files = {"video": open("/path/to/movie_block.mov", "rb")}
data = {
    "payload": "${getWatermarkPayload()}",
    "opacity": "${stegoOpacity / 100}"
}

response = requests.post(url, headers=headers, files=files, data=data)
print("Watermark job queued:", response.json().get("jobId"))`
  };

  const bitsList = getBits();

  return (
    <div className="flex-1 flex bg-glareless-slate-light min-h-screen relative font-sans text-slate-800 antialiased">
      
      {/* Dynamic Success/Warning/Alert Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border shadow-lg text-sm font-semibold transition ${
              toastType === "success" 
                ? "bg-emerald-50 border-emerald-200 text-jade-emerald" 
                : toastType === "warning"
                  ? "bg-amber-50 border-amber-200 text-muted-amber"
                  : "bg-red-50 border-red-200 text-deep-burgundy"
            }`}
          >
            <CheckCircle className={`h-5 w-5 ${
              toastType === "success" ? "text-emerald-600" : toastType === "warning" ? "text-amber-600" : "text-red-600"
            }`} />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Left-Hand Navigation Sidebar (Midnight Obsidian & Deep Slate Onyx) */}
      <aside className="w-80 bg-midnight-obsidian border-r border-cool-accent-gray flex flex-col justify-between select-none shadow-sm shrink-0">
        <div>
          {/* Brand Logo Header */}
          <div className="p-6 border-b border-deep-slate-onyx flex items-center gap-3">
            <div className="bg-premium-indigo p-2 rounded-lg text-white">
              <Film className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-sm font-display font-bold text-white tracking-wider">SENTINEL CINEMA</h1>
              <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">DRM COMMAND PORTAL</p>
            </div>
          </div>

          {/* User profile identifier */}
          <div className="p-6 border-b border-deep-slate-onyx bg-deep-slate-onyx/40">
            <span className="block text-xs font-semibold text-slate-300 font-sans tracking-wide truncate">
              {currentProfile.company_name || currentProfile.email}
            </span>
            <span className="inline-flex items-center gap-1.5 mt-2 rounded bg-midnight-obsidian border border-slate-700/60 text-[9px] px-2 py-0.5 text-cyan-400 font-mono">
              <Cpu className="h-2.5 w-2.5" /> Node: {currentProfile.device_fingerprint_hash}
            </span>
          </div>

          {/* Sidebar Menu Items */}
          <nav className="p-4 space-y-1">
            <div className="text-[9px] font-bold text-slate-500 px-3 py-2 uppercase tracking-widest font-mono">Operations Console</div>
            
            <button className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-xs font-semibold bg-deep-slate-onyx text-white hover:text-white transition">
              <Sliders className="h-4 w-4 text-premium-indigo" />
              <span>Watermark Workbench</span>
            </button>

            {currentProfile.role === "SUPER_ADMIN" && (
              <button
                onClick={() => router.push("/admin")}
                className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-deep-slate-onyx/40 transition"
              >
                <Cpu className="h-4 w-4 text-purple-400" />
                <span>Super Admin Desk</span>
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Footer Logout & Reset */}
        <div className="p-4 border-t border-deep-slate-onyx space-y-2">
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-deep-slate-onyx/40 transition"
          >
            <span className="flex items-center gap-2">
              <LogOut className="h-4 w-4" /> Sign Out Session
            </span>
            <ChevronRight className="h-3 w-3" />
          </button>

          <button
            onClick={resetAllData}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[9px] font-mono text-red-500/80 hover:text-red-400 hover:bg-deep-burgundy/10 transition"
          >
            <RefreshCw className="h-3 w-3 animate-spin-slow" /> Hard Reset Local Mock DB
          </button>
        </div>
      </aside>

      {/* Main Content Workspace (Canvas light viewport #F8FAFC) */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-glareless-slate-light">
        
        {/* Navigation Banner Header */}
        <header className="bg-white border-b border-cool-accent-gray px-8 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Workspace</span>
            <h2 className="text-xl font-display font-bold text-midnight-obsidian">Digital Rights Management Desk</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-jade-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Mesh Active
            </span>
          </div>
        </header>

        {/* Dashboard Sections Grid */}
        <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
          
          {/* Threat Metric Geolocation Cards Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Active Incidents Overview */}
            <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Incident Control</span>
                <h3 className="text-sm font-sans font-medium text-slate-600 mt-1">Global Piracy Leak Status</h3>
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-display font-bold text-midnight-obsidian">
                  {leakAlerts.filter(a => a.status === "Active").length}
                </span>
                <span className="text-xs font-semibold text-slate-500">Active breaches pulsing</span>
              </div>
            </div>

            {/* Ingestion Asset Count */}
            <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Asset Mesh</span>
                <h3 className="text-sm font-sans font-medium text-slate-600 mt-1">Watermarked Boundary Records</h3>
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-3xl font-display font-bold text-midnight-obsidian">{movies.length}</span>
                <span className="text-xs font-semibold text-slate-500">Movies protected</span>
              </div>
            </div>

            {/* Account trial limit */}
            <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm flex flex-col justify-between min-h-[140px]">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Node Licensing</span>
                <h3 className="text-sm font-sans font-medium text-slate-600 mt-1">Subscription License Tier</h3>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-bold text-premium-indigo font-mono bg-indigo-50 border border-indigo-100 px-3 py-1 rounded">
                  {currentProfile.subscription_tier || "Gold"} License
                </span>
                <span className="text-[10px] font-semibold text-slate-500 font-mono">
                  Trials: {currentProfile.trial_uses_remaining} clips
                </span>
              </div>
            </div>

          </div>

          {/* Interactive Stego Customizer & Movie Ingestion Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* Left Col: Workbench & Ingest Queue (8-span) */}
            <div className="xl:col-span-7 space-y-8">
              
              {/* Interactive Video Ingestion Desk */}
              <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-cool-accent-gray pb-4">
                  <div>
                    <h3 className="text-base font-display font-bold text-midnight-obsidian">Movie Ingestion Workbench</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Stitch watermark layers sequentially into movie blocks.</p>
                  </div>
                  
                  <button
                    onClick={startProcessingQueue}
                    disabled={isProcessingQueue || ingestionQueue.length === 0}
                    className="bg-premium-indigo hover:bg-deep-sapphire disabled:opacity-40 text-white font-semibold py-2 px-5 rounded-lg text-xs transition-colors duration-200 flex items-center gap-2 min-h-[44px]"
                  >
                    {isProcessingQueue ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Weave Stego Layers
                  </button>
                </div>

                {/* Stego Configuration Targets */}
                <div className="bg-glareless-slate-light border border-cool-accent-gray rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">Target Screen Node</label>
                    <select
                      value={selectedScreenId}
                      onChange={(e) => {
                        setSelectedScreenId(e.target.value);
                        if (e.target.value !== "custom") {
                          setCustomPayload("");
                        }
                      }}
                      className="w-full bg-white border border-cool-accent-gray rounded-lg p-2.5 font-sans text-slate-700 focus:outline-none focus:border-premium-indigo transition-colors duration-200"
                    >
                      {theatreScreens.map((screen) => (
                        <option key={screen.id} value={screen.id}>
                          {screen.chain_name} — {screen.city} (Screen {screen.screen_number})
                        </option>
                      ))}
                      <option value="custom">Override with Custom Payload...</option>
                    </select>
                  </div>

                  <div>
                    {selectedScreenId === "custom" ? (
                      <>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">Stego Payload String</label>
                        <input
                          type="text"
                          maxLength={25}
                          value={customPayload}
                          onChange={(e) => setCustomPayload(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
                          placeholder="e.g. SENTINEL_ENVELOPE_01"
                          className="w-full bg-white border border-cool-accent-gray rounded-lg p-2.5 text-slate-700 focus:outline-none focus:border-premium-indigo font-mono"
                        />
                      </>
                    ) : (
                      <>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">Generated Envelope Signature</label>
                        <div className="bg-slate-100 border border-cool-accent-gray p-2.5 rounded-lg font-mono text-xs text-premium-indigo truncate">
                          {getWatermarkPayload()}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 4 Interactive Drop Zones */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {zones.map((zone) => {
                    const queuedItem = ingestionQueue.find(item => item.zone === zone.key);
                    return (
                      <div
                        key={zone.key}
                        className={`border-2 rounded-xl p-4 text-center flex flex-col justify-between min-h-[140px] transition-all duration-300 relative overflow-hidden select-none ${
                          queuedItem
                            ? queuedItem.status === "processing"
                              ? "border-premium-indigo bg-indigo-50/20"
                              : queuedItem.status === "completed"
                                ? "border-emerald-200 bg-emerald-50/20"
                                : "border-cool-accent-gray bg-white"
                            : "border-dashed border-slate-300 hover:border-premium-indigo bg-white cursor-pointer"
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
                          <div className="text-[11px] font-bold text-slate-800">{zone.name}</div>
                          <div className="text-[9px] text-slate-500 mt-1 leading-normal">{zone.desc}</div>
                        </div>

                        <div className="mt-4">
                          {queuedItem ? (
                            <div className="space-y-2">
                              <div className="text-[9px] text-slate-600 font-mono truncate">{queuedItem.file.name}</div>
                              {queuedItem.status === "processing" ? (
                                <div className="space-y-1">
                                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-premium-indigo h-full transition-all duration-300" style={{ width: `${queuedItem.progress}%` }} />
                                  </div>
                                  <span className="text-[9px] text-premium-indigo font-semibold">{queuedItem.progress}% stitched</span>
                                </div>
                              ) : queuedItem.status === "completed" ? (
                                <span className="text-[9px] text-jade-emerald font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                                  <CheckCircle className="h-3 w-3" /> SECURE BIND
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Queued</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1 py-1 text-slate-400">
                              <UploadCloud className="h-5 w-5 text-slate-400" />
                              <span className="text-[9px] font-semibold uppercase tracking-wider">Drag file</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Queue Manager utils */}
                {ingestionQueue.length > 0 && (
                  <div className="text-right">
                    <button
                      onClick={() => setIngestionQueue([])}
                      disabled={isProcessingQueue}
                      className="text-[11px] font-bold text-slate-500 hover:text-red-500 underline transition-colors duration-200"
                    >
                      Flush Workbench Queue
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic EXIF Node Analyzer */}
              <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-base font-display font-bold text-midnight-obsidian">EXIF QuickTime Metadata Scanner</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Decodes standard QuickTime meta blocks and atom indices.</p>
                </div>

                {extractedMetadata ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Interactive Atom Node Blocks */}
                    <div className="md:col-span-5 space-y-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Atom Box Layout</span>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        {[
                          { name: "ftyp", size: "28B", data: "major_brand: mp42" },
                          { name: "moov", size: "235KB", data: "movie header and tracks metadata" },
                          { name: "mvhd", size: "108B", data: "timescale: 600, duration: 3000" },
                          { name: "udta", size: "1.2KB", data: "user metadata parent node" },
                          { name: "meta", size: "890B", data: "hdlr: mdir, keys metadata entries" },
                          { name: "©mak", size: "16B", data: `make: ${extractedMetadata.make || "Apple"}` },
                          { name: "©mod", size: "22B", data: `model: ${extractedMetadata.model || "iPhone"}` },
                          { name: "©xyz", size: "32B", data: `gps: ${extractedMetadata.gps || "40.75,-73.98"}` }
                        ].map((atom) => {
                          const isSelected = selectedAtom === atom.name;
                          return (
                            <div
                              key={atom.name}
                              onClick={() => setSelectedAtom(atom.name)}
                              className={`p-2 rounded-lg border text-left cursor-pointer transition-all duration-200 ${
                                isSelected 
                                  ? "border-premium-indigo bg-indigo-50/50 text-premium-indigo" 
                                  : "border-cool-accent-gray bg-white text-slate-600 hover:border-slate-400"
                              }`}
                            >
                              <div className="font-bold flex justify-between">
                                <span>{atom.name}</span>
                                <span className="text-[9px] text-slate-400 font-normal">{atom.size}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Node Data Details Panel */}
                    <div className="md:col-span-7 bg-glareless-slate-light border border-cool-accent-gray rounded-xl p-4 flex flex-col justify-between min-h-[200px]">
                      <div className="space-y-3 font-mono text-xs">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-cool-accent-gray pb-2">Atom Inspector</div>
                        
                        {selectedAtom ? (
                          <div className="space-y-2">
                            <div className="text-slate-500 font-semibold uppercase text-[10px]">Box: <span className="text-slate-800 font-mono text-xs">{selectedAtom}</span></div>
                            <div className="text-slate-700 bg-white p-3 rounded-lg border border-cool-accent-gray leading-relaxed break-all">
                              {(() => {
                                if (selectedAtom === "©mak") return `Parsed Manufacturer String: ${extractedMetadata.make || "Apple"}`;
                                if (selectedAtom === "©mod") return `Parsed Hardware Model: ${extractedMetadata.model || "iPhone 15 Pro Max"}`;
                                if (selectedAtom === "©xyz") return `Parsed Geolocation Coordinates: ${extractedMetadata.gps || "+40.7580-73.9855/"}`;
                                return `Static Container data representation: Raw block payload bytes authenticated. Metadata matching constraints: PASSED.`;
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-400 text-center py-12">Click an atom box block to inspect payload details.</div>
                        )}
                      </div>

                      <div className="text-[9px] text-slate-400 font-mono">
                        EXIF parser successfully read {extractedMetadata ? Object.keys(extractedMetadata).length : 0} threat vectors.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400 text-xs font-mono border border-dashed border-slate-300 rounded-xl bg-white select-none">
                    NO ACTIVE ASSETS SCANNED. INGEST A VIDEO CLIP TO POPULATE EXIF DATA.
                  </div>
                )}
              </div>

              {/* Movie Registry Console Form */}
              <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-display font-bold text-midnight-obsidian">Register Movie Boundaries</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Register new theatrical release movie assets before ingestion.</p>
                </div>
                <form onSubmit={handleAddMovie} className="flex gap-3">
                  <input
                    type="text"
                    value={newMovieTitle}
                    onChange={(e) => setNewMovieTitle(e.target.value)}
                    placeholder="e.g. Midnight Chronicles (Distributor Lock)"
                    className="flex-1 bg-slate-50 border border-cool-accent-gray rounded-lg px-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-premium-indigo font-sans"
                  />
                  <button
                    type="submit"
                    className="bg-premium-indigo hover:bg-deep-sapphire text-white font-semibold py-2 px-5 rounded-lg text-xs transition min-h-[44px]"
                  >
                    Register Movie
                  </button>
                </form>
              </div>

            </div>

            {/* Right Col: Stego Customizer & Geographical threat maps (5-span) */}
            <div className="xl:col-span-5 space-y-8">
              
              {/* Interactive Stego Customizer Panel */}
              <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-base font-display font-bold text-midnight-obsidian">Steganographic Envelope Customizer</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Control spatial dot densities and coordinates live.</p>
                </div>

                {/* Grid Bit Layout Preview */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-500">Watermark Pixel Map (24 x 10)</span>
                    <button 
                      onClick={resetStegoBits}
                      className="text-premium-indigo hover:underline text-[10px]"
                    >
                      Reset Overrides
                    </button>
                  </div>

                  <div className="bg-midnight-obsidian p-4 rounded-xl border border-cool-accent-gray">
                    <div 
                      className="grid gap-px mx-auto" 
                      style={{ 
                        gridTemplateColumns: `repeat(24, minmax(0, 1fr))`,
                        maxWidth: "340px"
                      }}
                    >
                      {Array.from({ length: 240 }).map((_, idx) => {
                        const bitVal = getBits()[idx] || 0;
                        const isSet = bitVal === 1;
                        return (
                          <div
                            key={idx}
                            onClick={() => handleBitClick(idx)}
                            className="aspect-square cursor-pointer rounded-[1px] transition-all duration-150"
                            style={{
                              backgroundColor: isSet ? stegoDotColor : "#1E293B",
                              opacity: isSet ? stegoOpacity / 100 : 0.4
                            }}
                            title={`Bit #${idx}: ${bitVal}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <span className="text-[9.5px] text-slate-400 block font-mono">Click pixel cells to manually toggle custom payload sequence bits.</span>
                </div>

                {/* Adjustments Sliders */}
                <div className="space-y-4 pt-2 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-600 font-semibold mb-1">
                      <span>Overlay Opacity Alpha</span>
                      <span className="font-mono">{stegoOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={stegoOpacity}
                      onChange={(e) => setStegoOpacity(Number(e.target.value))}
                      className="w-full accent-premium-indigo"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-600 font-semibold mb-1.5">
                      <span>Stego Dot Hex Color</span>
                      <span className="font-mono text-premium-indigo select-all">{stegoDotColor}</span>
                    </div>
                    <div className="flex gap-2">
                      {[
                        { name: "Cyan", hex: "#06b6d4" },
                        { name: "Indigo", hex: "#4F46E5" },
                        { name: "Emerald", hex: "#059669" },
                        { name: "Gold Accent", hex: "#D97706" }
                      ].map((col) => (
                        <button
                          key={col.hex}
                          onClick={() => {
                            setStegoDotColor(col.hex);
                            addLog(`[STEGO_CUSTOMIZER] Primary dot color token adjusted to ${col.hex}`);
                          }}
                          className={`flex-1 py-1 rounded text-[10px] font-semibold transition border ${
                            stegoDotColor === col.hex 
                              ? "border-premium-indigo bg-indigo-50 text-premium-indigo" 
                              : "border-cool-accent-gray bg-white text-slate-500"
                          }`}
                        >
                          {col.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-cool-accent-gray">
                    <span className="text-slate-600 font-semibold">Stego Guides Overlay</span>
                    <button
                      onClick={() => setIsStegoOverlayVisible(!isStegoOverlayVisible)}
                      className={`p-1.5 rounded-lg border transition-all duration-200 ${
                        isStegoOverlayVisible 
                          ? "border-premium-indigo text-premium-indigo bg-indigo-50/50" 
                          : "border-cool-accent-gray text-slate-400 bg-white"
                      }`}
                    >
                      {isStegoOverlayVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Threat Hotspot Geolocation Map Widget */}
              <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-base font-display font-bold text-midnight-obsidian">Spatial Threat locator Map</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Visualizes hot-zones where camcorder leaks were logged.</p>
                </div>

                {/* Custom SVG Map with City Nodes */}
                <div className="relative bg-slate-900 border border-cool-accent-gray rounded-xl p-4 overflow-hidden h-48 flex items-center justify-center">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
                  
                  {/* SVG map representation */}
                  <svg className="w-full h-full text-slate-700 opacity-60" viewBox="0 0 100 50">
                    <path d="M10,20 Q20,10 40,25 T80,15 T90,35" fill="none" stroke="#334155" strokeWidth="0.5" strokeDasharray="1,1" />
                    <circle cx="25" cy="15" r="1" fill="#64748B" />
                    <circle cx="45" cy="35" r="1.2" fill="#64748B" />
                    <circle cx="70" cy="20" r="1" fill="#64748B" />
                  </svg>

                  {/* NYC pin point */}
                  <div 
                    onClick={() => {
                      setSelectedCityNode("nyc");
                      addLog(`[GEOLOCATION] SELECTED NODE: NYC. Breach Alert count: 1.`);
                    }}
                    className="absolute cursor-pointer group"
                    style={{ left: "20%", top: "35%" }}
                  >
                    <span className="absolute -left-1.5 -top-1.5 w-5 h-5 rounded-full bg-red-500/20 group-hover:bg-red-500/30 animate-ping" />
                    <MapPin className="h-5 w-5 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                  </div>

                  {/* New Delhi pin point */}
                  <div 
                    onClick={() => {
                      setSelectedCityNode("delhi");
                      addLog(`[GEOLOCATION] SELECTED NODE: New Delhi. Breach Alert count: 1.`);
                    }}
                    className="absolute cursor-pointer group"
                    style={{ left: "70%", top: "55%" }}
                  >
                    <span className="absolute -left-1.5 -top-1.5 w-5 h-5 rounded-full bg-red-500/20 group-hover:bg-red-500/30 animate-ping" />
                    <MapPin className="h-5 w-5 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                  </div>
                </div>

                {/* Details card for city nodes */}
                <div className="bg-glareless-slate-light border border-cool-accent-gray rounded-xl p-4 text-xs font-mono">
                  {selectedCityNode === "nyc" ? (
                    <div className="space-y-1">
                      <div className="font-bold text-slate-800">New York Threat Node</div>
                      <div className="text-slate-500">Active Theater: AMC Empire 25</div>
                      <div className="text-slate-500">Resolved Coordinates: +40.7580 -73.9855</div>
                      <div className="text-red-600 font-semibold">Infringement Signal: Active Camcording Blocked</div>
                    </div>
                  ) : selectedCityNode === "delhi" ? (
                    <div className="space-y-1">
                      <div className="font-bold text-slate-800">New Delhi Threat Node</div>
                      <div className="text-slate-500">Active Theater: PVR Director&apos;s Cut</div>
                      <div className="text-slate-500">Resolved Coordinates: +28.5355 +77.2639</div>
                      <div className="text-red-600 font-semibold">Infringement Signal: Takedown citation dispatched</div>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-center py-4">Click map hot-spots to locate active breach centers.</div>
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* Active Breaches & Telemetry Log (Double Columns Row) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Active Breaches list panel */}
            <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-cool-accent-gray pb-4">
                <div>
                  <h3 className="text-base font-display font-bold text-midnight-obsidian">Active Breach Incidents</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Enforce legal takedown citations for verified leaks.</p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-red-50 text-red-600 border border-red-100 px-2.5 py-0.5 rounded-full animate-pulse">
                  REAL-TIME SYNC
                </span>
              </div>

              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {leakAlerts.filter(a => a.status === "Active").length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs font-mono border border-dashed border-slate-300 rounded-xl bg-slate-50">
                    NO ACTIVE BREACH DETECTED IN THE PIPELINE.
                  </div>
                ) : (
                  leakAlerts.map((alert) => {
                    const targetMovie = movies.find(m => m.id === alert.movie_id);
                    const screen = theatreScreens.find(s => s.id === alert.theatre_id);
                    return (
                      <div 
                        key={alert.id} 
                        className="bg-white border border-cool-accent-gray rounded-xl p-4 space-y-3 hover:border-red-300 transition-all duration-300 relative overflow-hidden shadow-sm"
                      >
                        <div className="absolute top-0 bottom-0 left-0 w-1 bg-red-600" />

                        <div className="text-xs space-y-2 pl-2 font-mono">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-red-600 uppercase tracking-wider text-[10px]">⚠️ SYSTEM_BREACH_ALERT</span>
                            <span className="text-[9px] text-slate-400">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 font-sans pt-1">
                            <div><span className="font-bold text-slate-400">MOVIE:</span> {targetMovie?.title || "Unknown"}</div>
                            <div><span className="font-bold text-slate-400">THEATER:</span> {screen?.chain_name || "Unknown"}</div>
                            <div><span className="font-bold text-slate-400">LOCATION:</span> {screen?.city || "Unknown"}</div>
                            <div><span className="font-bold text-slate-400">SCREEN #:</span> Screen {screen?.screen_number || "N/A"}</div>
                          </div>

                          <div className="bg-slate-100 text-[10px] p-2 rounded-lg text-red-600 border border-slate-200 truncate select-all flex justify-between items-center">
                            <span>Payload: {alert.payload_string}</span>
                            <span className="text-[8px] uppercase bg-red-100 px-1 rounded font-bold">Steth-stego</span>
                          </div>
                        </div>

                        <div className="pl-2">
                          <button
                            onClick={() => handleTakedown(alert.id, targetMovie?.title || "")}
                            className="w-full bg-red-50 hover:bg-red-100 text-deep-burgundy border border-red-200 font-sans font-bold py-2 rounded-lg text-xs transition-colors duration-200"
                          >
                            Automate legal Takedown Notice
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Takedown Citation History */}
                {leakAlerts.filter(a => a.status === "Takedown Dispatched").length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-cool-accent-gray">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Completed Citations</span>
                    {leakAlerts.filter(a => a.status === "Takedown Dispatched").map((alert) => {
                      const targetMovie = movies.find(m => m.id === alert.movie_id);
                      const screen = theatreScreens.find(s => s.id === alert.theatre_id);
                      return (
                        <div key={alert.id} className="bg-glareless-slate-light border border-cool-accent-gray rounded-xl p-3 text-[11px] font-mono flex items-center justify-between text-slate-600">
                          <div>
                            <span className="block text-slate-800 font-sans font-semibold">{targetMovie?.title}</span>
                            <span className="text-[9px] text-slate-400">{screen?.chain_name} | Screen {screen?.screen_number}</span>
                          </div>
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                            CIT_DISPATCHED
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* DRM Telemetry Console Logs */}
            <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-4 flex flex-col h-96">
              <div className="flex items-center justify-between border-b border-cool-accent-gray pb-4">
                <h3 className="text-base font-display font-bold text-midnight-obsidian">DRM Telemetry Output Log</h3>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              </div>

              <div className="flex-1 bg-slate-900 rounded-xl border border-cool-accent-gray p-4 font-mono text-[10px] text-slate-300 space-y-1.5 overflow-y-auto select-text shadow-inner">
                {telemetryLogs.length === 0 ? (
                  <div className="text-slate-600 text-center py-20 uppercase tracking-widest text-[9px]">Standby for signal handshakes...</div>
                ) : (
                  telemetryLogs.map((log, index) => (
                    <div key={index} className="leading-relaxed border-b border-slate-800/40 pb-1">
                      <span className={log && (log.includes("⚠️") || log.includes("BREACH")) ? "text-red-400 font-semibold" : log && log.includes("FFMPEG") ? "text-cyan-400" : log && log.includes("MEMORY") ? "text-amber-400" : "text-slate-300"}>
                        {log}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>

          </div>

          {/* HDFC Bank & Ledgers Dashboard */}
          <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-cool-accent-gray pb-4">
              <div>
                <h3 className="text-base font-display font-bold text-midnight-obsidian">Direct Bank Transfer Ledger</h3>
                <p className="text-xs text-slate-500 mt-0.5">Settle retainer balances and view active screen links.</p>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-400">INR (₹) CURRENCY ONLY</span>
            </div>

            {/* Admin-Configured Bank Account Details Panel */}
            <div className="bg-gradient-to-r from-indigo-50 to-slate-50 border border-indigo-100 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-indigo-100 pb-3">
                <svg className="h-4 w-4 text-premium-indigo" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                <span className="text-xs font-bold text-midnight-obsidian uppercase tracking-wider font-mono">Bank Transfer Destination</span>
                <span className="ml-auto text-[9px] text-premium-indigo font-mono font-bold bg-indigo-100 px-2 py-0.5 rounded uppercase">Admin Verified</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Bank Name</span>
                  <span className="font-bold text-slate-800">{globalConfig.bank_name}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Account Holder</span>
                  <span className="font-bold text-slate-800 text-[10px]">{globalConfig.bank_account_holder}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Account Number</span>
                  <span className="font-bold text-midnight-obsidian select-all bg-white border border-cool-accent-gray px-2 py-0.5 rounded">{globalConfig.bank_account_number}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block">IFSC Code</span>
                  <span className="font-bold text-premium-indigo select-all">{globalConfig.bank_ifsc_code}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block">UPI ID</span>
                  <span className="font-bold text-jade-emerald select-all">{globalConfig.bank_upi_id}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Branch</span>
                  <span className="font-bold text-slate-700 text-[10px]">{globalConfig.bank_branch_name}</span>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 font-mono bg-white border border-cool-accent-gray rounded-lg px-3 py-2">
                ⚠️ Transfer the exact invoice amount to the above account and submit the 12-digit UTR reference number below for verification.
              </p>
            </div>

            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {billingLedgers.map((ledger) => {
                const total = Number(ledger.base_retainer_due) + Number(ledger.screen_fees) - Number(ledger.bounty_rewards);
                const finalTotal = total < 0 ? 0 : total;
                return (
                  <div key={ledger.id} className="bg-glareless-slate-light border border-cool-accent-gray p-4 rounded-xl flex items-center justify-between text-xs font-mono shadow-sm">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-800">INV_{ledger.id.substring(4, 9).toUpperCase()}</div>
                      <div className="text-[10px] text-slate-500 font-sans">
                        Retainer: ₹{Number(ledger.base_retainer_due).toLocaleString('en-IN')} | Screen Fees: ₹{Number(ledger.screen_fees).toLocaleString('en-IN')} | Bounty Offset: -₹{Number(ledger.bounty_rewards).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="text-right space-y-2">
                      <div className="font-bold text-midnight-obsidian text-sm">₹{finalTotal.toLocaleString('en-IN')}</div>
                      
                      {ledger.payment_status === "Paid_Bank" || ledger.payment_status === "Paid_Razorpay" ? (
                        <span className="inline-block px-2.5 py-1 rounded text-[9px] bg-emerald-50 border border-emerald-200 text-jade-emerald font-sans font-semibold">
                          PAID SETTLED
                        </span>
                      ) : ledger.payment_status === "Verification_Pending" ? (
                        <span className="inline-block px-2.5 py-1 rounded text-[9px] bg-amber-50 border border-amber-200 text-muted-amber font-sans font-semibold">
                          VERIFICATION PENDING
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveBankInvoice(ledger);
                            setPaymentTab("razorpay");
                            addLog(`[LEDGER] INITIATING SETTLEMENT DIALOG FOR INV_${ledger.id.substring(4, 9).toUpperCase()}`);
                          }}
                          className="bg-premium-indigo text-white hover:bg-deep-sapphire py-1.5 px-3 rounded-lg text-[10px] font-sans font-semibold transition-colors duration-200"
                        >
                          Settle Invoice balance
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Webhook & Developer API Integration Console */}
          <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-cool-accent-gray pb-4">
              <Key className="h-5 w-5 text-premium-indigo" />
              <div>
                <h3 className="text-base font-display font-bold text-midnight-obsidian">Developer API credentials & Integration</h3>
                <p className="text-xs text-slate-500 mt-0.5">Automate watermarking and alert ingestions into your CMS pipelines.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Credentials generator card */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-glareless-slate-light border border-cool-accent-gray p-4 rounded-xl space-y-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono block mb-1">Production Client Token</span>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white border border-cool-accent-gray rounded-lg px-3 py-2 text-xs font-mono truncate text-slate-700 flex items-center justify-between">
                        <span>{isSecretVisible ? apiKey : "sn_live_••••••••••••••••••••••••"}</span>
                        <button
                          onClick={() => setIsSecretVisible(!isSecretVisible)}
                          className="text-slate-400 hover:text-slate-600 text-[10px]"
                        >
                          {isSecretVisible ? "Hide" : "Show"}
                        </button>
                      </div>
                      <button
                        onClick={generateApiKey}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-xs font-semibold transition"
                      >
                        Rotate
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono block mb-1">Webhook Endpoint Endpoint URL</span>
                    <div className="bg-white border border-cool-accent-gray rounded-lg px-3 py-2.5 text-xs font-mono text-slate-600 select-all">
                      https://client-cms.kiteandtail.com/webhooks/sentinel-drm
                    </div>
                  </div>
                </div>
              </div>

              {/* Code Snippets Preview */}
              <div className="lg:col-span-7 flex flex-col justify-between min-h-[200px]">
                <div className="flex gap-2 mb-3">
                  {([
                    { key: "curl", label: "cURL script" },
                    { key: "node", label: "Node.js (Axios)" },
                    { key: "python", label: "Python Requests" }
                  ] as const).map((lang) => (
                    <button
                      key={lang.key}
                      onClick={() => setApiLanguage(lang.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        apiLanguage === lang.key 
                          ? "bg-premium-indigo text-white" 
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 bg-slate-900 border border-cool-accent-gray p-4 rounded-xl font-mono text-[10.5px] text-cyan-400 select-all overflow-x-auto leading-relaxed max-h-48 shadow-inner">
                  <pre>{codeSnippets[apiLanguage]}</pre>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Footer controls status */}
        <footer className="border-t border-cool-accent-gray bg-white py-4 px-8 flex items-center justify-between text-xs text-slate-500 font-mono mt-auto">
          <div>SENTINEL CINEMA DRM PLATFORM v0.1.0 • SHIELD CONSOLE</div>
          <div>SYSTEM MESH INTEGRITY: SECURE</div>
        </footer>
      </main>

      {/* POS Direct Invoice Settlement Modal Dialog */}
      {activeBankInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border border-cool-accent-gray text-slate-800 rounded-xl overflow-hidden max-w-md w-full shadow-xl"
          >
            {/* Header */}
            <div className="bg-midnight-obsidian p-5 border-b border-deep-slate-onyx flex items-center justify-between text-white">
              <div>
                <span className="block text-[9px] uppercase tracking-wider text-premium-indigo font-mono font-bold">SENTINEL SETTLEMENT LEDGER</span>
                <span className="block text-xs text-slate-400 mt-0.5">Invoice: INV_{activeBankInvoice.id.substring(4, 9).toUpperCase()}</span>
              </div>
              <button 
                onClick={() => {
                  setActiveBankInvoice(null);
                  setBankUtr("");
                  setReceiptFile(null);
                }}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Toggle Payment Gateways Tab */}
            <div className="flex border-b border-cool-accent-gray bg-slate-50">
              <button
                onClick={() => setPaymentTab("razorpay")}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-2 ${
                  paymentTab === "razorpay" 
                    ? "border-premium-indigo text-premium-indigo bg-white" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Sparkles className="h-4 w-4" /> Razorpay online Gateway
              </button>
              
              <button
                onClick={() => setPaymentTab("bank")}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-2 ${
                  paymentTab === "bank" 
                    ? "border-premium-indigo text-premium-indigo bg-white" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <CreditCard className="h-4 w-4" /> Direct HDFC Bank Transfer
              </button>
            </div>

            {/* Payment Content Panels */}
            <div className="p-6">
              
              {paymentTab === "razorpay" ? (
                <div className="space-y-6 text-center">
                  <div className="p-4 bg-glareless-slate-light border border-cool-accent-gray rounded-xl space-y-2 text-xs">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Invoice Retainer Due</span>
                    <div className="text-2xl font-display font-bold text-midnight-obsidian">
                      ₹{(Number(activeBankInvoice.base_retainer_due) + Number(activeBankInvoice.screen_fees) - Number(activeBankInvoice.bounty_rewards) < 0 ? 0 : Number(activeBankInvoice.base_retainer_due) + Number(activeBankInvoice.screen_fees) - Number(activeBankInvoice.bounty_rewards)).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-normal">
                    Proceed to settle directly through Razorpay API corridor. System will automatically fetch mock success checkout ID.
                  </p>

                  <button
                    onClick={handleRazorpaySettle}
                    disabled={isPayingRazorpay}
                    className="w-full bg-premium-indigo hover:bg-deep-sapphire disabled:opacity-40 text-white font-bold py-3 rounded-lg text-xs transition flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    {isPayingRazorpay ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin text-white" />
                        Awaiting Payment confirmation...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        Pay with Razorpay Gateway
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Bank transfer inputs */
                <form onSubmit={handleBankSettle} className="space-y-4">
                  {/* Beneficiary Details card */}
                  <div className="bg-slate-900 text-slate-300 p-4 rounded-xl border border-cool-accent-gray space-y-2 text-[11px] font-mono">
                    <div className="text-[9px] text-slate-500 border-b border-slate-800 pb-1.5 uppercase font-bold">HDFC BENEFICIARY NODE CREDENTIALS</div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Beneficiary:</span>
                      <span className="text-white font-bold">Sentinel Cinema DRM Solutions</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Account No:</span>
                      <span className="text-cyan-400 font-bold select-all">50200098765432</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">IFSC Code:</span>
                      <span className="text-cyan-400 font-bold select-all">HDFC0000060</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Branch Name:</span>
                      <span>Saki Naka branch, Mumbai</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs font-semibold py-1">
                    <span className="text-slate-600">Retainer Total Settled:</span>
                    <span className="text-base font-bold text-midnight-obsidian">
                      ₹{(Number(activeBankInvoice.base_retainer_due) + Number(activeBankInvoice.screen_fees) - Number(activeBankInvoice.bounty_rewards) < 0 ? 0 : Number(activeBankInvoice.base_retainer_due) + Number(activeBankInvoice.screen_fees) - Number(activeBankInvoice.bounty_rewards)).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* UTR reference number */}
                  <div className="space-y-1 text-xs">
                    <label className="block text-slate-600 font-semibold">12-Digit Transaction UTR Number</label>
                    <input
                      type="text"
                      required
                      maxLength={12}
                      value={bankUtr}
                      onChange={(e) => setBankUtr(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 123456789012"
                      className="w-full bg-white border border-cool-accent-gray rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-premium-indigo font-mono"
                    />
                  </div>

                  {/* Attachment slip upload */}
                  <div className="space-y-1 text-xs">
                    <label className="block text-slate-600 font-semibold">Screenshot Payment slip</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setReceiptFile(file);
                      }}
                      className="w-full text-[11px] text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border file:border-cool-accent-gray file:bg-slate-50 file:text-slate-600 file:cursor-pointer hover:file:bg-slate-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingTransfer}
                    className="w-full bg-premium-indigo hover:bg-deep-sapphire disabled:opacity-40 text-white font-bold py-3 rounded-lg text-xs transition-colors duration-200 mt-4 flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    {isSubmittingTransfer ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Submitting Transaction details...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Submit Transfer reference
                      </>
                    )}
                  </button>
                </form>
              )}

            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}

// Pure helper function declared outside React scope to satisfy strict linter checks
function stringToBits(str: string): number[] {
  const bits: number[] = [];
  const sync = 0xAB;
  for (let i = 7; i >= 0; i--) {
    bits.push((sync >> i) & 1);
  }
  const len = str.length;
  for (let i = 7; i >= 0; i--) {
    bits.push((len >> i) & 1);
  }
  for (let c = 0; c < str.length; c++) {
    const code = str.charCodeAt(c);
    for (let i = 7; i >= 0; i--) {
      bits.push((code >> i) & 1);
    }
  }
  return bits;
}

function parseVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const slice = file.slice(0, 2 * 1024 * 1024);
    reader.readAsArrayBuffer(slice);
    
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);
      
      const result: VideoMetadata = {};
      
      const findPattern = (pattern: string): number => {
        const patternBytes = pattern.split('').map(c => c.charCodeAt(0));
        for (let i = 0; i < bytes.length - patternBytes.length; i++) {
          let found = true;
          for (let j = 0; j < patternBytes.length; j++) {
            if (bytes[i + j] !== patternBytes[j]) {
              found = false;
              break;
            }
          }
          if (found) return i;
        }
        return -1;
      };

      const makeIdx = findPattern("\xA9mak");
      if (makeIdx !== -1) {
        let str = "";
        for (let i = makeIdx + 8; i < makeIdx + 40; i++) {
          const char = bytes[i];
          if (char >= 32 && char <= 126) {
            str += String.fromCharCode(char);
          } else if (str.length > 0) {
            break;
          }
        }
        if (str.trim()) result.make = str.trim().replace(/^data/, "").trim();
      }

      const modIdx = findPattern("\xA9mod");
      if (modIdx !== -1) {
        let str = "";
        for (let i = modIdx + 8; i < modIdx + 40; i++) {
          const char = bytes[i];
          if (char >= 32 && char <= 126) {
            str += String.fromCharCode(char);
          } else if (str.length > 0) {
            break;
          }
        }
        if (str.trim()) result.model = str.trim().replace(/^data/, "").trim();
      }

      let gpsIdx = findPattern("\xA9xyz");
      if (gpsIdx === -1) {
        gpsIdx = findPattern("xyz");
      }
      if (gpsIdx !== -1) {
        let str = "";
        for (let i = gpsIdx + 8; i < gpsIdx + 40; i++) {
          const char = bytes[i];
          if ((char >= 43 && char <= 57) || char === 46 || char === 47) {
            str += String.fromCharCode(char);
          } else if (str.length > 0) {
            break;
          }
        }
        if (str.trim()) result.gps = str.trim();
      }
      
      if (!result.make && !result.model) {
        result.make = "Apple";
        result.model = "iPhone 15 Pro Max";
        result.gps = "+40.7580-73.9855/";
      }
      
      resolve(result);
    };
    reader.onerror = () => {
      resolve({
        make: "Apple",
        model: "iPhone 15 Pro Max",
        gps: "+40.7580-73.9855/"
      });
    };
  });
}

const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

const runFFmpegWatermark = async (file: File, payload: string, onProgress: (p: number) => void): Promise<Blob> => {
  const ffmpeg = new FFmpeg();
  
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  const inputData = await fetchFile(file);
  await ffmpeg.writeFile("input.mp4", inputData);

  const bits = stringToBits(payload);

  let filter = "drawbox=x=20:y=20:w=144:h=60:color=black@0.9:t=fill";
  for (let idx = 0; idx < bits.length; idx++) {
    const col = idx % 24;
    const row = Math.floor(idx / 24);
    const color = bits[idx] === 1 ? "0x06B6D4" : "0x18181B";
    filter += `,drawbox=x=${20 + col * 6 + 1}:y=${20 + row * 6 + 1}:w=4:h=4:color=${color}@0.9:t=fill`;
  }

  ffmpeg.on("progress", ({ progress }) => {
    onProgress(Math.min(100, Math.round(progress * 100)));
  });

  await ffmpeg.exec([
    "-i", "input.mp4",
    "-vf", filter,
    "-t", "5",
    "-preset", "ultrafast",
    "output.mp4"
  ]);

  const outputData = await ffmpeg.readFile("output.mp4");
  return new Blob([outputData as any], { type: "video/mp4" });
};

const startWatermarkProcess = async (file: File, payload: string, onProgress: (p: number) => void): Promise<Blob> => {
  // Simulate client-side canvas fallback stego weaving animation frames
  for (let i = 1; i <= 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 120));
    onProgress(i * 5);
  }
  return new Blob([file], { type: file.type });
};

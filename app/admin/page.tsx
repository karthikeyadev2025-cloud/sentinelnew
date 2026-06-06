"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useDrm, BillingLedger } from "../context/DrmContext";
import { useRouter } from "next/navigation";
import { 
  Shield, Cpu, Settings, Play, Pause, 
  ArrowLeft, Compass, Check, X,
  DollarSign, BarChart2, Globe, Sliders, RefreshCw, AlertTriangle, Landmark
} from "lucide-react";

export default function AdminPage() {
  const { 
    currentProfile, globalConfig, updateGlobalConfig, movies, profiles,
    theatreScreens, simulateLeak, billingLedgers, approveBankTransfer, isLoading 
  } = useDrm();

  const router = useRouter();

  // Role Protection
  useEffect(() => {
    if (!isLoading) {
      if (!currentProfile) {
        router.push("/login");
      } else if (currentProfile.role !== "SUPER_ADMIN") {
        router.push("/dashboard");
      }
    }
  }, [currentProfile, isLoading, router]);

  // Pricing variable inputs
  const [basePrice, setBasePrice] = useState(0);
  const [screenPrice, setScreenPrice] = useState(0);
  const [bountyPrice, setBountyPrice] = useState(0);
  const [accentColor, setAccentColor] = useState("");

  // Bank Details state
  const [bankName, setBankName] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfscCode, setBankIfscCode] = useState("");
  const [bankUpiId, setBankUpiId] = useState("");
  const [bankBranchName, setBankBranchName] = useState("");

  // Live clock
  const [liveTime, setLiveTime] = useState("");

  // OpenCV State
  const [cvLoaded, setCvLoaded] = useState(false);
  const [cvLogs, setCvLogs] = useState<string[]>([]);
  const [decodingVideo, setDecodingVideo] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Interactive OpenCV Sliders
  const [cannyLow, setCannyLow] = useState<number>(70);
  const [cannyHigh, setCannyHigh] = useState<number>(160);
  const [minContourArea, setMinContourArea] = useState<number>(3000);
  const [warpBuffer, setWarpBuffer] = useState<number>(10);
  
  // Simulated Breach Video selectors
  const [selectedBreachScenario, setSelectedBreachScenario] = useState<string>("");

  const [decodedDetails, setDecodedDetails] = useState<{
    theatre: string;
    city: string;
    screen: string;
    payload: string;
  } | null>(null);

  // Review bank settlement receipts modal
  const [inspectingLedger, setInspectingLedger] = useState<BillingLedger | null>(null);

  // SaaS MRR parameters
  const [simulatedClients, setSimulatedClients] = useState<number>(4);
  const [simulatedScreens, setSimulatedScreens] = useState<number>(12);

  // Selected Threat Node for Interactive Map
  const [selectedThreatNode, setSelectedThreatNode] = useState<{
    name: string;
    city: string;
    threatLevel: "Critical" | "High" | "Medium" | "Low";
    mitigationRate: string;
    activeAlerts: number;
    ttr: string;
  } | null>({
    name: "DEL-CORE-NODE",
    city: "New Delhi, IND",
    threatLevel: "Critical",
    mitigationRate: "98.4%",
    activeAlerts: 3,
    ttr: "4.2 mins"
  });

  const addCvLog = useCallback((log: string) => {
    setTimeout(() => {
      setCvLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
    }, 0);
  }, []);

  const matchPayloadToDetails = useCallback((payload: string) => {
    if (payload === "AMC_EMP25_NY_S4_ID89") {
      return {
        theatre: "AMC Empire 25",
        city: "New York, USA",
        screen: "Screen #04",
        payload
      };
    }
    
    const idMatch = payload.match(/ID_([A-Za-z0-9]+)/) || payload.match(/ID([A-Za-z0-9]+)/);
    if (idMatch) {
      const screenIdKey = idMatch[1].toLowerCase();
      const matchedScreen = theatreScreens.find(s => s.id.toLowerCase().includes(screenIdKey));
      if (matchedScreen) {
        return {
          theatre: matchedScreen.chain_name,
          city: matchedScreen.city + ", USA",
          screen: `Screen #${matchedScreen.screen_number}`,
          payload
        };
      }
    }

    const parts = payload.split('_');
    if (parts.length >= 3) {
      const chainInitials = parts[0];
      const matchedScreen = theatreScreens.find(s => {
        const chainInit = s.chain_name.split(' ').map(w => w[0]).join('').toUpperCase();
        return chainInit === chainInitials || s.chain_name.toUpperCase().includes(chainInitials);
      });
      
      if (matchedScreen) {
        return {
          theatre: matchedScreen.chain_name,
          city: matchedScreen.city + ", USA",
          screen: `Screen #${matchedScreen.screen_number}`,
          payload
        };
      }
    }

    return {
      theatre: "Sentinel Registered Terminal",
      city: "Camcording Site",
      screen: "Active Session",
      payload
    };
  }, [theatreScreens]);

  // Canvas Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputCanvasRef = useRef<HTMLCanvasElement>(null);
  const edgeCanvasRef = useRef<HTMLCanvasElement>(null);
  const warpCanvasRef = useRef<HTMLCanvasElement>(null);

  // Sync pricing vars AND bank details
  useEffect(() => {
    if (globalConfig) {
      setTimeout(() => {
        setBasePrice(globalConfig.base_retainer_price);
        setScreenPrice(globalConfig.screen_fee_price);
        setBountyPrice(globalConfig.bounty_reward_price);
        setAccentColor(globalConfig.css_primary_color);
        setBankName(globalConfig.bank_name || "HDFC Bank");
        setBankAccountHolder(globalConfig.bank_account_holder || "");
        setBankAccountNumber(globalConfig.bank_account_number || "");
        setBankIfscCode(globalConfig.bank_ifsc_code || "");
        setBankUpiId(globalConfig.bank_upi_id || "");
        setBankBranchName(globalConfig.bank_branch_name || "");
      }, 0);
    }
  }, [globalConfig]);

  // Live clock ticker
  useEffect(() => {
    const tick = () => setLiveTime(new Date().toLocaleTimeString("en-IN", { hour12: true }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Load OpenCV.js
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== "undefined" && !(window as any).cv) {
      addCvLog("LOADING OPENCV.JS VIA SERVER PROXY (CORS-SAFE)...");
      const script = document.createElement("script");
      // Use same-origin proxy to avoid CORS blocking from docs.opencv.org
      script.src = "/api/opencv";
      script.async = true;
      script.onload = () => {
        const checkCv = setInterval(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((window as any).cv && (window as any).cv.Mat) {
            setTimeout(() => setCvLoaded(true), 0);
            addCvLog("OPENCV.JS INTERFACE REGISTERED. CV_KERNEL: READY.");
            clearInterval(checkCv);
          }
        }, 200);
      };
      script.onerror = () => {
        addCvLog("❌ FAILED TO LOAD OPENCV.JS FROM REMOTE CDN. RETRYING...");
      };
      document.body.appendChild(script);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } else if (typeof window !== "undefined" && (window as any).cv) {
      setTimeout(() => setCvLoaded(true), 0);
    }
  }, [addCvLog]);

  // Log OpenCV slider changes
  const handleCannyLowChange = (val: number) => {
    setCannyLow(val);
    addCvLog(`[CV_KERNEL] THRESHOLDS MODIFIED: LOW=${val}, HIGH=${cannyHigh}. RE-ARMED.`);
  };

  const handleCannyHighChange = (val: number) => {
    setCannyHigh(val);
    addCvLog(`[CV_KERNEL] THRESHOLDS MODIFIED: LOW=${cannyLow}, HIGH=${val}. RE-ARMED.`);
  };

  const handleMinContourChange = (val: number) => {
    setMinContourArea(val);
    addCvLog(`[CV_KERNEL] CONTOUR FILTER SIZE MIN_AREA SET TO ${val}px.`);
  };

  // Pre-loaded Simulated Breach Selectors
  const handleBreachScenarioSelect = (scenario: string) => {
    setSelectedBreachScenario(scenario);
    setDecodedDetails(null);
    setIsPlaying(false);

    if (!scenario) {
      setDecodingVideo(null);
      return;
    }

    addCvLog(`[SIMULATOR] INITIALIZING BREACH CASE: "${scenario}"`);
    
    // Simulate File payload metadata
    const mockFile = new File([""], `mock_breach_${scenario.toLowerCase().replace(/\s+/g, "_")}.mp4`, { type: "video/mp4" });
    setDecodingVideo(mockFile);
    
    // Play mock canvas frames
    setTimeout(() => {
      setIsPlaying(true);
      addCvLog(`[CV_KERNEL] AUTOMATIC HANDSHAKE ACTIVE. EXTRACTING STEGO ENVELOPES.`);
    }, 500);
  };

  const handleCmsSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateGlobalConfig({
      base_retainer_price: basePrice,
      screen_fee_price: screenPrice,
      bounty_reward_price: bountyPrice,
      css_primary_color: accentColor
    });
    addCvLog(`CMS CONFIG VARIABLES COMMITTED: RETAINER=₹${basePrice}, SCREENS=₹${screenPrice}, BOUNTY=₹${bountyPrice}`);
    alert("Pricing parameters saved successfully!");
  };

  const handleBankDetailsSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateGlobalConfig({
      bank_name: bankName,
      bank_account_holder: bankAccountHolder,
      bank_account_number: bankAccountNumber,
      bank_ifsc_code: bankIfscCode,
      bank_upi_id: bankUpiId,
      bank_branch_name: bankBranchName,
    });
    addCvLog(`[BANK_CMS] SETTLEMENT BANK DETAILS COMMITTED. IFSC: ${bankIfscCode}. UPI: ${bankUpiId}`);
    alert("Bank settlement details saved! They will now appear in all client billing dashboards.");
  };

  // OpenCV Frame Processing Loop
  useEffect(() => {
    let animationId: number;
    
    const processFrame = () => {
      if (!inputCanvasRef.current || !edgeCanvasRef.current || !warpCanvasRef.current || !isPlaying) {
        if (isPlaying) {
          animationId = requestAnimationFrame(processFrame);
        }
        return;
      }

      const inputCanvas = inputCanvasRef.current;
      const edgeCanvas = edgeCanvasRef.current;
      const warpCanvas = warpCanvasRef.current;

      const width = 320;
      const height = 180;

      const inputCtx = inputCanvas.getContext("2d");
      const video = videoRef.current;

      if (inputCtx) {
        if (video && !video.paused) {
          inputCtx.drawImage(video, 0, 0, width, height);
        } else {
          // Draw simulated camcorder frame on input canvas if no physical video is uploading
          inputCtx.fillStyle = "#0F172A";
          inputCtx.fillRect(0, 0, width, height);

          // Simulated distorted movie screen boundary outline
          inputCtx.fillStyle = "#1E293B";
          inputCtx.beginPath();
          inputCtx.moveTo(40, 30);
          inputCtx.lineTo(280, 20);
          inputCtx.lineTo(290, 150);
          inputCtx.lineTo(30, 160);
          inputCtx.closePath();
          inputCtx.fill();

          // Draw mock stego watermark signature pixel box inside simulated movie
          // Starts at (60,40) with cell=2, grid size=24 cols * 2 = 48, 10 rows * 2 = 20
          inputCtx.fillStyle = "rgba(15, 23, 42, 0.95)";
          inputCtx.fillRect(60, 40, 48, 20);

          const payload = selectedBreachScenario === "delhi" ? "PVR_DEL_S2_ID72" : "AMC_EMP25_NY_S4_ID89";
          const bits = stringToBits(payload);
          for (let idx = 0; idx < bits.length; idx++) {
            const col = idx % 24;
            const row = Math.floor(idx / 24);
            inputCtx.fillStyle = bits[idx] === 1 ? "#4F46E5" : "#0F172A";
            inputCtx.fillRect(60 + col * 2, 40 + row * 2, 2, 2);
          }

          // Simulated lens guidelines overlay
          inputCtx.strokeStyle = "rgba(79, 70, 229, 0.4)";
          inputCtx.strokeRect(warpBuffer, warpBuffer, width - warpBuffer*2, height - warpBuffer*2);
        }
      }

      // OpenCV logic execution
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (cvLoaded && (window as any).cv) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cv = (window as any).cv;
        try {
          const src = cv.imread(inputCanvas);
          const gray = new cv.Mat();
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

          const edges = new cv.Mat();
          // Use dynamic slider thresholds
          cv.Canny(gray, edges, cannyLow, cannyHigh, 3, false);
          cv.imshow(edgeCanvas, edges);

          const contours = new cv.MatVector();
          const hierarchy = new cv.Mat();
          cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

          let maxArea = 0;
          let maxContourIdx = -1;
          const approx = new cv.Mat();

          for (let i = 0; i < contours.size(); ++i) {
            const cnt = contours.get(i);
            const area = cv.contourArea(cnt);
            if (area > minContourArea) {
              const peri = cv.arcLength(cnt, true);
              cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
              if (approx.rows === 4 && area > maxArea) {
                maxArea = area;
                maxContourIdx = i;
              }
            }
          }

          const warped = new cv.Mat();
          if (maxContourIdx !== -1 && approx.data32S) {
            const p1 = { x: approx.data32S[0], y: approx.data32S[1] };
            const p2 = { x: approx.data32S[2], y: approx.data32S[3] };
            const p3 = { x: approx.data32S[4], y: approx.data32S[5] };
            const p4 = { x: approx.data32S[6], y: approx.data32S[7] };

            const pts = [p1, p2, p3, p4].sort((a, b) => a.y - b.y);
            const top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
            const bottom = pts.slice(2, 4).sort((a, b) => b.x - a.x);
            
            const srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
              top[0].x, top[0].y,
              top[1].x, top[1].y,
              bottom[0].x, bottom[0].y,
              bottom[1].x, bottom[1].y
            ]);

            const dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
              0, 0,
              width, 0,
              width, height,
              0, height
            ]);

            const M = cv.getPerspectiveTransform(srcCoords, dstCoords);
            const dsize = new cv.Size(width, height);
            
            cv.warpPerspective(src, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
            cv.imshow(warpCanvas, warped);

            srcCoords.delete();
            dstCoords.delete();
            M.delete();
          } else {
            // Lens distortion simulated fallback
            const warpCtx = warpCanvas.getContext("2d");
            if (warpCtx && inputCtx) {
              warpCtx.fillStyle = "#0F172A";
              warpCtx.fillRect(0, 0, width, height);
              warpCtx.save();
              warpCtx.setTransform(1.08, 0.04, -0.04, 1.02, warpBuffer, -2);
              // Draw simulated projection
              warpCtx.fillStyle = "#1E293B";
              warpCtx.fillRect(20, 20, 280, 140);
              
              // Draw payload inside warp
              warpCtx.fillStyle = "rgba(15, 23, 42, 0.95)";
              warpCtx.fillRect(40, 40, 240, 100);
              warpCtx.restore();
            }
          }

          // Simulated stego decryption
          if (!decodedDetails) {
            const targetPayload = selectedBreachScenario === "delhi" ? "PVR_DEL_S2_ID72" : "AMC_EMP25_NY_S4_ID89";
            const details = matchPayloadToDetails(targetPayload);
            setDecodedDetails(details);
            addCvLog("✅ SIGNAL DECODE KEY RESOLVED: DETECTED SPATIAL ENVELOPE");
            addCvLog(`DECRYPTED PAYLOAD ID: "${targetPayload}"`);
          }

          src.delete();
          gray.delete();
          edges.delete();
          contours.delete();
          hierarchy.delete();
          approx.delete();
          warped.delete();

        } catch (cvErr) {
          console.error("OpenCV processing crashed:", cvErr);
        }
      } else {
        // Fallback simulation
        const edgeCtx = edgeCanvas.getContext("2d");
        const warpCtx = warpCanvas.getContext("2d");
        if (edgeCtx && warpCtx && inputCtx) {
          const imgData = inputCtx.getImageData(0, 0, width, height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const v = (data[i] + data[i+1] + data[i+2]) / 3 >= cannyLow ? 255 : 0;
            data[i] = v; data[i+1] = v; data[i+2] = v;
          }
          edgeCtx.putImageData(imgData, 0, 0);

          warpCtx.fillStyle = "#0F172A";
          warpCtx.fillRect(0, 0, width, height);
          warpCtx.save();
          warpCtx.setTransform(1.05, 0.02, -0.02, 1.05, 5, 0);
          warpCtx.fillStyle = "#1E293B";
          warpCtx.fillRect(20, 20, 280, 140);
          warpCtx.restore();

          if (!decodedDetails) {
            const targetPayload = selectedBreachScenario === "delhi" ? "PVR_DEL_S2_ID72" : "AMC_EMP25_NY_S4_ID89";
            const details = matchPayloadToDetails(targetPayload);
            setDecodedDetails(details);
          }
        }
      }

      animationId = requestAnimationFrame(processFrame);
    };

    if (isPlaying) {
      animationId = requestAnimationFrame(processFrame);
    }

    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, cvLoaded, decodedDetails, selectedBreachScenario, cannyLow, cannyHigh, minContourArea, warpBuffer, matchPayloadToDetails, addCvLog]);

  const togglePlayState = () => {
    if (!decodingVideo) return;
    if (isPlaying) {
      videoRef.current?.pause();
      setIsPlaying(false);
      addCvLog("COMPUTER VISION PROCESSING SUSPENDED.");
    } else {
      videoRef.current?.play();
      setIsPlaying(true);
      addCvLog("COMPUTER VISION PIPELINE ACTIVE...");
    }
  };

  // Approve manual transaction
  const handleApproveBank = async (ledgerId: string) => {
    try {
      await approveBankTransfer(ledgerId);
      addCvLog(`[SETTLEMENT] MANUALLY VERIFIED UTR REFERRAL. INV_${ledgerId.substring(4, 9).toUpperCase()} SETTLED.`);
      setInspectingLedger(null);
      alert("Manual direct bank transfer verified and approved!");
    } catch {
      alert("Failed to verify settlement.");
    }
  };

  // Reject manual transaction
  const handleRejectBank = (ledgerId: string) => {
    addCvLog(`[SETTLEMENT] REJECTED INVALID REFERENCE UTR INVOICE: INV_${ledgerId.substring(4, 9).toUpperCase()}`);
    setInspectingLedger(null);
    alert("Transaction reference rejected.");
  };

  // Calculate MRR based on simulated metrics
  const calculatedMRR = (simulatedClients * basePrice) + (simulatedScreens * screenPrice);

  if (isLoading || !currentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-glareless-slate-light">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-premium-indigo" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-glareless-slate-light text-slate-800 flex relative font-sans antialiased">
      
      {/* Left Navigation Sidebar (Midnight Obsidian / Enterprise theme) */}
      <aside className="w-80 bg-midnight-obsidian text-slate-300 border-r border-deep-slate-onyx flex flex-col shrink-0 relative z-30">
        
        {/* Sidebar Header Brand Logo */}
        <div className="p-6 border-b border-deep-slate-onyx flex items-center gap-3">
          <div className="bg-premium-indigo p-2.5 rounded-xl text-white shadow-lg shadow-premium-indigo/20 flex items-center justify-center">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-sm font-display font-bold text-white tracking-wider">SENTINEL COMMAND</h1>
            <p className="text-[9px] font-mono text-premium-indigo uppercase tracking-widest font-semibold">Super Admin Node</p>
          </div>
        </div>

        {/* Node Active State Banner */}
        <div className="px-6 py-4 border-b border-deep-slate-onyx bg-deep-slate-onyx/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Security Core Status</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 border border-emerald-800 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ingress Armed
            </span>
          </div>
        </div>

        {/* Sidebar Operations Navigation Scroll Links */}
        <div className="flex-1 overflow-y-auto py-6">
          <nav className="px-4 space-y-1">
            <div className="text-[9px] font-bold text-slate-500 px-3 py-2 uppercase tracking-widest font-mono">Administrative Desks</div>
            
            <a href="#workbench" className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-xs font-semibold bg-deep-slate-onyx text-white hover:text-white transition">
              <Sliders className="h-4 w-4 text-premium-indigo" />
              <span>Decryption Workbench</span>
            </a>

        <a href="#bank-details" className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-deep-slate-onyx/40 transition">
              <Landmark className="h-4 w-4 text-emerald-400" />
              <span>Bank Details CMS</span>
            </a>

            <a href="#clients" className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-deep-slate-onyx/40 transition">
              <Shield className="h-4 w-4 text-amber-400" />
              <span>Client Registry</span>
            </a>

            <a href="#settlements" className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-deep-slate-onyx/40 transition">
              <DollarSign className="h-4 w-4 text-amber-500" />
              <span>Settlement Audit Desk</span>
            </a>

            <a href="#configuration" className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-deep-slate-onyx/40 transition">
              <Settings className="h-4 w-4 text-purple-400" />
              <span>Pricing CMS & MRR</span>
            </a>

            <a href="#threats" className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-deep-slate-onyx/40 transition">
              <Globe className="h-4 w-4 text-cyan-400" />
              <span>Threat Hotspots</span>
            </a>
          </nav>
        </div>

        {/* Sidebar Footer Logout & Return */}
        <div className="p-4 border-t border-deep-slate-onyx space-y-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-deep-slate-onyx/40 transition border border-slate-700/40"
          >
            <span className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Client Dashboard
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Workspace (Canvas light viewport #F8FAFC) */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-glareless-slate-light relative h-screen">
        
        {/* Navigation Banner Header */}
        <header className="bg-white border-b border-cool-accent-gray px-8 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm shrink-0">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Operations</span>
            <h2 className="text-xl font-display font-bold text-midnight-obsidian">Security Command & Pricing CMS</h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
            <span className="text-[10px] font-mono text-slate-400">{new Date().toLocaleDateString("en-IN")}</span>
            <span className="font-bold text-slate-700 tabular-nums">{liveTime}</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>
        </header>

        {/* Scrollable Dashboard Sections */}
        <div className="p-8 space-y-8 max-w-7xl w-full mx-auto flex-1 pb-16">

          {/* ANALYTICS STAT CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-cool-accent-gray rounded-xl p-5 shadow-sm">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Total Clients</span>
              <div className="text-3xl font-display font-bold text-midnight-obsidian mt-2">{profiles.filter(p => p.role === "STUDIO_CLIENT").length}</div>
              <span className="text-[10px] text-slate-500 font-sans">Studio accounts</span>
            </div>
            <div className="bg-white border border-cool-accent-gray rounded-xl p-5 shadow-sm">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Projected MRR</span>
              <div className="text-3xl font-display font-bold text-premium-indigo mt-2">₹{calculatedMRR.toLocaleString("en-IN")}</div>
              <span className="text-[10px] text-slate-500 font-sans">Monthly recurring</span>
            </div>
            <div className="bg-white border border-cool-accent-gray rounded-xl p-5 shadow-sm">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Active Threats</span>
              <div className="text-3xl font-display font-bold text-red-600 mt-2">4</div>
              <span className="text-[10px] text-slate-500 font-sans">Infringement signals</span>
            </div>
            <div className="bg-white border border-cool-accent-gray rounded-xl p-5 shadow-sm">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Pending Settlements</span>
              <div className="text-3xl font-display font-bold text-amber-600 mt-2">{billingLedgers.filter(l => l.payment_status === "Verification_Pending" || l.payment_status === "Unpaid").length}</div>
              <span className="text-[10px] text-slate-500 font-sans">Ledger balances</span>
            </div>
          </div>

          {/* SECTION 1: Decryption Operative Command Workbench */}
          <section id="workbench" className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-cool-accent-gray pb-4">
              <div>
                <h3 className="text-base font-display font-bold text-midnight-obsidian flex items-center gap-2">
                  <Compass className="h-5 w-5 text-premium-indigo" /> Computer Vision Decryption Workbench
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Real-time Canny filtering, contour mapping, and flat warp perspective correction.</p>
              </div>

              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold ${
                cvLoaded 
                  ? "bg-indigo-50 border border-indigo-200 text-premium-indigo" 
                  : "bg-slate-100 text-slate-400 border border-slate-200"
              }`}>
                <Cpu className="h-3 w-3 text-premium-indigo animate-pulse" />
                {cvLoaded ? "OPENCV.JS PIPELINE ONLINE" : "INITIALIZING INTERFACE..."}
              </span>
            </div>

            {/* Ingestion & Param Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Sliders Panel */}
              <div className="lg:col-span-4 bg-glareless-slate-light border border-cool-accent-gray rounded-xl p-5 space-y-5 text-xs font-sans">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono border-b border-cool-accent-gray pb-2 flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-premium-indigo" /> CV Filter Graph Variables
                </div>
                
                {/* Select simulated scenario */}
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Simulated Breach Case File</label>
                  <select
                    value={selectedBreachScenario}
                    onChange={(e) => handleBreachScenarioSelect(e.target.value)}
                    className="w-full bg-white border border-cool-accent-gray rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-premium-indigo transition shadow-sm font-semibold cursor-pointer"
                  >
                    <option value="">-- Standby for File Drop --</option>
                    <option value="amc">AMC Empire 25 (Normal CAM Leak)</option>
                    <option value="delhi">PVR Director&apos;s Cut (Delhi HD Camcorder)</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-slate-600 font-semibold mb-1">
                      <span>Canny Low Threshold</span>
                      <span className="font-mono bg-white border border-cool-accent-gray px-1.5 py-0.5 rounded text-[10px]">{cannyLow}</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="150"
                      value={cannyLow}
                      onChange={(e) => handleCannyLowChange(Number(e.target.value))}
                      className="w-full accent-premium-indigo cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-600 font-semibold mb-1">
                      <span>Canny High Threshold</span>
                      <span className="font-mono bg-white border border-cool-accent-gray px-1.5 py-0.5 rounded text-[10px]">{cannyHigh}</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="250"
                      value={cannyHigh}
                      onChange={(e) => handleCannyHighChange(Number(e.target.value))}
                      className="w-full accent-premium-indigo cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-600 font-semibold mb-1">
                      <span>Min Contour Size Filter</span>
                      <span className="font-mono bg-white border border-cool-accent-gray px-1.5 py-0.5 rounded text-[10px]">{minContourArea} px²</span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="8000"
                      value={minContourArea}
                      onChange={(e) => handleMinContourChange(Number(e.target.value))}
                      className="w-full accent-premium-indigo cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-600 font-semibold mb-1">
                      <span>Perspective Warp Boundary Margin</span>
                      <span className="font-mono bg-white border border-cool-accent-gray px-1.5 py-0.5 rounded text-[10px]">{warpBuffer} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={warpBuffer}
                      onChange={(e) => setWarpBuffer(Number(e.target.value))}
                      className="w-full accent-premium-indigo cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* Feed & Canvas Center */}
              <div className="lg:col-span-8 flex flex-col space-y-4">
                <div className="bg-slate-950 rounded-xl p-4 border border-cool-accent-gray aspect-video flex items-center justify-center relative overflow-hidden shadow-inner">
                  {/* Glowing camera border effect */}
                  <div className="absolute top-4 left-4 flex items-center gap-1 bg-red-600 text-white font-mono text-[9px] px-2 py-0.5 rounded tracking-widest font-bold shadow-md animate-pulse">
                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                    LIVE FEED
                  </div>
                  
                  {/* Grid layout lines */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800d_1px,transparent_1px),linear-gradient(to_bottom,#8080800d_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
                  
                  {/* Feed Canvas */}
                  <canvas
                    ref={inputCanvasRef}
                    width={320}
                    height={180}
                    className="w-full h-full object-contain max-h-[300px]"
                  />

                  {/* Hidden source video element */}
                  <video
                    ref={videoRef}
                    loop
                    muted
                    playsInline
                    className="hidden"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-mono flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isPlaying ? "bg-indigo-500 animate-ping" : "bg-slate-300"}`} />
                    Status: {isPlaying ? "EXTRACTING DYNAMIC WATERMARK SPECTRA..." : "INGESTION IDLE - SELECT FILE"}
                  </span>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={togglePlayState}
                      disabled={!decodingVideo}
                      className="bg-premium-indigo hover:bg-deep-sapphire disabled:opacity-40 text-white font-bold py-2.5 px-5 rounded-lg transition text-[11px] min-h-[44px] flex items-center gap-1.5 shadow-sm shadow-premium-indigo/10 cursor-pointer"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {isPlaying ? "HALT ENGINE" : "DECRYPT FLOW"}
                    </button>
                    
                    <button
                      onClick={() => {
                        setDecodingVideo(null);
                        setIsPlaying(false);
                        setDecodedDetails(null);
                        setSelectedBreachScenario("");
                      }}
                      className="text-slate-600 hover:text-slate-800 text-[11px] font-bold py-2.5 px-4 border border-cool-accent-gray bg-white rounded-lg transition min-h-[44px] cursor-pointer"
                    >
                      CLEAR CASE
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Canvases Outputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-cool-accent-gray">
              
              {/* Step 2 Edge Map */}
              <div className="bg-glareless-slate-light border border-cool-accent-gray rounded-xl p-4 text-center space-y-3 shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono block">Canny Filter Map (Contrast Edges)</span>
                <div className="bg-slate-900 rounded-xl p-2 aspect-video flex items-center justify-center overflow-hidden border border-cool-accent-gray/60 max-h-[180px]">
                  <canvas ref={edgeCanvasRef} width={320} height={180} className="w-full h-full object-contain" />
                </div>
              </div>

              {/* Step 4 Perspective Warp */}
              <div className="bg-glareless-slate-light border border-cool-accent-gray rounded-xl p-4 text-center space-y-3 shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono block">Perspective Normalized (Warp Filter)</span>
                <div className="bg-slate-900 rounded-xl p-2 aspect-video flex items-center justify-center overflow-hidden border border-cool-accent-gray/60 max-h-[180px]">
                  <canvas ref={warpCanvasRef} width={320} height={180} className="w-full h-full object-contain" />
                </div>
              </div>

            </div>

            {/* Resolved Metadata output console */}
            <div className="bg-glareless-slate-light border border-cool-accent-gray rounded-xl p-5 grid grid-cols-1 md:grid-cols-12 gap-6 text-xs font-mono shadow-sm">
              <div className="md:col-span-8 space-y-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-cool-accent-gray pb-2 flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-jade-emerald" /> Resolved Payload telemetry
                </div>
                
                {decodedDetails ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-slate-700">
                    <div><span className="text-slate-400 font-semibold uppercase">Theater Chain:</span> <span className="text-slate-900 font-bold">{decodedDetails.theatre}</span></div>
                    <div><span className="text-slate-400 font-semibold uppercase">City Node:</span> <span className="text-slate-900 font-bold">{decodedDetails.city}</span></div>
                    <div><span className="text-slate-400 font-semibold uppercase">Terminal ID:</span> <span className="text-slate-900 font-bold">{decodedDetails.screen}</span></div>
                    <div><span className="text-slate-400 font-semibold uppercase">Stego Payload:</span> <span className="text-premium-indigo font-bold select-all">{decodedDetails.payload}</span></div>
                  </div>
                ) : (
                  <div className="text-slate-400 py-2 italic">Waiting for computer vision signature handshake...</div>
                )}
              </div>

              <div className="md:col-span-4 flex items-end">
                {decodedDetails && (
                  <button
                    onClick={async () => {
                      try {
                        const targetMovieId = movies.length > 0 ? movies[0].id : "";
                        if (!targetMovieId) {
                          alert("Ensure at least one movie block exists in client workspace first.");
                          return;
                        }
                        await simulateLeak(
                          targetMovieId,
                          decodedDetails.theatre,
                          decodedDetails.city.replace(", USA", ""),
                          decodedDetails.screen.replace("Screen #", ""),
                          decodedDetails.payload
                        );
                        addCvLog(`[INCIDENT] SIMULATED BREACH REPORT COMMITTED FOR "${decodedDetails.theatre}"`);
                        alert("Breach alert successfully recorded into CRM!");
                      } catch {
                        alert("Failed to commit alert.");
                      }
                    }}
                    className="w-full bg-premium-indigo hover:bg-deep-sapphire text-white font-bold py-3 px-4 rounded-lg transition text-center uppercase tracking-wider text-[10px] min-h-[44px] cursor-pointer shadow-md shadow-premium-indigo/20"
                  >
                    Commit Alert to CRM
                  </button>
                )}
              </div>
            </div>

            {/* OpenCV Logs console output */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[10px] text-slate-300 shadow-inner space-y-1.5 max-h-[140px] overflow-y-auto">
              <div className="text-premium-indigo font-bold border-b border-slate-900 pb-2 mb-2 uppercase tracking-widest text-[9px] flex items-center justify-between">
                <span>CV Kernel Pipeline Execution Log</span>
                <button 
                  onClick={() => setCvLogs([])} 
                  className="text-slate-500 hover:text-slate-300 text-[8px] border border-slate-800 px-1.5 py-0.5 rounded cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  Clear Console
                </button>
              </div>
              {cvLogs.length === 0 ? (
                <div className="text-slate-600 text-center py-4 uppercase tracking-wider">CV Engine securely armed. Standby for frame ingestion.</div>
              ) : (
                cvLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    <span className={log.includes("✅") ? "text-emerald-400 font-semibold" : log.includes("❌") ? "text-red-400" : "text-slate-400"}>
                      {log}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* SECTION 2: Pending Direct HDFC Bank Settlements Review Desk */}
          <section id="settlements" className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-cool-accent-gray pb-4">
              <DollarSign className="h-5 w-5 text-premium-indigo" />
              <div>
                <h3 className="text-base font-display font-bold text-midnight-obsidian">Direct Bank Settlements Desk</h3>
                <p className="text-xs text-slate-500 mt-0.5">Audit and clear merchant subscription retention ledgers submitted via manual bank UTR transfer references.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {billingLedgers.filter(l => l.payment_status === "Verification_Pending").length === 0 ? (
                <div className="col-span-full text-center py-12 text-slate-400 text-xs font-mono border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Landmark className="h-8 w-8 text-slate-300 mx-auto mb-2.5 animate-bounce" />
                  NO PENDING LEDGER BALANCES SUBMITTED FOR MANUAL CLEARANCE.
                </div>
              ) : (
                billingLedgers.filter(l => l.payment_status === "Verification_Pending").map((ledger) => {
                  const total = Number(ledger.base_retainer_due) + Number(ledger.screen_fees) - Number(ledger.bounty_rewards);
                  const finalTotal = total < 0 ? 0 : total;
                  return (
                    <div key={ledger.id} className="bg-glareless-slate-light border border-cool-accent-gray rounded-xl p-5 space-y-4 font-mono text-xs shadow-sm flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex justify-between border-b border-cool-accent-gray pb-2.5">
                          <span className="font-bold text-slate-800">INV_{ledger.id.substring(4, 9).toUpperCase()}</span>
                          <span className="font-bold text-premium-indigo text-sm">₹{finalTotal.toLocaleString('en-IN')}</span>
                        </div>
                        
                        <div className="text-[10px] text-slate-500 space-y-1">
                          <div>UTR Code: <span className="text-slate-800 font-bold select-all bg-white px-1.5 py-0.5 border border-cool-accent-gray rounded">{ledger.bank_utr}</span></div>
                          <div>Reference File: <span className="text-slate-700 font-semibold break-all">{ledger.bank_receipt_url}</span></div>
                        </div>
                      </div>

                      <button
                        onClick={() => setInspectingLedger(ledger)}
                        className="w-full bg-premium-indigo text-white hover:bg-deep-sapphire font-bold py-2.5 rounded-lg text-[10px] transition uppercase tracking-wider min-h-[44px] cursor-pointer shadow-sm shadow-premium-indigo/15 mt-2"
                      >
                        Audit Receipt Slip
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* SECTION 2B: Bank Settlement Details CMS */}
          <section id="bank-details" className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-cool-accent-gray pb-4">
              <Landmark className="h-5 w-5 text-emerald-600" />
              <div>
                <h3 className="text-base font-display font-bold text-midnight-obsidian">Bank Settlement Details CMS</h3>
                <p className="text-xs text-slate-500 mt-0.5">Configure bank account details that will be displayed to all studio clients in their billing dashboard for manual transfers.</p>
              </div>
            </div>
            <form onSubmit={handleBankDetailsSave} className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-sans">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                  className="w-full bg-slate-50 border border-cool-accent-gray rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:border-premium-indigo focus:bg-white font-mono text-sm transition"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Account Holder Name</label>
                <input
                  type="text"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  placeholder="e.g. Kite & Tail Cybersecurity Pvt. Ltd."
                  className="w-full bg-slate-50 border border-cool-accent-gray rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:border-premium-indigo focus:bg-white font-mono text-sm transition"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Account Number</label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 50200093847561"
                  maxLength={18}
                  className="w-full bg-slate-50 border border-cool-accent-gray rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:border-premium-indigo focus:bg-white font-mono text-sm transition"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={bankIfscCode}
                  onChange={(e) => setBankIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g. HDFC0001234"
                  maxLength={11}
                  className="w-full bg-slate-50 border border-cool-accent-gray rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:border-premium-indigo focus:bg-white font-mono text-sm transition"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">UPI ID</label>
                <input
                  type="text"
                  value={bankUpiId}
                  onChange={(e) => setBankUpiId(e.target.value)}
                  placeholder="e.g. kiteandtail@hdfcbank"
                  className="w-full bg-slate-50 border border-cool-accent-gray rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:border-premium-indigo focus:bg-white font-mono text-sm transition"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Branch Name</label>
                <input
                  type="text"
                  value={bankBranchName}
                  onChange={(e) => setBankBranchName(e.target.value)}
                  placeholder="e.g. Bandra Kurla Complex, Mumbai"
                  className="w-full bg-slate-50 border border-cool-accent-gray rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:border-premium-indigo focus:bg-white font-mono text-sm transition"
                />
              </div>
              <div className="md:col-span-2">
                <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-100 rounded-xl p-4 text-xs font-mono space-y-1 mb-4">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Live Preview — Client View</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div><span className="text-slate-400 text-[9px] block">Bank</span><span className="font-bold text-slate-800">{bankName || "—"}</span></div>
                    <div><span className="text-slate-400 text-[9px] block">Holder</span><span className="font-bold text-slate-800 text-[10px]">{bankAccountHolder || "—"}</span></div>
                    <div><span className="text-slate-400 text-[9px] block">Account No.</span><span className="font-bold text-midnight-obsidian">{bankAccountNumber || "—"}</span></div>
                    <div><span className="text-slate-400 text-[9px] block">IFSC</span><span className="font-bold text-premium-indigo">{bankIfscCode || "—"}</span></div>
                    <div><span className="text-slate-400 text-[9px] block">UPI</span><span className="font-bold text-jade-emerald">{bankUpiId || "—"}</span></div>
                    <div><span className="text-slate-400 text-[9px] block">Branch</span><span className="font-bold text-slate-700 text-[10px]">{bankBranchName || "—"}</span></div>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-jade-emerald hover:opacity-90 text-white font-bold py-3 rounded-lg transition text-xs min-h-[44px] cursor-pointer shadow-md shadow-emerald-600/15"
                >
                  Save Bank Details &mdash; Publish to All Client Dashboards
                </button>
              </div>
            </form>
          </section>

          {/* SECTION 2C: Client Registry Table */}
          <section id="clients" className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-cool-accent-gray pb-4">
              <Shield className="h-5 w-5 text-premium-indigo" />
              <div>
                <h3 className="text-base font-display font-bold text-midnight-obsidian">Studio Client Registry</h3>
                <p className="text-xs text-slate-500 mt-0.5">Registered studio clients and their subscription status on the Sentinel platform.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-sans">
                <thead>
                  <tr className="bg-glareless-slate-light border-b border-cool-accent-gray text-left">
                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Client Email</th>
                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Company</th>
                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Tier</th>
                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">GSTIN</th>
                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Trial Clips</th>
                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cool-accent-gray">
                  {profiles.filter(p => p.role === "STUDIO_CLIENT").map((client) => (
                    <tr key={client.id} className="hover:bg-glareless-slate-light transition">
                      <td className="px-4 py-3 font-mono text-slate-700 font-semibold">{client.email}</td>
                      <td className="px-4 py-3 text-slate-600">{client.company_name || <span className="text-slate-300 italic">Not set</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                          client.subscription_tier === "Platinum" ? "bg-indigo-50 text-premium-indigo border-indigo-200" :
                          client.subscription_tier === "Gold" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>{client.subscription_tier || "Gold"}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 text-[10px]">{client.gstin || "—"}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">{client.trial_uses_remaining}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          client.onboarding_completed 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${client.onboarding_completed ? "bg-emerald-500" : "bg-amber-500"}`} />
                          {client.onboarding_completed ? "Active" : "Onboarding"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {profiles.filter(p => p.role === "STUDIO_CLIENT").length === 0 && (
                <div className="text-center py-10 text-slate-400 text-xs font-mono border-2 border-dashed border-slate-200 rounded-xl mt-4">NO STUDIO CLIENTS REGISTERED YET.</div>
              )}
            </div>
          </section>

          {/* SECTION 3: System pricing variables & MRR Calculator Grid */}
          <section id="configuration" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Pricing variable settings form */}
            <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 border-b border-cool-accent-gray pb-4">
                <Settings className="h-5 w-5 text-premium-indigo" />
                <div>
                  <h3 className="text-base font-display font-bold text-midnight-obsidian">SaaS Plan Pricing Token Console</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Manage token multipliers for active retainers, telemetries, and bounties.</p>
                </div>
              </div>
              
              <form onSubmit={handleCmsSave} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Base Retainer Price (Flat INR)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      value={basePrice}
                      onChange={(e) => setBasePrice(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-cool-accent-gray rounded-lg px-7 py-2.5 text-slate-800 focus:outline-none focus:border-premium-indigo focus:bg-white font-mono text-sm transition"
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono mt-1 block">Charged flat rate per registered movie block.</span>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Screen Telemetry Link Fee (INR / Screen)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      value={screenPrice}
                      onChange={(e) => setScreenPrice(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-cool-accent-gray rounded-lg px-7 py-2.5 text-slate-800 focus:outline-none focus:border-premium-indigo focus:bg-white font-mono text-sm transition"
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono mt-1 block">Charged per active theatrical screen telemetry link.</span>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Bounty Reward Offset (INR / Threat Cleared)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      value={bountyPrice}
                      onChange={(e) => setBountyPrice(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-cool-accent-gray rounded-lg px-7 py-2.5 text-slate-800 focus:outline-none focus:border-premium-indigo focus:bg-white font-mono text-sm transition"
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono mt-1 block">Offset credited when client processes legal takedown.</span>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Brand CSS Primary Accent Color Token</label>
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-full bg-slate-50 border border-cool-accent-gray rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:border-premium-indigo focus:bg-white font-mono text-sm transition"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-premium-indigo hover:bg-deep-sapphire text-white font-bold py-3 rounded-lg transition text-xs min-h-[44px] cursor-pointer shadow-md shadow-premium-indigo/15"
                >
                  Commit CMS Pricing Tokens
                </button>
              </form>
            </div>

            {/* MRR Calculator */}
            <div className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-cool-accent-gray pb-4">
                  <BarChart2 className="h-5 w-5 text-premium-indigo" />
                  <div>
                    <h3 className="text-base font-display font-bold text-midnight-obsidian">MRR Forecast Simulator</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Simulate global monthly recurring revenue forecast based on pricing tokens.</p>
                  </div>
                </div>

                <div className="space-y-5 text-xs pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 mb-1 text-[10px] uppercase font-mono font-bold">Simulate Clients</label>
                      <input 
                        type="number" 
                        value={simulatedClients} 
                        onChange={(e) => setSimulatedClients(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-cool-accent-gray rounded-lg p-2.5 font-mono text-slate-800 focus:outline-none focus:bg-white transition" 
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[10px] uppercase font-mono font-bold">Simulate Screens</label>
                      <input 
                        type="number" 
                        value={simulatedScreens} 
                        onChange={(e) => setSimulatedScreens(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-cool-accent-gray rounded-lg p-2.5 font-mono text-slate-800 focus:outline-none focus:bg-white transition" 
                      />
                    </div>
                  </div>

                  <div className="p-5 bg-gradient-to-r from-slate-50 to-slate-100/50 border border-cool-accent-gray rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase font-mono block">Simulated Monthly Revenue</span>
                      <span className="text-2xl font-display font-bold text-midnight-obsidian">₹{calculatedMRR.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-slate-500 font-mono text-[9px] text-right leading-relaxed">
                      Flat Retainer: ₹{(simulatedClients * basePrice).toLocaleString('en-IN')} <br />
                      Screen Links: ₹{(simulatedScreens * screenPrice).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-mono bg-glareless-slate-light border border-cool-accent-gray rounded-lg p-3 mt-4">
                Note: Calculation assumes all simulated screens and clients are fully active with zero default or bounty offset debits.
              </div>
            </div>

          </section>

          {/* SECTION 4: Interactive Threat Dashboard */}
          <section id="threats" className="bg-white border border-cool-accent-gray rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-cool-accent-gray pb-4">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-premium-indigo" />
                <div>
                  <h3 className="text-base font-display font-bold text-midnight-obsidian">Interactive Global Infringement Threat Map</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Audit live active security threats and TTR mitigation vectors across regional sentinel nodes.</p>
                </div>
              </div>
              {selectedThreatNode && (
                <span className="text-[10px] font-mono text-slate-500">Node selection active</span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Map SVG container */}
              <div className="lg:col-span-2 bg-slate-950 border border-slate-900 rounded-xl p-4 flex flex-col justify-between min-h-[300px] relative overflow-hidden shadow-inner">
                {/* Glowing SVG Background Map */}
                <div className="absolute inset-0 bg-[radial-gradient(#ffffff04_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
                
                <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
                  <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    Sentinel Node Array
                  </span>
                  <span className="text-[8px] font-mono text-slate-505">CLICK NODES TO AUDIT TELEMETRY</span>
                </div>

                <div className="flex-1 flex items-center justify-center relative min-h-[220px]">
                  <svg viewBox="0 0 800 400" className="w-full h-full text-slate-800 pointer-events-none select-none max-h-[260px]">
                    {/* Simplified World Map Vector Paths */}
                    <path d="M150,150 Q200,130 250,170 T350,160 T450,180 T550,140 T650,170 T750,180" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" strokeDasharray="5,5" />
                    <path d="M100,220 Q200,260 300,230 T500,240 T700,250" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" strokeDasharray="5,5" />
                    
                    {/* Regional outline indicators */}
                    <rect x="50" y="80" width="160" height="180" rx="8" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                    <rect x="230" y="60" width="150" height="150" rx="8" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                    <rect x="420" y="100" width="220" height="200" rx="8" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                    <rect x="660" y="140" width="100" height="180" rx="8" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />

                    <text x="60" y="95" className="fill-slate-600 font-mono text-[8px] font-bold">NORTH AMERICA ZONE</text>
                    <text x="240" y="75" className="fill-slate-600 font-mono text-[8px] font-bold">EUROPEAN CORRIDOR</text>
                    <text x="430" y="115" className="fill-slate-600 font-mono text-[8px] font-bold">ASIA-PACIFIC ZONE</text>
                    <text x="670" y="155" className="fill-slate-600 font-mono text-[8px] font-bold">OCEANIA LINK</text>
                  </svg>

                  {/* NYC Node */}
                  <button
                    onClick={() => setSelectedThreatNode({
                      name: "NYC-WEST-NODE",
                      city: "New York, USA",
                      threatLevel: "High",
                      mitigationRate: "97.1%",
                      activeAlerts: 1,
                      ttr: "5.8 mins"
                    })}
                    style={{ top: "35%", left: "15%" }}
                    className="absolute pointer-events-auto group focus:outline-none cursor-pointer"
                  >
                    <span className="absolute -inset-2 rounded-full bg-red-500/20 group-hover:bg-red-500/35 animate-ping duration-1000" />
                    <span className="w-3.5 h-3.5 rounded-full bg-red-500 border border-white flex items-center justify-center text-[7px] font-bold text-white shadow-lg">NY</span>
                    <span className="absolute top-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white font-mono text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-25 border border-slate-700 shadow-xl">NYC-WEST</span>
                  </button>

                  {/* London Node */}
                  <button
                    onClick={() => setSelectedThreatNode({
                      name: "LON-CENTRAL-NODE",
                      city: "London, UK",
                      threatLevel: "Medium",
                      mitigationRate: "96.5%",
                      activeAlerts: 0,
                      ttr: "7.0 mins"
                    })}
                    style={{ top: "28%", left: "38%" }}
                    className="absolute pointer-events-auto group focus:outline-none cursor-pointer"
                  >
                    <span className="absolute -inset-2 rounded-full bg-amber-500/20 group-hover:bg-amber-500/35 animate-ping duration-1000" />
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white flex items-center justify-center text-[7px] font-bold text-white shadow-lg">LN</span>
                    <span className="absolute top-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white font-mono text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-25 border border-slate-700 shadow-xl">LON-CENTRAL</span>
                  </button>

                  {/* Delhi Node */}
                  <button
                    onClick={() => setSelectedThreatNode({
                      name: "DEL-CORE-NODE",
                      city: "New Delhi, IND",
                      threatLevel: "Critical",
                      mitigationRate: "98.4%",
                      activeAlerts: 3,
                      ttr: "4.2 mins"
                    })}
                    style={{ top: "48%", left: "62%" }}
                    className="absolute pointer-events-auto group focus:outline-none cursor-pointer"
                  >
                    <span className="absolute -inset-2.5 rounded-full bg-red-600/30 group-hover:bg-red-600/45 animate-ping duration-750" />
                    <span className="w-4.5 h-4.5 rounded-full bg-red-600 border border-white flex items-center justify-center text-[7px] font-bold text-white shadow-xl">DEL</span>
                    <span className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white font-mono text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-25 border border-slate-700 shadow-xl">DEL-CORE</span>
                  </button>

                  {/* Tokyo Node */}
                  <button
                    onClick={() => setSelectedThreatNode({
                      name: "TOK-EAST-NODE",
                      city: "Tokyo, JPN",
                      threatLevel: "Low",
                      mitigationRate: "99.1%",
                      activeAlerts: 0,
                      ttr: "3.1 mins"
                    })}
                    style={{ top: "35%", left: "80%" }}
                    className="absolute pointer-events-auto group focus:outline-none cursor-pointer"
                  >
                    <span className="absolute -inset-2 rounded-full bg-emerald-500/20 group-hover:bg-emerald-500/35 animate-ping duration-1000" />
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white flex items-center justify-center text-[7px] font-bold text-white shadow-lg">TK</span>
                    <span className="absolute top-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white font-mono text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-25 border border-slate-700 shadow-xl">TOK-EAST</span>
                  </button>
                </div>
              </div>

              {/* Node Metrics info card */}
              <div className="bg-glareless-slate-light border border-cool-accent-gray rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                {selectedThreatNode ? (
                  <div className="space-y-4">
                    <div className="border-b border-cool-accent-gray pb-3">
                      <span className="text-[9px] font-bold text-slate-400 font-mono block uppercase">Sentinel Location</span>
                      <h4 className="text-base font-display font-bold text-midnight-obsidian">{selectedThreatNode.city}</h4>
                      <span className="text-[10px] font-mono text-slate-505">{selectedThreatNode.name}</span>
                    </div>

                    <div className="space-y-3.5 text-xs font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-505">Threat Level:</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          selectedThreatNode.threatLevel === "Critical" ? "bg-red-50 text-red-700 border border-red-200" :
                          selectedThreatNode.threatLevel === "High" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                          selectedThreatNode.threatLevel === "Medium" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                          "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}>{selectedThreatNode.threatLevel}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-slate-500">Active Alert Signals:</span>
                        <span className="font-bold text-slate-800">{selectedThreatNode.activeAlerts} Alerts</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500">TTR Mitigation Rate:</span>
                        <span className="font-bold text-slate-800">{selectedThreatNode.mitigationRate}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500">Average Node TTR:</span>
                        <span className="font-bold text-slate-800">{selectedThreatNode.ttr}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-slate-400">
                    <AlertTriangle className="h-8 w-8 text-slate-300 mb-2" />
                    <span className="text-xs font-mono uppercase">Select a node on the map to audit region telemetry metrics.</span>
                  </div>
                )}

                <div className="border-t border-cool-accent-gray pt-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>Active Global Breaches:</span>
                    <span className="font-bold text-red-600 font-semibold">4 Active</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>Sentinel Mitigation Index:</span>
                    <span className="font-bold text-emerald-600 font-semibold">98.4%</span>
                  </div>
                </div>
              </div>

            </div>
          </section>

        </div>

      </main>

      {/* Direct Bank transfer inspect receipt overlay dialog */}
      {inspectingLedger && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-cool-accent-gray text-slate-800 rounded-xl overflow-hidden max-w-md w-full shadow-2xl animate-in fade-in duration-200">
            {/* Header */}
            <div className="bg-midnight-obsidian p-5 border-b border-deep-slate-onyx flex items-center justify-between text-white">
              <div>
                <span className="block text-[9px] uppercase tracking-wider text-premium-indigo font-mono font-bold">RECEIPT AUDIT WORKBENCH</span>
                <span className="block text-xs text-slate-400 mt-0.5">Verification Reference Ledger</span>
              </div>
              <button 
                onClick={() => setInspectingLedger(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-deep-slate-onyx transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Audit Details */}
            <div className="p-6 space-y-6">
              
              <div className="bg-glareless-slate-light border border-cool-accent-gray rounded-xl p-4 text-xs font-mono space-y-2.5 shadow-inner">
                <div className="flex justify-between border-b border-cool-accent-gray pb-2">
                  <span className="text-slate-500">Invoice Reference:</span>
                  <span className="font-bold text-slate-900">INV_{inspectingLedger.id.substring(4, 9).toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sender UTR Code:</span>
                  <span className="font-bold text-cyan-650 select-all">{inspectingLedger.bank_utr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Settled Amount:</span>
                  <span className="font-bold text-midnight-obsidian">
                    ₹{(Number(inspectingLedger.base_retainer_due) + Number(inspectingLedger.screen_fees) - Number(inspectingLedger.bounty_rewards) < 0 ? 0 : Number(inspectingLedger.base_retainer_due) + Number(inspectingLedger.screen_fees) - Number(inspectingLedger.bounty_rewards)).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-505">Attachment Slip:</span>
                  <span className="text-slate-700 underline truncate max-w-[200px]">{inspectingLedger.bank_receipt_url}</span>
                </div>
              </div>

              {/* Receipt Visualizer mockup */}
              <div className="border border-cool-accent-gray rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-center text-center aspect-video relative overflow-hidden select-none shadow-inner">
                <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1.5px,transparent_1.5px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
                
                {/* Mock receipt visual element */}
                <div className="bg-white border border-cool-accent-gray rounded-lg p-4 shadow-md w-48 font-mono text-[8px] text-slate-600 space-y-2 text-left relative z-10">
                  <div className="text-center font-bold text-[9px] border-b border-cool-accent-gray pb-1.5 text-slate-800 flex items-center justify-center gap-1">
                    <Landmark className="h-3 w-3 text-slate-500" />
                    <span>HDFC BANK SYSTEM RECEIPT</span>
                  </div>
                  <div className="flex justify-between"><span>Value Date:</span><span>{new Date().toLocaleDateString()}</span></div>
                  <div className="flex justify-between"><span>UTR Number:</span><span className="font-bold text-slate-800">{inspectingLedger.bank_utr?.substring(0,8)}...</span></div>
                  <div className="flex justify-between"><span>Ref Invoice:</span><span>INV_{inspectingLedger.id.substring(4,9).toUpperCase()}</span></div>
                  
                  <div className="border-t border-dashed border-cool-accent-gray pt-2 flex justify-between font-bold text-slate-900 text-[9px]">
                    <span>PAID TOTAL:</span>
                    <span>₹{(Number(inspectingLedger.base_retainer_due) + Number(inspectingLedger.screen_fees) - Number(inspectingLedger.bounty_rewards)).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="text-center text-[7px] text-emerald-650 font-bold bg-emerald-50/50 py-1 rounded border border-emerald-200 uppercase tracking-widest">
                    BANK TRANSFER MATCH
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => handleRejectBank(inspectingLedger.id)}
                  className="flex-1 bg-red-50 hover:bg-red-100 text-deep-burgundy border border-red-200 py-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                >
                  <X className="h-4 w-4" /> Reject Reference
                </button>
                <button
                  onClick={() => handleApproveBank(inspectingLedger.id)}
                  className="flex-1 bg-emerald-650 hover:bg-emerald-500 text-white py-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer shadow-md shadow-emerald-600/10"
                >
                  <Check className="h-4 w-4" /> Verify & Approve
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

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

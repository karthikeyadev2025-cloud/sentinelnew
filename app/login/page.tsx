"use client";

import React, { useState, useEffect } from "react";
import { useDrm } from "../context/DrmContext";
import { useRouter } from "next/navigation";
import { Shield, AlertTriangle, Cpu, Terminal, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function LoginPage() {
  const { login, deviceFingerprint, currentProfile } = useDrm();
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAbused, setIsAbused] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    // Add realistic boot-up logs
    const bootLogs = [
      "CRITICAL SECURITY LOGS: SYSTEM STANDBY...",
      "SENTINEL CINEMA DRM KERNEL 4.1.2-RELEASE",
      "BINDING IN-BROWSER WATERMARK ENGINES...",
      `TELEMETRY: RESOLVED DEVICE HASH: ${deviceFingerprint || "CALCULATING..."}`,
      "READY FOR HANDSHAKE."
    ];
    
    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < bootLogs.length) {
        setLogs(prev => [...prev, bootLogs[currentIdx]]);
        currentIdx++;
      } else {
        clearInterval(interval);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [deviceFingerprint]);

  // If already logged in, redirect
  useEffect(() => {
    if (currentProfile) {
      if (currentProfile.onboarding_completed) {
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    }
  }, [currentProfile, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setErrorMsg(null);
    setIsVerifying(true);
    
    // Telemetry log addition
    setLogs(prev => [
      ...prev,
      `INITIATING HANDSHAKE FOR CLIENT: ${email}`,
      `COMPUTING THREAT VECTOR FOR HARDWARE: ${deviceFingerprint}`
    ]);

    // Simulate verification delay
    setTimeout(async () => {
      try {
        const profile = await login(email);
        setLogs(prev => [...prev, "HANDSHAKE COMPLETED. PROFILE AUTHENTICATED."]);
        
        if (profile.onboarding_completed) {
          router.push("/dashboard");
        } else {
          router.push("/onboarding");
        }
      } catch (err: any) {
        setIsAbused(true);
        setErrorMsg(err.message || "Security violation detected.");
        setLogs(prev => [
          ...prev,
          "❌ HANDSHAKE ABORTED.",
          `CRITICAL: DEVICE HARDWARE FINGERPRINT MATCHES ABUSE_LOCKED SIGNATURE.`,
          "FIREWALL ACTIVE: LOCAL PORT SUSPENDED."
        ]);
      } finally {
        setIsVerifying(false);
      }
    }, 1200);
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-500 ${isAbused ? "bg-red-950/20" : "bg-zinc-950"}`}>
      {/* Decorative Grid Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      
      {/* Laser light scan effects */}
      <div className={`absolute left-0 right-0 h-[2px] pointer-events-none opacity-40 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-pulse top-1/4 ${isAbused && "via-red-500"}`} />
      
      <div className="w-full max-w-lg z-10">
        
        {/* Logo and Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-full bg-zinc-900 border border-zinc-800 mb-3 text-cyan-400">
            {isAbused ? (
              <AlertTriangle className="h-8 w-8 text-red-500 animate-bounce" />
            ) : (
              <Shield className="h-8 w-8 text-cyan-500" />
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            SENTINEL <span className={isAbused ? "text-red-500" : "text-cyan-400"}>DRM</span>
          </h1>
          <p className="text-xs tracking-widest text-zinc-500 uppercase mt-1">
            Kite & Tail Cybersecurity Command Node
          </p>
        </div>

        <AnimatePresence mode="wait">
          {isAbused ? (
            /* Crimson Red Lockout Screen */
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-950 border-2 border-red-600 rounded-xl p-6 shadow-[0_0_50px_rgba(220,38,38,0.2)] relative"
            >
              {/* Flashing Warning Corner Anchors */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-red-600 animate-ping" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-red-600 animate-ping" />
              
              <div className="flex items-start gap-4 text-red-500">
                <AlertTriangle className="h-10 w-10 flex-shrink-0 animate-pulse" />
                <div>
                  <h2 className="text-xl font-bold tracking-wide uppercase">Hardware Node Locked</h2>
                  <p className="text-sm text-zinc-400 mt-2">
                    This browser / workstation fingerprint matches the active blocklist:
                  </p>
                  <code className="block bg-zinc-900 p-2 rounded text-red-400 font-mono text-xs mt-3 select-all border border-red-900/50">
                    {deviceFingerprint || "FP_ABUSE_LOCKED"}
                  </code>
                </div>
              </div>

              <div className="mt-6 border-t border-zinc-800 pt-4 text-zinc-400 text-xs leading-relaxed space-y-2">
                <p>
                  Your profile <span className="text-red-400 font-mono">{email}</span> and hardware fingerprint have been flags-locked due to excessive trial abuse, unauthorized redistribution simulations, or cross-tenant leaks.
                </p>
                <p className="text-red-500 font-semibold uppercase tracking-wider text-[10px]">
                  CRITICAL CODE: SEC_ABUSE_LOCKED_FINGERPRINT
                </p>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setIsAbused(false);
                    setEmail("");
                    setErrorMsg(null);
                  }}
                  className="flex-1 py-2 rounded-lg bg-zinc-900 border border-zinc-850 hover:bg-zinc-850 text-zinc-300 text-sm font-semibold transition"
                >
                  Return to Handshake
                </button>
              </div>
            </motion.div>
          ) : (
            /* Secure Login Card */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl p-6"
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold tracking-wider text-zinc-400 uppercase mb-2">
                    Corporate Access Gateway
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. producer@kiteandtail.com"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-2">
                    Type <code className="text-red-400 select-all">abuser@flagged.com</code> to simulate Crimson Red lock behavior.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 text-sm"
                >
                  {isVerifying ? (
                    <>
                      <Cpu className="h-4 w-4 animate-spin text-cyan-200" />
                      Performing Security Verification...
                    </>
                  ) : (
                    <>
                      Authenticate Session
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Hardware Fingerprint Monitor */}
              <div className="mt-6 pt-6 border-t border-zinc-850">
                <div className="flex items-center justify-between text-xs text-zinc-500 font-mono mb-2">
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3 w-3 text-cyan-500" /> Device Signature:
                  </span>
                  <span className="text-zinc-400 font-semibold">{deviceFingerprint || "Resolving..."}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Real-time Telemetry Monitor terminal */}
        <div className="mt-6 bg-zinc-950/80 border border-zinc-850 rounded-xl p-4 font-mono text-[10px] text-zinc-400 space-y-1 h-36 overflow-y-auto select-none shadow-inner">
          <div className="flex items-center gap-1 text-cyan-500 font-semibold mb-2 uppercase tracking-wider border-b border-zinc-850 pb-1">
            <Terminal className="h-3 w-3" /> Live Kernel Telemetry log
          </div>
          {logs.map((log, index) => (
            <div key={index} className="truncate">
              <span className="text-zinc-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
              <span className={log.includes("❌") || log.includes("CRITICAL") ? "text-red-400" : log.includes("SUCCESS") || log.includes("COMPUTING") ? "text-cyan-300" : "text-zinc-400"}>
                {log}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useDrm } from "../context/DrmContext";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Cpu, Landmark, ArrowRight, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function OnboardingPage() {
  const { currentProfile, onboard, globalConfig, deviceFingerprint, isLoading } = useDrm();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Validate state access
  useEffect(() => {
    if (!isLoading) {
      if (!currentProfile) {
        router.push("/login");
      } else if (currentProfile.onboarding_completed) {
        router.push("/dashboard");
      } else {
        // Pre-fill email from profile
        const timer = setTimeout(() => {
          setEmail(currentProfile.email);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [currentProfile, isLoading, router]);

  if (isLoading || !currentProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
      </div>
    );
  }

  // Regex validations
  const isCorporateEmail = (emailStr: string) => {
    const blockedDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com", "proton.me", "protonmail.com"];
    const domain = emailStr.split("@")[1]?.toLowerCase();
    return domain && !blockedDomains.includes(domain);
  };

  const isValidGstin = (gstinStr: string) => {
    // 15 Character GSTIN format: e.g. 22AAAAA1111A1Z1
    // First 2: state code (numeric)
    // Next 10: PAN (5 letters, 4 numbers, 1 letter)
    // 13th: entity number (alpha/numeric)
    // 14th: Z default character
    // 15th: check digit
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstinStr.toUpperCase());
  };

  const handleNextStep = () => {
    setErrorMsg(null);

    if (step === 1) {
      if (!companyName.trim()) {
        setErrorMsg("Company Name is required.");
        return;
      }
      if (!isCorporateEmail(email)) {
        setErrorMsg("A corporate email domain is required (Gmail, Yahoo, Outlook etc. are blocked).");
        return;
      }
      if (!isValidGstin(gstin)) {
        setErrorMsg("Please enter a valid 15-character corporate GSTIN (e.g. 27AAAAA1111A1Z1).");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      setErrorMsg(null);
      await onboard({
        companyName,
        email,
        gstin: gstin.toUpperCase(),
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg || "Failed to save onboarding data.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-xl z-10">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between mb-8 border-b border-zinc-850 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-cyan-500" /> ONBOARDING WIZARD
            </h1>
            <p className="text-xs text-zinc-500">Step {step} of 3 — Secure Identity Setup</p>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  s === step ? "w-6 bg-cyan-500" : s < step ? "w-2 bg-emerald-500" : "w-2 bg-zinc-800"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form error alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/30 border border-red-900 text-red-400 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Landmark className="h-5 w-5 text-cyan-400" /> Step 1: Corporate Registry Verification
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Sentinel Cinema DRM is an enterprise-exclusive platform. Enter your corporate email and GSTIN to proceed.
              </p>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Company Registered Legal Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Kite & Tail Film Distributors"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Corporate Email Domain</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. licensing@kiteandtail.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500 transition font-mono"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Common consumer domains are blocked.</p>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Company GSTIN Number</label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="e.g. 27AAAAA1111A1Z1"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500 transition font-mono uppercase"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Format: 15 alphanumeric characters matching state-PAN registry standards.
                  </p>
                </div>
              </div>

              <button
                onClick={handleNextStep}
                className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded text-sm transition mt-6"
              >
                Proceed to Contract Terms <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-cyan-400" /> Step 2: License Pricing Structure
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Confirm your contract base variables. These amounts are automatically compiled onto Razorpay payment ledgers.
              </p>

              <div className="grid grid-cols-3 gap-3 pt-3">
                <div className="bg-zinc-950 p-3 rounded border border-zinc-800 text-center">
                  <div className="text-[10px] uppercase text-zinc-500">Base Retainer</div>
                  <div className="text-base font-bold text-cyan-400 mt-1">
                    ${globalConfig.base_retainer_price}
                  </div>
                  <div className="text-[8px] text-zinc-500">per movie / month</div>
                </div>
                <div className="bg-zinc-950 p-3 rounded border border-zinc-800 text-center">
                  <div className="text-[10px] uppercase text-zinc-500">Screen Telemetry</div>
                  <div className="text-base font-bold text-cyan-400 mt-1">
                    ${globalConfig.screen_fee_price}
                  </div>
                  <div className="text-[8px] text-zinc-500">per screen actively tracked</div>
                </div>
                <div className="bg-zinc-950 p-3 rounded border border-zinc-800 text-center">
                  <div className="text-[10px] uppercase text-zinc-500">Bounty Rewards</div>
                  <div className="text-base font-bold text-emerald-400 mt-1">
                    ${globalConfig.bounty_reward_price}
                  </div>
                  <div className="text-[8px] text-zinc-500">per verified pirate leak</div>
                </div>
              </div>

              <div className="bg-zinc-950 p-4 rounded border border-zinc-800 mt-4 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Onboarding Status:</span>
                  <span className="text-zinc-300 font-semibold">Active Client Trial</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Free Ingestion Credits:</span>
                  <span className="text-emerald-400 font-semibold font-mono">2 Watermarks Remaining</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-2 rounded bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-sm font-semibold transition"
                >
                  Back
                </button>
                <button
                  onClick={handleNextStep}
                  className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-4 rounded text-sm transition"
                >
                  Proceed to Device Bind <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Cpu className="h-5 w-5 text-cyan-400" /> Step 3: Hardware Signature Registry
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Sentinel Cinema DRM verifies operations through device signatures to avoid credential sharing. Bind this workstation to complete onboarding.
              </p>

              <div className="bg-zinc-950 p-4 rounded border border-zinc-800 font-mono space-y-2 mt-2">
                <div className="text-[10px] text-zinc-500 border-b border-zinc-850 pb-2">WORKSTATION METADATA</div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Target Signature:</span>
                  <span className="text-cyan-400 font-semibold select-all">{deviceFingerprint}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Threat Status:</span>
                  <span className="text-emerald-400 font-semibold">CLEAR (SEC_SAFE_NODE)</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Agent Class:</span>
                  <span className="text-zinc-300">STUDIO_CLIENT_NODE</span>
                </div>
              </div>

              <p className="text-[10px] text-zinc-500 leading-relaxed">
                * By clicking complete, you bind this device footprint hash to your account profile. Logins from flag-blocked hashes will lock the account instantly.
              </p>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-2 rounded bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-sm font-semibold transition"
                >
                  Back
                </button>
                <button
                  onClick={handleCompleteOnboarding}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded text-sm transition"
                >
                  <Check className="h-4 w-4" /> Finalize & Enter Desk
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

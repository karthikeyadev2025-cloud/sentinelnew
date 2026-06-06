"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

// Types corresponding to Supabase schemas
export interface Profile {
  id: string;
  email: string;
  role: "STUDIO_CLIENT" | "SUPER_ADMIN";
  onboarding_completed: boolean;
  trial_uses_remaining: number;
  device_fingerprint_hash: string;
  company_name?: string;
  gstin?: string;
}

export interface Movie {
  id: string;
  title: string;
  tracking_status: "Secure" | "Breached";
}

export interface TheatreScreen {
  id: string;
  movie_id: string;
  chain_name: string;
  city: string;
  screen_number: string;
}

export interface LeakAlert {
  id: string;
  movie_id: string;
  theatre_id: string;
  payload_string: string;
  status: "Active" | "Takedown Dispatched";
  timestamp: string;
}

export interface BillingLedger {
  id: string;
  base_retainer_due: number;
  screen_fees: number;
  bounty_rewards: number;
  payment_status: "Unpaid" | "Paid_Razorpay";
  created_at: string;
}

export interface GlobalConfig {
  base_retainer_price: number;
  screen_fee_price: number;
  bounty_reward_price: number;
  css_primary_color: string;
}

interface DrmContextType {
  currentProfile: Profile | null;
  profiles: Profile[];
  movies: Movie[];
  theatreScreens: TheatreScreen[];
  leakAlerts: LeakAlert[];
  billingLedgers: BillingLedger[];
  globalConfig: GlobalConfig;
  deviceFingerprint: string;
  isLoading: boolean;
  login: (email: string) => Promise<Profile>;
  onboard: (data: { companyName: string; email: string; gstin: string }) => Promise<void>;
  logout: () => void;
  addMovie: (title: string) => Promise<Movie>;
  simulateLeak: (movieId: string, chainName: string, city: string, screenNumber: string, payload: string) => Promise<void>;
  dispatchTakedown: (alertId: string) => Promise<void>;
  settleInvoice: (ledgerId: string) => Promise<void>;
  updateGlobalConfig: (config: Partial<GlobalConfig>) => Promise<void>;
  resetAllData: () => void;
}

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  base_retainer_price: 5000,
  screen_fee_price: 250,
  bounty_reward_price: 1200,
  css_primary_color: "#3b82f6", // Electric Blue
};

const DrmContext = createContext<DrmContextType | undefined>(undefined);

export function DrmProvider({ children }: { children: React.ReactNode }) {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [theatreScreens, setTheatreScreens] = useState<TheatreScreen[]>([]);
  const [leakAlerts, setLeakAlerts] = useState<LeakAlert[]>([]);
  const [billingLedgers, setBillingLedgers] = useState<BillingLedger[]>([]);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(DEFAULT_GLOBAL_CONFIG);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [useFallback, setUseFallback] = useState<boolean>(false);

  // Generate browser fingerprint hash
  useEffect(() => {
    if (typeof window !== "undefined") {
      const generateFingerprint = () => {
        const navigator_info = window.navigator.userAgent + window.navigator.language;
        const screen_info = window.screen.width + "x" + window.screen.height + "x" + window.screen.colorDepth;
        let hash = 0;
        const input = navigator_info + screen_info;
        for (let i = 0; i < input.length; i++) {
          const char = input.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash;
        }
        return "FP_" + Math.abs(hash).toString(16).toUpperCase();
      };
      const timer = setTimeout(() => {
        setDeviceFingerprint(generateFingerprint());
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  // LocalStorage Loading Fallback
  function loadLocalFallbacks() {
    // Global Config
    const localConfig = localStorage.getItem("drm_global_config");
    if (localConfig) setGlobalConfig(JSON.parse(localConfig));

    // Profiles
    const localProfiles = localStorage.getItem("drm_profiles");
    const defaultProfiles: Profile[] = [
      {
        id: "prof_client_1",
        email: "producer@kiteandtail.com",
        role: "STUDIO_CLIENT",
        onboarding_completed: true,
        trial_uses_remaining: 2,
        device_fingerprint_hash: "FP_CLIENT_OK",
        company_name: "Kite & Tail Studios",
        gstin: "27AAAAA1111A1Z1",
      },
      {
        id: "prof_admin_1",
        email: "admin@kiteandtail.com",
        role: "SUPER_ADMIN",
        onboarding_completed: true,
        trial_uses_remaining: 99,
        device_fingerprint_hash: "FP_ADMIN_OK",
        company_name: "Kite & Tail Ops",
        gstin: "27AAAAA2222B1Z2",
      },
      {
        id: "prof_abused",
        email: "abuser@flagged.com",
        role: "STUDIO_CLIENT",
        onboarding_completed: false,
        trial_uses_remaining: 0,
        device_fingerprint_hash: "FP_ABUSE_LOCKED",
      },
    ];
    if (localProfiles) {
      setProfiles(JSON.parse(localProfiles));
    } else {
      localStorage.setItem("drm_profiles", JSON.stringify(defaultProfiles));
      setProfiles(defaultProfiles);
    }

    // Movies
    const localMovies = localStorage.getItem("drm_movies");
    const defaultMovies: Movie[] = [
      { id: "mov_1", title: "Apex Horizon (Climax Locked)", tracking_status: "Secure" },
      { id: "mov_2", title: "Midnight Chronicles (Unwatermarked)", tracking_status: "Breached" },
    ];
    if (localMovies) setMovies(JSON.parse(localMovies));
    else {
      localStorage.setItem("drm_movies", JSON.stringify(defaultMovies));
      setMovies(defaultMovies);
    }

    // Screens
    const localScreens = localStorage.getItem("drm_screens");
    const defaultScreens: TheatreScreen[] = [
      { id: "scr_1", movie_id: "mov_2", chain_name: "AMC Empire 25", city: "New York", screen_number: "04" },
      { id: "scr_2", movie_id: "mov_1", chain_name: "Regal LA Live", city: "Los Angeles", screen_number: "01" },
      { id: "scr_3", movie_id: "mov_2", chain_name: "PVR Director's Cut", city: "New Delhi", screen_number: "02" },
    ];
    if (localScreens) setTheatreScreens(JSON.parse(localScreens));
    else {
      localStorage.setItem("drm_screens", JSON.stringify(defaultScreens));
      setTheatreScreens(defaultScreens);
    }

    // Alerts
    const localAlerts = localStorage.getItem("drm_alerts");
    const defaultAlerts: LeakAlert[] = [
      {
        id: "alt_1",
        movie_id: "mov_2",
        theatre_id: "scr_1",
        payload_string: "AMC_EMP25_NY_S4_ID89",
        status: "Active",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "alt_2",
        movie_id: "mov_2",
        theatre_id: "scr_3",
        payload_string: "PVR_DC_DEL_S2_ID72",
        status: "Takedown Dispatched",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
    ];
    if (localAlerts) setLeakAlerts(JSON.parse(localAlerts));
    else {
      localStorage.setItem("drm_alerts", JSON.stringify(defaultAlerts));
      setLeakAlerts(defaultAlerts);
    }

    // Ledgers
    const localLedgers = localStorage.getItem("drm_ledgers");
    const defaultLedgers: BillingLedger[] = [
      {
        id: "led_1",
        base_retainer_due: 5000,
        screen_fees: 500,
        bounty_rewards: 1200,
        payment_status: "Unpaid",
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "led_2",
        base_retainer_due: 5000,
        screen_fees: 250,
        bounty_rewards: 0,
        payment_status: "Paid_Razorpay",
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
    ];
    if (localLedgers) setBillingLedgers(JSON.parse(localLedgers));
    else {
      localStorage.setItem("drm_ledgers", JSON.stringify(defaultLedgers));
      setBillingLedgers(defaultLedgers);
    }

    // Session Profile
    const sessionProfile = sessionStorage.getItem("drm_current_profile");
    if (sessionProfile) setCurrentProfile(JSON.parse(sessionProfile));
  }

  // Hydrate State: Connects to Supabase; falls back to LocalStorage if tables don't exist
  useEffect(() => {
    const fetchRemoteData = async () => {
      try {
        setIsLoading(true);
        // Test connectivity by reading global configuration
        const { data: configData, error: configError } = await supabase
          .from("global_config")
          .select("*")
          .eq("id", 1)
          .maybeSingle();

        if (configError) {
          throw new Error("Supabase tables not initialized. Activating localStorage mode.");
        }

        if (configData) {
          setGlobalConfig(configData);
        } else {
          // Setup initial configuration row if empty
          await supabase.from("global_config").insert({ id: 1, ...DEFAULT_GLOBAL_CONFIG });
        }

        // Fetch remaining tables
        const { data: profs } = await supabase.from("profiles").select("*");
        if (profs) setProfiles(profs);

        const { data: movs } = await supabase.from("movies").select("*");
        if (movs) setMovies(movs);

        const { data: screens } = await supabase.from("theatre_screens").select("*");
        if (screens) setTheatreScreens(screens);

        const { data: alerts } = await supabase.from("leak_alerts").select("*");
        if (alerts) setLeakAlerts(alerts);

        const { data: ledgers } = await supabase.from("billing_ledgers").select("*");
        if (ledgers) setBillingLedgers(ledgers);

        // Restore active user session from sessionStorage
        const savedSession = sessionStorage.getItem("drm_current_profile");
        if (savedSession) {
          const sessionUser = JSON.parse(savedSession);
          // Refetch fresh profile data
          const { data: freshProf } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", sessionUser.id)
            .maybeSingle();
          if (freshProf) {
            setCurrentProfile(freshProf);
            sessionStorage.setItem("drm_current_profile", JSON.stringify(freshProf));
          } else {
            setCurrentProfile(sessionUser);
          }
        }
      } catch (err) {
        console.warn("DrmContext: Supabase connection failed. Falling back to local state.", err);
        setUseFallback(true);
        loadLocalFallbacks();
      } finally {
        setIsLoading(false);
      }
    };

    fetchRemoteData();
  }, []);;

  // Local sync helper for fallback mode
  const syncLocalProfiles = (updated: Profile[]) => {
    setProfiles(updated);
    localStorage.setItem("drm_profiles", JSON.stringify(updated));
  };

  // Login handler
  const login = async (email: string): Promise<Profile> => {
    let targetFingerprint = deviceFingerprint;
    if (email.toLowerCase() === "abuser@flagged.com") {
      targetFingerprint = "FP_ABUSE_LOCKED";
    }

    // Check device footprint blocklist
    if (targetFingerprint === "FP_ABUSE_LOCKED") {
      throw new Error("SECURITY_VIOLATION: Device hardware fingerprint is flag-locked due to terms abuse.");
    }

    if (useFallback) {
      let matchedProfile = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
      if (!matchedProfile) {
        matchedProfile = {
          id: "prof_" + Math.random().toString(36).substring(2, 9),
          email,
          role: "STUDIO_CLIENT",
          onboarding_completed: false,
          trial_uses_remaining: 2,
          device_fingerprint_hash: targetFingerprint,
        };
        syncLocalProfiles([...profiles, matchedProfile]);
      } else {
        matchedProfile.device_fingerprint_hash = targetFingerprint;
        syncLocalProfiles(profiles.map((p) => (p.id === matchedProfile!.id ? matchedProfile! : p)));
      }
      sessionStorage.setItem("drm_current_profile", JSON.stringify(matchedProfile));
      setCurrentProfile(matchedProfile);
      return matchedProfile;
    }

    // Supabase Mode
    // 1. Fetch matching profiles
    const { data: matched } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    let finalProfile: Profile;

    if (!matched) {
      // Create profile row
      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert({
          email: email.toLowerCase(),
          role: "STUDIO_CLIENT",
          onboarding_completed: false,
          trial_uses_remaining: 2,
          device_fingerprint_hash: targetFingerprint,
        })
        .select()
        .single();
      
      if (insertError) throw new Error(insertError.message);
      finalProfile = inserted;
    } else {
      // Check block condition on fetched profile
      if (matched.device_fingerprint_hash === "FP_ABUSE_LOCKED") {
        throw new Error("SECURITY_VIOLATION: Device hardware fingerprint is flag-locked due to terms abuse.");
      }

      // Update active fingerprint hash
      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update({ device_fingerprint_hash: targetFingerprint })
        .eq("id", matched.id)
        .select()
        .single();

      if (updateError) throw new Error(updateError.message);
      finalProfile = updated;
    }

    // Sync context profile list
    const { data: refreshedProfs } = await supabase.from("profiles").select("*");
    if (refreshedProfs) setProfiles(refreshedProfs);

    sessionStorage.setItem("drm_current_profile", JSON.stringify(finalProfile));
    setCurrentProfile(finalProfile);
    return finalProfile;
  };

  // Complete onboarding
  const onboard = async (data: { companyName: string; email: string; gstin: string }) => {
    if (!currentProfile) throw new Error("No active session");

    if (useFallback) {
      const updatedProfile: Profile = {
        ...currentProfile,
        company_name: data.companyName,
        gstin: data.gstin,
        onboarding_completed: true,
      };
      syncLocalProfiles(profiles.map((p) => (p.id === currentProfile.id ? updatedProfile : p)));
      setCurrentProfile(updatedProfile);
      sessionStorage.setItem("drm_current_profile", JSON.stringify(updatedProfile));
      return;
    }

    // Supabase Mode
    const { data: updated, error } = await supabase
      .from("profiles")
      .update({
        company_name: data.companyName,
        gstin: data.gstin,
        onboarding_completed: true,
      })
      .eq("id", currentProfile.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Refresh memory states
    const { data: refreshedProfs } = await supabase.from("profiles").select("*");
    if (refreshedProfs) setProfiles(refreshedProfs);

    setCurrentProfile(updated);
    sessionStorage.setItem("drm_current_profile", JSON.stringify(updated));
  };

  const logout = () => {
    sessionStorage.removeItem("drm_current_profile");
    setCurrentProfile(null);
  };

  // Register movie
  const addMovie = async (title: string): Promise<Movie> => {
    if (useFallback) {
      const newMovie: Movie = {
        id: "mov_" + Math.random().toString(36).substring(2, 9),
        title,
        tracking_status: "Secure",
      };
      const updated = [...movies, newMovie];
      setMovies(updated);
      localStorage.setItem("drm_movies", JSON.stringify(updated));

      const newLedger: BillingLedger = {
        id: "led_" + Math.random().toString(36).substring(2, 9),
        base_retainer_due: globalConfig.base_retainer_price,
        screen_fees: globalConfig.screen_fee_price * 2,
        bounty_rewards: 0,
        payment_status: "Unpaid",
        created_at: new Date().toISOString(),
      };
      const updatedLedgers = [...billingLedgers, newLedger];
      setBillingLedgers(updatedLedgers);
      localStorage.setItem("drm_ledgers", JSON.stringify(updatedLedgers));
      return newMovie;
    }

    // Supabase Mode
    const { data: movie, error: err1 } = await supabase
      .from("movies")
      .insert({ title, tracking_status: "Secure" })
      .select()
      .single();

    if (err1) throw new Error(err1.message);

    await supabase.from("billing_ledgers").insert({
      base_retainer_due: globalConfig.base_retainer_price,
      screen_fees: globalConfig.screen_fee_price * 2,
      bounty_rewards: 0,
      payment_status: "Unpaid",
    });

    // Refresh states
    const { data: refreshedMovs } = await supabase.from("movies").select("*");
    if (refreshedMovs) setMovies(refreshedMovs);

    const { data: refreshedLeds } = await supabase.from("billing_ledgers").select("*");
    if (refreshedLeds) setBillingLedgers(refreshedLeds);

    return movie;
  };

  // Simulate leak
  const simulateLeak = async (
    movieId: string,
    chainName: string,
    city: string,
    screenNumber: string,
    payload: string
  ) => {
    if (useFallback) {
      const targetMovie = movies.find((m) => m.id === movieId);
      if (!targetMovie) return;

      const updatedMovies = movies.map((m) =>
        m.id === movieId ? { ...m, tracking_status: "Breached" as const } : m
      );
      setMovies(updatedMovies);
      localStorage.setItem("drm_movies", JSON.stringify(updatedMovies));

      const newScreen: TheatreScreen = {
        id: "scr_" + Math.random().toString(36).substring(2, 9),
        movie_id: movieId,
        chain_name: chainName,
        city: city,
        screen_number: screenNumber,
      };
      const updatedScreens = [...theatreScreens, newScreen];
      setTheatreScreens(updatedScreens);
      localStorage.setItem("drm_screens", JSON.stringify(updatedScreens));

      const newAlert: LeakAlert = {
        id: "alt_" + Math.random().toString(36).substring(2, 9),
        movie_id: movieId,
        theatre_id: newScreen.id,
        payload_string: payload,
        status: "Active",
        timestamp: new Date().toISOString(),
      };
      const updatedAlerts = [...leakAlerts, newAlert];
      setLeakAlerts(updatedAlerts);
      localStorage.setItem("drm_alerts", JSON.stringify(updatedAlerts));

      const activeLedgerIndex = billingLedgers.findIndex((l) => l.payment_status === "Unpaid");
      if (activeLedgerIndex > -1) {
        const updatedLedgers = [...billingLedgers];
        updatedLedgers[activeLedgerIndex].bounty_rewards += globalConfig.bounty_reward_price;
        setBillingLedgers(updatedLedgers);
        localStorage.setItem("drm_ledgers", JSON.stringify(updatedLedgers));
      }
      return;
    }

    // Supabase Mode
    // 1. Set tracking status
    await supabase.from("movies").update({ tracking_status: "Breached" }).eq("id", movieId);

    // 2. Add screen
    const { data: screen } = await supabase
      .from("theatre_screens")
      .insert({
        movie_id: movieId,
        chain_name: chainName,
        city,
        screen_number: screenNumber,
      })
      .select()
      .single();

    if (screen) {
      // 3. Add alert
      await supabase.from("leak_alerts").insert({
        movie_id: movieId,
        theatre_id: screen.id,
        payload_string: payload,
        status: "Active",
      });
    }

    // 4. Update Unpaid ledgers
    const { data: ledgersToUpdate } = await supabase
      .from("billing_ledgers")
      .select("*")
      .eq("payment_status", "Unpaid");

    if (ledgersToUpdate && ledgersToUpdate.length > 0) {
      for (const led of ledgersToUpdate) {
        await supabase
          .from("billing_ledgers")
          .update({ bounty_rewards: led.bounty_rewards + globalConfig.bounty_reward_price })
          .eq("id", led.id);
      }
    }

    // Refresh states
    const { data: refreshedMovs } = await supabase.from("movies").select("*");
    if (refreshedMovs) setMovies(refreshedMovs);

    const { data: refreshedScreens } = await supabase.from("theatre_screens").select("*");
    if (refreshedScreens) setTheatreScreens(refreshedScreens);

    const { data: refreshedAlerts } = await supabase.from("leak_alerts").select("*");
    if (refreshedAlerts) setLeakAlerts(refreshedAlerts);

    const { data: refreshedLeds } = await supabase.from("billing_ledgers").select("*");
    if (refreshedLeds) setBillingLedgers(refreshedLeds);
  };

  // Dispatch Takedown notice
  const dispatchTakedown = async (alertId: string) => {
    if (useFallback) {
      const updatedAlerts = leakAlerts.map((a) =>
        a.id === alertId ? { ...a, status: "Takedown Dispatched" as const } : a
      );
      setLeakAlerts(updatedAlerts);
      localStorage.setItem("drm_alerts", JSON.stringify(updatedAlerts));

      const alert = leakAlerts.find((a) => a.id === alertId);
      if (alert) {
        const movieId = alert.movie_id;
        const hasOtherActiveAlerts = updatedAlerts.some(
          (a) => a.movie_id === movieId && a.status === "Active"
        );
        if (!hasOtherActiveAlerts) {
          const updatedMovies = movies.map((m) =>
            m.id === movieId ? { ...m, tracking_status: "Secure" as const } : m
          );
          setMovies(updatedMovies);
          localStorage.setItem("drm_movies", JSON.stringify(updatedMovies));
        }
      }
      return;
    }

    // Supabase Mode
    await supabase.from("leak_alerts").update({ status: "Takedown Dispatched" }).eq("id", alertId);

    const targetAlert = leakAlerts.find((a) => a.id === alertId);
    if (targetAlert) {
      // Check for remaining active leaks
      const { data: remainingActive } = await supabase
        .from("leak_alerts")
        .select("*")
        .eq("movie_id", targetAlert.movie_id)
        .eq("status", "Active");

      if (!remainingActive || remainingActive.length === 0) {
        // Set movie status to Secure
        await supabase.from("movies").update({ tracking_status: "Secure" }).eq("id", targetAlert.movie_id);
      }
    }

    // Refresh states
    const { data: refreshedMovs } = await supabase.from("movies").select("*");
    if (refreshedMovs) setMovies(refreshedMovs);

    const { data: refreshedAlerts } = await supabase.from("leak_alerts").select("*");
    if (refreshedAlerts) setLeakAlerts(refreshedAlerts);
  };

  // Settle Invoice via Razorpay
  const settleInvoice = async (ledgerId: string) => {
    if (useFallback) {
      const updatedLedgers = billingLedgers.map((l) =>
        l.id === ledgerId ? { ...l, payment_status: "Paid_Razorpay" as const } : l
      );
      setBillingLedgers(updatedLedgers);
      localStorage.setItem("drm_ledgers", JSON.stringify(updatedLedgers));
      return;
    }

    // Supabase Mode
    const { error } = await supabase
      .from("billing_ledgers")
      .update({ payment_status: "Paid_Razorpay" })
      .eq("id", ledgerId);

    if (error) throw new Error(error.message);

    // Refresh state
    const { data: refreshedLeds } = await supabase.from("billing_ledgers").select("*");
    if (refreshedLeds) setBillingLedgers(refreshedLeds);
  };

  // Update Global SaaS pricing config
  const updateGlobalConfig = async (config: Partial<GlobalConfig>) => {
    if (useFallback) {
      const updated = { ...globalConfig, ...config };
      setGlobalConfig(updated);
      localStorage.setItem("drm_global_config", JSON.stringify(updated));
      return;
    }

    // Supabase Mode
    const { error } = await supabase
      .from("global_config")
      .update(config)
      .eq("id", 1);

    if (error) throw new Error(error.message);

    // Refresh state
    const { data: configData } = await supabase
      .from("global_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (configData) setGlobalConfig(configData);
  };

  // Reset variables helper
  const resetAllData = () => {
    localStorage.removeItem("drm_global_config");
    localStorage.removeItem("drm_profiles");
    localStorage.removeItem("drm_movies");
    localStorage.removeItem("drm_screens");
    localStorage.removeItem("drm_alerts");
    localStorage.removeItem("drm_ledgers");
    sessionStorage.removeItem("drm_current_profile");
    window.location.reload();
  };

  return (
    <DrmContext.Provider
      value={{
        currentProfile,
        profiles,
        movies,
        theatreScreens,
        leakAlerts,
        billingLedgers,
        globalConfig,
        deviceFingerprint,
        isLoading,
        login,
        onboard,
        logout,
        addMovie,
        simulateLeak,
        dispatchTakedown,
        settleInvoice,
        updateGlobalConfig,
        resetAllData,
      }}
    >
      {children}
    </DrmContext.Provider>
  );
}

export function useDrm() {
  const context = useContext(DrmContext);
  if (context === undefined) {
    throw new Error("useDrm must be used within a DrmProvider");
  }
  return context;
}

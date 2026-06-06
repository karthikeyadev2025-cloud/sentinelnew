"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

// Types corresponding to mock database tables
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
  addMovie: (title: string) => Movie;
  simulateLeak: (movieId: string, chainName: string, city: string, screenNumber: string, payload: string) => void;
  dispatchTakedown: (alertId: string) => void;
  settleInvoice: (ledgerId: string) => void;
  updateGlobalConfig: (config: Partial<GlobalConfig>) => void;
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

  // Generate browser fingerprint
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
          hash = hash & hash; // Convert to 32bit integer
        }
        return "FP_" + Math.abs(hash).toString(16).toUpperCase();
      };
      setDeviceFingerprint(generateFingerprint());
    }
  }, []);

  // Initialize and sync with LocalStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 1. Config
      const localConfig = localStorage.getItem("drm_global_config");
      if (localConfig) {
        setGlobalConfig(JSON.parse(localConfig));
      } else {
        localStorage.setItem("drm_global_config", JSON.stringify(DEFAULT_GLOBAL_CONFIG));
      }

      // 2. Profiles
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
          device_fingerprint_hash: "FP_ABUSE_LOCKED", // Mapped to banned fingerprint
        },
      ];

      if (localProfiles) {
        setProfiles(JSON.parse(localProfiles));
      } else {
        localStorage.setItem("drm_profiles", JSON.stringify(defaultProfiles));
        setProfiles(defaultProfiles);
      }

      // 3. Movies
      const localMovies = localStorage.getItem("drm_movies");
      const defaultMovies: Movie[] = [
        { id: "mov_1", title: "Apex Horizon (Climax Locked)", tracking_status: "Secure" },
        { id: "mov_2", title: "Midnight Chronicles (Unwatermarked)", tracking_status: "Breached" },
      ];
      if (localMovies) {
        setMovies(JSON.parse(localMovies));
      } else {
        localStorage.setItem("drm_movies", JSON.stringify(defaultMovies));
        setMovies(defaultMovies);
      }

      // 4. Screens
      const localScreens = localStorage.getItem("drm_screens");
      const defaultScreens: TheatreScreen[] = [
        { id: "scr_1", movie_id: "mov_2", chain_name: "AMC Empire 25", city: "New York", screen_number: "04" },
        { id: "scr_2", movie_id: "mov_1", chain_name: "Regal LA Live", city: "Los Angeles", screen_number: "01" },
        { id: "scr_3", movie_id: "mov_2", chain_name: "PVR Director's Cut", city: "New Delhi", screen_number: "02" },
      ];
      if (localScreens) {
        setTheatreScreens(JSON.parse(localScreens));
      } else {
        localStorage.setItem("drm_screens", JSON.stringify(defaultScreens));
        setTheatreScreens(defaultScreens);
      }

      // 5. Alerts
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
      if (localAlerts) {
        setLeakAlerts(JSON.parse(localAlerts));
      } else {
        localStorage.setItem("drm_alerts", JSON.stringify(defaultAlerts));
        setLeakAlerts(defaultAlerts);
      }

      // 6. Ledgers
      const localLedgers = localStorage.getItem("drm_ledgers");
      const defaultLedgers: BillingLedger[] = [
        {
          id: "led_1",
          base_retainer_due: 5000,
          screen_fees: 500, // 2 screens * 250
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
      if (localLedgers) {
        setBillingLedgers(JSON.parse(localLedgers));
      } else {
        localStorage.setItem("drm_ledgers", JSON.stringify(defaultLedgers));
        setBillingLedgers(defaultLedgers);
      }

      // Restore session profile
      const sessionProfile = sessionStorage.getItem("drm_current_profile");
      if (sessionProfile) {
        setCurrentProfile(JSON.parse(sessionProfile));
      }

      setIsLoading(false);
    }
  }, []);

  // helper to save profile list
  const saveProfiles = (updated: Profile[]) => {
    setProfiles(updated);
    localStorage.setItem("drm_profiles", JSON.stringify(updated));
  };

  // Login handler
  const login = async (email: string): Promise<Profile> => {
    // Determine target fingerprint
    let targetFingerprint = deviceFingerprint;
    if (email.toLowerCase() === "abuser@flagged.com") {
      targetFingerprint = "FP_ABUSE_LOCKED";
    }

    // Check blocked state
    if (targetFingerprint === "FP_ABUSE_LOCKED") {
      throw new Error("SECURITY_VIOLATION: Device hardware fingerprint is flag-locked due to terms abuse.");
    }

    // Locate profile or create new
    let matchedProfile = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());

    if (!matchedProfile) {
      // Create new studio client profile
      matchedProfile = {
        id: "prof_" + Math.random().toString(36).substring(2, 9),
        email: email,
        role: "STUDIO_CLIENT",
        onboarding_completed: false,
        trial_uses_remaining: 2,
        device_fingerprint_hash: targetFingerprint,
      };
      const updated = [...profiles, matchedProfile];
      saveProfiles(updated);
    } else {
      // Bind current fingerprint
      matchedProfile.device_fingerprint_hash = targetFingerprint;
      const updated = profiles.map((p) => (p.id === matchedProfile!.id ? matchedProfile! : p));
      saveProfiles(updated);
    }

    sessionStorage.setItem("drm_current_profile", JSON.stringify(matchedProfile));
    setCurrentProfile(matchedProfile);
    return matchedProfile;
  };

  // Complete onboarding
  const onboard = async (data: { companyName: string; email: string; gstin: string }) => {
    if (!currentProfile) throw new Error("No active session");

    const updatedProfile: Profile = {
      ...currentProfile,
      company_name: data.companyName,
      gstin: data.gstin,
      onboarding_completed: true,
    };

    const updatedProfiles = profiles.map((p) => (p.id === currentProfile.id ? updatedProfile : p));
    saveProfiles(updatedProfiles);
    setCurrentProfile(updatedProfile);
    sessionStorage.setItem("drm_current_profile", JSON.stringify(updatedProfile));
  };

  const logout = () => {
    sessionStorage.removeItem("drm_current_profile");
    setCurrentProfile(null);
  };

  // Create movie
  const addMovie = (title: string): Movie => {
    const newMovie: Movie = {
      id: "mov_" + Math.random().toString(36).substring(2, 9),
      title: title,
      tracking_status: "Secure",
    };
    const updated = [...movies, newMovie];
    setMovies(updated);
    localStorage.setItem("drm_movies", JSON.stringify(updated));

    // Also update billing ledger by adding a screen fee placeholder
    const newLedger: BillingLedger = {
      id: "led_" + Math.random().toString(36).substring(2, 9),
      base_retainer_due: globalConfig.base_retainer_price,
      screen_fees: globalConfig.screen_fee_price * 2, // Default 2 screens
      bounty_rewards: 0,
      payment_status: "Unpaid",
      created_at: new Date().toISOString(),
    };
    const updatedLedgers = [...billingLedgers, newLedger];
    setBillingLedgers(updatedLedgers);
    localStorage.setItem("drm_ledgers", JSON.stringify(updatedLedgers));

    return newMovie;
  };

  // Simulate leak
  const simulateLeak = (
    movieId: string,
    chainName: string,
    city: string,
    screenNumber: string,
    payload: string
  ) => {
    const targetMovie = movies.find((m) => m.id === movieId);
    if (!targetMovie) return;

    // Set movie to Breached
    const updatedMovies = movies.map((m) =>
      m.id === movieId ? { ...m, tracking_status: "Breached" as const } : m
    );
    setMovies(updatedMovies);
    localStorage.setItem("drm_movies", JSON.stringify(updatedMovies));

    // Create Screen
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

    // Create Alert
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

    // Add bounty cost to ledgers
    const activeLedgerIndex = billingLedgers.findIndex((l) => l.payment_status === "Unpaid");
    if (activeLedgerIndex > -1) {
      const updatedLedgers = [...billingLedgers];
      updatedLedgers[activeLedgerIndex].bounty_rewards += globalConfig.bounty_reward_price;
      setBillingLedgers(updatedLedgers);
      localStorage.setItem("drm_ledgers", JSON.stringify(updatedLedgers));
    }
  };

  // Dispatch automated takedown notice
  const dispatchTakedown = (alertId: string) => {
    const updatedAlerts = leakAlerts.map((a) =>
      a.id === alertId ? { ...a, status: "Takedown Dispatched" as const } : a
    );
    setLeakAlerts(updatedAlerts);
    localStorage.setItem("drm_alerts", JSON.stringify(updatedAlerts));

    // Check if there are any remaining active alerts for that movie.
    // If not, revert movie tracking_status to "Secure"
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
  };

  // Settle invoice via Razorpay mockup
  const settleInvoice = (ledgerId: string) => {
    const updatedLedgers = billingLedgers.map((l) =>
      l.id === ledgerId ? { ...l, payment_status: "Paid_Razorpay" as const } : l
    );
    setBillingLedgers(updatedLedgers);
    localStorage.setItem("drm_ledgers", JSON.stringify(updatedLedgers));
  };

  // Super Admin CMS pricing controls
  const updateGlobalConfig = (config: Partial<GlobalConfig>) => {
    const updated = { ...globalConfig, ...config };
    setGlobalConfig(updated);
    localStorage.setItem("drm_global_config", JSON.stringify(updated));
  };

  // Reset function to default local state
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

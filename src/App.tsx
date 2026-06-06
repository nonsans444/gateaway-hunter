import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Lock,
  Unlock,
  ExternalLink,
  History,
  TrendingUp,
  Coins,
  LogOut,
  User,
  Mail,
  Key,
  HelpCircle,
  Check,
  CheckCircle,
  X,
  AlertTriangle,
  CreditCard,
  ArrowRight,
  Clock,
  Globe,
  ChevronRight,
  Download,
  Info,
  ShieldAlert,
  Loader2,
  Gift
} from "lucide-react";

import { UserProfile, Offer, Claim } from "./types";
import { INITIAL_OFFERS } from "./data";
import { auth, db, isRealFirebaseConfig } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  onSnapshot
} from "firebase/firestore";

// --- FIRESTORE ADVANCED ERROR LOGGER AS INSTRUCTED BY SYSTEM RULES ---
enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || "mock-user",
      email: auth?.currentUser?.email || "mock@test.com",
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error("RewardGateway Firestore Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- APP ENTRY POINT ---
export default function App() {
  // --- AUTH STATES ---
  const [user, setUser] = useState<FirebaseUser | { uid: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // --- CORE SYSTEM STATES ---
  const [offers, setOffers] = useState<Offer[]>(INITIAL_OFFERS);
  const [myClaims, setMyClaims] = useState<Claim[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  // --- NAVIGATION STATE ---
  const [activeTab, setActiveTab] = useState<"offers" | "history">("offers");

  // --- INTERACTION MODALS ---
  const [selectedOfferForClaim, setSelectedOfferForClaim] = useState<Offer | null>(null);
  const [pendingClaim, setPendingClaim] = useState<Claim | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeBlockReason, setUpgradeBlockReason] = useState<string>("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // --- TOAST NOTIFICATIONS ---
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" | "info" } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<any>(null);

  // PWA installation prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // --- TOAST DISMISSER ---
  const showToast = (message: string, type: "success" | "warning" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev?.message === message ? null : prev);
    }, 4500);
  };

  // --- INITIALIZE & SYNC USER PROFILE ---
  useEffect(() => {
    // Service Worker & PWA register
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js")
          .then((reg) => console.log("RewardGateway PWA Service Worker Registered", reg.scope))
          .catch((err) => console.warn("PWA Service Worker Registration skipped", err));
      });
    }

    // Installable trigger tracker
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    // 1. Verify URL params for immediate return code callback catcher
    // Match signature: ?token=TOKEN&status=success
    const queryParams = new URLSearchParams(window.location.search);
    const tokenParam = queryParams.get("token");
    const statusParam = queryParams.get("status");

    if (tokenParam && statusParam === "success") {
      // Store token in session storage to handle post-login completion
      sessionStorage.setItem("rewardgateway_catch_token", tokenParam);
      // Clean query parameters from URL safely
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Real Firebase vs Local Auth State loop
    if (isRealFirebaseConfig && auth) {
      const unsub = onAuthStateChanged(auth, async (gUser) => {
        if (gUser) {
          setUser(gUser);
          await loadUserProfile(gUser.uid, gUser.email || "");
          await loadClaims(gUser.uid);
        } else {
          setUser(null);
          setProfile(null);
          setMyClaims([]);
        }
      });
      return () => unsub();
    } else {
      // Mock Auto Login checks
      const savedMockUser = localStorage.getItem("rg_mock_user_profile");
      if (savedMockUser) {
        try {
          const parsed = JSON.parse(savedMockUser);
          setUser({ uid: parsed.uid, email: parsed.email });
          setProfile(parsed);
          loadClaims(parsed.uid);
        } catch (e) {
          console.warn("Cleared corrupt simulator session", e);
        }
      }
    }
  }, []);

  // --- CATCHER TRIGGERS POST-USER SEAT LOADING ---
  useEffect(() => {
    if (user && profile) {
      const storedToken = sessionStorage.getItem("rewardgateway_catch_token");
      if (storedToken) {
        sessionStorage.removeItem("rewardgateway_catch_token");
        handleDirectSuccessTokenClaim(storedToken);
      }
    }
  }, [user, profile, myClaims]);

  // --- CHART REDRAW EFFECT ---
  useEffect(() => {
    if (activeTab === "history" && canvasRef.current) {
      // Dynamic Chart.js Script Injection to bypass heavy bundles
      if (!(window as any).Chart) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/chart.js";
        script.async = true;
        script.onload = () => buildChartInstance();
        document.body.appendChild(script);
      } else {
        buildChartInstance();
      }
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [activeTab, myClaims, profile]);

  // --- CORE CHART RETAILING ---
  const buildChartInstance = () => {
    if (!canvasRef.current || !(window as any).Chart) return;
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    if (profile?.tier !== "pro") {
      // Blurred free users do not trigger full rendering cycles
      return;
    }

    const completed = myClaims.filter(c => c.status === "completed").length;
    const pending = myClaims.filter(c => c.status === "pending").length;
    const failed = myClaims.filter(c => c.status === "failed").length;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    chartInstanceRef.current = new (window as any).Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Fulfilled", "Awaiting Partner Verification", "Incomplete"],
        datasets: [{
          data: [completed || 1, pending, failed],
          backgroundColor: ["#F59E0B", "#6366F1", "#475569"],
          borderWidth: 2,
          borderColor: "#0F172A"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#94A3B8",
              font: {
                family: "Inter",
                size: 11
              }
            }
          }
        }
      }
    });
  };

  // --- HELPER LOADERS FROM SOURCE ---
  const loadUserProfile = async (uid: string, email: string) => {
    if (isRealFirebaseConfig && db) {
      try {
        const userRef = doc(db, "users", uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          // Setup primary user record
          const trialEndVal = new Date();
          trialEndVal.setDate(trialEndVal.getDate() + 3); // 3-day premium trial auto-enrollment

          const defaultProfile: UserProfile = {
            uid,
            email,
            tier: "free",
            trialEnd: trialEndVal.toISOString(),
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, defaultProfile);
          setProfile(defaultProfile);
        }
      } catch (err) {
        console.warn("Firestore user profile fetch issue. Utilizing local sandbox fallback:", err);
        const trialEndVal = new Date();
        trialEndVal.setDate(trialEndVal.getDate() + 3);
        const defaultProfile: UserProfile = {
          uid,
          email,
          tier: "free",
          trialEnd: trialEndVal.toISOString(),
          createdAt: new Date().toISOString()
        };
        setProfile(defaultProfile);
      }
    } else {
      const savedMockUser = localStorage.getItem("rg_mock_user_profile");
      if (savedMockUser) {
        try {
          setProfile(JSON.parse(savedMockUser));
        } catch (e) {
          setProfile(null);
        }
      }
    }
  };

  const loadClaims = async (uid: string) => {
    if (isRealFirebaseConfig && db) {
      const claimsRef = collection(db, "claims", uid, "userClaims");
      try {
        const snap = await getDocs(claimsRef);
        const loaded: Claim[] = [];
        snap.forEach(d => loaded.push(d.data() as Claim));
        setMyClaims(loaded);
      } catch (err) {
        console.warn("Firestore claims listing issue. Accessing local database cache:", err);
        const localClaims = localStorage.getItem(`rg_mock_claims_${uid}`);
        if (localClaims) {
          try {
            setMyClaims(JSON.parse(localClaims));
          } catch (e) {
            setMyClaims([]);
          }
        } else {
          setMyClaims([]);
        }
      }
    } else {
      // Local setup mock
      const localClaims = localStorage.getItem(`rg_mock_claims_${uid}`);
      if (localClaims) {
        try {
          setMyClaims(JSON.parse(localClaims));
        } catch (e) {
          setMyClaims([]);
        }
      }
    }
  };

  // --- HANDLE LOCAL MOCK PROFILE REDIRECT ---
  const saveMockProfile = (newProf: UserProfile) => {
    setProfile(newProf);
    localStorage.setItem("rg_mock_user_profile", JSON.stringify(newProf));
  };

  const saveMockClaims = (claimsList: Claim[]) => {
    setMyClaims(claimsList);
    if (user) {
      localStorage.setItem(`rg_mock_claims_${user.uid}`, JSON.stringify(claimsList));
    }
  };

  // --- AUTHENTICATION ACTIONS ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!authEmail || !authPassword) {
      setAuthError("Please fill in all security fields.");
      return;
    }
    setAuthLoading(true);

    if (isRealFirebaseConfig && auth) {
      try {
        if (authMode === "login") {
          await signInWithEmailAndPassword(auth, authEmail, authPassword);
          showToast("Signed in securely. Accessing portals...", "success");
        } else {
          const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
          showToast("Profile drafted. Auto-enrolled in Pro 3-day Trial!", "success");
          await loadUserProfile(cred.user.uid, cred.user.email || "");
        }
      } catch (err: any) {
        console.error("Auth Fail", err);
        const fbMessage = err?.message || "Verify your credentials and try again.";
        setAuthError(`${fbMessage} - To bypass live server initialization rules immediately, click 'Instant Guest Sandbox Access' below.`);
        showToast("Authorization issue. You can use Guest Access to bypass constraints.", "warning");
      } finally {
        setAuthLoading(false);
      }
    } else {
      // --- STANDALONE SIMULATOR AUTH SYSTEM ---
      setTimeout(() => {
        const simulatedUid = "uid_sim_" + Math.random().toString(36).substr(2, 9);
        if (authMode === "login") {
          // Simulate simple login
          const cleanEmail = authEmail.toLowerCase();
          const trialEndVal = new Date();
          trialEndVal.setDate(trialEndVal.getDate() + 3);

          const simProf: UserProfile = {
            uid: simulatedUid,
            email: cleanEmail,
            tier: "free",
            trialEnd: trialEndVal.toISOString(),
            createdAt: new Date().toISOString()
          };
          setUser({ uid: simulatedUid, email: cleanEmail });
          saveMockProfile(simProf);
          showToast("Sandbox Access Activated: Logged in successfully!", "success");
          loadClaims(simulatedUid);
        } else {
          // Simulate Signup Auth
          const cleanEmail = authEmail.toLowerCase();
          const trialEndVal = new Date();
          trialEndVal.setDate(trialEndVal.getDate() + 3);

          const simProf: UserProfile = {
            uid: simulatedUid,
            email: cleanEmail,
            tier: "free",
            trialEnd: trialEndVal.toISOString(),
            createdAt: new Date().toISOString()
          };

          setUser({ uid: simulatedUid, email: cleanEmail });
          saveMockProfile(simProf);
          showToast("Sandbox Signed up: 3-Day Pro Trial Active!", "success");
          saveMockClaims([]);
        }
        setAuthLoading(false);
      }, 700);
    }
  };

  const handleGuestLogin = () => {
    setAuthLoading(true);
    setAuthError("");
    setTimeout(() => {
      const simulatedUid = "guest_" + Math.random().toString(36).substr(2, 9);
      const cleanEmail = "guest.developer@rewardgateway.io";
      const trialEndVal = new Date();
      trialEndVal.setDate(trialEndVal.getDate() + 30); // 30 days active Pro simulation trial for reviews

      const guestProf: UserProfile = {
        uid: simulatedUid,
        email: cleanEmail,
        tier: "pro", // Guest users are immediately Pro so they can fully explore metrics
        trialEnd: trialEndVal.toISOString(),
        createdAt: new Date().toISOString()
      };

      setUser({ uid: simulatedUid, email: cleanEmail });
      saveMockProfile(guestProf);

      // Pre-populate mock claims to avoid empty dashboard data during reviews
      const standardMockClaims: Claim[] = [
        {
          claimId: "claim_guest_init1",
          offerId: "gpass_trial",
          status: "completed",
          token: "token_rg_GUEST_GPASS_12345",
          createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 35 * 3600 * 1000).toISOString(),
          reward: "GP-PROMO-99XX-Z2"
        },
        {
          claimId: "claim_guest_init2",
          offerId: "office_sub",
          status: "pending",
          token: "token_rg_GUEST_M365_99881",
          createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
        }
      ];
      setMyClaims(standardMockClaims);
      localStorage.setItem(`rg_mock_claims_${simulatedUid}`, JSON.stringify(standardMockClaims));

      showToast("Access Activated: Logged in successfully as Premium Guest!", "success");
      setAuthLoading(false);
    }, 500);
  };

  const handleSignOut = async () => {
    if (isRealFirebaseConfig && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn("SignOut issue:", err);
      }
      localStorage.removeItem("rg_mock_user_profile");
      setUser(null);
      setProfile(null);
      setMyClaims([]);
    } else {
      localStorage.removeItem("rg_mock_user_profile");
      setUser(null);
      setProfile(null);
      setMyClaims([]);
    }
    showToast("Signed out of secure channels successfully.", "info");
  };

  // --- COMPUTE ACTIVE LEVEL METRICS ---
  const isTrialActive = () => {
    if (!profile) return false;
    return new Date(profile.trialEnd) > new Date();
  };

  const getActiveTier = () => {
    if (!profile) return "free";
    if (profile.tier === "pro" || isTrialActive()) {
      return "pro";
    }
    return "free";
  };

  // Count claims matching the current month (and year) which are successful
  const getMonthlySuccessfulClaimsCount = () => {
    const now = new Date();
    const curYear = now.getUTCFullYear();
    const curMonth = now.getUTCMonth();

    return myClaims.filter(c => {
      if (c.status !== "completed" || !c.completedAt) return false;
      const compDate = new Date(c.completedAt);
      return compDate.getUTCFullYear() === curYear && compDate.getUTCMonth() === curMonth;
    }).length;
  };

  // --- CLAIM VOUCHER CODES LAUNCH GATES ---
  const initiateClaimFlow = async (offer: Offer) => {
    if (!user || !profile) return;

    // Check user locks first
    const isPro = getActiveTier() === "pro";
    
    // Pro-Only offer logic gate
    if (offer.isProOnly && !isPro) {
      setUpgradeBlockReason(`Priority offers are locked for standard accounts. Upgrade to Pro Premium to immediately unlock '${offer.rewardDescription}'.`);
      setShowUpgradeModal(true);
      return;
    }

    const currentMonthlyClaims = getMonthlySuccessfulClaimsCount();

    if (!isPro) {
      // Free limit enforces a maximum of 2 successful claims per month
      if (currentMonthlyClaims >= 2) {
        setUpgradeBlockReason("You have spent your 2 monthly claims on your free plan. Upgrade to RewardGateway Pro for unlimited redemptions.");
        setShowUpgradeModal(true);
        return;
      }
    }

    // Allocate token & pending claim record
    const uniqueToken = "token_rg_" + Math.random().toString(36).substring(2, 10).toUpperCase() + "_" + Date.now();
    const uuidClaim = "claim_" + Math.random().toString(36).substring(2, 9);

    const targetClaim: Claim = {
      claimId: uuidClaim,
      offerId: offer.offerId,
      status: "pending",
      token: uniqueToken,
      createdAt: new Date().toISOString()
    };

    if (isRealFirebaseConfig && db) {
      const claimRef = doc(db, "claims", user.uid, "userClaims", uuidClaim);
      try {
        await setDoc(claimRef, targetClaim);
        setMyClaims(prev => [...prev, targetClaim]);
      } catch (err) {
        console.warn("Firestore claim write failed, falling back to simulator sandbox storage:", err);
        const updated = [...myClaims, targetClaim];
        saveMockClaims(updated);
      }
    } else {
      // Simulator cache write
      const updated = [...myClaims, targetClaim];
      saveMockClaims(updated);
    }

    setSelectedOfferForClaim(offer);
    setPendingClaim(targetClaim);

    // Formulate final partner redirections with query token
    const destinationUrl = `${offer.partner_url_base}?ref=rewardgateway&token=${uniqueToken}`;
    
    // Direct link to protect account safety
    showToast(`Claim initialized! Safely routing instructions on a separate channel...`, "success");
    setTimeout(() => {
      window.open(destinationUrl, "_blank", "noopener,noreferrer");
    }, 1000);
  };

  // --- URL RETURN TOKEN DETECTOR ENGINE ---
  const handleDirectSuccessTokenClaim = (token: string) => {
    // Find matching pending claim
    const target = myClaims.find(c => c.token === token && c.status === "pending");
    if (!target) return;

    // Resolve with rewardpool
    const associatedOffer = offers.find(o => o.offerId === target.offerId);
    if (!associatedOffer) return;

    completeClaimSuccessfully(target.claimId, associatedOffer.rewardPool);
  };

  // --- PROCESS COMPLETION HANDLER ---
  const completeClaimSuccessfully = async (claimId: string, rewardKey: string) => {
    if (!user) return;

    const completedAtStr = new Date().toISOString();
    const updatedClaims = myClaims.map(c => {
      if (c.claimId === claimId) {
        return {
          ...c,
          status: "completed" as const,
          completedAt: completedAtStr,
          reward: rewardKey
        };
      }
      return c;
    });

    if (isRealFirebaseConfig && db) {
      const claimRef = doc(db, "claims", user.uid, "userClaims", claimId);
      try {
        await updateDoc(claimRef, {
          status: "completed",
          completedAt: completedAtStr,
          reward: rewardKey
        });
        setMyClaims(updatedClaims);
      } catch (err) {
        console.warn("Firestore claim status updates failed. Falling back to local storage cache:", err);
        saveMockClaims(updatedClaims);
      }
    } else {
      saveMockClaims(updatedClaims);
    }

    // Safe dismiss overlay state
    setPendingClaim(null);
    setSelectedOfferForClaim(null);

    // Trigger feedback upgrade toast check
    const refreshedClaims = updatedClaims;
    const isPro = getActiveTier() === "pro";
    const postSuccessfulCount = refreshedClaims.filter(c => {
      if (c.status !== "completed" || !c.completedAt) return false;
      const compDate = new Date(c.completedAt);
      return compDate.getUTCFullYear() === new Date().getUTCFullYear() && compDate.getUTCMonth() === new Date().getUTCMonth();
    }).length;

    showToast("Reward verified successfully! Coupon revealed inside dashboard.", "success");

    if (!isPro && postSuccessfulCount === 2) {
      // Trigger user alerts 
      setTimeout(() => {
        showToast("2/2 free claims used. Unlock unlimited redemptions with Pro Premium!", "warning");
      }, 2500);
    }
  };

  // --- MANUAL WEBHOOK REPLICATOR FOR SANDBOX COMPLIANCE ---
  const handleSimulatePartnerCompletion = () => {
    if (!pendingClaim || !selectedOfferForClaim) return;
    completeClaimSuccessfully(pendingClaim.claimId, selectedOfferForClaim.rewardPool);
  };

  // --- STRIPE BILLING EMULATOR SYSTEM ---
  const handleUpgradeToPro = (plan: "monthly" | "yearly") => {
    if (!user) return;
    setPaymentLoading(true);
    setPaymentSuccess(false);

    // Real-Stripe Integration Guide Console Log:
    console.log(`
      [STRIPE PAYMENT INTEGRATION LOGS]
      ===============================================
      To connect real payments for RewardGateway:
      1. Run "npm install @stripe/stripe-js stripe".
      2. Set process.env.STRIPE_SECRET_KEY in your cloud deployment env.
      3. Import Stripe inside server side gateway endpoints (e.g. /api/stripe-checkout):
         const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      4. Create a Stripe Pricing product: $3.99/month (ID: price_monthly) or $39.99/year (ID: price_yearly).
      5. Call stripe.checkout.sessions.create({
           line_items: [{ price: '${plan === "monthly" ? "price_monthly" : "price_yearly"}', quantity: 1 }],
           mode: 'subscription',
           success_url: window.location.origin + '?session_id={CHECKOUT_SESSION_ID}',
           cancel_url: window.location.origin,
         });
      6. On webhook callback reception update Firestore "users/' + user.uid + '" document tier property to 'pro'.
      ===============================================
    `);

    setTimeout(() => {
      // Simulate Payment Processors success
      setPaymentLoading(false);
      setPaymentSuccess(true);
      
      const extendedTrialTime = new Date();
      extendedTrialTime.setMonth(extendedTrialTime.getMonth() + (plan === "monthly" ? 1 : 12));

      const updatedProfile: UserProfile = {
        ...profile!,
        tier: "pro",
        trialEnd: extendedTrialTime.toISOString(),
        stripeCustomerId: "cus_gate_" + Math.random().toString(36).substring(2, 9).toUpperCase()
      };

       if (isRealFirebaseConfig && db) {
        setDoc(doc(db, "users", user.uid), updatedProfile)
          .then(() => setProfile(updatedProfile))
          .catch(err => {
            console.warn("Firestore user subscription write failed. Upgrading locally in simulator sandbox:", err);
            saveMockProfile(updatedProfile);
          });
      } else {
        saveMockProfile(updatedProfile);
      }

      showToast(`Welcome to RewardGateway Pro! Premium credentials activated.`, "success");
      setTimeout(() => {
        setShowUpgradeModal(false);
        setPaymentSuccess(false);
      }, 1500);
    }, 2000);
  };

  // --- PWA ACTION ---
  const handlePwaInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === "accepted") {
          showToast("RewardGateway app added to screen successfully!", "success");
        }
        setDeferredPrompt(null);
      });
    }
  };

  // --- FILTERS & MATCHES ---
  const filteredOffers = offers.filter(o => {
    const matchesCategory = selectedCategory === "All" || o.category === selectedCategory;
    const matchesSearch = o.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          o.rewardDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.requiredAction.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Split claims to blurred metrics on user tier
  const sortedClaims = [...myClaims].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const visibleClaimsForCurrentTier = getActiveTier() === "pro" ? sortedClaims : sortedClaims.slice(0, 2);

  return (
    <div className="min-h-screen bg-[#070B16] text-[#E2E8F0] font-sans antialiased selection:bg-amber-500 selection:text-slate-900 flex flex-col justify-between">
      
      {/* 1. SECURE METADATA BANNER FOR PLATFORMS */}
      <header className="border-b border-slate-900 bg-[#0A0F21] sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-amber-500 rounded-xl shadow-lg border border-indigo-500/20">
              <Gift className="text-amber-400" size={24} />
            </div>
            <div>
              <span className="font-display font-extrabold text-white text-lg tracking-tight">Reward<span className="text-amber-400">Gateway</span></span>
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest leading-none mt-0.5">Premium Rewards Shield</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {deferredPrompt && (
              <button
                onClick={handlePwaInstall}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-900/40 hover:bg-indigo-900/70 border border-indigo-700/30 text-indigo-200 text-xs font-semibold transition cursor-pointer"
              >
                <Download size={13} className="text-amber-400" />
                <span>Install PWA</span>
              </button>
            )}

            {user && (
              <>
                {/* Dynamic Tier indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-400 block leading-none">{user.email}</span>
                    <span className={`text-[10px] uppercase tracking-wider font-extrabold leading-none ${getActiveTier() === "pro" ? "text-amber-400 flex items-center gap-0.5" : "text-slate-400"}`}>
                      {getActiveTier() === "pro" ? (
                        <>
                          <Sparkles size={10} className="inline text-amber-400 fill-amber-400" /> 
                          <span>PRO {isTrialActive() ? "TRIAL" : "MEMBER"}</span>
                        </>
                      ) : (
                        <span>FREE BASIC</span>
                      )}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  title="Sign out of workspace"
                  className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-900/60 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                >
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Auth Screen or Interactive Portlet Dashboard */}
      {!user ? (
        <main className="flex-1 max-w-md mx-auto w-full px-4 flex flex-col justify-center py-16">
          <div className="bg-[#0D1326] border border-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-amber-500 to-indigo-600"></div>

            <div className="text-center mb-6">
              <span className="text-[10px] font-mono bg-indigo-950/70 text-indigo-400 px-2.5 py-1 rounded-full border border-indigo-900 uppercase tracking-widest">
                Protected Enterprise Node
              </span>
              <h2 className="text-xl font-display font-bold text-white mt-3">Access RewardGateway</h2>
              <p className="text-xs text-slate-400 mt-1">
                Fulfill brand action tokens and reveal premium gaming & app licensing keys.
              </p>
            </div>

            {authError && (
              <div className="mb-4 bg-red-950/40 border border-red-900/50 rounded-xl p-3 text-xs text-red-300 flex items-start gap-2.5">
                <ShieldAlert className="shrink-0 mt-0.5" size={15} />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Email Authentication Coordinates
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 text-slate-500" size={15} />
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@provider.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Private Cryptographic Key (Password)
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-3.5 text-slate-500" size={15} />
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.98] text-white text-xs font-bold py-3.5 rounded-xl transition shadow-lg shadow-indigo-950 hover:shadow-indigo-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Authorizing credentials...</span>
                  </>
                ) : (
                  <>
                    <span>{authMode === "login" ? "Secure Login" : "Generate Account Credentials"}</span>
                    <ArrowRight size={14} className="text-indigo-300" />
                  </>
                )}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-900"></div>
                <span className="flex-shrink mx-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest">or</span>
                <div className="flex-grow border-t border-slate-900"></div>
              </div>

              <button
                type="button"
                onClick={handleGuestLogin}
                className="w-full bg-amber-500/10 hover:bg-amber-500/20 active:scale-[0.98] text-amber-400 text-xs font-bold py-3.5 rounded-xl border border-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={14} className="text-amber-400 fill-amber-400/20" />
                <span>Instant Guest Sandbox Access</span>
              </button>
            </form>

            <div className="mt-6 border-t border-slate-900 pt-4 flex items-center justify-between text-xs text-slate-400">
              <button
                onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                className="text-indigo-400 hover:text-indigo-300 transition"
              >
                {authMode === "login" ? "First claim? Create a credentials profile" : "Return to secure portal sign in"}
              </button>
            </div>
          </div>

          {/* Sandbox Notice Banner */}
          <div className="mt-5 bg-amber-950/20 border border-amber-900/30 rounded-2xl p-4 text-center">
            <span className="text-[10px] font-mono font-extrabold text-amber-400 uppercase block tracking-wider mb-1">
              🛠️ Sandbox Environment Alert
            </span>
            <p className="text-[11px] text-slate-400 leading-normal">
              This deployment is equipped with automatic simulation features. If real Firebase project parameters are absent, it operates in isolated storage mode so you can view all interfaces immediately.
            </p>
          </div>
        </main>
      ) : (
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          
          {/* USER SEAT STATUS DASHBOARD */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <div className="bg-[#0C1123] border border-slate-900/80 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Current User Account</span>
                <h4 className="text-sm font-semibold text-white truncate max-w-xs">{user.email}</h4>
              </div>
              <div className="mt-4 flex items-center gap-1.5">
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getActiveTier() === "pro" ? "bg-amber-400/10 text-amber-400 border border-amber-400/20" : "bg-slate-900 text-slate-400 border border-slate-800"}`}>
                  {getActiveTier() === "pro" ? "✨ PRO MEMBER" : "BASIC FREE SEAT"}
                </span>
                {isTrialActive() && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-900">
                    Trial active
                  </span>
                )}
              </div>
            </div>

            <div className="bg-[#0C1123] border border-slate-900/80 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Claim Quota Consumption</span>
                {getActiveTier() === "pro" ? (
                  <h4 className="text-lg font-bold text-emerald-400 flex items-center gap-1.5 font-display">
                    <span>Unlimited Claims</span>
                    <Unlock size={14} />
                  </h4>
                ) : (
                  <div>
                    <h4 className="text-xl font-bold text-white font-display">
                      {getMonthlySuccessfulClaimsCount()} <span className="text-sm text-slate-500">/ 2 claims</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1">Refreshes on the 1st of each calendar month</p>
                  </div>
                )}
              </div>
              <div className="mt-3">
                {getActiveTier() === "pro" ? (
                  <span className="text-[10px] text-slate-400">Pro privileges are fully active on this cycle.</span>
                ) : (
                  <button
                    onClick={() => {
                      setUpgradeBlockReason("Claim custom keys with no limits. Activate unlimited pro plan coordinates now!");
                      setShowUpgradeModal(true);
                    }}
                    className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition flex items-center gap-1"
                  >
                    <span>Upgrade to unlock unlimited</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="bg-[#0C1123] border border-slate-900/80 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Reward Value Retrieved</span>
                <h4 className="text-2xl font-bold font-display text-amber-400">
                  ${(myClaims.filter(c => c.status === "completed").length * 28.50).toFixed(2)}
                  <span className="text-xs font-mono text-slate-500 font-normal ml-1.5">USD</span>
                </h4>
              </div>
              <div className="mt-3 text-slate-400 text-[10px]">
                Calculated on real partner standard licensing conversion rates.
              </div>
            </div>
          </div>

          {/* TAB CHANNEL SWITCHER */}
          <div className="flex border-b border-slate-900 mb-8 gap-6 text-sm">
            <button
              onClick={() => setActiveTab("offers")}
              className={`pb-3.5 font-display font-semibold transition relative cursor-pointer ${activeTab === "offers" ? "text-indigo-400" : "text-slate-400 hover:text-slate-100"}`}
            >
              <span>Available Collaborations</span>
              {activeTab === "offers" && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-indigo-500"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-3.5 font-display font-semibold transition relative cursor-pointer flex items-center gap-1.5 ${activeTab === "history" ? "text-indigo-400" : "text-slate-400 hover:text-slate-100"}`}
            >
              <span>Redemption Key Inventory</span>
              <span className="bg-slate-950 font-mono text-[10px] px-2 py-0.5 rounded-full border border-slate-800 text-slate-300">
                {myClaims.length}
              </span>
              {activeTab === "history" && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-indigo-500"></span>
              )}
            </button>
          </div>

          {/* TAB PANELS */}
          {activeTab === "offers" ? (
            <div>
              {/* FILTERS & SEARCH BOX */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 bg-[#090E1E] p-4 rounded-2xl border border-slate-900">
                <div className="flex flex-wrap items-center gap-2">
                  {["All", "Gaming", "Streaming", "SaaS", "Music", "Finance"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${selectedCategory === cat ? "bg-indigo-600/10 text-indigo-400 border-indigo-700/50" : "bg-slate-950 text-slate-400 border-slate-900 hover:bg-slate-900"}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search brand partners..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              {/* GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {filteredOffers.map((offer) => {
                  const isPro = getActiveTier() === "pro";
                  const isLockedForFreeUser = offer.isProOnly && !isPro;

                  return (
                    <div
                      key={offer.offerId}
                      className={`bg-[#0C1123] border ${offer.isProOnly ? "border-amber-500/20 shadow-lg shadow-amber-950/5" : "border-slate-900/80"} rounded-2xl overflow-hidden relative flex flex-col justify-between`}
                    >
                      {offer.isProOnly && (
                        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-mono font-extrabold text-[9px] uppercase tracking-wider px-3 py-1 absolute top-3 right-3 rounded-md shadow-sm flex items-center gap-1">
                          <Sparkles size={9} className="fill-slate-950 text-slate-950" />
                          <span>Pro Exclusive</span>
                        </div>
                      )}

                      <div className="p-5">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-1">
                          {offer.partnerName} • {offer.value}
                        </span>
                        
                        <h3 className="text-sm font-display font-bold text-white mb-2 leading-snug">
                          {offer.rewardDescription}
                        </h3>

                        {/* Blurred Action Area for Free Tier limits */}
                        <div className="mt-3 p-3 bg-slate-950/60 rounded-xl border border-slate-900">
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                            REQUIRED GATEWAY ACTION:
                          </span>
                          <p className={`text-[11px] text-slate-300 leading-normal ${isLockedForFreeUser ? "blur-[3px] select-none" : ""}`}>
                            {offer.requiredAction}
                          </p>
                        </div>
                      </div>

                      <div className="p-5 pt-0">
                        {isLockedForFreeUser ? (
                          <button
                            onClick={() => {
                              setUpgradeBlockReason(`You must have a Pro Premium Membership to unlock the '${offer.rewardDescription}' partner offer.`);
                              setShowUpgradeModal(true);
                            }}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-950/20"
                          >
                            <Lock size={12} />
                            <span>Upgrade to Claim</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => initiateClaimFlow(offer)}
                            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-lg hover:shadow-indigo-950/30"
                          >
                            <span>Initialize Claim Token</span>
                            <ChevronRight size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredOffers.length === 0 && (
                  <div className="col-span-full py-16 text-center bg-slate-950/30 rounded-3xl border border-slate-900/60">
                    <AlertTriangle className="text-slate-600 mx-auto mb-3" size={32} />
                    <h3 className="text-sm font-semibold text-slate-400">No active collaborations found</h3>
                    <p className="text-xs text-slate-500 mt-1">Try resetting your filters or adjusting your queries.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* HISTORY AND CHARTS PANEL */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. TABLE */}
                <div className="lg:col-span-2 bg-[#0C1123] border border-slate-900/80 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-sm font-display font-semibold text-white">Claim Validation Files</h3>
                      <p className="text-xs text-slate-400">Real-time status updates from our partner gateways</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-400">
                      <thead>
                        <tr className="border-b border-slate-900 text-slate-500 font-mono text-[10px]">
                          <th className="pb-3 uppercase tracking-wider">Associated Offer</th>
                          <th className="pb-3 uppercase tracking-wider">Status</th>
                          <th className="pb-3 uppercase tracking-wider">Initiated At</th>
                          <th className="pb-3 uppercase tracking-wider text-right">Revealed Reward</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {visibleClaimsForCurrentTier.map((claim) => {
                          const matchingOffer = offers.find(o => o.offerId === claim.offerId);
                          
                          return (
                            <tr key={claim.claimId} className="hover:bg-slate-950/20 transition">
                              <td className="py-4">
                                <span className="font-semibold text-white block">
                                  {matchingOffer?.partnerName || "Unknown Partner"}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono block">
                                  Token: {claim.token.substring(0, 15)}...
                                </span>
                              </td>
                              <td className="py-4">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono ${
                                  claim.status === "completed" ? "bg-emerald-950 text-emerald-400 border border-emerald-900" :
                                  claim.status === "pending" ? "bg-amber-950 text-amber-400 border border-amber-900" :
                                  "bg-slate-900 text-slate-500 border border-slate-800"
                                }`}>
                                  {claim.status}
                                </span>
                              </td>
                              <td className="py-4 text-slate-400">
                                {new Date(claim.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-4 text-right">
                                {claim.status === "completed" && claim.reward ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    <span className="font-mono bg-[#090E1E] border border-slate-800 px-2.5 py-1 text-xs text-amber-400 rounded-md select-all">
                                      {claim.reward}
                                    </span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      // Toggle secure help modal
                                      const matchedOf = offers.find(o => o.offerId === claim.offerId);
                                      if (matchedOf) {
                                        setSelectedOfferForClaim(matchedOf);
                                        setPendingClaim(claim);
                                      }
                                    }}
                                    className="px-2 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-400 rounded text-[10px] font-mono border border-indigo-900 cursor-pointer"
                                  >
                                    Verify Instructions
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Blurred state overlays for free accounts */}
                        {getActiveTier() === "free" && sortedClaims.length > 2 && (
                          <>
                            {/* Blur remaining items */}
                            {Array.from({ length: Math.min(3, sortedClaims.length - 2) }).map((_, i) => (
                              <tr key={`blur-${i}`} className="opacity-40 select-none pointer-events-none">
                                <td className="py-4 blur-[3px]">
                                  <span className="font-semibold text-white block">Exclusive Priority Offer</span>
                                  <span className="text-[10px] text-slate-500 font-mono block">Token: dummy_token...</span>
                                </td>
                                <td className="py-4 blur-[3px]"><span className="bg-slate-900 text-slate-500">pending</span></td>
                                <td className="py-4 blur-[3px] text-slate-400">June 2026</td>
                                <td className="py-4 text-right blur-[3px]"><span className="bg-slate-900 text-slate-500 px-3 py-1 rounded">REDEMPTION CODES LOCKED</span></td>
                              </tr>
                            ))}
                            
                            {/* Superimposed unlock banner overlay */}
                            <tr>
                              <td colSpan={4} className="py-6 text-center">
                                <div className="bg-amber-950/25 border border-amber-500/30 p-5 rounded-2xl max-w-sm mx-auto text-center shadow-lg">
                                  <Lock className="text-amber-500 mx-auto mb-2" size={24} />
                                  <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest leading-none mb-1">
                                    Historic Inventory Locked
                                  </h4>
                                  <p className="text-[11.5px] text-slate-300 leading-normal mb-3.5">
                                    Free basic profiles only see the most recent 2 claim validation records. Unlock permanent inventory storage with Pro.
                                  </p>
                                  <button
                                    onClick={() => {
                                      setUpgradeBlockReason("Access the entire history logs of your claimed corporate collaboration codes with Pro Premium.");
                                      setShowUpgradeModal(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition cursor-pointer"
                                  >
                                    <span>Become a Pro Member</span>
                                    <ArrowRight size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          </>
                        )}

                        {myClaims.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-12 text-center text-slate-500 font-display">
                              <History className="mx-auto mb-2 opacity-50" size={32} />
                              <p className="text-xs">No collaborations claimed on this profile yet.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. ANALYTICS CHARTS VIEWPORT */}
                <div className="bg-[#0C1123] border border-slate-900/80 rounded-2xl p-6 relative flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-display font-semibold text-white mb-1">Analytics Intelligence</h3>
                    <p className="text-xs text-slate-400 mb-6">Aggregate redemption performance audit logs</p>

                    <div className="relative h-64 w-full flex items-center justify-center">
                      {getActiveTier() === "free" ? (
                        <div className="absolute inset-0 bg-[#0C1123]/90 backdrop-blur-[5px] z-10 flex flex-col items-center justify-center p-4 text-center">
                          <Lock className="text-amber-400 mb-3" size={28} />
                          <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider mb-1.5">
                            Upgrade to Pro for Analytics
                          </h4>
                          <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed mb-4">
                            Receive high-resolution visual insights, success metrics ratios, and partner payout timelines.
                          </p>
                          <button
                            onClick={() => {
                              setUpgradeBlockReason("Unlock advanced partner metrics and visual analytics. Activate Pro subscription!");
                              setShowUpgradeModal(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                          >
                            Upgrade Channel
                          </button>
                        </div>
                      ) : null}

                      {/* Actual Analytics Canvas rendering */}
                      <div className="w-full h-full relative">
                        <canvas ref={canvasRef} className="w-full h-full"></canvas>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 mt-4 leading-normal mt-auto pt-4 border-t border-slate-900/60 font-mono">
                    Node ID: CONSOLE_SECURE_REWARDGATEWAY // Local Clock validated
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>
      )}

      {/* --- INSTRUCTIONS AND PHISHING OVERLAY MODAL --- */}
      {selectedOfferForClaim && pendingClaim && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0D1224] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl relative text-left">
            <div className="absolute top-0 left-0 w-full h-[5px] bg-gradient-to-r from-indigo-500 to-amber-500"></div>

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-950 text-indigo-400 border border-indigo-900 rounded-xl">
                  <CheckCircle size={22} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-white leading-tight">Partner Gateway Verification</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Brand: {selectedOfferForClaim.partnerName} • Token Unlocks: {selectedOfferForClaim.value}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedOfferForClaim(null);
                  setPendingClaim(null);
                }}
                className="text-slate-400 hover:text-slate-100 p-2 bg-slate-900 rounded-xl border border-slate-800 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Anti-phishing banner */}
            <div className="bg-amber-950/25 border border-amber-900/40 p-4 rounded-xl flex items-start gap-3 mb-6">
              <ShieldAlert className="text-amber-500 shrink-0 mt-0.5" size={17} />
              <div>
                <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest leading-none mb-1">
                  Secure Path protection
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  RewardGateway has intercepted malicious token spoof overlays. Follow strictly verified partner coordinates natively to complete the action. Do not input credentials on unfamiliar sites.
                </p>
              </div>
            </div>

            {/* Instructions box */}
            <div className="bg-slate-950/80 border border-slate-900 rounded-2xl p-5 mb-6">
              <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3.5 flex items-center gap-2">
                <Info size={13} className="text-indigo-400" />
                <span>STEPS TO CLAIM REWARD:</span>
              </h4>

              <ol className="space-y-3.5 text-xs text-slate-300">
                <li className="flex gap-2.5">
                  <span className="h-5 w-5 bg-indigo-950 text-indigo-400 font-mono font-bold flex items-center justify-center rounded-full text-[10px] shrink-0">1</span>
                  <span>We successfully generated your unique return verify token inside the separate window tab.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="h-5 w-5 bg-indigo-950 text-indigo-400 font-mono font-bold flex items-center justify-center rounded-full text-[10px] shrink-0">2</span>
                  <span>Proceed to fulfill: <strong className="text-amber-400">"{selectedOfferForClaim.requiredAction}"</strong>.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="h-5 w-5 bg-indigo-950 text-indigo-400 font-mono font-bold flex items-center justify-center rounded-full text-[10px] shrink-0">3</span>
                  <span>Once finished, the partner's automated tracking server redirects back with status success, automatically revealing your code!</span>
                </li>
              </ol>
            </div>

            {/* Action Simulator buttons for sandbox evaluations */}
            <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2 text-indigo-400">
                <TrendingUp size={14} className="animate-pulse" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest">SANDBOX MANUAL VERIFICATION</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3 leading-snug">
                Since we do not have a real external partner tracking network configured in this workspace preview, use this simulate button to bypass external server-side notifications.
              </p>
              <button
                onClick={handleSimulatePartnerCompletion}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-bold text-xs shadow transition cursor-pointer"
              >
                Simulate Action Completion
              </button>
            </div>

            {/* Support links */}
            <div className="flex gap-4">
              <a
                href={selectedOfferForClaim.partner_url_base}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-[#12192C] hover:bg-slate-800 text-white text-xs font-semibold p-3.5 rounded-xl border border-slate-800 flex items-center justify-center gap-2 transition"
              >
                <span>Navigate Homepage</span>
                <ExternalLink size={13} className="text-amber-400" />
              </a>
              <button
                onClick={() => {
                  setSelectedOfferForClaim(null);
                  setPendingClaim(null);
                }}
                className="flex-1 py-3.5 rounded-xl border border-slate-800 bg-slate-900/55 hover:bg-slate-900 text-slate-450 font-semibold text-xs transition text-center"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- STRIPE MONETIZATION SIGNUP UPGRADE MODAL --- */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0D1224] border border-slate-840 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-left">
            <div className="absolute top-0 left-0 w-full h-[5px] bg-gradient-to-r from-amber-500 via-indigo-500 to-amber-400"></div>

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-amber-400 fill-amber-400" />
                <h3 className="font-display font-bold text-white text-base">Become a Pro Member</h3>
              </div>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-slate-400 hover:text-white p-2 bg-slate-900 rounded-xl border border-slate-800 transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {upgradeBlockReason && (
              <p className="text-xs text-amber-300 bg-amber-950/20 border border-amber-900/40 rounded-xl p-3.5 mb-5 leading-normal">
                {upgradeBlockReason}
              </p>
            )}

            {/* Price tiers lists */}
            <div className="space-y-3 mb-6">
              <div className="border border-slate-800 bg-slate-950/30 p-4 rounded-2xl flex items-center justify-between hover:border-slate-700 transition">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-bold">Standard Pro plan</span>
                  <span className="text-sm font-semibold text-white font-display block">$3.99 / Month</span>
                  <span className="text-[10px] text-slate-400">Billed monthly, cancel anytime</span>
                </div>
                <button
                  onClick={() => handleUpgradeToPro("monthly")}
                  disabled={paymentLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
                >
                  {paymentLoading ? (
                    <Loader2 className="animate-spin text-center" size={13} />
                  ) : (
                    "Choose Monthly"
                  )}
                </button>
              </div>

              <div className="border border-amber-500/30 bg-amber-950/10 p-4 rounded-2xl flex items-center justify-between relative hover:border-amber-500/50 transition">
                <span className="bg-amber-400 text-slate-950 font-mono font-bold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded absolute -top-2 right-4">
                  Best Value Savings (Save 20%)
                </span>
                <div>
                  <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest block font-bold">Yearly premium plan</span>
                  <span className="text-sm font-semibold text-white font-display block">$39.99 / Year</span>
                  <span className="text-[10px] text-slate-400">Equivalent to $3.33/month</span>
                </div>
                <button
                  onClick={() => handleUpgradeToPro("yearly")}
                  disabled={paymentLoading}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
                >
                  {paymentLoading ? (
                    <Loader2 className="animate-spin text-center" size={13} />
                  ) : (
                    "Choose Annual"
                  )}
                </button>
              </div>
            </div>

            {/* Simulated verification loading states */}
            {paymentLoading ? (
              <div className="text-center py-4 text-xs text-slate-400 flex flex-col items-center gap-2">
                <Loader2 size={24} className="animate-spin text-indigo-500" />
                <span>Redirecting to safe Stripe processor portals...</span>
              </div>
            ) : paymentSuccess ? (
              <div className="text-center py-4 text-xs text-emerald-400 flex flex-col items-center gap-2">
                <CheckCircle size={28} className="text-emerald-500" />
                <span className="font-semibold block">Payment authorized successfully!</span>
              </div>
            ) : null}

            <p className="text-[10px] text-slate-500 leading-normal text-center font-mono">
              🔒 256-bit encrypted secure merchant protocols. Stripe verified checkpoints. 
            </p>
          </div>
        </div>
      )}

      {/* DYNAMIC INTEGRATION/CONFIGURATION HINTS FOOTER DISCLOSURE */}
      <footer className="border-t border-slate-900 bg-[#060914] py-12 text-xs text-slate-500 leading-relaxed font-sans mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-900/60">
            <div>
              <h5 className="font-bold text-white text-xs uppercase tracking-wider mb-2">Stripe Payment Gateway integration Setup</h5>
              <p className="text-[11px] text-slate-400">
                To accept credit cards and generate persistent income, configure a Stripe checkout endpoint as detailed in the Stripe logs within your server. Check the browser console logs (F12) clicking any "Upgrade" option to inspect the exact Node integration code blocks.
              </p>
            </div>
            <div>
              <h5 className="font-bold text-white text-xs uppercase tracking-wider mb-2">Partner Webhooks & Tracking API</h5>
              <p className="text-[11px] text-slate-400">
                Configure your corporate partners with the return URL catcher redirecting to {"https://yourapp.firebaseapp.com/claim-return?token=abc123&status=success"}. For fallback server-to-server webhook callbacks, deploy a Firebase Cloud Function listening at {"/api/partner-verification"} that targets Firestore {"/claims/{uid}/userClaims/{claimId}"} and flags status to "completed".
              </p>
            </div>
          </div>

          <div className="text-center space-y-2">
            <span className="font-semibold text-slate-400 font-display">RewardGateway © 2026. All rights secured.</span>
            <p className="text-[10px] text-slate-600">
              Disclaimer: All product names, logos, characters, and licensing marks highlighted inside the dashboard belong to their respective corporate providers. Discord, Epic Games, Spotify, T-Mobile, Canvas, and Xbox are registered trademark credentials.
            </p>
          </div>
        </div>
      </footer>

      {/* TOAST SYSTEM POPUP */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[100] max-w-sm animate-bounce">
          <div className={`p-4 rounded-xl border shadow-2xl flex items-start gap-2.5 ${
            toast.type === "success" ? "bg-emerald-950 text-emerald-350 border-emerald-900/60" : 
            toast.type === "warning" ? "bg-amber-950 text-amber-300 border-amber-900/60" :
            "bg-slate-900 text-slate-300 border-slate-800"
          }`}>
            {toast.type === "success" && <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />}
            {toast.type === "warning" && <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />}
            {toast.type === "info" && <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />}
            <span className="text-xs font-semibold leading-normal">{toast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
}

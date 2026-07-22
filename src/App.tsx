import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Word, WordFlags, UserProfile } from "./types";
import { loadWordsCached, pullWords } from "./data/version";
import {
  getSession,
  onAuthStateChange,
  signUpWithMobileDob,
  signInWithMobileDob,
  signOut,
  updateProfile,
  touchStreak,
  deleteAccount,
} from "./data/auth";
import { setProgressFlags, markWordViewed, initSync, teardownSync } from "./data/sync";
import { getDailyMastered, recordMasteredDelta } from "./data/daily";
import { logger } from "./utils/logger";
import { trackEvent, trackPageView, setAnalyticsUser } from "./utils/analytics";
import { formatDefinitions, wordMatchesDefinition } from "./utils/wordContent";
import {
  DefinitionsHeading,
  DefinitionsList,
  WordEtymology,
} from "./components/DefinitionsList";
import {
  getContinueState,
  resolveContinueTarget,
  setContinueState,
  continueKey,
  type ContinueState,
} from "./data/continue";
import {
  getLastUnitState,
  setLastUnitState,
  lastUnitKey,
  type LastUnitState,
} from "./data/lastUnit";
import { unitNumberForWord, resolveNextUnit } from "./data/units";
import SplashView from "./components/SplashView";
import SignupView from "./components/SignupView";
import SignInView from "./components/SignInView";
import LoadingView from "./components/LoadingView";
import DashboardView from "./components/DashboardView";
import LearningPathView from "./components/LearningPathView";
import BrowseView from "./components/BrowseView";
import MasteredView from "./components/MasteredView";
import ToughNutView from "./components/ToughNutView";
import ProfileView from "./components/ProfileView";
import {
  CoachMarkSpotlight,
  hasSeenCoachMark,
  markCoachMarkSeen,
  type CoachMarkStep,
} from "./components/CoachMarks";
// import TestsView from './components/TestsView'; // Tests temporarily disabled

import {
  Home,
  BookOpen,
  CheckCircle,
  Brain,
  User,
  Search,
  X,
  Volume2,
  ChevronRight,
} from "lucide-react";
import { speakWord } from "./utils/speech";
import { preloadSounds } from "./utils/sounds";
import { isWordUnseen } from "./utils/wordStatus";

type AppView = "loading" | "splash" | "signup" | "signin" | "app";
type Tab = "Home" | "Browse" | "Mastered" | "Tough Nut" | "Profile";

const TAB_PATH: Record<Tab, string> = {
  Home: "/",
  Browse: "/browse",
  Mastered: "/mastered",
  "Tough Nut": "/tough-nut",
  Profile: "/profile",
};
const PATH_TAB: Record<string, Tab> = Object.fromEntries(
  Object.entries(TAB_PATH).map(([tab, path]) => [path, tab]),
) as Record<string, Tab>;
const tabForPath = (path: string): Tab => PATH_TAB[path] ?? "Home";

type AuthErrorLike = { message?: string };

/** Map an auth error to a friendly, user-facing message. */
function authErrorMessage(e: unknown, ctx: "signup" | "signin"): string {
  const msg = (e as AuthErrorLike | null)?.message ?? "";
  const lower = msg.toLowerCase();
  if (
    lower.includes("fetch") ||
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("offline")
  ) {
    return "You appear to be offline. Connect to the internet to continue.";
  }
  if (msg) return msg;
  return ctx === "signup"
    ? "Could not create your account. Please try again."
    : "Could not sign you in. Please try again.";
}

export default function App() {
  const [view, setView] = useState<AppView>("loading");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);

  const [words, setWords] = useState<Word[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("Home");
  const [selectedLetter, setSelectedLetter] = useState<string>("A");
  // Letter shown on the learning path (defaults to the continue letter, but the
  // user can switch it from the progress panel without leaving Home).
  const [pathLetter, setPathLetter] = useState<string>("A");
  const [dailyMastered, setDailyMastered] = useState(0);
  // When set, Browse is scoped to a single unit of `letter` instead of the
  // whole letter (set by tapping a unit on the learning path).
  const [browseScope, setBrowseScope] = useState<{
    letter: string;
    unitNumber: number;
  } | null>(null);
  const [activeCoachMark, setActiveCoachMark] = useState<CoachMarkStep | null>(
    null,
  );
  const [continueTarget, setContinueTarget] = useState<ContinueState | null>(
    null,
  );
  // The unit the user last started on the learning path — highlighted as
  // "resume here". Persisted per user; units are never locked.
  const [lastStartedUnit, setLastStartedUnit] = useState<LastUnitState | null>(
    null,
  );
  const wordsRef = useRef<Word[]>([]);
  const lastSavedContinueRef = useRef<ContinueState | null>(null);
  const browseCurrentWordIdRef = useRef<string | null>(null);
  const prevTabRef = useRef<Tab>("Home");

  // Search
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWordForModal, setSelectedWordForModal] = useState<Word | null>(
    null,
  );

  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  useEffect(() => {
    preloadSounds();
  }, []);

  /**
   * Land a user in the app: paint instantly from cache, then refresh from
   * Supabase in the background. `p` is the freshly-fetched profile (or null when
   * we're restoring offline and fall back to the cached profile).
   */
  const enterApp = async (uid: string, p: UserProfile | null) => {
    logger.info("app:boot", "entering app", { userId: uid });
    setAnalyticsUser(uid);

    const cacheKey = `instagre_profile_${uid}`;
    let prof = p;
    if (!prof) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          prof = JSON.parse(raw) as UserProfile;
          logger.debug("app:boot", "restored cached profile");
        }
      } catch {
        logger.warn("app:boot", "corrupt cached profile");
      }
    }
    if (prof) localStorage.setItem(cacheKey, JSON.stringify(prof));

    const cachedWords = loadWordsCached(uid);
    logger.debug("app:boot", "loaded cached words", { count: cachedWords.length });

    const initialContinue = resolveContinueTarget(
      cachedWords,
      getContinueState(uid),
    );
    lastSavedContinueRef.current = initialContinue;

    setLastStartedUnit(getLastUnitState(uid));

    setUserId(uid);
    setProfile(prof);
    setWords(cachedWords); // instant paint from cache / seed
    setSelectedLetter(initialContinue?.letter ?? "A");
    setPathLetter(initialContinue?.letter ?? "A");
    setBrowseScope(null);
    setDailyMastered(getDailyMastered(uid));
    setContinueTarget(initialContinue);
    setActiveTab("Home");
    window.history.replaceState({ tab: "Home" }, "", TAB_PATH.Home);
    setView("app");
    initSync(uid);
    trackPageView(TAB_PATH.Home, "Home");

    logger.info("app:boot", "app shell rendered", { userId: uid });

    setStreak(touchStreak(uid));
    void pullWords(uid)
      .then((freshWords) => {
        logger.info("app:boot", "refreshed words from server", {
          userId: uid,
          count: freshWords.length,
        });
        setWords(freshWords);
      })
      .catch((e) => {
        logger.warn("app:boot", "failed to refresh words from server", {
          userId: uid,
          error: (e as Error).message,
        });
      });
  };

  // Boot: restore local session if one exists, else show splash/signup.
  useEffect(() => {
    logger.info("app:boot", "app booting up");

    const session = getSession();
    if (session) {
      logger.info("app:boot", "found existing session, entering app");
      void enterApp(session.userId, session.profile);
    } else {
      // No auth session: always show the initial landing (Get Started / Log In).
      // This prevents users from getting stuck on the signup form after they
      // previously tapped "Get Started" but didn't complete account creation.
      logger.info("app:boot", "no session found, showing initial view", {
        view: "splash",
      });
      setView("splash");
    }

    const unsub = onAuthStateChange((s) => {
      if (!s) {
        logger.info("app:auth", "session cleared in another tab, signing out");
        teardownSync();
        setUserId(null);
        setProfile(null);
        setWords([]);
        setView("signin");
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push a new history entry so Android/TWA's back button and the browser's
  // back gesture step through tabs instead of exiting the app. popstate
  // (below) reverses it by reading the entry back, not by calling this again.
  const navigateToTab = (tab: Tab) => {
    setActiveTab(tab);
    if (selectedWordForModal) setSelectedWordForModal(null);
    window.history.pushState({ tab }, "", TAB_PATH[tab]);
    trackPageView(TAB_PATH[tab], tab);
  };

  // Back/forward navigation: restore the tab from history state (or the URL,
  // for forward navigation into an entry pushed before a reload) and close
  // the word modal if that's the top of the "stack" being popped.
  useEffect(() => {
    if (view !== "app") return;
    const onPopState = (e: PopStateEvent) => {
      const state = e.state as { tab?: Tab; modal?: boolean } | null;
      setSelectedWordForModal((prev) => (prev ? null : prev));
      if (state?.modal) return; // popped back onto the modal's own entry
      setActiveTab(state?.tab ?? tabForPath(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [view]);

  const openWordModal = (word: Word) => {
    setSelectedWordForModal(word);
    window.history.pushState({ tab: activeTab, modal: true }, "", window.location.pathname);
  };

  const closeWordModal = () => {
    window.history.back();
  };

  const dismissCoachMark = (step: CoachMarkStep) => {
    markCoachMarkSeen(step);
    setActiveCoachMark(null);
  };

  // Home coachmark: first time the user lands on the dashboard.
  useEffect(() => {
    if (view !== "app" || activeTab !== "Home") return;
    if (hasSeenCoachMark("home")) return;
    const timer = window.setTimeout(() => {
      setActiveCoachMark((prev) => (prev === "home" ? prev : "home"));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [view, activeTab]);

  useEffect(() => {
    if (activeCoachMark === "home" && activeTab !== "Home") {
      setActiveCoachMark(null);
    }
  }, [activeTab, activeCoachMark]);

  const handleGetStarted = () => {
    setView("signup");
  };

  // Async auth handlers — they throw friendly errors that the views display.
  const handleSignup = async (p: UserProfile) => {
    try {
      logger.info("app:handler", "signup handler called");
      const { userId: uid, profile: prof } = await signUpWithMobileDob(p);
      logger.info("app:handler", "signup auth succeeded, entering app");
      trackEvent("sign_up", { method: "mobile_dob" });
      await enterApp(uid, prof);
    } catch (e) {
      const errorMsg = authErrorMessage(e, "signup");
      logger.error("app:handler", "signup handler error", {
        error: (e as Error).message,
        userMessage: errorMsg,
      });
      throw new Error(errorMsg);
    }
  };

  const handleSignIn = async (mobile: string, dob: string) => {
    try {
      logger.info("app:handler", "signin handler called");
      const { userId: uid, profile: prof } = await signInWithMobileDob(
        mobile,
        dob,
      );
      logger.info("app:handler", "signin auth succeeded, entering app");
      trackEvent("login", { method: "mobile_dob" });
      await enterApp(uid, prof);
    } catch (e) {
      const errorMsg = authErrorMessage(e, "signin");
      logger.error("app:handler", "signin handler error", {
        error: (e as Error).message,
        userMessage: errorMsg,
      });
      throw new Error(errorMsg);
    }
  };

  const handleLogout = () => {
    logger.info("app:handler", "logout handler called", { userId });
    trackEvent("logout");
    teardownSync();
    signOut();
    setAnalyticsUser(null);
    setUserId(null);
    setProfile(null);
    setWords([]);
    setView("signin");
    logger.info("app:handler", "logout completed");
  };

  // Delete the account server-side, then wipe every local key scoped to this
  // user (progress, streak, continue/last-unit position, cached profile) so
  // nothing survives on-device after the account is gone.
  const handleDeleteAccount = async () => {
    if (!userId) return;
    const uid = userId;
    logger.info("app:handler", "delete account handler called", { userId: uid });
    await deleteAccount(uid);
    trackEvent("delete_account");

    [
      `instagre_progress_${uid}`,
      `instagre_pending_${uid}`,
      `instagre_streak_${uid}`,
      `instagre_profile_${uid}`,
      `instagre_daily_${uid}`,
      continueKey(uid),
      lastUnitKey(uid),
    ].forEach((key) => localStorage.removeItem(key));

    teardownSync();
    setAnalyticsUser(null);
    setUserId(null);
    setProfile(null);
    setWords([]);
    setView("splash");
    logger.info("app:handler", "delete account completed", { userId: uid });
  };

  const handleUpdateProfile = (updated: UserProfile) => {
    if (!userId) {
      logger.warn("app:handler", "update profile called without userId");
      return;
    }
    logger.info("app:handler", "profile update initiated", {
      userId,
      fullName: updated.fullName,
    });
    setProfile(updated);
    localStorage.setItem(`instagre_profile_${userId}`, JSON.stringify(updated));
    void updateProfile(userId, updated)
      .then((newProf) => {
        setProfile(newProf);
        trackEvent("profile_update");
        logger.info("app:handler", "profile updated successfully", { userId });
      })
      .catch((e) => {
        logger.error("app:handler", "profile update failed", {
          userId,
          error: (e as Error)?.message ?? e,
        });
      });
  };

  // Toggle one or both learning flags for a word (they're independent).
  // Optimistic: update UI immediately, then cache + enqueue the remote sync.
  const handleSetFlags = (wordId: string, flags: Partial<WordFlags>) => {
    const prev = words.find((w) => w.id === wordId);
    const updated = words.map((w) =>
      w.id === wordId ? { ...w, ...flags } : w,
    );
    setWords(updated);
    if (userId) {
      const w = updated.find((x) => x.id === wordId);
      if (w)
        setProgressFlags(userId, wordId, {
          mastered: w.mastered,
          toughNut: w.toughNut,
        });

      // Keep today's mastered count in sync on each mastered on/off transition.
      if (flags.mastered === true && !prev?.mastered) {
        setDailyMastered(recordMasteredDelta(userId, 1));
      } else if (flags.mastered === false && prev?.mastered) {
        setDailyMastered(recordMasteredDelta(userId, -1));
      }
    }

    if (flags.mastered !== undefined && flags.mastered !== prev?.mastered) {
      trackEvent(flags.mastered ? "mark_mastered" : "unmark_mastered", {
        word_id: wordId,
        word: prev?.word,
      });
    }
    if (flags.toughNut !== undefined && flags.toughNut !== prev?.toughNut) {
      trackEvent(flags.toughNut ? "mark_tough_nut" : "unmark_tough_nut", {
        word_id: wordId,
        word: prev?.word,
      });
    }

    // Contextual coachmarks after the user's first mastered / tough-nut mark.
    if (
      flags.mastered === true &&
      !prev?.mastered &&
      !hasSeenCoachMark("mastered-tab")
    ) {
      window.setTimeout(() => setActiveCoachMark("mastered-tab"), 780);
    }
    if (
      flags.toughNut === true &&
      !prev?.toughNut &&
      !hasSeenCoachMark("tough-tab")
    ) {
      window.setTimeout(() => setActiveCoachMark("tough-tab"), 780);
    }
  };

  // Reset the mastered flag for every word starting with `letter` in one pass —
  // looping handleSetFlags per word would each read the same stale `words`
  // closure and only the last call would stick.
  const handleResetLetterMastered = (letter: string) => {
    const toReset = words.filter(
      (w) => w.mastered && w.word.toUpperCase().startsWith(letter),
    );
    if (toReset.length === 0) return;
    const resetIdSet = new Set(toReset.map((w) => w.id));

    const updated = words.map((w) =>
      resetIdSet.has(w.id) ? { ...w, mastered: false } : w,
    );
    setWords(updated);

    if (userId) {
      toReset.forEach((w) =>
        setProgressFlags(userId, w.id, { mastered: false, toughNut: w.toughNut }),
      );
      let nextDailyMastered = 0;
      for (let i = 0; i < toReset.length; i++) {
        nextDailyMastered = recordMasteredDelta(userId, -1);
      }
      setDailyMastered(nextDailyMastered);
    }
  };

  const handleMarkViewed = useCallback(
    (wordId: string) => {
      setWords((prev) => {
        const word = prev.find((w) => w.id === wordId);
        if (!word || word.viewed) return prev;
        trackEvent("view_word", { word_id: wordId, word: word.word });
        if (userId) markWordViewed(userId, wordId);
        return prev.map((w) =>
          w.id === wordId ? { ...w, viewed: true } : w,
        );
      });
    },
    [userId],
  );

  const handleBrowseCurrentWordChange = useCallback((wordId: string | null) => {
    browseCurrentWordIdRef.current = wordId;
  }, []);

  // Mark the visible browse card when leaving the tab (not on landing — that
  // would hide the Unseen pill before the user can see it).
  useEffect(() => {
    const prev = prevTabRef.current;
    if (prev === "Browse" && activeTab !== "Browse") {
      const wordId = browseCurrentWordIdRef.current;
      if (wordId) handleMarkViewed(wordId);
    }
    prevTabRef.current = activeTab;
  }, [activeTab, handleMarkViewed]);

  const selectLetter = (letter: string) => {
    setSelectedLetter(letter);
    setBrowseScope(null); // changing letters always drops any unit scope
  };

  // Tapping a unit on the learning path opens Browse scoped to that unit's
  // words. setSelectedLetter directly (not selectLetter) so the scope survives.
  const navigateToUnit = (letter: string, unitNumber: number) => {
    if (userId) {
      const next = { letter, unitNumber };
      setLastUnitState(userId, next);
      setLastStartedUnit(next);
    }
    setSelectedLetter(letter);
    setBrowseScope({ letter, unitNumber });
    navigateToTab("Browse");
  };

  // "Go to next unit" from the Browse unit-complete card: scope Browse to the
  // next unit in place (no new history entry — we're already on Browse). Falls
  // back to Home when there's no unit after this one.
  const goToNextUnit = (letter: string, unitNumber: number) => {
    const next = resolveNextUnit(words, letter, unitNumber);
    if (!next) {
      setBrowseScope(null);
      navigateToTab("Home");
      return;
    }
    if (userId) {
      setLastUnitState(userId, next);
      setLastStartedUnit(next);
    }
    setSelectedLetter(next.letter);
    setBrowseScope(next);
  };

  const handlePathSelectLetter = (letter: string) => {
    setPathLetter(letter);
  };

  useEffect(() => {
    if (!userId) {
      setContinueTarget(null);
      return;
    }
    const next = resolveContinueTarget(words, getContinueState(userId));
    setContinueTarget((prev) =>
      prev?.letter === next?.letter && prev?.wordId === next?.wordId ? prev : next,
    );
  }, [userId, words]);

  const handleSaveContinuePosition = useCallback(
    (letter: string, wordId: string) => {
      if (!userId) return;
      const saved = { letter, wordId };

      const lastSaved = lastSavedContinueRef.current;
      const isSameSavedPosition =
        lastSaved?.letter === saved.letter && lastSaved?.wordId === saved.wordId;
      if (!isSameSavedPosition) {
        setContinueState(userId, saved);
        lastSavedContinueRef.current = saved;
      }

      // Studying a word means its unit is "started" — highlight it on the path.
      // Driven by session activity, not mastery, so mastering words elsewhere
      // never shifts which unit is active.
      const unitNumber = unitNumberForWord(wordsRef.current, letter, wordId);
      if (unitNumber != null) {
        const startedUnit = { letter, unitNumber };
        setLastUnitState(userId, startedUnit);
        setLastStartedUnit((prev) =>
          prev?.letter === startedUnit.letter &&
          prev?.unitNumber === startedUnit.unitNumber
            ? prev
            : startedUnit,
        );
      }

      const next = resolveContinueTarget(wordsRef.current, saved);
      setContinueTarget((prev) =>
        prev?.letter === next?.letter && prev?.wordId === next?.wordId ? prev : next,
      );
    },
    [userId],
  );

  // Snapshot resume position when entering a letter — not live-linked to
  // continueTarget, or saving the current card re-triggers restore in a loop.
  const browseResumeWordId = useMemo(() => {
    if (!userId) return null;
    const state = getContinueState(userId);
    if (state?.letter === selectedLetter) return state.wordId;
    return null;
  }, [userId, selectedLetter]);

  const navigateToLetterBrowse = (letter: string) => {
    selectLetter(letter);
    navigateToTab("Browse");
  };

  // Search matches
  const matchedWords =
    searchQuery.trim() === ""
      ? []
      : words.filter(
          (w) =>
            w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
            wordMatchesDefinition(w, searchQuery),
        );

  const masteredTotalCount = words.filter((w) => w.mastered).length;

  // First-time users (no word seen or mastered yet) get the alphabet Dashboard.
  // Once they've started learning any letter, Home becomes the unit path.
  const hasStartedLearning = words.some((w) => w.viewed || w.mastered);

  // -------------------------------------------------- Pre-app screens
  if (view === "loading") return <LoadingView />;
  if (view === "splash")
    return (
      <SplashView
        onGetStarted={handleGetStarted}
        onLogIn={() => {
          setView("signin");
        }}
      />
    );
  if (view === "signup")
    return (
      <SignupView
        onSignup={handleSignup}
        onGoToSignIn={() => setView("signin")}
        onBack={() => setView("splash")}
      />
    );
  if (view === "signin")
    return (
      <SignInView
        onSignIn={handleSignIn}
        onGoToSignUp={() => setView("signup")}
        onBack={() => setView("splash")}
      />
    );

  // -------------------------------------------------- Main app shell
  const immersive =
    activeTab === "Home" ||
    activeTab === "Browse" ||
    activeTab === "Mastered" ||
    activeTab === "Tough Nut" ||
    activeTab === "Profile";
  const initial = (profile?.fullName?.trim()?.[0] ?? "I").toUpperCase();

  return (
    <div className="bg-[#f3f4f6] min-h-screen text-text-primary font-sans antialiased selection:bg-primary selection:text-white">
      {/* Top App Bar (hidden on the immersive Browse tab) */}
      {!immersive && (
        <header className="fixed top-0 w-full max-w-[600px] h-14 z-50 bg-primary text-white shadow-sm flex items-center justify-between px-4 left-1/2 -translate-x-1/2">
          <div className="flex items-center select-none">
            <div className="px-2.5 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
              <span className="font-serif text-white text-base font-black leading-none tracking-tight">
                InstaGRE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isSearchActive ? (
              <div className="flex items-center bg-white/10 rounded-lg px-2 py-1 max-w-[180px] shrink-0 border border-white/15">
                <input
                  type="text"
                  placeholder="Search vocabulary..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-white outline-hidden placeholder-white/50 w-full"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setIsSearchActive(false);
                    setSearchQuery("");
                  }}
                  className="text-white/60 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsSearchActive(true)}
                className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10"
                title="Search words"
              >
                <Search className="w-4.5 h-4.5" />
              </button>
            )}

            <button
              onClick={() => navigateToTab("Profile")}
              className="w-8 h-8 rounded-full bg-white/15 border border-white/25 flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-white/25 transition-colors"
              title="Profile"
            >
              {initial}
            </button>
          </div>
        </header>
      )}

      {/* Main container */}
      <div
        data-app-shell
        className={`max-w-[600px] mx-auto bg-surface flex flex-col pb-16 border-x border-gray-150 relative ${
          immersive ? "h-screen pt-0" : "min-h-screen pt-14"
        }`}
      >
        {/* Search results overlay */}
        {!immersive && isSearchActive && searchQuery.trim() !== "" && (
          <div className="bg-white p-4 absolute top-14 left-0 right-0 z-40 border-b border-gray-200 shadow-xl max-h-[75vh] overflow-y-auto space-y-3">
            <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest block pb-1 border-b">
              Matched Items in Dictionary ({matchedWords.length})
            </span>

            {matchedWords.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400 italic">
                No results match "{searchQuery}". Try another pattern!
              </div>
            ) : (
              <div className="space-y-2">
                {matchedWords.map((word) => (
                  <div
                    key={word.id}
                    onClick={() => {
                      trackEvent("search_select_result", {
                        query: searchQuery,
                        word_id: word.id,
                        word: word.word,
                      });
                      handleMarkViewed(word.id);
                      openWordModal({ ...word, viewed: true });
                      setIsSearchActive(false);
                      setSearchQuery("");
                    }}
                    className="p-3 border rounded-xl border-gray-100 hover:bg-gray-50 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-serif font-black text-gray-800 text-sm">
                          {word.word}
                        </span>
                        <span className="text-gray-400 italic">
                          ({word.ipa})
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                        {formatDefinitions(word.definitions)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {isWordUnseen(word) && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-gray-100 text-gray-500">
                          Unseen
                        </span>
                      )}
                      {word.mastered && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-success-soft text-success-vibrant">
                          Mastered
                        </span>
                      )}
                      {word.toughNut && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-warning-soft text-warning-vibrant inline-flex items-center gap-1">
                          Tough <Brain className="w-3 h-3" />
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Views */}
        <main className={immersive ? "flex-1 min-h-0" : "flex-1 p-4"}>
          {activeTab === "Home" &&
            (hasStartedLearning ? (
              <LearningPathView
                words={words}
                activeLetter={pathLetter}
                dailyMastered={dailyMastered}
                lastStartedUnit={
                  lastStartedUnit?.letter === pathLetter
                    ? lastStartedUnit.unitNumber
                    : null
                }
                onSelectLetter={handlePathSelectLetter}
                onStartUnit={navigateToUnit}
              />
            ) : (
              <DashboardView
                words={words}
                streak={streak}
                continueLetter={continueTarget?.letter ?? null}
                onLetterSelect={navigateToLetterBrowse}
              />
            ))}

          {activeTab === "Browse" && (
            <BrowseView
              words={words}
              selectedLetter={selectedLetter}
              unitNumber={
                browseScope?.letter === selectedLetter
                  ? browseScope.unitNumber
                  : null
              }
              resumeWordId={browseResumeWordId}
              onSetSelectedLetter={selectLetter}
              onClearUnitScope={() => setBrowseScope(null)}
              onGoToNextUnit={() =>
                browseScope && goToNextUnit(browseScope.letter, browseScope.unitNumber)
              }
              onGoHome={() => {
                setBrowseScope(null);
                navigateToTab("Home");
              }}
              onSetFlags={handleSetFlags}
              onMarkViewed={handleMarkViewed}
              onCurrentWordChange={handleBrowseCurrentWordChange}
              onSaveContinuePosition={handleSaveContinuePosition}
            />
          )}

          {activeTab === "Mastered" && (
            <MasteredView
              words={words}
              selectedLetter={selectedLetter}
              onSetSelectedLetter={selectLetter}
              onSetFlags={handleSetFlags}
              onResetLetter={handleResetLetterMastered}
              onNavigateToBrowseLetter={navigateToLetterBrowse}
            />
          )}

          {activeTab === "Tough Nut" && (
            <ToughNutView words={words} onSetFlags={handleSetFlags} />
          )}

          {activeTab === "Profile" && profile && (
            <ProfileView
              profile={profile}
              words={words}
              streak={streak}
              onUpdateProfile={handleUpdateProfile}
              onLogout={handleLogout}
              onDeleteAccount={handleDeleteAccount}
            />
          )}

          {/* Tests tab temporarily disabled
          {activeTab === 'Tests' && (
            <TestsView words={words} onUpdateStatus={handleUpdateStatus} initialSelectedMode={null} />
          )} */}
        </main>

        {/* Bottom navigation */}
        <nav
          id="global_navigation_bar"
          className="fixed bottom-0 w-full max-w-[600px] h-16 z-50 border-t border-gray-150 bg-surface flex justify-around items-center px-2 left-1/2 -translate-x-1/2"
        >
          {(
            [
              { tab: "Home", label: "Home", Icon: Home },
              { tab: "Browse", label: "Browse", Icon: BookOpen },
              { tab: "Mastered", label: "Mastered", Icon: CheckCircle },
              { tab: "Tough Nut", label: "Tough Nut", Icon: Brain },
              { tab: "Profile", label: "Profile", Icon: User },
            ] as const
          ).map(({ tab, label, Icon }) => {
            const isActive = activeTab === tab;
            const showBadge =
              !isActive &&
              ((tab === "Mastered" && masteredTotalCount > 0) ||
                (tab === "Tough Nut" && words.some((w) => w.toughNut)));
            return (
              <button
                key={tab}
                type="button"
                data-nav-tab={tab}
                data-coach-nav={tab}
                onClick={() => navigateToTab(tab)}
                className={`relative flex flex-col items-center justify-center p-1 cursor-pointer transition-all ${
                  isActive
                    ? "text-primary"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {showBadge && (
                  <span
                    className={`absolute top-1 right-2 w-2 h-2 rounded-full ${
                      tab === "Mastered"
                        ? "bg-success-vibrant"
                        : "bg-warning-vibrant"
                    }`}
                  />
                )}
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-bold tracking-wider uppercase mt-1">
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Word details modal (from search) */}
      {selectedWordForModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-100 p-6 space-y-5 relative">
            <button
              onClick={closeWordModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2 pt-2">
              <div className="flex justify-center gap-1.5">
                {isWordUnseen(selectedWordForModal) && (
                    <span className="text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider bg-gray-100 text-gray-500">
                      Unseen
                    </span>
                  )}
                {selectedWordForModal.mastered && (
                  <span className="text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider bg-success-soft text-success-vibrant">
                    Mastered ✓
                  </span>
                )}
                {selectedWordForModal.toughNut && (
                  <span className="text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider bg-warning-soft text-warning-vibrant inline-flex items-center gap-1">
                    Tough Nut <Brain className="w-3 h-3" />
                  </span>
                )}
              </div>
              <h2 className="font-serif text-3xl font-black text-gray-900 leading-none">
                {selectedWordForModal.word}
              </h2>
              <div className="flex justify-center items-center gap-1.5 text-xs text-gray-400 italic">
                <span>{selectedWordForModal.ipa}</span>
                <span className="text-[9px] font-extrabold text-primary bg-primary/10 px-1.5 rounded uppercase">
                  {selectedWordForModal.partOfSpeech}
                </span>
              </div>
            </div>

            <div className="flex justify-center select-none pt-1">
              <button
                type="button"
                onClick={() => speakWord(selectedWordForModal.word)}
                className="bg-primary/10 hover:bg-primary/20 text-primary p-3 rounded-full flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-transform"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <DefinitionsHeading count={selectedWordForModal.definitions.length} />
              <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl">
                <DefinitionsList
                  definitions={selectedWordForModal.definitions}
                  variant="detail"
                />
              </div>
            </div>

            <WordEtymology
              etymology={selectedWordForModal.etymology}
              className="text-xs [&_p]:text-xs"
            />

            <div className="pt-2 border-t border-gray-100 space-y-2">
              <div className="grid grid-cols-2 gap-2 font-bold text-[10px] uppercase text-center leading-none">
                <button
                  type="button"
                  onClick={() => {
                    const next = {
                      ...selectedWordForModal,
                      mastered: !selectedWordForModal.mastered,
                    };
                    handleSetFlags(selectedWordForModal.id, {
                      mastered: next.mastered,
                    });
                    setSelectedWordForModal(next);
                  }}
                  className={`p-2.5 rounded-xl border cursor-pointer ${
                    selectedWordForModal.mastered
                      ? "bg-success-soft border-success-vibrant text-success-vibrant"
                      : "bg-white border-gray-150 text-success-vibrant hover:bg-success-soft/20"
                  }`}
                >
                  {selectedWordForModal.mastered
                    ? "Mastered ✓"
                    : "Mark Mastered"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = {
                      ...selectedWordForModal,
                      toughNut: !selectedWordForModal.toughNut,
                    };
                    handleSetFlags(selectedWordForModal.id, {
                      toughNut: next.toughNut,
                    });
                    setSelectedWordForModal(next);
                  }}
                  className={`p-2.5 rounded-xl border cursor-pointer inline-flex items-center justify-center gap-1 ${
                    selectedWordForModal.toughNut
                      ? "bg-warning-soft border-warning-vibrant text-warning-vibrant"
                      : "bg-white border-gray-150 text-warning-vibrant hover:bg-warning-soft/20"
                  }`}
                >
                  {selectedWordForModal.toughNut ? (
                    <>
                      Tough Nut <Brain className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    "Mark Tough"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contextual first-run coachmarks */}
      {activeCoachMark === "home" &&
        (hasStartedLearning ? (
          <CoachMarkSpotlight
            target="[data-coach='path-active-unit']"
            title="Start your next unit"
            body="Words are grouped into bite-sized units. Tap the highlighted unit to start learning — finish it to unlock the next one."
            placement="bottom"
            onDismiss={() => dismissCoachMark("home")}
          />
        ) : (
          <CoachMarkSpotlight
            target="[data-coach='home-alphabet']"
            title="Pick a letter to start"
            body="Tap any letter to browse vocabulary flashcards. Your progress is tracked per letter — green means you've mastered them all."
            placement="bottom"
            onDismiss={() => dismissCoachMark("home")}
          />
        ))}
      {activeCoachMark === "mastered-tab" && (
        <CoachMarkSpotlight
          target="[data-coach-nav='Mastered']"
          title="Mastered words live here"
          body="Every word you mark with ✓ is saved in the Mastered tab so you can review them anytime."
          placement="top"
          onDismiss={() => dismissCoachMark("mastered-tab")}
        />
      )}
      {activeCoachMark === "tough-tab" && (
        <CoachMarkSpotlight
          target="[data-coach-nav='Tough Nut']"
          title="Drill your Tough Nuts"
          body="Words you flag as Tough Nut go to this tab perfect for words you want to revisit and drill."
          placement="top"
          icon={<Brain className="w-5 h-5" />}
          onDismiss={() => dismissCoachMark("tough-tab")}
        />
      )}
    </div>
  );
}

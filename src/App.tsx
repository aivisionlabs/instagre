import { useState, useEffect } from "react";
import { Word, WordStatus, UserProfile } from "./types";
import { loadWords, persistWords } from "./data/version";
import {
  getCurrentProfile,
  setCurrentMobile,
  saveProfile,
  logout as logoutUser,
  touchStreak,
  getStreak,
} from "./data/auth";
import SplashView from "./components/SplashView";
import SignupView from "./components/SignupView";
import SignInView from "./components/SignInView";
import DashboardView from "./components/DashboardView";
import BrowseView from "./components/BrowseView";
import LearnedView from "./components/LearnedView";
import ToughNutView from "./components/ToughNutView";
import ProfileView from "./components/ProfileView";
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

type AppView = "splash" | "signup" | "signin" | "app";
type Tab = "Home" | "Browse" | "Learned" | "Tough Nut" | "Profile";

export default function App() {
  const [view, setView] = useState<AppView>("splash");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [streak, setStreak] = useState(0);

  const [words, setWords] = useState<Word[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("Home");
  const [selectedLetter, setSelectedLetter] = useState<string>("A");

  // Search
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWordForModal, setSelectedWordForModal] = useState<Word | null>(
    null,
  );

  // Boot: restore session if one exists, else decide splash vs signup.
  useEffect(() => {
    const existing = getCurrentProfile();
    if (existing) {
      enterApp(existing);
      return;
    }
    const started = localStorage.getItem("wordcrack_has_started") === "true";
    setView(started ? "signup" : "splash");
  }, []);

  /** Load a user's data and land them in the app. */
  const enterApp = (p: UserProfile) => {
    setCurrentMobile(p.mobile);
    setProfile(p);
    setWords(loadWords(p.mobile));
    setStreak(touchStreak(p.mobile));
    setActiveTab("Home");
    setView("app");
  };

  const handleGetStarted = () => {
    localStorage.setItem("wordcrack_has_started", "true");
    setView("signup");
  };

  const handleSignup = (p: UserProfile) => {
    saveProfile(p);
    enterApp(p);
  };

  const handleSignIn = (p: UserProfile) => enterApp(p);

  const handleLogout = () => {
    logoutUser();
    setProfile(null);
    setWords([]);
    setView("signin");
  };

  const handleUpdateProfile = (updated: UserProfile) => {
    const saved = saveProfile(updated);
    setProfile(saved);
  };

  // Persist word-status mutations through a single path (now per-user).
  const triggerWordsSync = (updated: Word[]) => {
    setWords(updated);
    if (profile) persistWords(updated, profile.mobile);
  };

  const handleUpdateStatus = (wordId: string, newStatus: WordStatus) => {
    triggerWordsSync(
      words.map((w) => (w.id === wordId ? { ...w, status: newStatus } : w)),
    );
  };

  const navigateToLetterBrowse = (letter: string) => {
    setSelectedLetter(letter);
    setActiveTab("Browse");
  };

  // Search matches
  const matchedWords =
    searchQuery.trim() === ""
      ? []
      : words.filter(
          (w) =>
            w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
            w.definition.toLowerCase().includes(searchQuery.toLowerCase()),
        );

  const learnedTotalCount = words.filter(
    (w) => w.status === "Learned It",
  ).length;

  // -------------------------------------------------- Pre-app screens
  if (view === "splash")
    return (
      <SplashView
        onGetStarted={handleGetStarted}
        onLogIn={() => {
          localStorage.setItem("wordcrack_has_started", "true");
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
  const immersive = activeTab === "Browse"; // full-bleed, owns its own header
  const initial = (profile?.fullName?.trim()?.[0] ?? "W").toUpperCase();

  return (
    <div className="bg-[#f3f4f6] min-h-screen text-text-primary font-sans antialiased selection:bg-primary selection:text-white">
      {/* Top App Bar (hidden on the immersive Browse tab) */}
      {!immersive && (
        <header className="fixed top-0 w-full max-w-[600px] h-14 z-50 bg-primary text-white shadow-sm flex items-center justify-between px-4 left-1/2 -translate-x-1/2">
          <div className="flex items-center select-none">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <span className="font-serif text-primary text-lg font-black leading-none">
                W
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
              onClick={() => setActiveTab("Profile")}
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
                      setSelectedWordForModal(word);
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
                        {word.definition}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          word.status === "Learned It"
                            ? "bg-success-soft text-success-vibrant"
                            : word.status === "Tough Nut"
                              ? "bg-warning-soft text-warning-vibrant"
                              : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {word.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Views */}
        <main className={immersive ? "flex-1" : "flex-1 p-4"}>
          {activeTab === "Home" && (
            <DashboardView
              words={words}
              streak={streak}
              onLetterSelect={navigateToLetterBrowse}
            />
          )}

          {activeTab === "Browse" && (
            <BrowseView
              words={words}
              selectedLetter={selectedLetter}
              onSetSelectedLetter={setSelectedLetter}
              onUpdateStatus={handleUpdateStatus}
            />
          )}

          {activeTab === "Learned" && (
            <LearnedView
              words={words}
              onUpdateStatus={handleUpdateStatus}
              onNavigateToBrowseLetter={navigateToLetterBrowse}
            />
          )}

          {activeTab === "Tough Nut" && (
            <ToughNutView
              words={words}
              onUpdateStatus={handleUpdateStatus}
              onNavigateToBrowseLetter={navigateToLetterBrowse}
            />
          )}

          {activeTab === "Profile" && profile && (
            <ProfileView
              profile={profile}
              words={words}
              streak={streak}
              onUpdateProfile={handleUpdateProfile}
              onLogout={handleLogout}
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
              { tab: "Learned", label: "Learned", Icon: CheckCircle },
              { tab: "Tough Nut", label: "Tough Nut", Icon: Brain },
              { tab: "Profile", label: "Profile", Icon: User },
            ] as const
          ).map(({ tab, label, Icon }) => {
            const isActive = activeTab === tab;
            const showBadge =
              !isActive &&
              ((tab === "Learned" && learnedTotalCount > 0) ||
                (tab === "Tough Nut" &&
                  words.some((w) => w.status === "Tough Nut")));
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative flex flex-col items-center justify-center p-1 cursor-pointer transition-all ${
                  isActive
                    ? "text-primary"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {showBadge && (
                  <span
                    className={`absolute top-1 right-2 w-2 h-2 rounded-full ${
                      tab === "Learned"
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
              onClick={() => setSelectedWordForModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2 pt-2">
              <span
                className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${
                  selectedWordForModal.status === "Learned It"
                    ? "bg-success-soft text-success-vibrant"
                    : selectedWordForModal.status === "Tough Nut"
                      ? "bg-warning-soft text-warning-vibrant"
                      : "bg-gray-100 text-gray-500"
                }`}
              >
                {selectedWordForModal.status}
              </span>
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
              <h5 className="font-extrabold text-text-secondary uppercase tracking-wider">
                Primary Meaning
              </h5>
              <p className="bg-gray-50 border border-gray-100 p-3 rounded-xl leading-relaxed text-gray-800">
                {selectedWordForModal.definition}
              </p>
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-2">
              <div className="grid grid-cols-3 gap-2 font-bold text-[10px] uppercase text-center leading-none">
                {(["Unseen", "Tough Nut", "Learned It"] as const).map(
                  (status) => {
                    const active = selectedWordForModal.status === status;
                    const styles =
                      status === "Unseen"
                        ? active
                          ? "bg-gray-200 border-gray-400 text-gray-800"
                          : "bg-white border-gray-150 text-gray-500 hover:bg-gray-50"
                        : status === "Tough Nut"
                          ? active
                            ? "bg-warning-soft border-warning-vibrant text-warning-vibrant"
                            : "bg-white border-gray-150 text-warning-vibrant hover:bg-warning-soft/20"
                          : active
                            ? "bg-success-soft border-success-vibrant text-success-vibrant"
                            : "bg-white border-gray-150 text-success-vibrant hover:bg-success-soft/20";
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => {
                          handleUpdateStatus(selectedWordForModal.id, status);
                          setSelectedWordForModal(null);
                        }}
                        className={`p-2.5 rounded-xl border cursor-pointer ${styles}`}
                      >
                        {status === "Tough Nut"
                          ? "Tough Nut 🥜"
                          : status === "Learned It"
                            ? "Learned It ✓"
                            : "Unseen"}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

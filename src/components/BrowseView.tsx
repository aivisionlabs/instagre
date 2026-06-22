import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { Word, WordFlags } from "../types";
import { speakWord } from "../utils/speech";
import {
  Volume2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Eye,
  EyeOff,
  Brain,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import LetterSelectorModal from "./LetterSelectorModal";
import {
  CoachMarkTour,
  hasSeenBrowseTour,
  markBrowseTourSeen,
  type CoachMarkTourStep,
} from "./CoachMarks";

const BROWSE_COACH_STEPS: CoachMarkTourStep[] = [
  {
    target: "#browse_tab [data-coach='browse-letter']",
    title: "Pick a letter",
    body: "Tap here to jump between letters and see your mastery progress for each one.",
    placement: "bottom",
  },
  {
    target: "#browse_tab [data-coach='browse-definition']",
    title: "Show or hide the definition",
    body: "Quiz yourself — hide the meaning while you think, then tap to reveal it.",
    placement: "bottom",
  },
  {
    target: "#browse_tab [data-coach='browse-swipe']",
    title: "Swipe to navigate",
    body: "Swipe up or down to move to the next or previous word in this letter.",
    placement: "top",
  },
  {
    target: "#browse_tab [data-coach='browse-card']",
    title: "Flip for details",
    body: "Tap the card to flip it and see example sentences, synonyms, and antonyms.",
    placement: "top",
  },
  {
    target: "#browse_tab [data-coach='browse-pronounce']",
    title: "Hear it aloud",
    body: "Tap the speaker icon to hear the correct pronunciation.",
    placement: "bottom",
  },
  {
    target: "#browse_tab [data-coach='browse-flags']",
    title: "Mark your progress",
    body: "Tap ✓ when you've mastered a word, or 🥜 to flag a Tough Nut. The card stays put until you swipe.",
    placement: "top",
  },
];

interface BrowseViewProps {
  words: Word[];
  selectedLetter: string;
  resumeWordId: string | null;
  onSetSelectedLetter: (letter: string) => void;
  onSetFlags: (wordId: string, flags: Partial<WordFlags>) => void;
  onSaveContinuePosition: (letter: string, wordId: string) => void;
}

type FlyTarget = "mastered" | "tough";

interface IconFly {
  id: number;
  target: FlyTarget;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface BackGesture {
  y: number;
  scrollTop: number;
  time: number;
  target: HTMLElement;
}

function getNavTabCenter(target: FlyTarget) {
  const tabName = target === "mastered" ? "Mastered" : "Tough Nut";
  const el = document.querySelector<HTMLElement>(
    `#global_navigation_bar [data-nav-tab="${tabName}"]`,
  );
  if (el) {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  const shellWidth = Math.min(window.innerWidth, 600);
  const shellLeft = (window.innerWidth - shellWidth) / 2;
  const tabIndex = target === "mastered" ? 2 : 3;
  return {
    x: shellLeft + (shellWidth * (tabIndex + 0.5)) / 5,
    y: window.innerHeight - 32,
  };
}

function getFlyOrigin(el: HTMLElement | null) {
  if (el) {
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 - 80 };
}

function pulseNavTab(target: FlyTarget) {
  const tabName = target === "mastered" ? "Mastered" : "Tough Nut";
  const el = document.querySelector<HTMLElement>(
    `#global_navigation_bar [data-nav-tab="${tabName}"]`,
  );
  el?.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.14)" },
      { transform: "scale(1)" },
    ],
    { duration: 380, easing: "ease-out" },
  );
}

/** Bold every occurrence of the headword (and inflections) inside a sentence. */
function highlightWord(sentence: string, target: string) {
  const regex = new RegExp(`(${target}\\w*)`, "gi");
  return sentence.split(regex).map((part, i) =>
    regex.test(part) ? (
      <span key={i} className="font-bold text-text-primary">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export default function BrowseView({
  words,
  selectedLetter,
  resumeWordId,
  onSetSelectedLetter,
  onSetFlags,
  onSaveContinuePosition,
}: BrowseViewProps) {
  const [focusIndex, setFocusIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showDefinition, setShowDefinition] = useState(true);
  const [showLetters, setShowLetters] = useState(false);
  const [swipeDir, setSwipeDir] = useState<"up" | "down">("up");
  const [exitFlipped, setExitFlipped] = useState(false);
  const [iconFlies, setIconFlies] = useState<IconFly[]>([]);
  const [showBrowseTour, setShowBrowseTour] = useState(false);
  const flyIdRef = useRef(0);
  const skipSaveAfterRestoreRef = useRef(false);

  // Tracks a pointer gesture on the (flipped) back face so we can tell a
  // navigation flick apart from a content scroll. Framer's drag="y" can't
  // see gestures that start inside the back face's overflow-y-auto scroller,
  // so the back face navigates via these handlers instead.
  const backGesture = useRef<BackGesture | null>(null);
  const backTouchGesture = useRef<BackGesture | null>(null);
  const suppressClick = useRef(false);

  // Every word for the letter stays in the stack regardless of its flags —
  // navigation is swipe-only, so marking a word never removes it or advances.
  const filteredWords = words
    .filter((w) => w.word.toUpperCase().startsWith(selectedLetter))
    .sort((a, b) => a.word.localeCompare(b.word));

  const total = filteredWords.length;
  const lettersTotal = total;
  const masteredInLetter = filteredWords.filter((w) => w.mastered).length;
  const percentage =
    lettersTotal > 0 ? Math.round((masteredInLetter / lettersTotal) * 100) : 0;

  // Restore flashcard position when the letter changes. useLayoutEffect so
  // focusIndex is correct before the save effect runs in the same commit.
  useLayoutEffect(() => {
    setIsFlipped(false);
    skipSaveAfterRestoreRef.current = true;
    const letterWords = words
      .filter((w) => w.word.toUpperCase().startsWith(selectedLetter))
      .sort((a, b) => a.word.localeCompare(b.word));

    if (letterWords.length === 0) {
      setFocusIndex(0);
      return;
    }
    if (resumeWordId) {
      const idx = letterWords.findIndex((w) => w.id === resumeWordId);
      setFocusIndex(idx >= 0 ? idx : 0);
      return;
    }
    setFocusIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only restore on letter/resume, not every progress tick
  }, [selectedLetter, resumeWordId]);

  // When a word leaves the stack (marked Learned) the list shrinks; clamp the
  // focus so we never point past the end and the next word slides into view.
  useEffect(() => {
    if (total > 0 && focusIndex >= total) setFocusIndex(total - 1);
  }, [total, focusIndex]);

  const current = filteredWords[focusIndex];

  useEffect(() => {
    if (!current) return;
    if (skipSaveAfterRestoreRef.current) {
      skipSaveAfterRestoreRef.current = false;
      return;
    }
    onSaveContinuePosition(selectedLetter, current.id);
  }, [selectedLetter, current?.id, onSaveContinuePosition]);

  // First visit to Browse: walk through every CTA on the flashcard screen.
  // Wait until card position is restored — resumeWordId can change focusIndex
  // right after mount, which previously cancelled the tour timer permanently.
  useEffect(() => {
    if (!current?.id || hasSeenBrowseTour() || showBrowseTour) return;
    const timer = window.setTimeout(() => setShowBrowseTour(true), 600);
    return () => window.clearTimeout(timer);
  }, [current?.id, showBrowseTour]);

  const completeBrowseTour = () => {
    markBrowseTourSeen();
    setShowBrowseTour(false);
  };

  const goTo = (dir: "up" | "down") => {
    if (total === 0) return;
    setExitFlipped(isFlipped);
    setSwipeDir(dir);
    setFocusIndex((prev) =>
      dir === "up" ? (prev + 1) % total : (prev - 1 + total) % total,
    );
  };

  const handleCardExitComplete = () => {
    setIsFlipped(false);
    setExitFlipped(false);
  };

  const removeIconFly = (id: number) => {
    setIconFlies((prev) => prev.filter((fly) => fly.id !== id));
  };

  const flyIconToTab = (target: FlyTarget, source: HTMLElement) => {
    const from = getFlyOrigin(source);
    const to = getNavTabCenter(target);
    flyIdRef.current += 1;
    setIconFlies((prev) => [
      ...prev,
      {
        id: flyIdRef.current,
        target,
        from,
        to,
      },
    ]);
  };

  const dismissBrowseTourIfActive = () => {
    if (showBrowseTour) completeBrowseTour();
  };

  // Mastered and Tough Nut are independent toggles. Per the browse UX, tapping
  // either one only updates the flag — it never flips, advances, or removes the
  // card. The user moves on by explicitly swiping up.
  const toggleMastered = (word: Word, source: HTMLElement) => {
    const next = !word.mastered;
    onSetFlags(word.id, { mastered: next });
    if (next) {
      flyIconToTab("mastered", source);
      dismissBrowseTourIfActive();
    }
  };

  const toggleTough = (word: Word, source: HTMLElement) => {
    const next = !word.toughNut;
    onSetFlags(word.id, { toughNut: next });
    if (next) {
      flyIconToTab("tough", source);
      dismissBrowseTourIfActive();
    }
  };

  const getBackScroller = (root: HTMLElement) =>
    root.querySelector<HTMLElement>("[data-back-scroll]");

  const resolveBackNav = (
    startY: number,
    endY: number,
    startTime: number,
    endTime: number,
    startScrollTop: number,
    endScrollTop: number,
    scroller: HTMLElement | null,
  ): "up" | "down" | null => {
    const dy = startY - endY; // positive => moved up
    const dt = endTime - startTime;
    const velocityPxS = dt > 0 ? (dy / dt) * 1000 : 0;
    const isSwipeGesture = Math.abs(velocityPxS) > 300;
    const isLargeDrag = Math.abs(dy) > 100;
    if (!isSwipeGesture && !isLargeDrag) return null;

    const scrolled = Math.abs(endScrollTop - startScrollTop) > 4;
    if (!scrolled) return dy > 0 ? "up" : "down";

    if (!scroller) return null;
    const atTop = startScrollTop <= 2;
    const atBottom =
      startScrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
    if (atTop && dy > 0) return "up";
    if (atBottom && dy < 0) return "down";
    return null;
  };

  const beginBackGesture = (e: PointerEvent<HTMLElement>) => {
    const scroller =
      e.currentTarget.dataset.backScroll !== undefined
        ? e.currentTarget
        : getBackScroller(e.currentTarget);
    backGesture.current = {
      y: e.clientY,
      scrollTop: scroller?.scrollTop ?? 0,
      time: e.timeStamp,
      target: e.currentTarget,
    };
    suppressClick.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.currentTarget.dataset.backScroll !== undefined) {
      e.stopPropagation();
    }
  };

  const handleBackPointerMove = (e: PointerEvent<HTMLElement>) => {
    const g = backGesture.current;
    if (!g) return;

    const scroller =
      g.target.dataset.backScroll !== undefined
        ? g.target
        : getBackScroller(g.target);
    if (!scroller) return;

    const dy = g.y - e.clientY;
    const atTop = scroller.scrollTop <= 0;
    const atBottom =
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;

    // At scroll edges, keep the gesture on the card so swipes navigate instead
    // of being eaten by the scroller (which fires pointercancel).
    if ((atTop && dy > 8) || (atBottom && dy < -8)) {
      e.preventDefault();
    }

    if (e.currentTarget.dataset.backScroll !== undefined) {
      e.stopPropagation();
    }
  };

  const finishBackGesture = (e: PointerEvent<HTMLElement>) => {
    const g = backGesture.current;
    backGesture.current = null;
    if (!g) return;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const scroller =
      g.target.dataset.backScroll !== undefined
        ? g.target
        : getBackScroller(g.target);
    const dir = resolveBackNav(
      g.y,
      e.clientY,
      g.time,
      e.timeStamp,
      g.scrollTop,
      scroller?.scrollTop ?? 0,
      scroller,
    );

    if (dir) {
      suppressClick.current = true; // don't let the trailing click unflip
      goTo(dir);
    }

    if (e.currentTarget.dataset.backScroll !== undefined) {
      e.stopPropagation();
    }
  };

  const cancelBackGesture = (e: PointerEvent<HTMLElement>) => {
    backGesture.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (e.currentTarget.dataset.backScroll !== undefined) {
      e.stopPropagation();
    }
  };

  const beginBackTouchGesture = (e: ReactTouchEvent<HTMLElement>) => {
    const touch = e.changedTouches[0];
    if (!touch) return;

    const scroller =
      e.currentTarget.dataset.backScroll !== undefined
        ? e.currentTarget
        : getBackScroller(e.currentTarget);
    backTouchGesture.current = {
      y: touch.clientY,
      scrollTop: scroller?.scrollTop ?? 0,
      time: e.timeStamp,
      target: e.currentTarget,
    };
    suppressClick.current = false;

    if (e.currentTarget.dataset.backScroll !== undefined) {
      e.stopPropagation();
    }
  };

  const finishBackTouchGesture = (e: ReactTouchEvent<HTMLElement>) => {
    const g = backTouchGesture.current;
    backTouchGesture.current = null;
    const touch = e.changedTouches[0];
    if (!g || !touch) return;

    const scroller =
      g.target.dataset.backScroll !== undefined
        ? g.target
        : getBackScroller(g.target);
    const dir = resolveBackNav(
      g.y,
      touch.clientY,
      g.time,
      e.timeStamp,
      g.scrollTop,
      scroller?.scrollTop ?? 0,
      scroller,
    );

    if (dir) {
      suppressClick.current = true;
      goTo(dir);
    }

    if (e.currentTarget.dataset.backScroll !== undefined) {
      e.stopPropagation();
    }
  };

  const cancelBackTouchGesture = (e: ReactTouchEvent<HTMLElement>) => {
    backTouchGesture.current = null;
    if (e.currentTarget.dataset.backScroll !== undefined) {
      e.stopPropagation();
    }
  };

  const backPointerHandlers = {
    onPointerDown: beginBackGesture,
    onPointerMove: handleBackPointerMove,
    onPointerUp: finishBackGesture,
    onPointerCancel: cancelBackGesture,
    onTouchStart: beginBackTouchGesture,
    onTouchEnd: finishBackTouchGesture,
    onTouchCancel: cancelBackTouchGesture,
  };

  const handleBackClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setIsFlipped(false);
  };

  // A word can carry both flags, so render one pill per active flag (or a
  // neutral "Unseen" pill when it has neither).
  const FlagPills = ({ word }: { word: Word }) => (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {!word.mastered && !word.toughNut && (
        <span className="text-[8px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest border bg-gray-100 text-gray-500 border-gray-200">
          Unseen
        </span>
      )}
      {word.mastered && (
        <span className="text-[8px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest border bg-success-soft text-success-vibrant border-success-vibrant/20">
          Mastered ✓
        </span>
      )}
      {word.toughNut && (
        <span className="text-[8px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest border bg-warning-soft text-warning-vibrant border-warning-vibrant/20">
          Tough Nut 🥜
        </span>
      )}
    </div>
  );

  return (
    <div id="browse_tab" className="relative h-full flex flex-col bg-white">
      {/* ------------------------------------------------- In-card header (hidden while card is flipped) */}
      {!isFlipped && (
        <div className="px-5 pt-4 pb-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="px-2.5 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
              <span className="font-serif text-white text-base font-black leading-none tracking-tight">
                InstaGRE
              </span>
            </div>

            <button
              type="button"
              data-coach="browse-letter"
              onClick={() => setShowLetters(true)}
              className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full pl-3.5 pr-2.5 py-1.5 text-sm font-bold text-text-primary hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <span>{selectedLetter}</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Progress + front-mode toggles */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1">
              <p className="text-[11px] font-bold tracking-wider uppercase text-primary mb-1.5">
                {masteredInLetter} / {lettersTotal} Mastered ({percentage}%)
              </p>
              <div className="h-1.5 w-full bg-gray-150 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              data-coach="browse-definition"
              onClick={() => setShowDefinition((v) => !v)}
              title={showDefinition ? "Hide definition" : "Show definition"}
              aria-pressed={showDefinition}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                showDefinition
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {showDefinition ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------- Card stage */}
      {total === 0 || !current ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 text-gray-400 gap-2">
          <BookOpen className="w-12 h-12 stroke-1" />
          <p className="text-sm">
            No words starting with “{selectedLetter}” yet.
          </p>
          <button
            type="button"
            onClick={() => setShowLetters(true)}
            className="text-primary font-bold text-sm hover:underline cursor-pointer mt-1"
          >
            Pick another letter
          </button>
        </div>
      ) : (
        <div className="flex-1 relative [perspective:1600px] overflow-hidden">
          <AnimatePresence mode="wait" custom={swipeDir} onExitComplete={handleCardExitComplete}>
            <motion.div
              key={current.id}
              custom={swipeDir}
              initial={{ opacity: 0, y: swipeDir === "up" ? 120 : -120 }}
              animate={{ opacity: 1, y: 0, rotateY: isFlipped ? 180 : 0 }}
              exit={{
                opacity: 0,
                y: swipeDir === "up" ? -120 : 120,
                // Stay on the back face when navigating from a flipped card so the
                // front side never flashes during the swipe-out transition.
                rotateY: exitFlipped ? 180 : 0,
                transition: {
                  y: { type: "spring", damping: 26, stiffness: 170 },
                  opacity: { duration: 0.2 },
                  rotateY: { duration: 0 },
                },
              }}
              transition={{ type: "spring", damping: 26, stiffness: 170 }}
              drag={isFlipped ? false : "y"}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.6}
              onDragEnd={(_, info) => {
                const isSwipeGesture = Math.abs(info.velocity.y) > 300;
                const isLargeDrag = Math.abs(info.offset.y) > 100;

                if (isSwipeGesture || isLargeDrag) {
                  if (info.offset.y < 0 || info.velocity.y < 0) goTo("up");
                  else goTo("down");
                }
              }}
              className="absolute inset-0 [transform-style:preserve-3d]"
            >
              {/* ============================== FRONT FACE */}
              <div
                onClick={() => setIsFlipped(true)}
                className={`absolute inset-0 [backface-visibility:hidden] bg-white flex flex-col px-7 pt-2 pb-4 cursor-pointer ${
                  isFlipped ? "pointer-events-none" : ""
                }`}
              >
                <div
                  data-coach="browse-card"
                  className="flex-1 flex flex-col items-center justify-start text-center gap-3 pt-1"
                >
                  <FlagPills word={current} />

                  <h2 className="font-serif text-[52px] leading-[1.05] font-black text-text-primary tracking-tight select-none">
                    {current.word}
                  </h2>

                  <div className="flex items-center gap-3">
                    <span className="text-base text-gray-400 italic font-sans">
                      {current.ipa}
                    </span>
                    <button
                      type="button"
                      data-coach="browse-pronounce"
                      onClick={(e) => {
                        e.stopPropagation();
                        speakWord(current.word);
                      }}
                      className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
                      title="Hear pronunciation"
                    >
                      <Volume2 className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <span className="text-[11px] font-bold tracking-widest uppercase text-gray-500 border border-gray-200 rounded-full px-3.5 py-1">
                    {current.partOfSpeech}
                  </span>

                  {showDefinition && (
                    <p className="text-lg leading-relaxed text-text-secondary max-w-[300px] mt-2">
                      {current.definition}
                    </p>
                  )}
                </div>

                {/* Floating status actions */}
                <div
                  className="absolute right-5 bottom-10 flex flex-col items-center gap-2.5 opacity-70 hover:opacity-100 transition-opacity"
                  data-coach="browse-flags"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMastered(current, e.currentTarget);
                    }}
                    className={`w-11 h-11 rounded-full border-2 shadow-md flex items-center justify-center transition-colors cursor-pointer active:scale-95 ${
                      current.mastered
                        ? "bg-success-vibrant/90 border-success-vibrant text-white"
                        : "bg-white/70 border-success-vibrant/70 text-success-vibrant hover:bg-success-vibrant hover:text-white"
                    }`}
                    title={current.mastered ? "Unmark Mastered" : "Mark as Mastered"}
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTough(current, e.currentTarget);
                      }}
                      className={`w-11 h-11 rounded-full border-2 shadow-md flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                        current.toughNut
                          ? "bg-warning-vibrant/90 border-warning-vibrant text-white"
                          : "bg-white/70 border-warning-vibrant/70 text-warning-vibrant hover:bg-warning-vibrant hover:text-white"
                      }`}
                      title={current.toughNut ? "Unmark Tough Nut" : "Mark as Tough Nut"}
                    >
                      <Brain className="w-5 h-5" />
                    </button>
                    <span className="text-[9px] font-bold tracking-wider uppercase text-gray-400 leading-none text-center">
                      Tough
                      <br />
                      Nut
                    </span>
                  </div>
                </div>

                {/* Swipe hint */}
                <div
                  data-coach="browse-swipe"
                  className="flex flex-col items-center gap-1 select-none pointer-events-none"
                >
                  <span className="text-[11px] font-bold tracking-wider uppercase text-gray-400">
                    Word {focusIndex + 1} of {total}
                  </span>
                  <ChevronUp className="w-4 h-4 text-gray-300" />
                </div>
              </div>

              {/* ============================== BACK FACE */}
              <div
                onClick={handleBackClick}
                {...backPointerHandlers}
                className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white flex flex-col cursor-pointer [touch-action:pan-y] ${
                  isFlipped ? "" : "pointer-events-none"
                }`}
              >
                {/* Blue header */}
                <div className="bg-primary text-white px-7 pt-7 pb-6 shrink-0 relative overflow-hidden">
                  <BookOpen className="absolute -right-2 -bottom-3 w-28 h-28 text-white/5 -rotate-12 pointer-events-none" />
                  <div className="flex items-start justify-between relative z-10">
                    <div className="space-y-2">
                      <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
                        {current.partOfSpeech}
                      </span>
                      <h3 className="font-serif text-[40px] leading-none font-black">
                        {current.word}
                      </h3>
                      <p className="text-sm text-white/80 italic font-sans">
                        {current.ipa}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        speakWord(current.word);
                      }}
                      className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="Hear pronunciation"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Scrollable detail body */}
                <div
                  data-back-scroll
                  {...backPointerHandlers}
                  className="flex-1 overflow-y-auto px-7 py-5 space-y-5"
                >
                  <section className="space-y-1.5">
                    <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-text-secondary">
                      Definition
                    </h5>
                    <p className="text-[15px] leading-relaxed text-text-primary">
                      {current.definition}
                    </p>
                  </section>

                  {current.examples.length > 0 && (
                    <section className="space-y-2">
                      <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-text-secondary">
                        Example Sentences
                      </h5>
                      <div className="space-y-2">
                        {current.examples.map((ex, i) => (
                          <p
                            key={i}
                            className="text-sm italic text-text-secondary leading-relaxed bg-gray-50 border-l-2 border-primary rounded-r-lg pl-3 pr-3 py-2.5"
                          >
                            “{highlightWord(ex, current.word)}”
                          </p>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="grid grid-cols-2 gap-5">
                    <section className="space-y-2">
                      <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-text-secondary">
                        Synonyms
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                        {current.synonyms.map((s) => (
                          <span
                            key={s}
                            className="bg-gray-100 text-text-secondary text-xs font-medium px-2.5 py-1 rounded-md uppercase tracking-wide"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </section>
                    <section className="space-y-2">
                      <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-text-secondary">
                        Antonyms
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                        {current.antonyms.map((a) => (
                          <span
                            key={a}
                            className="bg-gray-100 text-text-secondary text-xs font-medium px-2.5 py-1 rounded-md uppercase tracking-wide"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>

                {/* Floating status actions (mirrors the front face) */}
                <div
                  className="absolute right-5 bottom-10 z-20 flex flex-col items-center gap-2.5 opacity-70 hover:opacity-100 transition-opacity"
                  data-coach="browse-flags"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMastered(current, e.currentTarget);
                    }}
                    className={`w-11 h-11 rounded-full border-2 shadow-md flex items-center justify-center transition-colors cursor-pointer active:scale-95 ${
                      current.mastered
                        ? "bg-success-vibrant/90 border-success-vibrant text-white"
                        : "bg-white/70 border-success-vibrant/70 text-success-vibrant hover:bg-success-vibrant hover:text-white"
                    }`}
                    title={current.mastered ? "Unmark Mastered" : "Mark as Mastered"}
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTough(current, e.currentTarget);
                      }}
                      className={`w-11 h-11 rounded-full border-2 shadow-md flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                        current.toughNut
                          ? "bg-warning-vibrant/90 border-warning-vibrant text-white"
                          : "bg-white/70 border-warning-vibrant/70 text-warning-vibrant hover:bg-warning-vibrant hover:text-white"
                      }`}
                      title={current.toughNut ? "Unmark Tough Nut" : "Mark as Tough Nut"}
                    >
                      <Brain className="w-5 h-5" />
                    </button>
                    <span className="text-[9px] font-bold tracking-wider uppercase text-gray-400 leading-none text-center">
                      Tough
                      <br />
                      Nut
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1 pb-4 select-none pointer-events-none">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-gray-400">
                    Word {focusIndex + 1} of {total}
                  </span>
                  <ChevronUp className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Floating icon flies toward Mastered / Tough Nut tab */}
      {showBrowseTour && !isFlipped && (
        <CoachMarkTour steps={BROWSE_COACH_STEPS} onComplete={completeBrowseTour} />
      )}

      {iconFlies.map((fly) => {
        const dx = fly.to.x - fly.from.x;
        const dy = fly.to.y - fly.from.y;
        const isMastered = fly.target === "mastered";

        return createPortal(
          <motion.div
            key={fly.id}
            className={`fixed z-[100] pointer-events-none w-11 h-11 rounded-full border-2 shadow-lg flex items-center justify-center ${
              isMastered
                ? "bg-success-vibrant/90 border-success-vibrant text-white"
                : "bg-warning-vibrant/90 border-warning-vibrant text-white"
            }`}
            style={{
              left: fly.from.x,
              top: fly.from.y,
            }}
            initial={{ x: "-50%", y: "-50%", opacity: 1, scale: 1 }}
            animate={{
              x: `calc(-50% + ${dx}px)`,
              y: `calc(-50% + ${dy}px)`,
              opacity: 0,
              scale: 0.45,
            }}
            transition={{ duration: 0.72, ease: [0.32, 0.72, 0, 1] }}
            onAnimationComplete={() => {
              removeIconFly(fly.id);
              pulseNavTab(fly.target);
            }}
          >
            {isMastered ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <Brain className="w-5 h-5" />
            )}
          </motion.div>,
          document.body,
        );
      })}

      {/* ------------------------------------------------- Letter overlay */}
      <AnimatePresence>
        {showLetters && (
          <LetterSelectorModal
            show={showLetters}
            onClose={() => setShowLetters(false)}
            selectedLetter={selectedLetter}
            onSelectLetter={onSetSelectedLetter}
            words={words}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

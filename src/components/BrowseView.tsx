import { useState, useEffect, useRef, type PointerEvent } from "react";
import { Word, WordStatus } from "../types";
import { speakWord } from "../utils/speech";
import {
  Volume2,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BrowseViewProps {
  words: Word[];
  selectedLetter: string;
  onSetSelectedLetter: (letter: string) => void;
  onUpdateStatus: (wordId: string, newStatus: WordStatus) => void;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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
  onSetSelectedLetter,
  onUpdateStatus,
}: BrowseViewProps) {
  const [focusIndex, setFocusIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showDefinition, setShowDefinition] = useState(true);
  const [showLetters, setShowLetters] = useState(false);
  const [swipeDir, setSwipeDir] = useState<"up" | "down">("up");

  // Tracks a pointer gesture on the (flipped) back face so we can tell a
  // navigation flick apart from a content scroll. Framer's drag="y" can't
  // see gestures that start inside the back face's overflow-y-auto scroller,
  // so the back face navigates via these handlers instead.
  const backGesture = useRef<{ y: number; scrollTop: number; time: number } | null>(null);
  const suppressClick = useRef(false);

  const lettersWords = words
    .filter((w) => w.word.toUpperCase().startsWith(selectedLetter))
    .sort((a, b) => a.word.localeCompare(b.word));

  // Learned words leave the browse stack; Tough Nut + Unseen stay visible here.
  const filteredWords = lettersWords.filter((w) => w.status !== "Learned It");

  const total = filteredWords.length;
  const lettersTotal = lettersWords.length;
  const learnedInLetter = lettersWords.filter(
    (w) => w.status === "Learned It",
  ).length;
  const percentage =
    lettersTotal > 0 ? Math.round((learnedInLetter / lettersTotal) * 100) : 0;

  // Keep focusIndex valid when the letter (and therefore the list) changes.
  useEffect(() => {
    setFocusIndex(0);
    setIsFlipped(false);
  }, [selectedLetter]);

  // When a word leaves the stack (marked Learned) the list shrinks; clamp the
  // focus so we never point past the end and the next word slides into view.
  useEffect(() => {
    if (total > 0 && focusIndex >= total) setFocusIndex(total - 1);
  }, [total, focusIndex]);

  const current = filteredWords[focusIndex];

  const goTo = (dir: "up" | "down") => {
    if (total === 0) return;
    setSwipeDir(dir);
    setIsFlipped(false);
    setFocusIndex((prev) =>
      dir === "up" ? (prev + 1) % total : (prev - 1 + total) % total,
    );
  };

  // Marking Learned removes the word from this stack, so the next word slides
  // into the current index on its own — we just animate up and unflip. (The
  // clamp effect handles the case where the removed word was the last one.)
  const markLearned = (wordId: string) => {
    setSwipeDir("up");
    setIsFlipped(false);
    onUpdateStatus(wordId, "Learned It");
  };

  const getBackScroller = (root: HTMLElement) =>
    root.querySelector<HTMLElement>("[data-back-scroll]");

  const handleBackPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const scroller = getBackScroller(e.currentTarget);
    backGesture.current = {
      y: e.clientY,
      scrollTop: scroller?.scrollTop ?? 0,
      time: e.timeStamp,
    };
    suppressClick.current = false;
  };

  const handleBackPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = backGesture.current;
    backGesture.current = null;
    if (!g) return;

    const scroller = getBackScroller(e.currentTarget);
    // If the content actually scrolled during this gesture, it was a scroll,
    // not a navigation swipe — leave the card where it is.
    const scrolled = Math.abs((scroller?.scrollTop ?? 0) - g.scrollTop) > 4;
    const dy = g.y - e.clientY; // positive => moved up
    const dt = e.timeStamp - g.time;
    const velocity = dt > 0 ? dy / dt : 0; // px per ms

    const isFlick = Math.abs(velocity) > 0.4 || Math.abs(dy) > 70;

    if (!scrolled && isFlick) {
      suppressClick.current = true; // don't let the trailing click unflip
      goTo(dy > 0 ? "up" : "down");
    }
  };

  const handleBackClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setIsFlipped(false);
  };

  const letterPercentage = (letter: string) => {
    const inLetter = words.filter((w) =>
      w.word.toUpperCase().startsWith(letter),
    );
    if (inLetter.length === 0) return { count: 0, pct: 0 };
    const learned = inLetter.filter((w) => w.status === "Learned It").length;
    return {
      count: inLetter.length,
      pct: Math.round((learned / inLetter.length) * 100),
    };
  };

  const statusPill = (status: WordStatus) =>
    status === "Learned It"
      ? "bg-success-soft text-success-vibrant border-success-vibrant/20"
      : status === "Tough Nut"
        ? "bg-warning-soft text-warning-vibrant border-warning-vibrant/20"
        : "bg-gray-100 text-gray-500 border-gray-200";

  return (
    <div id="browse_tab" className="relative h-full flex flex-col bg-white">
      {/* ------------------------------------------------- In-card header (hidden while card is flipped) */}
      {!isFlipped && (
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
              <span className="font-serif text-white text-lg font-black leading-none">
                W
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowLetters(true)}
              className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full pl-3.5 pr-2.5 py-1.5 text-sm font-bold text-text-primary hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <span>{selectedLetter}</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Progress + front-mode toggles */}
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1">
              <p className="text-[11px] font-bold tracking-wider uppercase text-primary mb-1.5">
                {learnedInLetter} / {lettersTotal} Learned ({percentage}%)
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
          <AnimatePresence mode="wait" custom={swipeDir}>
            <motion.div
              key={current.id}
              custom={swipeDir}
              initial={{ opacity: 0, y: swipeDir === "up" ? 120 : -120 }}
              animate={{ opacity: 1, y: 0, rotateY: isFlipped ? 180 : 0 }}
              exit={{
                opacity: 0,
                y: swipeDir === "up" ? -120 : 120,
                // Snap the flip back to the front instantly so the outgoing card
                // never slides away showing its (mirrored) back-face content.
                rotateY: 0,
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
                className={`absolute inset-0 [backface-visibility:hidden] bg-white flex flex-col px-7 pt-6 pb-5 cursor-pointer ${
                  isFlipped ? "pointer-events-none" : ""
                }`}
              >
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                  <span
                    className={`text-[8px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest border ${statusPill(
                      current.status,
                    )}`}
                  >
                    {current.status}
                  </span>

                  <h2 className="font-serif text-[52px] leading-[1.05] font-black text-text-primary tracking-tight select-none">
                    {current.word}
                  </h2>

                  <div className="flex items-center gap-3">
                    <span className="text-base text-gray-400 italic font-sans">
                      {current.ipa}
                    </span>
                    <button
                      type="button"
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
                <div className="absolute right-5 bottom-20 flex flex-col items-center gap-3 opacity-70 hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      markLearned(current.id);
                    }}
                    className={`w-11 h-11 rounded-full border-2 shadow-md flex items-center justify-center transition-colors cursor-pointer active:scale-95 ${
                      current.status === "Learned It"
                        ? "bg-success-vibrant/90 border-success-vibrant text-white"
                        : "bg-white/70 border-success-vibrant/70 text-success-vibrant hover:bg-success-vibrant hover:text-white"
                    }`}
                    title="Mark as Learned"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(current.id, "Tough Nut");
                        goTo("up");
                      }}
                      className={`w-11 h-11 rounded-full border-2 shadow-md flex items-center justify-center text-xl transition-all cursor-pointer active:scale-95 ${
                        current.status === "Tough Nut"
                          ? "bg-warning-vibrant/90 border-warning-vibrant"
                          : "bg-white/70 border-warning-soft hover:scale-105"
                      }`}
                      title="Mark as Tough Nut"
                    >
                      🥜
                    </button>
                    <span className="text-[9px] font-bold tracking-wider uppercase text-gray-400 leading-none text-center">
                      Tough
                      <br />
                      Nut
                    </span>
                  </div>
                </div>

                {/* Swipe hint */}
                <div className="flex flex-col items-center gap-1 select-none pointer-events-none">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-gray-400">
                    Word {focusIndex + 1} of {total}
                  </span>
                  <ChevronUp className="w-4 h-4 text-gray-300" />
                </div>
              </div>

              {/* ============================== BACK FACE */}
              <div
                onClick={handleBackClick}
                onPointerDown={handleBackPointerDown}
                onPointerUp={handleBackPointerUp}
                onPointerCancel={() => {
                  backGesture.current = null;
                }}
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
                  className="absolute right-5 bottom-20 z-20 flex flex-col items-center gap-3 opacity-70 hover:opacity-100 transition-opacity"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      markLearned(current.id);
                    }}
                    className={`w-11 h-11 rounded-full border-2 shadow-md flex items-center justify-center transition-colors cursor-pointer active:scale-95 ${
                      current.status === "Learned It"
                        ? "bg-success-vibrant/90 border-success-vibrant text-white"
                        : "bg-white/70 border-success-vibrant/70 text-success-vibrant hover:bg-success-vibrant hover:text-white"
                    }`}
                    title="Mark as Learned"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(current.id, "Tough Nut");
                        goTo("up");
                      }}
                      className={`w-11 h-11 rounded-full border-2 shadow-md flex items-center justify-center text-xl transition-all cursor-pointer active:scale-95 ${
                        current.status === "Tough Nut"
                          ? "bg-warning-vibrant/90 border-warning-vibrant"
                          : "bg-white/70 border-warning-soft hover:scale-105"
                      }`}
                      title="Mark as Tough Nut"
                    >
                      🥜
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

      {/* ------------------------------------------------- Letter overlay */}
      <AnimatePresence>
        {showLetters && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-white/80 backdrop-blur-md flex flex-col"
          >
            <div className="flex justify-end p-4">
              <button
                type="button"
                onClick={() => setShowLetters(false)}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close letter selector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center px-6">
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-400">
                Alphabet Navigation
              </p>
              <h3 className="font-sans text-lg font-semibold text-text-primary mt-1">
                Select a letter to explore words
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
                {ALPHABET.map((letter) => {
                  const { count, pct } = letterPercentage(letter);
                  const isSelected = selectedLetter === letter;
                  const isEmpty = count === 0;
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={isEmpty}
                      onClick={() => {
                        onSetSelectedLetter(letter);
                        setShowLetters(false);
                      }}
                      className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-primary text-white shadow-md"
                          : isEmpty
                            ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                            : "bg-white border border-gray-150 text-text-primary hover:border-primary hover:scale-[1.03]"
                      }`}
                    >
                      <span className="font-serif text-2xl font-bold leading-none">
                        {letter}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          isSelected ? "text-white/80" : "text-gray-400"
                        }`}
                      >
                        {pct}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

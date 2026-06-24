import { useState } from "react";
import { Word, WordFlags } from "../types";
import { speakWord } from "../utils/speech";
import { Volume2, ChevronRight, CheckCircle2, ChevronDown, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatDefinitions } from "../utils/wordContent";
import LetterSelectorModal from "./LetterSelectorModal";

interface MasteredViewProps {
  words: Word[];
  selectedLetter: string;
  onSetSelectedLetter: (letter: string) => void;
  onSetFlags: (wordId: string, flags: Partial<WordFlags>) => void;
  onNavigateToBrowseLetter: (letter: string) => void;
}

export default function MasteredView({
  words,
  selectedLetter,
  onSetSelectedLetter,
  onSetFlags,
  onNavigateToBrowseLetter,
}: MasteredViewProps) {
  const [openWordId, setOpenWordId] = useState<string | null>(null);
  const [showLetters, setShowLetters] = useState(false);

  const masteredWords = words.filter((w) => w.mastered);

  const wordsInLetter = words.filter((w) =>
    w.word.toUpperCase().startsWith(selectedLetter),
  );
  const masteredInLetter = wordsInLetter.filter((w) => w.mastered);
  const lettersTotal = wordsInLetter.length;
  const percentage =
    lettersTotal > 0
      ? Math.round((masteredInLetter.length / lettersTotal) * 100)
      : 0;

  const filteredMastered = masteredInLetter.sort((a, b) =>
    a.word.localeCompare(b.word),
  );

  return (
    <div id="mastered_tab" className="relative h-full flex flex-col bg-white">
      {/* Header — same top row as Browse (logo left, letter picker right) */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="px-2.5 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
            <span className="font-serif text-white text-base font-black leading-none tracking-tight">
              InstaGRE
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowLetters(true)}
            aria-label="Select letter"
            className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full pl-3.5 pr-2.5 py-1.5 text-sm font-bold text-text-primary hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <span>{selectedLetter}</span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1">
            <p className="text-[11px] font-bold tracking-wider uppercase text-success-vibrant mb-1.5">
              {masteredInLetter.length} / {lettersTotal} Mastered ({percentage}%)
            </p>
            <div className="h-1.5 w-full bg-gray-150 rounded-full overflow-hidden">
              <div
                className="h-full bg-success-vibrant rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="bg-success-soft text-success-vibrant font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1 text-sm border border-success-vibrant/25 shadow-xs shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>{masteredWords.length}</span>
          </div>
        </div>
      </div>

      {/* Main listing */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {masteredWords.length === 0 ? (
          <div className="bg-success-soft/30 py-16 px-6 rounded-2xl border border-success-vibrant/10 text-center text-success-vibrant/65 space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto stroke-1" />
            <h4 className="font-serif font-bold text-base">
              Your dictionary is currently empty
            </h4>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Swipe words to &ldquo;Mastered&rdquo; inside the Browse section
              to see them tracked securely here. Use the letter button in the
              top right to filter by letter.
            </p>
          </div>
        ) : filteredMastered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 text-gray-400 gap-2 py-16">
            <BookOpen className="w-12 h-12 stroke-1" />
            <p className="text-sm">
              No mastered words starting with &ldquo;{selectedLetter}&rdquo; yet.
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
          <div className="space-y-3">
            {filteredMastered.map((word) => {
              const isOpen = openWordId === word.id;

              return (
                <div
                  key={word.id}
                  className="bg-white rounded-xl border border-gray-150 overflow-hidden transition-all duration-200 shadow-xs hover:border-success-vibrant/35"
                >
                  <div
                    onClick={() => setOpenWordId(isOpen ? null : word.id)}
                    className="p-4 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-success-soft text-success-vibrant flex items-center justify-center font-bold font-serif text-sm">
                        {word.word.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-gray-900 group-hover:text-success-vibrant text-base leading-tight">
                          {word.word}
                        </h4>
                        <p className="text-xs text-gray-400 italic mt-0.5">
                          {word.ipa}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {word.toughNut && (
                        <span className="text-[9px] font-bold text-warning-vibrant bg-warning-soft px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Tough 🥜
                        </span>
                      )}
                      <span className="text-[9px] font-bold text-success-vibrant bg-success-soft px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Mastered
                      </span>
                      <ChevronRight
                        className={`w-4 h-4 text-gray-400 transform transition-transform ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="bg-gray-50 border-t border-gray-100 overflow-hidden"
                      >
                        <div className="p-4 space-y-4 text-sm select-text">
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1">
                              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                                Definition
                              </p>
                              <p className="text-gray-800 font-sans leading-relaxed">
                              <p className="text-[11px] text-gray-500 line-clamp-2">
                                {formatDefinitions(word.definitions)}
                              </p>
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => speakWord(word.word)}
                              className="bg-primary/5 hover:bg-primary/10 text-primary p-2 rounded-full cursor-pointer transition-transform shrink-0"
                              title="Play pronunciation"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>

                          {word.examples.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                                Context Use
                              </p>
                              <p className="text-xs text-gray-600 italic bg-white p-2.5 rounded-xl border border-gray-100 leading-relaxed">
                                &ldquo;{word.examples[0]}&rdquo;
                              </p>
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-2.5 border-t border-gray-100 text-[11px] font-sans font-bold">
                            <button
                              type="button"
                              onClick={() =>
                                onNavigateToBrowseLetter(
                                  word.word.toUpperCase().charAt(0),
                                )
                              }
                              className="text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              Browse Full Letter{" "}
                              {word.word.toUpperCase().charAt(0)} Feed &rarr;
                            </button>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  onSetFlags(word.id, {
                                    toughNut: !word.toughNut,
                                  })
                                }
                                className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  word.toughNut
                                    ? "text-warning-vibrant bg-warning-soft border-warning-vibrant/30"
                                    : "text-warning-vibrant bg-white hover:bg-warning-soft border-gray-150"
                                }`}
                              >
                                {word.toughNut
                                  ? "Tough Nut 🥜"
                                  : "Flag Tough Nut 🥜"}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  onSetFlags(word.id, { mastered: false });
                                  setOpenWordId(null);
                                }}
                                className="text-gray-500 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-150 transition-colors cursor-pointer"
                              >
                                Remove from Mastered
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showLetters && (
          <LetterSelectorModal
            show={showLetters}
            onClose={() => setShowLetters(false)}
            selectedLetter={selectedLetter}
            onSelectLetter={onSetSelectedLetter}
            words={words}
            disableWhen="no-mastered"
            heading="Mastered by Letter"
            subheading="Select a letter to review mastered words"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

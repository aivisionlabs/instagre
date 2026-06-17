import { useState } from 'react';
import { Word, WordStatus } from '../types';
import { speakWord } from '../utils/speech';
import { Volume2, ChevronRight, CheckCircle2, Bookmark, RefreshCw, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LearnedViewProps {
  words: Word[];
  onUpdateStatus: (wordId: string, newStatus: WordStatus) => void;
  onNavigateToBrowseLetter: (letter: string) => void;
}

export default function LearnedView({ 
  words, 
  onUpdateStatus, 
  onNavigateToBrowseLetter 
}: LearnedViewProps) {
  const [selectedLetterTab, setSelectedLetterTab] = useState<string>('All');
  const [openWordId, setOpenWordId] = useState<string | null>(null);

  const learnedWords = words.filter(w => w.status === 'Learned It');

  // Find unique starting letters of learned words
  const startingLetters = Array.from(
    new Set(learnedWords.map(w => w.word.toUpperCase().charAt(0)))
  ).sort();

  const filteredLearned = learnedWords.filter(word => {
    if (selectedLetterTab === 'All') return true;
    return word.word.toUpperCase().startsWith(selectedLetterTab);
  }).sort((a, b) => a.word.localeCompare(b.word));

  return (
    <div id="learned_tab" className="space-y-4">
      {/* Header and stats */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-150">
        <div>
          <h3 className="font-serif text-xl font-bold text-success-vibrant">Mastered Vocabulary</h3>
          <p className="text-xs text-gray-500 font-medium">These words are checked off your study plan.</p>
        </div>
        <div className="bg-success-soft text-success-vibrant font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1 text-sm border border-success-vibrant/25 shadow-xs">
          <CheckCircle2 className="w-4 h-4" />
          <span>{learnedWords.length} Learned</span>
        </div>
      </div>

      {/* Ribbon jump menu filters */}
      {startingLetters.length > 0 && (
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-gray-200">
          <button
            onClick={() => setSelectedLetterTab('All')}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-colors cursor-pointer ${
              selectedLetterTab === 'All'
                ? 'bg-success-vibrant text-white font-extrabold'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Grouped
          </button>
          {startingLetters.map(letter => (
            <button
              key={letter}
              onClick={() => setSelectedLetterTab(letter)}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-colors cursor-pointer ${
                selectedLetterTab === letter
                  ? 'bg-success-vibrant text-white font-extrabold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {letter} ({learnedWords.filter(w => w.word.toUpperCase().startsWith(letter)).length})
            </button>
          ))}
        </div>
      )}

      {/* Main Listing View */}
      {learnedWords.length === 0 ? (
        <div className="bg-success-soft/30 py-16 px-6 rounded-2xl border border-success-vibrant/10 text-center text-success-vibrant/65 space-y-3">
          <CheckCircle2 className="w-12 h-12 mx-auto stroke-1" />
          <h4 className="font-serif font-bold text-base">Your dictionary is currently empty</h4>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Swipe words of various letters to "Learned It" inside the Browse section to see them tracked securely here.
          </p>
        </div>
      ) : filteredLearned.length === 0 ? (
        <div className="bg-white py-12 px-6 rounded-2xl border text-center text-gray-400">
          <p className="text-sm">No learned entries fit letter tab filter "{selectedLetterTab}".</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLearned.map((word) => {
            const isOpen = openWordId === word.id;

            return (
              <div 
                key={word.id}
                className="bg-white rounded-xl border border-gray-150 overflow-hidden transition-all duration-200 shadow-xs hover:border-success-vibrant/35"
              >
                {/* Row Header */}
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
                      <p className="text-xs text-gray-400 italic mt-0.5">{word.ipa}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-success-vibrant bg-success-soft px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Mastered
                    </span>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transform transition-transform ${
                      isOpen ? 'rotate-90' : ''
                    }`} />
                  </div>
                </div>

                {/* Extended Details card layout with transitions */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="bg-gray-50 border-t border-gray-100 overflow-hidden"
                    >
                      <div className="p-4 space-y-4 text-sm select-text">
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Definition</p>
                            <p className="text-gray-800 font-sans leading-relaxed">{word.definition}</p>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => speakWord(word.word)}
                            className="bg-primary/5 hover:bg-primary/10 text-primary p-2 rounded-full cursor-pointer transition-transform shrink-0"
                            title="Play pronunciation voice speaker helper"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>

                        {word.examples.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Context Use</p>
                            <p className="text-xs text-gray-600 italic bg-white p-2.5 rounded-xl border border-gray-100 leading-relaxed">
                              "{word.examples[0]}"
                            </p>
                          </div>
                        )}

                        {/* State alteration footer controls */}
                        <div className="flex justify-between items-center pt-2.5 border-t border-gray-100 text-[11px] font-sans font-bold">
                          <button
                            type="button"
                            onClick={() => onNavigateToBrowseLetter(word.word.toUpperCase().charAt(0))}
                            className="text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            Browse Full Letter {word.word.toUpperCase().charAt(0)} Feed &rarr;
                          </button>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateStatus(word.id, 'Tough Nut');
                                setOpenWordId(null);
                              }}
                              className="text-warning-vibrant bg-white hover:bg-warning-soft px-3 py-1.5 rounded-lg border border-gray-150 transition-colors cursor-pointer"
                            >
                              Move to Tough Nut 🥜
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateStatus(word.id, 'Unseen');
                                setOpenWordId(null);
                              }}
                              className="text-gray-500 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-150 transition-colors cursor-pointer"
                            >
                              Reset status
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
  );
}

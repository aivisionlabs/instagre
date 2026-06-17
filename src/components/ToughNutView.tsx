import { useState } from 'react';
import { Word, WordStatus } from '../types';
import { speakWord } from '../utils/speech';
import { Volume2, ChevronRight, AlertCircle, EyeOff, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ToughNutViewProps {
  words: Word[];
  onUpdateStatus: (wordId: string, newStatus: WordStatus) => void;
  onNavigateToBrowseLetter: (letter: string) => void;
}

export default function ToughNutView({
  words,
  onUpdateStatus,
  onNavigateToBrowseLetter
}: ToughNutViewProps) {
  const [openWordId, setOpenWordId] = useState<string | null>(null);

  const toughWords = words.filter(w => w.status === 'Tough Nut').sort((a, b) => a.word.localeCompare(b.word));

  return (
    <div id="tough_nut_tab" className="space-y-4">
      {/* Upper header summary */}
      <div className="bg-[#fff9f0] border border-warning-vibrant/20 p-4 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-warning-vibrant">
            <AlertCircle className="w-5 h-5 stroke-[2.5]" />
            <h3 className="font-serif text-lg font-bold text-[#7c2d12]">Tough Nuts List ({toughWords.length})</h3>
          </div>
          <p className="text-xs text-[#7c2d12]/80 leading-relaxed font-sans font-medium">
            These are difficult vocabulary words you have flagged as difficult. Repetition builds brain pathways!
          </p>
        </div>
      </div>

      {/* Primary Listing array */}
      {toughWords.length === 0 ? (
        <div className="bg-white py-16 px-6 rounded-2xl border text-center text-gray-400 space-y-3">
          <AlertCircle className="w-12 h-12 mx-auto stroke-1 text-gray-300" />
          <h4 className="font-serif font-bold text-base text-gray-700">No Tough Nuts identified yet!</h4>
          <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
            While studying words inside the Browse letter feed, swipe left or flag any difficult word as a "Tough Nut" to isolate it for focal drilling.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {toughWords.map((word) => {
            const isOpen = openWordId === word.id;

            return (
              <div 
                key={word.id}
                className="bg-white rounded-xl border border-gray-150 overflow-hidden transition-all duration-200 shadow-xs hover:border-warning-vibrant/35"
              >
                {/* Collapsed Top Header row */}
                <div 
                  onClick={() => setOpenWordId(isOpen ? null : word.id)}
                  className="p-4 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-warning-soft text-warning-vibrant flex items-center justify-center font-bold font-serif text-sm">
                      {word.word.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-gray-900 group-hover:text-warning-vibrant text-base leading-tight">
                        {word.word}
                      </h4>
                      <p className="text-xs text-gray-400 italic mt-0.5">{word.ipa}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-warning-vibrant bg-warning-soft px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Troublesome
                    </span>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transform transition-transform ${
                      isOpen ? 'rotate-90' : ''
                    }`} />
                  </div>
                </div>

                {/* Expanded contents block cards */}
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
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">Definition</p>
                            <p className="text-gray-850 font-sans leading-relaxed">{word.definition}</p>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => speakWord(word.word)}
                            className="bg-primary/5 hover:bg-primary/10 text-primary p-2 rounded-full cursor-pointer transition-transform shrink-0"
                            title="Play pronunciation voice speech assistance"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>

                        {word.examples.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">Context Use</p>
                            <p className="text-xs text-grat-600 italic bg-white p-2.5 border border-gray-100 rounded-xl leading-relaxed">
                              "{word.examples[0]}"
                            </p>
                          </div>
                        )}

                        {/* Alter state controls list */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-gray-100 text-[11px] font-sans font-bold w-full">
                          <button
                            type="button"
                            onClick={() => onNavigateToBrowseLetter(word.word.toUpperCase().charAt(0))}
                            className="text-primary hover:underline flex items-center gap-0.5 cursor-pointer leading-none"
                          >
                            Browse Full Letter {word.word.toUpperCase().charAt(0)} Feed &rarr;
                          </button>

                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateStatus(word.id, 'Learned It');
                                setOpenWordId(null);
                              }}
                              className="w-1/2 sm:w-auto text-success-vibrant bg-white hover:bg-success-soft px-3 py-1.5 rounded-lg border border-gray-150 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span>Learned It</span>
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateStatus(word.id, 'Unseen');
                                setOpenWordId(null);
                              }}
                              className="w-1/2 sm:w-auto text-gray-500 bg-white hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-150 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Reset to Unseen</span>
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

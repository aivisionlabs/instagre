import { useState, useEffect } from 'react';
import { Word, WordFlags, QuizQuestion, TestHistory } from '../types';
import { Award, Play, Volume2, HelpCircle, Check, X, ShieldAlert, Zap, History, RotateCcw, AlertTriangle, BookOpen, Brain } from 'lucide-react';
import { speakWord } from '../utils/speech';
import { formatDefinitions, primaryDefinition } from '../utils/wordContent';

interface TestsViewProps {
  words: Word[];
  onSetFlags: (wordId: string, flags: Partial<WordFlags>) => void;
  initialSelectedMode?: string | null; // e.g. "Tough Nut Drill" or "By Letter: A"
}

export default function TestsView({
  words,
  onSetFlags,
  initialSelectedMode = null
}: TestsViewProps) {
  const [activeScreen, setActiveScreen] = useState<'lobby' | 'quiz' | 'results'>('lobby');
  const [selectedLetter, setSelectedLetter] = useState<string>('A');
  const [quizMode, setQuizMode] = useState<string>('Letter'); // 'Letter' | 'Full' | 'Tough'
  
  // Quiz session state variables
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [answeredCorrectlyCount, setAnsweredCorrectlyCount] = useState(0);
  const [incorrectWords, setIncorrectWords] = useState<Word[]>([]);
  const [currentTestName, setCurrentTestName] = useState<string>('');
  
  // History tracking state
  const [historyList, setHistoryList] = useState<TestHistory[]>([]);

  // Load history on mount
  useEffect(() => {
    const cached = localStorage.getItem('instagre_test_history');
    if (cached) {
      try {
        setHistoryList(JSON.parse(cached));
      } catch (err) {
        console.error('Error loading test history from local storage:', err);
      }
    }
  }, []);

  // Handle immediate external game launch trigger (e.g. from Dashboard or Tough Nut quick drill)
  useEffect(() => {
    if (initialSelectedMode) {
      if (initialSelectedMode === 'Tough Nut Drill') {
        launchQuiz('Tough');
      } else if (initialSelectedMode.startsWith('By Letter: ')) {
        const letter = initialSelectedMode.replace('By Letter: ', '');
        setSelectedLetter(letter);
        launchQuiz('Letter', letter);
      }
    }
  }, [initialSelectedMode]);

  // Letters supporting testing
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Generate randomized quiz helper
  const launchQuiz = (mode: string, letterVal?: string) => {
    let sourceWords: Word[] = [];
    let titleStr = '';

    if (mode === 'Tough') {
      sourceWords = words.filter(w => w.toughNut);
      titleStr = 'Tough Nut Drill';
    } else if (mode === 'Full') {
      // test on all words that started to be learned
      sourceWords = words.filter(w => w.mastered);
      titleStr = 'Comprehensive Full Test';
      if (sourceWords.length === 0) {
        sourceWords = words; // fallback
        titleStr = 'Universal Warmup Test';
      }
    } else {
      const activeLetter = letterVal || selectedLetter;
      sourceWords = words.filter(w => w.word.toUpperCase().startsWith(activeLetter));
      titleStr = `Letter ${activeLetter} Progress Test`;
    }

    if (sourceWords.length === 0) {
      alert(`No words available for this testing mode.`);
      return;
    }

    // Prepare questions. We limit to 10 questions max per run to keep it snappy.
    const subset = [...sourceWords].sort(() => 0.5 - Math.random()).slice(0, 10);
    const quizQuestions: QuizQuestion[] = subset.map((word, idx) => {
      // Randomize quiz type: 0 = Multiple Choice, 1 = Flashcard Recall, 2 = Fill in the Blank
      const typeRand = Math.floor(Math.random() * 3);
      const questionId = `q_${idx}_${Date.now()}`;

      if (typeRand === 0) {
        // Multiple choice
        // Get 3 incorrect distractor definitions
        const otherDefs = words
          .filter(w => w.id !== word.id)
          .map(w => primaryDefinition(w.definitions));
        const distractors = otherDefs.sort(() => 0.5 - Math.random()).slice(0, 3);
        const answer = primaryDefinition(word.definitions);
        const options = [answer, ...distractors].sort(() => 0.5 - Math.random());

        return {
          id: questionId,
          type: 'multiple-choice',
          word,
          questionText: `What is the precise definition of the GRE word "${word.word}"?`,
          options,
          correctAnswer: answer
        };
      } else if (typeRand === 1) {
        // Flashcard recall
        const answer = primaryDefinition(word.definitions);
        return {
          id: questionId,
          type: 'flashcard-recall',
          word,
          questionText: `Do you recall the correct GRE vocabulary word corresponding to this definition?\n\n"${answer}"`,
          correctAnswer: word.word
        };
      } else {
        // Fill in the blank
        // Clean up example sentence with blank space
        let sentenceWithBlank = 'No context sentence template available.';
        if (word.examples && word.examples.length > 0) {
          const original = word.examples[0];
          // Replace case-insensitive occurrence of the word with a blank strip
          const regex = new RegExp(`\\b${word.word}\\w*\\b`, 'gi');
          sentenceWithBlank = original.replace(regex, '________');
        }

        // Get 3 distractor words
        const otherWords = words
          .filter(w => w.id !== word.id)
          .map(w => w.word);
        const distractors = otherWords.sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [word.word, ...distractors].sort(() => 0.5 - Math.random());

        return {
          id: questionId,
          type: 'fill-in-blank',
          word,
          questionText: `Choose the correct GRE word that fits in the context blank:`,
          sentenceWithBlank,
          options,
          correctAnswer: word.word
        };
      }
    });

    setQuestions(quizQuestions);
    setCurrentQuestionIdx(0);
    setSelectedOption(null);
    setIsAnswerRevealed(false);
    setAnsweredCorrectlyCount(0);
    setIncorrectWords([]);
    setCurrentTestName(titleStr);
    setActiveScreen('quiz');
  };

  const handleSelectOption = (opt: string) => {
    if (isAnswerRevealed) return;
    setSelectedOption(opt);
    setIsAnswerRevealed(true);

    const question = questions[currentQuestionIdx];
    if (opt === question.correctAnswer) {
      setAnsweredCorrectlyCount(prev => prev + 1);
    } else {
      setIncorrectWords(prev => [...prev, question.word]);
    }
  };

  const handleFlashcardSelfRate = (gotIt: boolean) => {
    setIsAnswerRevealed(true);
    const question = questions[currentQuestionIdx];
    
    if (gotIt) {
      setAnsweredCorrectlyCount(prev => prev + 1);
    } else {
      setIncorrectWords(prev => [...prev, question.word]);
    }

    // Immediately push to next step since they rated
    setTimeout(() => {
      advanceQuiz();
    }, 800);
  };

  const advanceQuiz = () => {
    setSelectedOption(null);
    setIsAnswerRevealed(false);

    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else {
      // Finished all questions! Gather score and save history
      const finalScore = answeredCorrectlyCount;
      const totalQuestions = questions.length;
      const finalPercent = Math.round((finalScore / totalQuestions) * 100);

      const record: TestHistory = {
        id: `h_${Date.now()}`,
        score: finalScore,
        total: totalQuestions,
        percentage: finalPercent,
        date: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        mode: currentTestName
      };

      const updatedHistory = [record, ...historyList].slice(0, 30); // limit to 30 histories
      setHistoryList(updatedHistory);
      localStorage.setItem('instagre_test_history', JSON.stringify(updatedHistory));

      setActiveScreen('results');
    }
  };

  // One-tap force status to Tough Nut
  const markIncorrectAsTough = (wordId: string) => {
    onSetFlags(wordId, { toughNut: true });
  };

  const clearHistoryLog = () => {
    if (confirm('Are you sure you want to clear your test history?')) {
      setHistoryList([]);
      localStorage.removeItem('instagre_test_history');
    }
  };

  return (
    <div id="tests_container" className="space-y-4">
      
      {/* 1. QUIZ LOBBY SCREEN */}
      {activeScreen === 'lobby' && (
        <div className="space-y-6">
          <div className="pb-2 border-b border-gray-150 space-y-1">
            <h3 className="font-serif text-xl font-bold text-primary">Vocabulary Practice Arena</h3>
            <p className="text-xs text-text-secondary leading-normal font-sans">
              Test your recall of spelling, definitions, and context clues with multi-mode randomized testing.
            </p>
          </div>

          {/* Setup controls cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* By Letter Select Card */}
            <div className="bg-white p-5 rounded-2xl border border-gray-150 space-y-4 flex flex-col justify-between shadow-xs">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-primary font-serif font-black text-base">
                  <Play className="w-5 h-5" />
                  <span>By Letter Sprint</span>
                </div>
                <p className="text-xs text-gray-500 font-sans leading-relaxed">
                  Focus purely on GRE vocabulary starting with your selected alphabetical subset.
                </p>

                {/* Letter Picker Grid */}
                <div className="grid grid-cols-6 gap-1 pt-1">
                  {alphabet.slice(0, 12).map(l => (
                    <button
                      key={l}
                      onClick={() => setSelectedLetter(l)}
                      className={`text-xs py-1.5 rounded-lg font-bold border transition-colors cursor-pointer ${
                        selectedLetter === l
                          ? 'bg-primary text-white border-primary'
                          : 'bg-gray-50 border-gray-150 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => launchQuiz('Letter')}
                className="btn-3d w-full mt-2 bg-primary text-white py-2.5 rounded-xl font-bold text-xs cursor-pointer uppercase font-sans tracking-wide"
              >
                Launch Letter {selectedLetter} Test &rarr;
              </button>
            </div>

            {/* Other Modes selector Card */}
            <div className="bg-white p-5 rounded-2xl border border-gray-150 space-y-4 flex flex-col justify-between shadow-xs">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary font-serif font-black text-base">
                  <Zap className="w-5 h-5 text-warning-vibrant" />
                  <span>Drill and Practice Modes</span>
                </div>
                
                {/* Full Test trigger */}
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-150 flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-xs text-gray-800">Comprehensive Full Test</h5>
                    <p className="text-[11px] text-gray-400">Randomized 10-word quiz from all loaded words.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => launchQuiz('Full')}
                    className="bg-primary/10 hover:bg-primary/20 text-primary hover:underline px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-colors"
                  >
                    Start
                  </button>
                </div>

                {/* Tough Nut Drill trigger */}
                <div className="bg-[#fff9f0] p-3 rounded-xl border border-warning-vibrant/20 flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-xs text-warning-vibrant">Tough Nut Focal Drill</h5>
                    <p className="text-[11px] text-gray-500">Practice questions covering ONLY flagged tough words.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => launchQuiz('Tough')}
                    className="bg-warning-vibrant text-white hover:bg-[#b45309] px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-colors"
                  >
                    Drill
                  </button>
                </div>
              </div>

              <div className="text-[10px] text-gray-400 italic font-sans">
                Tests are generated on-the-fly inside the client cache. No external connection required!
              </div>
            </div>
          </div>

          {/* Test history log listing */}
          <div className="bg-white rounded-2xl border border-gray-150 p-5 space-y-4 shadow-xs">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="flex items-center gap-1.5 text-gray-700 font-serif font-bold text-[14px]">
                <History className="w-4 h-4 text-gray-400" />
                <span>Recent Test Performance Log</span>
              </div>
              {historyList.length > 0 && (
                <button
                  onClick={clearHistoryLog}
                  className="text-gray-400 hover:text-danger-vibrant text-xs font-bold leading-none cursor-pointer"
                >
                  Clear Log
                </button>
              )}
            </div>

            {historyList.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-xs font-sans italic">
                No quiz history compiled yet. Complete your first letter sprint or warm up above!
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {historyList.map(item => (
                  <div 
                    key={item.id}
                    className="p-3 border rounded-xl border-gray-100 flex items-center justify-between text-xs font-sans"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-gray-800">{item.mode}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{item.date}</div>
                    </div>

                    <div className="text-right">
                      <div className={`font-serif font-black text-sm ${
                        item.percentage >= 80 
                          ? 'text-success-vibrant' 
                          : item.percentage >= 50 
                            ? 'text-warning-vibrant' 
                            : 'text-danger-vibrant'
                      }`}>
                        {item.percentage}%
                      </div>
                      <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                        {item.score} / {item.total} Correct
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. LIVE ACTIVE QUIZ RUNNING VIEW */}
      {activeScreen === 'quiz' && questions.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-md space-y-6">
          {/* Quiz Header Progress Tracker */}
          <div className="flex justify-between items-center text-xs">
            <span className="font-serif font-black uppercase text-primary tracking-wide">
              {currentTestName}
            </span>
            <span className="bg-gray-150 text-gray-700 px-2.5 py-1 rounded-full font-bold">
              Q: {currentQuestionIdx + 1} / {questions.length}
            </span>
          </div>

          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary"
              style={{ width: `${((currentQuestionIdx) / questions.length) * 100}%` }}
            />
          </div>

          {/* Active Question Layout Box */}
          {(() => {
            const question = questions[currentQuestionIdx];

            return (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <p className="text-sm text-gray-500 font-bold tracking-wider uppercase mb-1.5 font-sans">
                    Question Type: {question.type.replace('-', ' ')}
                  </p>
                  <p className="font-serif text-[17px] font-bold text-gray-800 px-4 leading-normal">
                    {question.questionText}
                  </p>
                </div>

                {/* 2.1 MULTIPLE CHOICE LAYOUT */}
                {question.type === 'multiple-choice' && (
                  <div className="space-y-2.5">
                    {question.options?.map((opt, i) => {
                      const isSelected = selectedOption === opt;
                      const isCorrect = opt === question.correctAnswer;
                      
                      let btnStyle = 'border-gray-150 hover:bg-gray-50 bg-white';
                      if (isAnswerRevealed) {
                        if (isCorrect) {
                          btnStyle = 'bg-success-soft text-success-vibrant border-success-vibrant font-bold';
                        } else if (isSelected) {
                          btnStyle = 'bg-danger-soft text-danger-vibrant border-danger-vibrant font-bold';
                        } else {
                          btnStyle = 'bg-white text-gray-300 border-gray-100';
                        }
                      } else if (isSelected) {
                        btnStyle = 'bg-primary/5 border-primary text-primary font-bold';
                      }

                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSelectOption(opt)}
                          disabled={isAnswerRevealed}
                          className={`w-full p-3.5 rounded-xl border text-left text-xs transition-all flex items-start gap-2 cursor-pointer leading-relaxed ${btnStyle}`}
                        >
                          <span className="font-bold text-gray-400 select-none">{String.fromCharCode(65 + i)})</span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 2.2 FLASHCARD RECALL LAYOUT */}
                {question.type === 'flashcard-recall' && (
                  <div className="space-y-4">
                    {isAnswerRevealed ? (
                      <div className="bg-success-soft/20 p-6 rounded-2xl border border-success-vibrant/20 text-center space-y-2">
                        <span className="text-[10px] font-bold text-success-vibrant uppercase tracking-widest bg-success-soft/80 px-2 py-0.5 rounded">
                          Answer Key Word
                        </span>
                        <h4 className="font-serif text-3xl font-black text-gray-900 tracking-tight">
                          {question.correctAnswer}
                        </h4>
                        <p className="text-xs text-gray-500 italic mt-1 font-serif">{question.word.ipa}</p>
                        
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => speakWord(question.word.word)}
                            className="bg-primary/10 hover:bg-primary/20 text-primary p-2.5 rounded-full cursor-pointer transition-transform shrink-0"
                            title="Play word spelling audio pronunciation assist"
                          >
                            <Volume2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 bg-gray-50 border rounded-2xl border-dashed border-gray-300 text-center">
                        <button
                          type="button"
                          onClick={() => setIsAnswerRevealed(true)}
                          className="bg-primary hover:bg-[#002e5d] text-white px-5 py-2.5 rounded-xl font-bold text-xs select-none shadow-xs cursor-pointer"
                        >
                          Click to Reveal Answer
                        </button>
                      </div>
                    )}

                    {/* Self grading controls */}
                    {isAnswerRevealed && (
                      <div className="grid grid-cols-2 gap-3.5 text-center font-bold font-sans text-xs pt-2">
                        <button
                          onClick={() => handleFlashcardSelfRate(false)}
                          className="p-3 bg-danger-soft text-danger-vibrant rounded-xl border border-danger-vibrant/20 hover:bg-[#fee2e2]/75 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <X className="w-4 h-4 stroke-[2.5]" />
                          <span>Nope / Hard (✗)</span>
                        </button>
                        <button
                          onClick={() => handleFlashcardSelfRate(true)}
                          className="p-3 bg-success-soft text-success-vibrant rounded-xl border border-success-vibrant/20 hover:bg-[#dcfce7]/75 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>Got It! (✓)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 2.3 FILL IN THE BLANK LAYOUT */}
                {question.type === 'fill-in-blank' && (
                  <div className="space-y-4">
                    {/* Sentence highlight layout */}
                    <div className="bg-gray-50 p-4 border border-gray-150 rounded-2xl font-serif text-[15px] italic text-center leading-relaxed">
                      "{question.sentenceWithBlank}"
                    </div>

                    <div className="space-y-2">
                      {question.options?.map((opt, i) => {
                        const isSelected = selectedOption === opt;
                        const isCorrect = opt === question.correctAnswer;

                        let btnStyle = 'border-gray-150 hover:bg-gray-50 bg-white';
                        if (isAnswerRevealed) {
                          if (isCorrect) {
                            btnStyle = 'bg-success-soft text-success-vibrant border-success-vibrant font-bold';
                          } else if (isSelected) {
                            btnStyle = 'bg-danger-soft text-danger-vibrant border-danger-vibrant font-bold';
                          } else {
                            btnStyle = 'bg-white text-gray-300 border-gray-100';
                          }
                        } else if (isSelected) {
                          btnStyle = 'bg-primary/5 border-primary text-primary font-bold';
                        }

                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelectOption(opt)}
                            disabled={isAnswerRevealed}
                            className={`w-full p-3 rounded-xl border text-center text-xs transition-colors cursor-pointer font-bold ${btnStyle}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Next button flow */}
                {isAnswerRevealed && question.type !== 'flashcard-recall' && (
                  <div className="pt-2 text-center select-none">
                    <button
                      type="button"
                      onClick={advanceQuiz}
                      className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-xl text-xs font-bold font-sans uppercase tracking-wider cursor-pointer active:scale-95 transition-transform"
                    >
                      Advance to Next Question &rarr;
                    </button>
                  </div>
                )}

              </div>
            );
          })()}
        </div>
      )}

      {/* 3. TEST SUMMARY AND DETAILED RESULTS SCREEN */}
      {activeScreen === 'results' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-md space-y-6">
          
          {/* Trophy Header info */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
              <Award className="w-10 h-10" />
            </div>
            <h3 className="font-serif text-2xl font-black text-gray-950">Quiz Summary Report</h3>
            <p className="text-xs text-gray-500 font-medium tracking-wide font-sans">{currentTestName}</p>
          </div>

          {/* Core score stats percentage and count cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-150 text-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-sans">Accuracy Score</p>
              <h4 className={`text-4xl font-serif font-black mt-1 ${
                (answeredCorrectlyCount / questions.length) >= 0.7 
                  ? 'text-success-vibrant' 
                  : (answeredCorrectlyCount / questions.length) >= 0.5 
                    ? 'text-warning-vibrant' 
                    : 'text-danger-vibrant'
              }`}>
                {Math.round((answeredCorrectlyCount / questions.length) * 100)}%
              </h4>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-150 text-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-sans">Raw Breakdown</p>
              <h4 className="text-4xl font-serif font-black text-gray-800 mt-1">
                {answeredCorrectlyCount} / {questions.length}
              </h4>
            </div>
          </div>

          {/* List of incorrectly answered words block */}
          {incorrectWords.length > 0 && (
            <div className="space-y-3 p-3 bg-danger-soft/20 rounded-xl border border-danger-vibrant/10">
              <div className="flex items-center gap-1.5 text-danger-vibrant">
                <ShieldAlert className="w-4 h-4 stroke-[2.5]" />
                <h5 className="font-serif font-bold text-xs">Review Incorrect Responses ({incorrectWords.length})</h5>
              </div>

              <p className="text-[11px] text-gray-500 leading-normal leading-tight font-sans">
                These words were missed. Add them to your **Tough Nut** focus folder instantly with one tap!
              </p>

              <div className="space-y-2 pt-1">
                {incorrectWords.filter((w, idx, self) => self.findIndex(t => t.id === w.id) === idx).map((word: Word) => (
                  <div 
                    key={word.id}
                    className="bg-white p-3 border rounded-xl border-gray-100 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-serif font-extrabold text-gray-900">{word.word}</span>
                      <p className="text-[10px] text-gray-400 line-clamp-2">
                        {formatDefinitions(word.definitions)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => markIncorrectAsTough(word.id)}
                      disabled={word.toughNut}
                      className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg uppercase tracking-wider cursor-pointer flex-shrink-0 flex items-center gap-1 text-center ${
                        word.toughNut
                          ? 'bg-amber-100 text-warning-vibrant border border-warning-vibrant/20 cursor-default'
                          : 'bg-warning-vibrant text-white hover:bg-[#b45309]'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {word.toughNut ? (
                          <>
                            Added <Brain className="w-3 h-3" />
                          </>
                        ) : (
                          'Flag Tough'
                        )}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Navigation Trigger elements */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => launchQuiz(quizMode === 'Letter' ? 'Letter' : quizMode === 'Tough' ? 'Tough' : 'Full')}
              className="w-full bg-primary hover:bg-[#002e5d] text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wide cursor-pointer text-center flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retake Test Quiz</span>
            </button>

            <button
              onClick={() => setActiveScreen('lobby')}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-bold text-xs uppercase tracking-wide cursor-pointer text-center"
            >
              Lobby Hub Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

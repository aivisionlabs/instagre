import { BookOpen, CheckCircle, TrendingUp, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface SplashViewProps {
  onGetStarted: () => void;
  onLogIn: () => void;
}

export default function SplashView({ onGetStarted, onLogIn }: SplashViewProps) {
  return (
    <div id="splash_root" className="bg-brand-deep min-h-screen text-white flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Ambient Orbs */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-80 h-80 bg-primary/20 rounded-full blur-[60px]" />
        <div className="absolute bottom-[-15%] right-[-5%] w-96 h-96 bg-primary-container/30 rounded-full blur-[70px]" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-secondary/15 rounded-full blur-[50px]" />
      </div>

      {/* Top Spacer */}
      <div className="h-10" />

      {/* Main Brand Content */}
      <main className="relative z-10 flex flex-col items-center justify-center flex-grow text-center px-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          {/* Logo with Tactile Depth */}
          <div className="w-24 h-24 bg-primary-container rounded-[24px] flex items-center justify-center shadow-2xl mb-6 border-b-4 border-primary mx-auto">
            <BookOpen className="text-white w-12 h-12" />
          </div>

          <h1 className="font-serif text-[48px] uppercase tracking-wide leading-tight mb-2">
            InstaGRE
          </h1>
          
          <p className="font-sans text-sm text-[#d6e3ff]/90 max-w-[280px] mx-auto leading-relaxed">
            Master every GRE word. One swipe at a time.
          </p>
        </motion.div>

        {/* Decorative achievements */}
        <div className="grid grid-cols-2 gap-4 opacity-75 mt-8 max-w-xs mx-auto">
          <div className="flex items-center space-x-2 bg-white/5 px-3 py-2 rounded-xl backdrop-blur-xs border border-white/10">
            <CheckCircle className="text-[#a9c7ff] w-4 h-4" />
            <span className="text-[11px] font-bold tracking-wider uppercase font-sans">3000+ Words</span>
          </div>
          <div className="flex items-center space-x-2 bg-white/5 px-3 py-2 rounded-xl backdrop-blur-xs border border-white/10">
            <TrendingUp className="text-[#a9c7ff] w-4 h-4" />
            <span className="text-[11px] font-bold tracking-wider uppercase font-sans">Smart Track</span>
          </div>
        </div>
      </main>

      {/* Interactive Footer Section */}
      <footer className="relative z-10 w-full px-6 pb-12 max-w-md mx-auto">
        {/* Visual Progress Dot Indicators */}
        <div className="flex justify-center mb-8 space-x-2">
          <div className="h-1.5 w-8 bg-white/90 rounded-full" />
          <div className="h-1.5 w-2.5 bg-white/20 rounded-full" />
          <div className="h-1.5 w-2.5 bg-white/20 rounded-full" />
        </div>

        {/* Active 3D CTA button */}
        <button
          id="btn_get_started"
          onClick={onGetStarted}
          className="btn-3d w-full bg-primary-container hover:bg-secondary text-white py-4 rounded-full font-bold text-[15px] flex items-center justify-center space-x-2 cursor-pointer transition-colors"
        >
          <span>Get Started</span>
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Secondary Login suggestion */}
        <p className="mt-4 text-center">
          <span className="text-xs text-[#d6e3ff]/60">Already cracking words?</span>
          <button
            type="button"
            onClick={onLogIn}
            className="text-xs text-[#a9c7ff] hover:text-white underline font-semibold ml-1.5 cursor-pointer"
          >
            Log In
          </button>
        </p>
      </footer>

      {/* Subtle texture overlay */}
      <div 
        className="pointer-events-none fixed inset-0 z-50 mix-blend-overlay opacity-15"
        style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/carbon-fibre.png')" }}
      />
    </div>
  );
}

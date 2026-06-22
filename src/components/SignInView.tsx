import { useState, FormEvent } from 'react';
import { normalizeMobile } from '../data/auth';
import { ArrowLeft, Phone, Calendar, ArrowRight, BookOpen } from 'lucide-react';

interface SignInViewProps {
  onSignIn: (mobile: string, dob: string) => Promise<void>;
  onGoToSignUp: () => void;
  onBack: () => void;
}

/**
 * Sign-in by mobile number + date of birth (DOB is the password, mapped to a
 * synthetic Supabase auth email behind the scenes).
 */
export default function SignInView({ onSignIn, onGoToSignUp, onBack }: SignInViewProps) {
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (normalizeMobile(mobile).length < 7) return setError('Please enter a valid mobile number.');
    if (!dob) return setError('Please enter your date of birth.');

    setSubmitting(true);
    try {
      await onSignIn(mobile, dob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you in.');
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface min-h-screen text-text-primary font-sans flex flex-col max-w-[600px] mx-auto">
      <header className="flex items-center gap-3 px-5 pt-6 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="text-primary p-1 -ml-1 rounded-full hover:bg-primary/10 transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-serif text-xl font-bold text-primary">InstaGRE</span>
      </header>

      <main className="flex-1 px-6 pt-4">
        <div className="w-16 h-16 bg-primary rounded-[18px] flex items-center justify-center shadow-md mb-6">
          <BookOpen className="w-8 h-8 text-white" />
        </div>

        <h1 className="font-serif text-[40px] leading-[1.05] font-black text-text-primary">
          Welcome Back
        </h1>
        <p className="text-text-secondary text-sm mt-2 mb-7">
          Sign in with your mobile number and date of birth to resume your study.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-gray-150 shadow-sm p-6 space-y-5"
        >
          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-text-primary">
              Mobile Number
            </label>
            <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-3 h-12 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors">
              <Phone className="w-4.5 h-4.5 text-gray-400 shrink-0" />
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="bg-transparent w-full outline-none text-sm text-text-primary placeholder-gray-400"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-text-primary">
              Date of Birth
            </label>
            <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-3 h-12 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors">
              <Calendar className="w-4.5 h-4.5 text-gray-400 shrink-0" />
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="bg-transparent w-full outline-none text-sm text-text-primary placeholder-gray-400"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-danger-vibrant font-medium bg-danger-soft border border-danger-vibrant/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-3d w-full bg-primary hover:bg-primary-container text-white h-13 rounded-xl font-bold text-base flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>{submitting ? 'Signing in…' : 'Sign In'}</span>
            {!submitting && <ArrowRight className="w-5 h-5" />}
          </button>

          <p className="text-center text-sm text-text-secondary">
            New to InstaGRE?{' '}
            <button
              type="button"
              onClick={onGoToSignUp}
              className="text-primary font-bold cursor-pointer hover:underline"
            >
              Create Account
            </button>
          </p>
        </form>
      </main>

      <footer className="px-6 py-8">
        <p className="text-center text-[11px] text-gray-400">
          © 2024 InstaGRE Education. Precision Vocabulary Prep.
        </p>
      </footer>
    </div>
  );
}

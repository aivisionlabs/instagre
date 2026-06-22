import { useState, FormEvent } from 'react';
import { UserProfile } from '../types';
import { normalizeMobile } from '../data/auth';
import { ArrowLeft, User, Calendar, Phone, ArrowRight, GraduationCap, Zap, BadgeCheck } from 'lucide-react';

interface SignupViewProps {
  onSignup: (profile: UserProfile) => Promise<void>;
  onGoToSignIn: () => void;
  onBack: () => void;
}

export default function SignupView({ onSignup, onGoToSignIn, onBack }: SignupViewProps) {
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) return setError('Please enter your full name.');
    if (!dob) return setError('Please enter your date of birth.');
    if (normalizeMobile(mobile).length < 7) return setError('Please enter a valid mobile number.');

    setSubmitting(true);
    try {
      await onSignup({
        fullName: fullName.trim(),
        dob,
        mobile: normalizeMobile(mobile),
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface min-h-screen text-text-primary font-sans flex flex-col max-w-[600px] mx-auto">
      {/* Header */}
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
        <h1 className="font-serif text-[40px] leading-[1.05] font-black text-text-primary">
          Create Your Account
        </h1>
        <p className="text-text-secondary text-sm mt-2 mb-7">
          Step into your personalized scholarly theater.
        </p>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-gray-150 shadow-sm p-6 space-y-5"
        >
          {/* Full name */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-text-primary">
              Full Name
            </label>
            <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-3 h-12 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors">
              <User className="w-4.5 h-4.5 text-gray-400 shrink-0" />
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alexander Hamilton"
                className="bg-transparent w-full outline-none text-sm text-text-primary placeholder-gray-400"
              />
            </div>
          </div>

          {/* DOB */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-text-primary">
              Date of Birth <span className="text-gray-400 normal-case font-medium tracking-normal">· used to sign in</span>
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

          {/* Mobile */}
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
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-danger-vibrant font-medium bg-danger-soft border border-danger-vibrant/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <p className="text-[11px] text-gray-500 text-center leading-relaxed">
            By signing up, you agree to our{' '}
            <span className="text-primary font-semibold underline">Terms of Service</span> and{' '}
            <span className="text-primary font-semibold underline">Privacy Policy</span>.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="btn-3d w-full bg-primary hover:bg-primary-container text-white h-13 rounded-xl font-bold text-base flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>{submitting ? 'Creating account…' : 'Sign Up'}</span>
            {!submitting && <ArrowRight className="w-5 h-5" />}
          </button>

          <p className="text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onGoToSignIn}
              className="text-primary font-bold cursor-pointer hover:underline"
            >
              Sign In
            </button>
          </p>
        </form>
      </main>

      {/* Footer trust badges */}
      <footer className="px-6 py-8 mt-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-gray-400">
            Trusted by Scholars
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-gray-400">
          {[
            { icon: GraduationCap, label: 'GRE Content' },
            { icon: Zap, label: 'Fast Learning' },
            { icon: BadgeCheck, label: 'Success Proven' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 text-center">
              <Icon className="w-6 h-6" />
              <span className="text-[11px] font-medium">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-8">
          © 2024 InstaGRE Education. Precision Vocabulary Prep.
        </p>
      </footer>
    </div>
  );
}

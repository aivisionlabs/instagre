import { BookOpen } from "lucide-react";

/** Boot splash shown while we restore the Supabase session. */
export default function LoadingView() {
  return (
    <div className="bg-brand-deep min-h-screen text-white flex flex-col items-center justify-center gap-6 font-sans">
      <div className="w-20 h-20 bg-primary-container rounded-[22px] flex items-center justify-center shadow-2xl border-b-4 border-primary">
        <BookOpen className="text-white w-10 h-10" />
      </div>
      <h1 className="font-serif text-3xl uppercase tracking-wide">InstaGRE</h1>
      <div
        className="w-7 h-7 rounded-full border-2 border-white/25 border-t-white animate-spin"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

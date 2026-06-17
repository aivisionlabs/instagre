import { useState } from 'react';
import { Word, UserProfile } from '../types';
import { User, Calendar, LogOut, Check, X } from 'lucide-react';

interface ProfileViewProps {
  profile: UserProfile;
  words: Word[];
  streak: number;
  onUpdateProfile: (profile: UserProfile) => void;
  onLogout: () => void;
}

/** Display a stored yyyy-mm-dd as mm/dd/yyyy; pass through anything unexpected. */
function formatDob(dob: string): string {
  if (!dob) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : dob;
}

function formatMobile(mobile: string): string {
  const d = mobile.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return mobile;
}

export default function ProfileView({
  profile,
  words,
  streak,
  onUpdateProfile,
  onLogout,
}: ProfileViewProps) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile.fullName);
  const [dob, setDob] = useState(profile.dob);

  const wordsMastered = words.filter((w) => w.status === 'Learned It').length;

  const handleSave = () => {
    onUpdateProfile({ ...profile, fullName: fullName.trim() || profile.fullName, dob });
    setEditing(false);
  };

  const handleCancel = () => {
    setFullName(profile.fullName);
    setDob(profile.dob);
    setEditing(false);
  };

  return (
    <div id="profile_tab" className="space-y-7">
      {/* Identity */}
      <div className="text-center pt-2">
        <h2 className="font-serif text-[32px] font-black text-text-primary leading-tight">
          {profile.fullName}
        </h2>
        <p className="text-[11px] font-bold tracking-widest uppercase text-text-secondary mt-1">
          Scholar of the Month
        </p>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-sm p-6 space-y-5">
        {editing ? (
          <>
            <div className="space-y-2">
              <label className="text-[11px] font-bold tracking-wider uppercase text-text-secondary">
                Full Name
              </label>
              <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-3 h-11 focus-within:border-primary transition-colors">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-transparent w-full outline-none text-sm text-text-primary"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold tracking-wider uppercase text-text-secondary">
                Date of Birth
              </label>
              <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-3 h-11 focus-within:border-primary transition-colors">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="bg-transparent w-full outline-none text-sm text-text-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-text-secondary">
                Mobile Number
              </label>
              <p className="text-sm text-gray-400 mt-1">{formatMobile(profile.mobile)} (locked)</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleSave}
                className="bg-primary hover:bg-primary-container text-white h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Check className="w-4 h-4" /> Save
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-100 hover:bg-gray-200 text-text-secondary h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-[11px] font-bold tracking-wider uppercase text-text-secondary">
                Date of Birth
              </p>
              <p className="text-lg text-text-primary mt-1">{formatDob(profile.dob)}</p>
            </div>

            <div className="border-t border-gray-100" />

            <div>
              <p className="text-[11px] font-bold tracking-wider uppercase text-text-secondary">
                Mobile Number
              </p>
              <p className="text-lg text-text-primary mt-1">{formatMobile(profile.mobile)}</p>
            </div>

            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-3d w-full bg-primary hover:bg-primary-container text-white h-12 rounded-xl font-bold text-base cursor-pointer transition-colors mt-1"
            >
              Edit Profile
            </button>
          </>
        )}
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={onLogout}
        className="mx-auto flex items-center gap-2 text-danger-vibrant font-bold cursor-pointer hover:opacity-80 transition-opacity"
      >
        <LogOut className="w-5 h-5" />
        <span>Logout</span>
      </button>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#e8f0fe] border border-primary/10 rounded-2xl p-5">
          <p className="font-serif text-4xl font-black text-primary leading-none">{wordsMastered}</p>
          <p className="text-xs font-medium text-text-secondary mt-2">Words Mastered</p>
        </div>
        <div className="bg-[#e7f5ee] border border-success-vibrant/10 rounded-2xl p-5">
          <p className="font-serif text-4xl font-black text-success-vibrant leading-none">{streak}</p>
          <p className="text-xs font-medium text-text-secondary mt-2">Day Streak</p>
        </div>
      </div>
    </div>
  );
}

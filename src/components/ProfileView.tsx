import { useState, useEffect } from 'react';
import { Word, UserProfile } from '../types';
import { User, LogOut, Check, X, Volume2, VolumeX, Trash2, AlertTriangle } from 'lucide-react';
import { isSoundEffectsEnabled, setSoundEffectsEnabled } from '../utils/speech';

interface ProfileViewProps {
  profile: UserProfile;
  words: Word[];
  streak: number;
  onUpdateProfile: (profile: UserProfile) => void;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
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
  onDeleteAccount,
}: ProfileViewProps) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile.fullName);
  const [soundEnabled, setSoundEnabledLocal] = useState(isSoundEffectsEnabled());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setSoundEnabledLocal(isSoundEffectsEnabled());
  }, []);

  const handleToggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabledLocal(newState);
    setSoundEffectsEnabled(newState);
  };

  const wordsMastered = words.filter((w) => w.mastered).length;

  const handleSave = () => {
    onUpdateProfile({ ...profile, fullName: fullName.trim() || profile.fullName });
    setEditing(false);
  };

  const handleCancel = () => {
    setFullName(profile.fullName);
    setEditing(false);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteAccount();
    } catch (e) {
      setDeleting(false);
      setDeleteError(
        e instanceof Error ? e.message : 'Could not delete your account. Please try again.',
      );
    }
  };

  return (
    <div id="profile_tab" className="relative h-full flex flex-col bg-white">
      {/* Header — consistent with other views */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="px-2.5 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
            <span className="font-serif text-white text-base font-black leading-none tracking-tight">
              InstaGRE
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-7 px-5">
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

            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-text-secondary">
                Date of Birth
              </label>
              <p className="text-sm text-gray-400 mt-1">{formatDob(profile.dob)} (locked · used to sign in)</p>
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

      {/* Sound Settings */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-sm p-6 space-y-4">
        <p className="text-[11px] font-bold tracking-wider uppercase text-text-secondary">
          Sound Settings
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-primary" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-400" />
            )}
            <span className="text-sm text-text-primary font-medium">
              {soundEnabled ? 'Sound On' : 'Sound Off'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleSound}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors cursor-pointer ${
              soundEnabled ? 'bg-primary' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                soundEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
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

      {/* Danger zone: permanent account + data deletion */}
      <div className="border-t border-gray-100 pt-5">
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="mx-auto flex items-center gap-2 text-gray-400 text-sm font-medium cursor-pointer hover:text-danger-vibrant transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Account</span>
          </button>
        ) : (
          <div className="bg-danger-soft border border-danger-vibrant/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-danger-vibrant shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-danger-vibrant">
                  Permanently delete your account?
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  This erases your profile, mastered/tough-nut progress, and streak from our
                  servers and this device. This can't be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <p className="text-xs text-danger-vibrant font-medium">{deleteError}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="bg-danger-vibrant hover:opacity-90 disabled:opacity-60 text-white h-11 rounded-xl font-bold text-sm cursor-pointer transition-opacity"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="bg-gray-100 hover:bg-gray-200 text-text-secondary h-11 rounded-xl font-bold text-sm cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

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

      <p className="text-center pb-2">
        <a
          href="/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Privacy Policy
        </a>
      </p>
      </div>
    </div>
  );
}

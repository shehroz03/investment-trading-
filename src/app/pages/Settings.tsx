import { useState } from "react";
import { Settings as SettingsIcon, Sun, Moon, Save, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import { useTheme } from "@/app/context/ThemeContext";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";

export default function Settings() {
  const { user, profile } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const { textPrimary, textMuted, inputBg } = useThemeClasses();

  const [name, setName] = useState(profile?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  if (!user || !profile) return null;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const { error } = await supabase.from('users').update({ name }).eq('id', user.id);
      if (error) throw error;
      setProfileMessage("Profile updated.");
    } catch (err) {
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMessage("Password changed successfully.");
      setNewPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <>
      <PageHeader icon={<SettingsIcon size={20} />} title="Settings" subtitle="Manage your profile, security, and preferences" />

      <Panel>
        <h3 className={`font-semibold text-sm mb-4 ${textPrimary}`}>Profile</h3>

        <div className="grid grid-cols-2 gap-4 max-w-md mb-5">
          <div>
            <p className={`text-xs mb-1 ${textMuted}`}>Credit Score</p>
            <p className={`text-2xl font-bold ${textPrimary}`}>{profile.creditScore ? `${profile.creditScore}/100` : "—"}</p>
          </div>
          <div>
            <p className={`text-xs mb-1 ${textMuted}`}>Profile Completion</p>
            <p className={`text-2xl font-bold ${textPrimary}`}>{profile.profileCompletionPercent ?? 0}%</p>
            <div className={`h-1.5 mt-1.5 rounded-full overflow-hidden ${darkMode ? "bg-white/8" : "bg-slate-100"}`}>
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, profile.profileCompletionPercent ?? 0))}%` }}
              />
            </div>
          </div>
        </div>
        <p className={`text-xs mb-4 ${textMuted}`}>Credit score and profile completion are set by an admin.</p>

        <form onSubmit={saveProfile} className="space-y-3 max-w-md">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`}
          />
          <p className={`text-xs ${textMuted}`}>
            Username <span className="font-mono">{profile.username}</span> and email <span className="font-mono">{profile.email}</span> can't be changed.
          </p>
          {profileMessage && <p className="text-xs text-teal-400">{profileMessage}</p>}
          <button
            type="submit"
            disabled={savingProfile}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg text-sm font-semibold shadow-lg shadow-teal-600/30 disabled:opacity-60"
          >
            <Save size={15} /> {savingProfile ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </Panel>

      <Panel>
        <h3 className={`font-semibold text-sm mb-4 ${textPrimary}`}>Change Password</h3>
        <form onSubmit={changePassword} className="space-y-3 max-w-md">
          <input
            type="password"
            required
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`}
          />
          {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
          {passwordMessage && <p className="text-xs text-teal-400">{passwordMessage}</p>}
          <button
            type="submit"
            disabled={changingPassword}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg text-sm font-semibold shadow-lg shadow-teal-600/30 disabled:opacity-60"
          >
            <Lock size={15} /> {changingPassword ? "Updating..." : "Update Password"}
          </button>
        </form>
      </Panel>

      <Panel>
        <h3 className={`font-semibold text-sm mb-4 ${textPrimary}`}>Appearance</h3>
        <button
          onClick={toggleDarkMode}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${textPrimary} ${darkMode ? "border-white/10" : "border-slate-200"}`}
        >
          {darkMode ? <Sun size={15} className="text-yellow-400" /> : <Moon size={15} />}
          Switch to {darkMode ? "Light" : "Dark"} Mode
        </button>
      </Panel>
    </>
  );
}

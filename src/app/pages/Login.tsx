import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { LogIn, Mail, Lock } from "lucide-react";
import { logIn } from "@/lib/auth";
import { useTheme } from "@/app/context/ThemeContext";

export default function Login() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const bg = darkMode ? "bg-[#09090B] text-white" : "bg-slate-50 text-slate-900";
  const cardBg = darkMode ? "bg-[#151B23] border-white/8" : "bg-white border-slate-200";
  const inputBg = darkMode ? "bg-white/6 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900";
  const textMuted = darkMode ? "text-slate-400" : "text-slate-500";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await logIn(email, password);
      const from = (location.state as { from?: Location })?.from?.pathname ?? "/";
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${bg}`}>
      <div className={`w-full max-w-sm rounded-2xl border p-6 ${cardBg}`}>
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-semibold">Creator Zone</span>
        </div>

        <h1 className="font-bold text-lg mb-1">Welcome back</h1>
        <p className={`text-sm mb-6 ${textMuted}`}>Log in to your account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`}
            />
          </div>
          <div className="relative">
            <Lock size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-teal-600/30 flex items-center justify-center gap-2"
          >
            <LogIn size={15} />
            {submitting ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className={`text-xs text-center mt-5 ${textMuted}`}>
          Don't have an account?{" "}
          <Link to="/signup" className="text-teal-500 font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

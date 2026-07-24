import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { UserPlus, Mail, Lock, User, AtSign } from "lucide-react";
import { signUp } from "@/lib/auth";
import { useTheme } from "@/app/context/ThemeContext";

export default function Signup() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
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
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await signUp({ name, username, email, password });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign up.");
    } finally {
      setSubmitting(false);
    }
  };

  const fields = [
    { icon: User, type: "text", placeholder: "Full Name", value: name, onChange: setName },
    { icon: AtSign, type: "text", placeholder: "Username", value: username, onChange: setUsername },
    { icon: Mail, type: "email", placeholder: "Email", value: email, onChange: setEmail },
    { icon: Lock, type: "password", placeholder: "Password", value: password, onChange: setPassword },
  ];

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${bg}`}>
      <div className={`w-full max-w-sm rounded-2xl border p-6 ${cardBg}`}>
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-semibold">Creator Zone</span>
        </div>

        <h1 className="font-bold text-lg mb-1">Create your account</h1>
        <p className={`text-sm mb-6 ${textMuted}`}>Start investing and earning today</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((f) => (
            <div className="relative" key={f.placeholder}>
              <f.icon size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
              <input
                type={f.type}
                required
                placeholder={f.placeholder}
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none focus:border-teal-500 ${inputBg}`}
              />
            </div>
          ))}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-teal-600/30 flex items-center justify-center gap-2"
          >
            <UserPlus size={15} />
            {submitting ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className={`text-xs text-center mt-5 ${textMuted}`}>
          Already have an account?{" "}
          <Link to="/login" className="text-teal-500 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { UserPlus, Mail, Lock, User, AtSign, Gift, CheckCircle, XCircle } from "lucide-react";
import { signUp } from "@/lib/auth";
import { validateReferralCode } from "@/lib/referrals";
import { useTheme } from "@/app/context/ThemeContext";

export default function Signup() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // On mount: read ?ref= param from URL and pre-fill the referral code box
  useEffect(() => {
    const refFromUrl = searchParams.get("ref");
    if (refFromUrl) {
      const upperCode = refFromUrl.trim().toUpperCase();
      setReferralCode(upperCode);
      // Auto-validate the code from URL
      validateReferralCode(upperCode).then((valid) => setReferralValid(valid));
    }
  }, [searchParams]);

  // Validate referral code with debounce as user types
  useEffect(() => {
    if (!referralCode.trim()) {
      setReferralValid(null);
      return;
    }
    if (referralCode.trim().length < 6) {
      setReferralValid(null);
      return;
    }

    setValidating(true);
    const timer = setTimeout(async () => {
      const valid = await validateReferralCode(referralCode.trim());
      setReferralValid(valid);
      setValidating(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [referralCode]);

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
      await signUp({
        name,
        username,
        email,
        password,
        referralCode: referralCode.trim() || undefined,
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign up.");
    } finally {
      setSubmitting(false);
    }
  };

  const mainFields = [
    { icon: User, type: "text", placeholder: "Full Name", value: name, onChange: setName },
    { icon: AtSign, type: "text", placeholder: "Username", value: username, onChange: setUsername },
    { icon: Mail, type: "email", placeholder: "Email", value: email, onChange: setEmail },
    { icon: Lock, type: "password", placeholder: "Password", value: password, onChange: setPassword },
  ];

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${bg}`}>
      <div className={`w-full max-w-sm rounded-2xl border p-6 ${cardBg}`}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <span className="font-semibold">WealthHub</span>
        </div>

        <h1 className="font-bold text-lg mb-1">Create your account</h1>
        <p className={`text-sm mb-6 ${textMuted}`}>Start investing and earning today</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main fields */}
          {mainFields.map((f) => (
            <div className="relative" key={f.placeholder}>
              <f.icon size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
              <input
                type={f.type}
                required
                placeholder={f.placeholder}
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none focus:border-violet-500 transition-colors ${inputBg}`}
              />
            </div>
          ))}

          {/* Referral Code Field */}
          <div>
            <div className="relative">
              <Gift size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${
                referralValid === true
                  ? "text-emerald-500"
                  : referralValid === false
                  ? "text-red-400"
                  : "text-amber-400"
              }`} />
              <input
                type="text"
                placeholder="Referral Code (Optional)"
                value={referralCode}
                maxLength={6}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className={`w-full pl-9 pr-9 py-2.5 rounded-xl border text-sm outline-none transition-colors font-mono tracking-widest ${inputBg} ${
                  referralValid === true
                    ? "border-emerald-500/60 focus:border-emerald-500"
                    : referralValid === false
                    ? "border-red-400/60 focus:border-red-400"
                    : "focus:border-violet-500"
                }`}
              />
              {/* Validation icon */}
              {!validating && referralCode.trim().length === 6 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {referralValid === true ? (
                    <CheckCircle size={16} className="text-emerald-500" />
                  ) : referralValid === false ? (
                    <XCircle size={16} className="text-red-400" />
                  ) : null}
                </span>
              )}
              {validating && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                </span>
              )}
            </div>

            {/* Validation feedback message */}
            {referralCode.trim().length === 6 && !validating && (
              <p className={`text-xs mt-1.5 ml-1 ${referralValid ? "text-emerald-500" : "text-red-400"}`}>
                {referralValid
                  ? "✓ Valid referral code — bonus will be applied!"
                  : "✗ Invalid referral code — please check and try again."}
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2"
          >
            <UserPlus size={15} />
            {submitting ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className={`text-xs text-center mt-5 ${textMuted}`}>
          Already have an account?{" "}
          <Link to="/login" className="text-violet-500 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

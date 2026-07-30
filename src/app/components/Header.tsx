import { useState } from "react";
import { Link } from "react-router";
import {
  Menu,
  Sun,
  Moon,
  Bell,
  ChevronRight,
  Home,
  User,
  Plus,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";

interface HeaderProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  onMenuToggle: () => void;
}

export function Header({ darkMode, toggleDarkMode, onMenuToggle }: HeaderProps) {
  const { profile } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);

  const notifications = [
    "Welcome to WealthHub!",
    profile?.kycStatus === "pending"
      ? "Your KYC submission is under review"
      : profile?.kycStatus === "approved"
        ? "Your KYC has been approved"
        : "Complete your KYC verification",
  ];

  return (
    <header
      className={`sticky top-0 z-40 flex items-center justify-between px-4 lg:px-6 h-16 border-b transition-colors duration-300 ${
        darkMode
          ? "bg-[#0D1117] border-white/8 text-white"
          : "bg-white border-slate-200 text-slate-900"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className={`lg:hidden p-2 rounded-lg transition-colors ${
            darkMode ? "hover:bg-white/10 text-slate-300" : "hover:bg-slate-100 text-slate-600"
          }`}
        >
          <Menu size={20} />
        </button>

        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <div className="hidden sm:block">
            <p className={`font-semibold text-sm leading-tight ${darkMode ? "text-white" : "text-slate-900"}`}>
              WealthHub
            </p>
          </div>
        </Link>

        <div className={`hidden md:flex items-center gap-1 text-xs ml-4 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
          <Home size={12} />
          <span>Home</span>
          <ChevronRight size={12} />
          <span className="text-violet-500 font-medium">Personal Area</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-lg transition-all duration-200 ${
            darkMode
              ? "bg-white/10 hover:bg-white/15 text-yellow-400"
              : "bg-slate-100 hover:bg-slate-200 text-slate-600"
          }`}
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className={`p-2 rounded-lg transition-colors relative ${
              darkMode ? "bg-white/10 hover:bg-white/15 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          {notifOpen && (
            <div
              className={`absolute right-0 top-12 w-72 rounded-xl border shadow-2xl z-50 ${
                darkMode ? "bg-[#151B23] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="p-4 border-b border-inherit">
                <p className="font-semibold text-sm">Notifications</p>
              </div>
              <div className="p-3 space-y-2">
                {notifications.map((n, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg text-xs ${darkMode ? "bg-white/5 hover:bg-white/10" : "bg-slate-50 hover:bg-slate-100"} transition-colors`}
                  >
                    {n}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Link
          to="/wallet/deposit"
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-lg transition-all duration-200 shadow-lg shadow-violet-600/30 text-sm font-semibold"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Deposit</span>
        </Link>

        <Link to="/settings" className={`flex items-center gap-2 pl-2 border-l ${darkMode ? "border-white/10" : "border-slate-200"}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <User size={14} className="text-white" />
          </div>
          <div className="hidden md:block">
            <p className={`text-xs font-semibold leading-tight ${darkMode ? "text-white" : "text-slate-900"}`}>
              {profile?.name ?? "..."}
            </p>
            <p className={`text-xs leading-tight ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              @{profile?.username ?? "..."}
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}

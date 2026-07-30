import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import {
  Users,
  Settings,
  LogOut,
  MessageCircle,
  Newspaper,
  ChevronRight,
  ArrowDownToLine,
  X,
  Shield,
  ArrowUpFromLine,
  ShieldQuestion,
  LineChart,
  Crown,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { logOut } from "@/lib/auth";

interface AdminSidebarProps {
  darkMode: boolean;
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  to?: string;
  badge?: string;
  children?: { label: string; icon: React.ReactNode; to: string }[];
}

export function AdminSidebar({ darkMode, isOpen, onClose }: AdminSidebarProps) {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const navItems: NavItem[] = [
    { label: "Overview", icon: <Shield size={18} />, to: "/admin" },
    { label: "Deposits", icon: <ArrowDownToLine size={18} />, to: "/admin/deposits" },
    { label: "Withdrawals", icon: <ArrowUpFromLine size={18} />, to: "/admin/withdrawals" },
    { label: "KYC Verification", icon: <ShieldQuestion size={18} />, to: "/admin/kyc" },
    { label: "VIP Requests", icon: <Crown size={18} />, to: "/admin/vip-requests" },
    { label: "Support Tickets", icon: <MessageCircle size={18} />, to: "/admin/support" },
    { label: "Users", icon: <Users size={18} />, to: "/admin/users" },
    { label: "Trades", icon: <LineChart size={18} />, to: "/admin/trades" },
    { label: "Content", icon: <Newspaper size={18} />, to: "/admin/content" },
    { label: "Platform Settings", icon: <Settings size={18} />, to: "/admin/settings" },
  ];

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  };

  const isActive = (to?: string) => !!to && (to === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(to));

  const handleLogout = async () => {
    await logOut();
    navigate("/login");
  };

  const cardBg = darkMode ? "bg-[#151B23] border-white/8" : "bg-white border-slate-200";
  const sidebarBg = darkMode ? "bg-[#0D1117] border-white/8" : "bg-slate-50 border-slate-200";
  const textPrimary = darkMode ? "text-white" : "text-slate-900";
  const textMuted = darkMode ? "text-slate-400" : "text-slate-500";
  const hoverBg = darkMode ? "hover:bg-white/8" : "hover:bg-slate-100";

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed left-0 top-0 h-full w-72 z-50 border-r flex flex-col transition-transform duration-300 ${sidebarBg} ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } lg:static lg:z-auto`}
      >
        <div className="lg:hidden flex items-center justify-between px-4 h-16 border-b border-inherit">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">A</span>
            </div>
            <span className={`font-semibold text-sm ${textPrimary}`}>Admin Panel</span>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${hoverBg} ${textMuted}`}>
            <X size={18} />
          </button>
        </div>

        <div className={`mx-3 mt-4 mb-2 p-4 rounded-xl border ${cardBg}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30">
              <Shield size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className={`font-semibold text-sm truncate ${textPrimary}`}>Admin Workspace</p>
              <div className="flex flex-col gap-0.5 mt-0.5">
                <span className={`text-xs ${textMuted}`}>
                  Logged in as <span className="text-indigo-500 font-medium">{profile?.username ?? "..."}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5">
          <p className={`text-xs font-semibold uppercase tracking-wider px-3 py-2 ${textMuted}`}>Admin Menu</p>

          {navItems.map((item) => {
            const isExpanded = expandedItems.includes(item.label);
            const hasChildren = !!item.children;
            const active = isActive(item.to) || (hasChildren && item.children!.some((c) => isActive(c.to)));

            const content = (
              <>
                {active && (
                  <div className="absolute left-3 w-1 h-6 rounded-r-full bg-indigo-500" style={{ marginLeft: "-12px" }} />
                )}
                <span className={active ? "text-indigo-500" : ""}>{item.icon}</span>
                <span className="flex-1 text-left font-medium">{item.label}</span>
                {item.badge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-medium capitalize">
                    {item.badge}
                  </span>
                )}
                {hasChildren && (
                  <span className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                    <ChevronRight size={14} />
                  </span>
                )}
              </>
            );

            const className = `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group relative ${
              active
                ? darkMode
                  ? "bg-indigo-500/15 text-indigo-400 shadow-sm"
                  : "bg-indigo-50 text-indigo-700"
                : `${hoverBg} ${textMuted} hover:${textPrimary}`
            }`;

            return (
              <div key={item.label}>
                {hasChildren ? (
                  <button onClick={() => toggleExpand(item.label)} className={className}>
                    {content}
                  </button>
                ) : (
                  <Link to={item.to!} onClick={onClose} className={className}>
                    {content}
                  </Link>
                )}
              </div>
            );
          })}

          <div className={`my-3 border-t ${darkMode ? "border-white/8" : "border-slate-200"}`} />

          <Link
            to="/"
            onClick={onClose}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${hoverBg} text-slate-500`}
          >
            <ArrowLeft size={18} />
            <span className="font-medium">Back to Dashboard</span>
          </Link>
          
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${hoverBg} text-red-500 hover:bg-red-500/10 mt-1`}
          >
            <LogOut size={18} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

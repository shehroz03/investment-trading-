import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Wallet,
  FileText,
  Settings,
  LogOut,
  MessageCircle,
  Image,
  Newspaper,
  FileDown,
  ChevronRight,
  User,
  TrendingUp,
  ArrowDownToLine,
  X,
  Shield,
  ArrowUpFromLine,
  ShieldQuestion,
  LineChart,
  Crown,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { logOut } from "@/lib/auth";

interface SidebarProps {
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

const SUPPORT_WHATSAPP_NUMBER = "10000000000";

export function Sidebar({ darkMode, isOpen, onClose }: SidebarProps) {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const navItems: NavItem[] = [
    { label: "Dashboard", icon: <LayoutDashboard size={18} />, to: "/" },
    {
      label: "KYC",
      icon: <ShieldCheck size={18} />,
      to: "/kyc",
      badge: profile?.kycStatus && profile.kycStatus !== "none" ? profile.kycStatus : undefined,
    },
    {
      label: "My Wallet",
      icon: <Wallet size={18} />,
      children: [
        { label: "Balance", icon: <Wallet size={15} />, to: "/wallet" },
        { label: "Deposit", icon: <ArrowDownToLine size={15} />, to: "/wallet/deposit" },
        { label: "Withdraw", icon: <TrendingUp size={15} />, to: "/wallet/withdraw" },
      ],
    },
    {
      label: "Reports",
      icon: <FileText size={18} />,
      children: [
        { label: "Daily Reports", icon: <FileText size={15} />, to: "/reports/daily" },
        { label: "Monthly Reports", icon: <FileText size={15} />, to: "/reports/monthly" },
      ],
    },
    {
      label: "VIP Channel",
      icon: <Crown size={18} />,
      to: "/vip-channel",
      badge: profile?.vipStatus && profile.vipStatus !== "none" ? profile.vipStatus : undefined,
    },
    { label: "Settings", icon: <Settings size={18} />, to: "/settings" },
    ...(profile?.role === "admin"
      ? [
          {
            label: "Admin Panel",
            icon: <Shield size={18} />,
            children: [
              { label: "Overview", icon: <Shield size={15} />, to: "/admin" },
              { label: "Deposits", icon: <ArrowDownToLine size={15} />, to: "/admin/deposits" },
              { label: "Withdrawals", icon: <ArrowUpFromLine size={15} />, to: "/admin/withdrawals" },
              { label: "KYC", icon: <ShieldQuestion size={15} />, to: "/admin/kyc" },
              { label: "VIP Requests", icon: <Crown size={15} />, to: "/admin/vip-requests" },
              { label: "Users", icon: <Users size={15} />, to: "/admin/users" },
              { label: "Trades", icon: <LineChart size={15} />, to: "/admin/trades" },
              { label: "Content", icon: <Newspaper size={15} />, to: "/admin/content" },
              { label: "Platform Settings", icon: <Settings size={15} />, to: "/admin/settings" },
            ],
          },
        ]
      : []),
  ];

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  };

  const isActive = (to?: string) => !!to && (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));

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
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className={`font-semibold text-sm ${textPrimary}`}>Creator Zone</span>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${hoverBg} ${textMuted}`}>
            <X size={18} />
          </button>
        </div>

        <div className={`mx-3 mt-4 mb-2 p-4 rounded-xl border ${cardBg}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal-500/30">
              <User size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className={`font-semibold text-sm truncate ${textPrimary}`}>{profile?.name ?? "..."}</p>
              <div className="flex flex-col gap-0.5 mt-0.5">
                <span className={`text-xs ${textMuted}`}>
                  <span className={darkMode ? "text-slate-500" : "text-slate-400"}>Username:</span>{" "}
                  <span className="text-teal-500 font-medium">{profile?.username ?? "..."}</span>
                </span>
                <span className={`text-xs ${textMuted}`}>
                  <span className={darkMode ? "text-slate-500" : "text-slate-400"}>Credit Score:</span>{" "}
                  <span className="text-teal-500 font-medium">{profile?.creditScore ? `${profile.creditScore}/100` : "—"}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5">
          <p className={`text-xs font-semibold uppercase tracking-wider px-3 py-2 ${textMuted}`}>Navigation</p>

          {navItems.map((item) => {
            const isExpanded = expandedItems.includes(item.label);
            const hasChildren = !!item.children;
            const active = isActive(item.to) || (hasChildren && item.children!.some((c) => isActive(c.to)));

            const content = (
              <>
                {active && (
                  <div className="absolute left-3 w-1 h-6 rounded-r-full bg-teal-500" style={{ marginLeft: "-12px" }} />
                )}
                <span className={active ? "text-teal-500" : ""}>{item.icon}</span>
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
                  ? "bg-teal-500/15 text-teal-400 shadow-sm"
                  : "bg-teal-50 text-teal-700"
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

                {hasChildren && isExpanded && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-teal-500/30 pl-3">
                    {item.children!.map((child) => (
                      <Link
                        key={child.label}
                        to={child.to}
                        onClick={onClose}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${hoverBg} ${
                          isActive(child.to) ? "text-teal-500 font-medium" : textMuted
                        }`}
                      >
                        {child.icon}
                        <span>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className={`my-3 border-t ${darkMode ? "border-white/8" : "border-slate-200"}`} />

          <p className={`text-xs font-semibold uppercase tracking-wider px-3 py-2 ${textMuted}`}>Utilities</p>

          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${hoverBg} ${textMuted}`}
          >
            <MessageCircle size={18} className="text-green-500" />
            <span className="font-medium">Live Support 24/7</span>
            <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500 font-medium">Online</span>
          </a>

          <Link to="/social-banners" onClick={onClose} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${hoverBg} ${textMuted}`}>
            <Image size={18} className="text-purple-500" />
            <span className="font-medium">Social Banners</span>
          </Link>

          <Link to="/news" onClick={onClose} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${hoverBg} ${textMuted}`}>
            <Newspaper size={18} className="text-blue-500" />
            <span className="font-medium">News & Updates</span>
          </Link>

          <Link to="/guides" onClick={onClose} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${hoverBg} ${textMuted}`}>
            <FileDown size={18} className="text-orange-500" />
            <span className="font-medium">PDF Guides</span>
          </Link>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${hoverBg} text-red-500 hover:bg-red-500/10`}
          >
            <LogOut size={18} />
            <span className="font-medium">Logout</span>
          </button>
        </div>

        <div className={`px-4 py-3 border-t text-xs text-center ${darkMode ? "border-white/8 text-slate-600" : "border-slate-200 text-slate-400"}`}>
          © 2026 Creator Zone
        </div>
      </aside>
    </>
  );
}

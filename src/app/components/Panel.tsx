import type { ReactNode } from "react";
import { useTheme } from "@/app/context/ThemeContext";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { darkMode } = useTheme();
  const cardBg = darkMode ? "bg-[#151B23] border-white/8" : "bg-white border-slate-200";
  return <div className={`rounded-xl border p-5 ${cardBg} ${className}`}>{children}</div>;
}

export function useThemeClasses() {
  const { darkMode } = useTheme();
  return {
    darkMode,
    cardBg: darkMode ? "bg-[#151B23] border-white/8" : "bg-white border-slate-200",
    textPrimary: darkMode ? "text-white" : "text-slate-900",
    textMuted: darkMode ? "text-slate-400" : "text-slate-500",
    inputBg: darkMode
      ? "bg-white/6 border-white/10 text-white placeholder:text-slate-500"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400",
    hoverBg: darkMode ? "hover:bg-white/8" : "hover:bg-slate-100",
    divider: darkMode ? "border-white/8" : "border-slate-200",
    theadBg: darkMode ? "bg-white/4 text-slate-400" : "bg-slate-50 text-slate-500",
  };
}

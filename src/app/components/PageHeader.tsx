import type { ReactNode } from "react";
import { useTheme } from "@/app/context/ThemeContext";

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ icon, title, subtitle, action }: PageHeaderProps) {
  const { darkMode } = useTheme();
  const textPrimary = darkMode ? "text-white" : "text-slate-900";
  const textMuted = darkMode ? "text-slate-400" : "text-slate-500";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-teal-500">{icon}</span>
          <h1 className={`font-bold ${textPrimary}`}>{title}</h1>
        </div>
        {subtitle && <p className={`text-sm ${textMuted}`}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

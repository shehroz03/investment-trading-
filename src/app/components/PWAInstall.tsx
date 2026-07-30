import { useState } from "react";
import { Smartphone, X, Download } from "lucide-react";

interface PWAInstallProps {
  darkMode: boolean;
}

export function PWAInstall({ darkMode }: PWAInstallProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl transition-all ${
          darkMode
            ? "bg-[#151B23] border-white/10 text-white shadow-black/50"
            : "bg-white border-slate-200 text-slate-900 shadow-slate-300/50"
        }`}
        style={{ maxWidth: 240 }}
      >
        {/* NEW badge */}
        <div className="absolute -top-2.5 -left-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">
          NEW
        </div>

        {/* Close button */}
        <button
          onClick={() => setDismissed(true)}
          className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs transition-colors ${
            darkMode ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-slate-200 hover:bg-slate-300 text-slate-600"
          }`}
        >
          <X size={10} />
        </button>

        <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex-shrink-0 shadow-lg shadow-violet-500/30">
          <Smartphone size={18} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold leading-tight ${darkMode ? "text-white" : "text-slate-900"}`}>
            Install App
          </p>
          <p className={`text-xs leading-tight ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            Add to home screen
          </p>
        </div>

        <button className="flex-shrink-0 p-1.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors">
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}

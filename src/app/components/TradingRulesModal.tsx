import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useThemeClasses } from "@/app/components/Panel";

interface TradingRulesModalProps {
  onClose: () => void;
  onAccept?: () => void;
}

const RULES = [
  "Cryptocurrency and simulated-asset prices are highly volatile — you can lose some or all of the amount you trade.",
  "Some listed assets on this platform use simulated pricing for demonstration purposes and do not reflect real market values.",
  "Trade outcomes are based on real or simulated price movement at settlement time, unless an admin has recorded a manual review for that trade.",
  "Only trade with funds you can afford to lose. This platform does not guarantee profits or fixed returns.",
  "You must be of legal age and comply with the laws that apply to you regarding trading and investment platforms.",
];

export function TradingRulesModal({ onClose, onAccept }: TradingRulesModalProps) {
  const { textPrimary, textMuted, cardBg, divider } = useThemeClasses();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className={`w-full max-w-md rounded-2xl border flex flex-col ${cardBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-inherit flex-shrink-0">
          <h2 className={`font-semibold flex items-center gap-2 ${textPrimary}`}>
            <AlertTriangle size={17} className="text-amber-400" />
            Trading Rules & Risk Disclosure
          </h2>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${textMuted}`}>
            <X size={18} />
          </button>
        </div>

        <div className={`px-5 py-4 space-y-3 border-b ${divider}`}>
          {RULES.map((rule, i) => (
            <p key={i} className={`text-sm flex gap-2 ${textMuted}`}>
              <span className="font-semibold text-teal-500 flex-shrink-0">{i + 1}.</span>
              <span>{rule}</span>
            </p>
          ))}
        </div>

        <div className="p-5">
          <button
            onClick={() => {
              onAccept?.();
              onClose();
            }}
            className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-teal-600/30"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}

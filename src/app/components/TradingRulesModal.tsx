import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useThemeClasses } from "@/app/components/Panel";

interface TradingRulesModalProps {
  onClose: () => void;
  onAccept?: () => void;
}

const RULES = [

  "Unauthorized operation/non-compliance operation is strictly prohibited. If you violate the rules for your own reasons, the losses will be borne by you. Please do not leave during the task.",
  "The combined VIP task randomly assigns 1-3 small tasks. Each task requires payment, and the randomly assigned task must be completed to complete the task. It is not allowed to terminate or exit midway, otherwise the system cannot generate a withdrawal code.",
  "The data of this task is accurate data, all data will be kept confidential and must not be disclosed to irrelevant personnel.",
  "After completing the combined VIP task, the system automatically generates a withdrawal code. After receiving the withdrawal code, you can use the withdrawal code to find your manager to withdraw funds for you.",
  "In order to protect the rights and interests of each employee, the company has signed a compensation agreement for each employee, and the compensation agreement has come into effect. If any loss occurs, the company will compensate you in full.",
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

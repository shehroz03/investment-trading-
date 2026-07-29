import { useParams, useNavigate } from "react-router";
import { TradingPanel } from "@/app/components/TradingPanel";
import { useTheme } from "@/app/context/ThemeContext";
import { LineChart } from "lucide-react";

export default function Trade() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const { darkMode } = useTheme();

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LineChart size={20} className="text-teal-500" />
            <h1 className={`font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>
              Trade {symbol ? symbol.replace("USDT", "") : ""}
            </h1>
          </div>
          <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            Execute trades and monitor the live market.
          </p>
        </div>
      </div>

      <section>
        <TradingPanel
          initialSymbol={symbol ?? "BTCUSDT"}
          onSymbolChange={(newSymbol) => navigate(`/trade/${newSymbol}`)}
        />
      </section>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { useAuth } from "@/app/context/AuthContext";
import { useThemeClasses } from "@/app/components/Panel";
import { getClosedTrades, type Trade } from "@/lib/trading";

const GAIN = "#22C55E";
const LOSS = "#EF4444";

interface TooltipProps {
  active?: boolean;
  payload?: { payload: Trade }[];
  textPrimary: string;
  textMuted: string;
  cardBg: string;
  divider: string;
}

// Position (above/below the zero reference line) carries win/loss independently of color,
// so this reads correctly even without color vision — never rely on the green/red alone.
function PnlTooltip({ active, payload, textPrimary, textMuted, cardBg, divider }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const t = payload[0].payload;
  const pnl = t.pnl ?? 0;
  const positive = pnl >= 0;

  return (
    <div className={`rounded-lg border px-3 py-2 text-xs shadow-lg ${cardBg} ${divider}`}>
      <p className={`font-semibold ${textPrimary}`}>
        {t.direction === "long" ? "Long" : "Short"} {t.symbol.replace("USDT", "")}
      </p>
      <p className={`font-semibold ${positive ? "text-green-400" : "text-red-400"}`}>
        {positive ? "+" : ""}
        {`$${pnl.toFixed(2)}`}
      </p>
      <p className={textMuted}>{t.closedAt ? t.closedAt.toDate().toLocaleString() : "—"}</p>
      {t.adminOutcome && <p className={textMuted}>Admin-decided {t.adminOutcome}</p>}
    </div>
  );
}

export function TradePnlChart() {
  const { user } = useAuth();
  const { textPrimary, textMuted, cardBg, divider, darkMode } = useThemeClasses();
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    if (!user) return;
    getClosedTrades(user.uid).then(setTrades);
  }, [user]);

  // getClosedTrades returns newest-first; flip to chronological (oldest -> newest) so the
  // chart reads left-to-right like a timeline.
  const data = useMemo(() => [...trades].reverse(), [trades]);

  const gridColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const axisColor = darkMode ? "#64748b" : "#94a3b8";

  if (trades.length === 0) {
    return (
      <div className={`rounded-xl border p-5 text-center ${cardBg}`}>
        <p className={`text-sm ${textMuted}`}>No closed trades yet — profit and loss will show here once a trade settles.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${cardBg}`}>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="id" tick={false} axisLine={{ stroke: gridColor }} tickLine={false} />
            <YAxis
              tick={{ fill: axisColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${v}`}
              width={52}
            />
            <ReferenceLine y={0} stroke={gridColor} />
            <Tooltip
              cursor={{ fill: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
              content={<PnlTooltip textPrimary={textPrimary} textMuted={textMuted} cardBg={cardBg} divider={divider} />}
            />
            <Bar dataKey="pnl" radius={[3, 3, 3, 3]} maxBarSize={28}>
              {data.map((t) => (
                <Cell key={t.id} fill={(t.pnl ?? 0) >= 0 ? GAIN : LOSS} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 pt-2">
        <span className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: GAIN }} />
          <span className={textMuted}>Win</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: LOSS }} />
          <span className={textMuted}>Loss</span>
        </span>
      </div>
    </div>
  );
}

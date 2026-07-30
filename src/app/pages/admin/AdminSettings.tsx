import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Save, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getAppConfig, updateAppConfig, type AppConfig, type PaymentCoin } from "@/lib/config";

export default function AdminSettings() {
  const { textPrimary, textMuted, inputBg, divider } = useThemeClasses();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getAppConfig().then(setConfig);
  }, []);

  if (!config) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateAppConfig(config);
      setMessage("Settings saved.");
    } finally {
      setSaving(false);
    }
  };

  const updatePlan = (key: string, field: "label" | "minAmount" | "dailyRoiPercent", value: string) => {
    setConfig({
      ...config,
      plans: {
        ...config.plans,
        [key]: {
          ...config.plans[key],
          [field]: field === "label" ? value : Number(value),
        },
      },
    });
  };

  const updateCoin = (index: number, field: keyof PaymentCoin, value: string) => {
    const coins = [...config.paymentInfo.coins];
    coins[index] = { ...coins[index], [field]: value };
    setConfig({ ...config, paymentInfo: { ...config.paymentInfo, coins } });
  };

  const addCoin = () => {
    setConfig({
      ...config,
      paymentInfo: {
        ...config.paymentInfo,
        coins: [...config.paymentInfo.coins, { symbol: "", label: "", icon: "", network: "", address: "" }],
      },
    });
  };

  const removeCoin = (index: number) => {
    setConfig({
      ...config,
      paymentInfo: { ...config.paymentInfo, coins: config.paymentInfo.coins.filter((_, i) => i !== index) },
    });
  };

  return (
    <>
      <PageHeader icon={<SettingsIcon size={20} />} title="Platform Settings" subtitle="Tune investment plans and payment details" />

      <form onSubmit={handleSave} className="space-y-4">
        <Panel>
          <h3 className={`font-semibold text-sm mb-4 ${textPrimary}`}>Investment Plans</h3>
          <div className="space-y-3">
            {Object.entries(config.plans).map(([key, plan]) => (
              <div key={key} className={`grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b ${divider} last:border-0 last:pb-0`}>
                <input
                  value={plan.label}
                  onChange={(e) => updatePlan(key, "label", e.target.value)}
                  placeholder="Label"
                  className={`px-3 py-2 rounded-lg border text-sm outline-none ${inputBg}`}
                />
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${textMuted}`}>Min $</span>
                  <input
                    type="number"
                    value={plan.minAmount}
                    onChange={(e) => updatePlan(key, "minAmount", e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm outline-none ${inputBg}`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${textMuted}`}>Daily ROI %</span>
                  <input
                    type="number"
                    step="0.01"
                    value={plan.dailyRoiPercent}
                    onChange={(e) => updatePlan(key, "dailyRoiPercent", e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm outline-none ${inputBg}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <h3 className={`font-semibold text-sm mb-4 ${textPrimary}`}>Payment Info (shown on Deposit page)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 max-w-xl">
            <div>
              <p className={`text-xs mb-1.5 ${textMuted}`}>Binance Pay ID</p>
              <input
                value={config.paymentInfo.binancePayId}
                onChange={(e) => setConfig({ ...config, paymentInfo: { ...config.paymentInfo, binancePayId: e.target.value } })}
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none font-mono ${inputBg}`}
              />
            </div>
            <div>
              <p className={`text-xs mb-1.5 ${textMuted}`}>Binance Pay link</p>
              <input
                value={config.paymentInfo.binancePayLink}
                onChange={(e) => setConfig({ ...config, paymentInfo: { ...config.paymentInfo, binancePayLink: e.target.value } })}
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${inputBg}`}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>Deposit Coins</p>
            <button
              type="button"
              onClick={addCoin}
              className="flex items-center gap-1 text-xs font-semibold text-violet-500 hover:underline"
            >
              <Plus size={13} /> Add Coin
            </button>
          </div>
          <div className="space-y-2">
            {config.paymentInfo.coins.map((coin, i) => (
              <div key={i} className={`grid grid-cols-1 sm:grid-cols-12 gap-2 pb-2 border-b ${divider} last:border-0 last:pb-0`}>
                <input
                  value={coin.icon}
                  onChange={(e) => updateCoin(i, "icon", e.target.value)}
                  placeholder="Icon"
                  className={`sm:col-span-1 px-2 py-2 rounded-lg border text-sm text-center outline-none ${inputBg}`}
                />
                <input
                  value={coin.symbol}
                  onChange={(e) => updateCoin(i, "symbol", e.target.value.toUpperCase())}
                  placeholder="Symbol"
                  className={`sm:col-span-2 px-2 py-2 rounded-lg border text-sm outline-none ${inputBg}`}
                />
                <input
                  value={coin.label}
                  onChange={(e) => updateCoin(i, "label", e.target.value)}
                  placeholder="Label"
                  className={`sm:col-span-2 px-2 py-2 rounded-lg border text-sm outline-none ${inputBg}`}
                />
                <input
                  value={coin.network}
                  onChange={(e) => updateCoin(i, "network", e.target.value)}
                  placeholder="Network"
                  className={`sm:col-span-2 px-2 py-2 rounded-lg border text-sm outline-none ${inputBg}`}
                />
                <input
                  value={coin.address}
                  onChange={(e) => updateCoin(i, "address", e.target.value)}
                  placeholder="Deposit address"
                  className={`sm:col-span-4 px-3 py-2 rounded-lg border text-sm outline-none font-mono ${inputBg}`}
                />
                <button
                  type="button"
                  onClick={() => removeCoin(i)}
                  title="Remove coin"
                  className="sm:col-span-1 flex items-center justify-center px-2 py-2 rounded-lg text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </Panel>

        {message && <p className="text-xs text-violet-400">{message}</p>}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-600/30 disabled:opacity-60"
        >
          <Save size={15} /> {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </>
  );
}

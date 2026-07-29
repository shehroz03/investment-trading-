import { supabase } from "@/lib/supabase";

export interface InvestmentPlan {
  label: string;
  minAmount: number;
  dailyRoiPercent: number;
}

export interface PaymentCoin {
  symbol: string;
  label: string;
  icon: string;
  network: string;
  address: string;
}

export interface PaymentInfo {
  binancePayId: string;
  binancePayLink: string;
  coins: PaymentCoin[];
}

export interface AppConfig {
  plans: Record<string, InvestmentPlan>;
  paymentInfo: PaymentInfo;
}

const DEFAULT_CONFIG: AppConfig = {
  plans: {
    starter: { label: "Starter", minAmount: 50, dailyRoiPercent: 0.5 },
    growth: { label: "Growth", minAmount: 500, dailyRoiPercent: 0.8 },
    pro: { label: "Pro", minAmount: 2000, dailyRoiPercent: 1.2 },
  },
  // Sample placeholders — an admin can replace these from Admin > Settings.
  paymentInfo: {
    binancePayId: "123456789",
    binancePayLink: "https://www.binance.com/en/my/wallet/account/payment",
    coins: [
      { symbol: "BTC", label: "Bitcoin", icon: "₿", network: "Bitcoin", address: "bc1qsample00000000000000000000000000000000" },
      { symbol: "ETH", label: "Ethereum", icon: "Ξ", network: "ERC20", address: "0xSAMPLE0000000000000000000000000000000000" },
      { symbol: "USDC", label: "USD Coin", icon: "$", network: "ERC20", address: "0xSAMPLE0000000000000000000000000000000000" },
      { symbol: "SOL", label: "Solana", icon: "S", network: "Solana", address: "SoLSAMPLE0000000000000000000000000000000" },
      { symbol: "PYUSD", label: "PayPal USD", icon: "$", network: "ERC20", address: "0xSAMPLE0000000000000000000000000000000000" },
      { symbol: "USDT", label: "Tether", icon: "₮", network: "TRC20", address: "TSAMPLE00000000000000000000000000000000" },
      { symbol: "XRP", label: "XRP", icon: "X", network: "XRP Ledger", address: "rSAMPLE00000000000000000000000000000000" },
      { symbol: "BNB", label: "BNB", icon: "B", network: "BEP20", address: "bnb1sample0000000000000000000000000000000" },
      { symbol: "TRX", label: "TRON", icon: "T", network: "TRON", address: "TSAMPLE00000000000000000000000000000000" },
      { symbol: "ADA", label: "Cardano", icon: "A", network: "Cardano", address: "addr1sample0000000000000000000000000000000" },
    ],
  },
};

let cache: AppConfig | null = null;

function mergeWithDefaults(data: Partial<AppConfig>): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    ...data,
    paymentInfo: { ...DEFAULT_CONFIG.paymentInfo, ...(data.paymentInfo ?? {}) },
  };
}

export async function getAppConfig(forceRefresh = false): Promise<AppConfig> {
  if (cache && !forceRefresh) return cache;
  const { data, error } = await supabase.from('config').select('data').eq('doc', 'settings').single();
  
  if (data && data.data) {
    cache = mergeWithDefaults(data.data as Partial<AppConfig>);
    return cache;
  }
  
  if (error && error.code === 'PGRST116') {
    await supabase.from('config').insert({ doc: 'settings', data: DEFAULT_CONFIG });
    cache = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
  
  if (error) throw error;
  return DEFAULT_CONFIG;
}

export async function updateAppConfig(patch: Partial<AppConfig>): Promise<void> {
  const current = await getAppConfig();
  const merged = { ...current, ...patch };
  
  const { error } = await supabase.from('config').update({ data: merged }).eq('doc', 'settings');
  if (error) throw error;
  
  cache = null;
  await getAppConfig(true);
}

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { type User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface UserProfile {
  uid: string;
  name: string;
  username: string;
  email: string;
  role: "user" | "admin";
  kycStatus: "none" | "pending" | "approved" | "rejected";
  vipStatus: "none" | "pending" | "approved" | "rejected";
  creditScore: number;
  profileCompletionPercent: number;
  referralCode?: string | null;
  referredBy?: string | null;
  createdAt: string;
}

export interface Wallet {
  available: number;
  locked: number;
  demo_available: number;
  demo_locked: number;
  pending: number;
  pendingOrder: number;
  unlockTarget: number | null;
  firstTradePlaced: boolean;
  lastInterestAt: string | null;
  totalDeposits: number;
  totalWithdrawals: number;
  totalEarnings: number;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  wallet: Wallet | null;
  loading: boolean;
  isDemo: boolean;
  setIsDemo: (demo: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profileResolved, setProfileResolved] = useState(false);
  const [walletResolved, setWalletResolved] = useState(false);
  const [isDemo, setIsDemoState] = useState(() => {
    try {
      return localStorage.getItem('tradeMode') === 'demo';
    } catch {
      return false;
    }
  });

  const setIsDemo = (demo: boolean) => {
    setIsDemoState(demo);
    try {
      localStorage.setItem('tradeMode', demo ? 'demo' : 'real');
    } catch {
      // localStorage might not be available
    }
  };

  useEffect(() => {
    // Initial session check — runs once on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthResolved(true);
    });

    // Only react to actual sign-in / sign-out events.
    // TOKEN_REFRESHED fires every time the tab regains focus and would
    // reset `authResolved` → `loading = true` → full-screen spinner flash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
          setUser(session?.user ?? null);
          setAuthResolved(true);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = user?.id;

    if (!userId) {
      setProfile(null);
      setWallet(null);
      setProfileResolved(true);
      setWalletResolved(true);
      return;
    }

    setProfileResolved(false);
    setWalletResolved(false);

    const mapProfile = (pData: any): UserProfile => ({
      uid: pData.id,
      name: pData.name,
      username: pData.username,
      email: pData.email,
      role: pData.role,
      kycStatus: pData.kyc_status,
      vipStatus: pData.vip_status,
      creditScore: pData.credit_score,
      profileCompletionPercent: pData.profile_completion_percent,
      referralCode: pData.referral_code,
      referredBy: pData.referred_by,
      createdAt: pData.created_at,
    });

    const mapWallet = (wData: any): Wallet => ({
      available: wData.available ?? 0,
      locked: wData.locked ?? 0,
      demo_available: wData.demo_available ?? 0,
      demo_locked: wData.demo_locked ?? 0,
      pending: wData.pending ?? 0,
      pendingOrder: wData.pendingOrder ?? 0,
      unlockTarget: wData.unlockTarget ?? null,
      firstTradePlaced: wData.firstTradePlaced ?? false,
      lastInterestAt: wData.lastInterestAt ?? null,
      totalDeposits: wData.totalDeposits ?? 0,
      totalWithdrawals: wData.totalWithdrawals ?? 0,
      totalEarnings: wData.totalEarnings ?? 0,
    });

    const fetchInitialData = async () => {
      let pData = null;
      
      // Retry up to 4 times (2 seconds total) to allow auth.ts to finish inserting the profile
      for (let i = 0; i < 4; i++) {
        const { data } = await supabase.from('users').select('*').eq('id', userId).single();
        if (data) {
          pData = data;
          break;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      
      // If the user record is not found in the database (e.g. after a DB wipe),
      // force logout to clear the stale session from the browser.
      if (!pData) {
        await supabase.auth.signOut();
        setProfileResolved(true);
        setWalletResolved(true);
        return;
      }
      
      setProfile(mapProfile(pData));
      setProfileResolved(true);

      const { data: wData } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
      if (wData) setWallet(mapWallet(wData));
      setWalletResolved(true);
    };

    fetchInitialData();

    const profileChannel = supabase.channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, (payload) => {
        setProfile(mapProfile(payload.new));
      })
      .subscribe();

    const walletChannel = supabase.channel('public:wallets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, (payload) => {
        setWallet(mapWallet(payload.new));
      })
      .subscribe();

    return () => {
      profileChannel.unsubscribe();
      walletChannel.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loading = !authResolved || (!!user && (!profileResolved || !walletResolved));

  return (
    <AuthContext.Provider value={{ user, profile, wallet, loading, isDemo, setIsDemo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

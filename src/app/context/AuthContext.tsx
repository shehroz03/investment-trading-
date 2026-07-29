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
  createdAt: string;
}

export interface Wallet {
  available: number;
  locked: number;
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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [profileResolved, setProfileResolved] = useState(false);
  const [walletResolved, setWalletResolved] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthResolved(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setAuthResolved(true);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
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
      createdAt: pData.created_at,
    });

    const mapWallet = (wData: any): Wallet => ({
      available: wData.available ?? 0,
      locked: wData.locked ?? 0,
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
      const { data: pData, error: pError } = await supabase.from('users').select('*').eq('id', user.id).single();
      
      // Agar database mein user ka record nahi milta (maslan DB wipe hone ke baad), 
      // toh purana session browser se nikalne ke liye force logout karein.
      if (!pData) {
        await supabase.auth.signOut();
        setProfileResolved(true);
        setWalletResolved(true);
        return;
      }
      
      setProfile(mapProfile(pData));
      setProfileResolved(true);

      const { data: wData } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
      if (wData) setWallet(mapWallet(wData));
      setWalletResolved(true);
    };

    fetchInitialData();

    const profileChannel = supabase.channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${user.id}` }, (payload) => {
        setProfile(mapProfile(payload.new));
      })
      .subscribe();

    const walletChannel = supabase.channel('public:wallets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` }, (payload) => {
        setWallet(mapWallet(payload.new));
      })
      .subscribe();

    return () => {
      profileChannel.unsubscribe();
      walletChannel.unsubscribe();
    };
  }, [user]);

  const loading = !authResolved || (!!user && (!profileResolved || !walletResolved));

  return (
    <AuthContext.Provider value={{ user, profile, wallet, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

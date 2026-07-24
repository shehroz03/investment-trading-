import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  name: string;
  username: string;
  email: string;
  role: "user" | "admin";
  kycStatus: "none" | "pending" | "approved" | "rejected";
  creditScore: number;
  profileCompletionPercent: number;
  createdAt: Timestamp;
}

export interface Wallet {
  available: number;
  locked: number;
  pending: number;
  pendingOrder: number;
  unlockTarget: number | null;
  firstTradePlaced: boolean;
  lastInterestAt: Timestamp | null;
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthResolved(true);
      if (!firebaseUser) {
        setProfile(null);
        setWallet(null);
        setProfileResolved(true);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    setProfileResolved(false);
    const unsubProfile = onSnapshot(doc(db, "users", user.uid), (snap) => {
      setProfile(snap.exists() ? ({ uid: user.uid, ...snap.data() } as UserProfile) : null);
      setProfileResolved(true);
    });
    const unsubWallet = onSnapshot(doc(db, "wallets", user.uid), (snap) => {
      if (!snap.exists()) {
        setWallet(null);
        return;
      }
      // Wallet docs created before pendingOrder/unlockTarget/firstTradePlaced existed won't
      // have those fields in Firestore yet — default them so consumers always get a number.
      const data = snap.data();
      setWallet({
        available: data.available ?? 0,
        locked: data.locked ?? 0,
        pending: data.pending ?? 0,
        pendingOrder: data.pendingOrder ?? 0,
        unlockTarget: data.unlockTarget ?? null,
        firstTradePlaced: data.firstTradePlaced ?? false,
        lastInterestAt: data.lastInterestAt ?? null,
        totalDeposits: data.totalDeposits ?? 0,
        totalWithdrawals: data.totalWithdrawals ?? 0,
        totalEarnings: data.totalEarnings ?? 0,
      });
    });

    return () => {
      unsubProfile();
      unsubWallet();
    };
  }, [user]);

  const loading = !authResolved || (!!user && !profileResolved);

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

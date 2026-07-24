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
      setWallet(snap.exists() ? (snap.data() as Wallet) : null);
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

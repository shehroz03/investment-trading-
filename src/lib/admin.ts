import { collection, doc, getDocs, orderBy, query, updateDoc, where, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserProfile } from "@/app/context/AuthContext";
import type { Trade } from "@/lib/trading";

export interface PendingDeposit {
  id: string;
  uid: string;
  amount: number;
  method: string;
  proofUrl: string;
  purpose: "wallet" | "investment";
  plan: string | null;
  createdAt: Timestamp | null;
}

export interface PendingWithdrawal {
  id: string;
  uid: string;
  amount: number;
  method: string;
  destination: string;
  createdAt: Timestamp | null;
}

export interface PendingKyc {
  uid: string;
  personalInfo: { fullName: string; dateOfBirth: string; address: string; country: string };
  idProofUrl: string;
  addressProofUrl: string;
  selfieUrl: string;
  submittedAt: Timestamp | null;
}

export async function getPendingDeposits(): Promise<PendingDeposit[]> {
  const snap = await getDocs(
    query(collection(db, "deposits"), where("status", "==", "pending"), orderBy("createdAt", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PendingDeposit);
}

export async function getPendingWithdrawals(): Promise<PendingWithdrawal[]> {
  const snap = await getDocs(
    query(collection(db, "withdrawals"), where("status", "==", "pending"), orderBy("createdAt", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PendingWithdrawal);
}

export async function getPendingKyc(): Promise<PendingKyc[]> {
  const snap = await getDocs(
    query(collection(db, "kyc"), where("status", "==", "pending"), orderBy("submittedAt", "asc"))
  );
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as PendingKyc);
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile);
}

export async function setUserRole(uid: string, role: "user" | "admin"): Promise<void> {
  await updateDoc(doc(db, "users", uid), { role });
}

export async function setUserProfileStats(
  uid: string,
  data: { creditScore: number; profileCompletionPercent: number }
): Promise<void> {
  await updateDoc(doc(db, "users", uid), data);
}

export async function getAllTrades(): Promise<Trade[]> {
  const snap = await getDocs(query(collection(db, "trades"), orderBy("openedAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trade);
}

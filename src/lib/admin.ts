import {
  collection,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserProfile } from "@/app/context/AuthContext";
import type { Trade } from "@/lib/trading";
import { creditAvailableInTransaction, creditPendingOrderAndRecoverLocked } from "@/lib/wallet";

export interface PendingDeposit {
  id: string;
  uid: string;
  amount: number;
  method: string;
  proofUrl: string;
  purpose: "wallet" | "investment" | "order";
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

export async function creditUserWallet(uid: string, amount: number, note: string): Promise<void> {
  const walletRef = doc(db, "wallets", uid);
  await runTransaction(db, async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const walletData = walletSnap.data() ?? {};
    const currentAvailable = (walletData.available as number) ?? 0;

    creditAvailableInTransaction(tx, uid, walletRef, walletData, currentAvailable + amount, {
      totalEarnings: increment(amount),
    });
    tx.set(doc(collection(db, "transactions")), {
      uid,
      type: "admin_credit",
      amount,
      note: note || "Admin credit",
      createdAt: serverTimestamp(),
    });
  });
}

export interface WalletSummary {
  available: number;
  pendingOrder: number;
  locked: number;
  unlockTarget: number | null;
}

export async function getAllWallets(): Promise<Record<string, WalletSummary>> {
  const snap = await getDocs(collection(db, "wallets"));
  const summaries: Record<string, WalletSummary> = {};
  snap.docs.forEach((d) => {
    summaries[d.id] = {
      available: (d.data().available as number) ?? 0,
      pendingOrder: (d.data().pendingOrder as number) ?? 0,
      locked: (d.data().locked as number) ?? 0,
      unlockTarget: (d.data().unlockTarget as number | null) ?? null,
    };
  });
  return summaries;
}

// Sets the Available-balance threshold the user must reach before their Locked balance
// automatically sweeps into Pending Order Balance. Checks immediately in case the wallet's
// current available balance already meets the new target — otherwise it would sit locked
// until the next unrelated balance credit happened to trigger the check.
export async function setUnlockTarget(uid: string, targetAvailable: number | null): Promise<void> {
  const walletRef = doc(db, "wallets", uid);
  await runTransaction(db, async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const walletData = walletSnap.data() ?? {};
    const currentAvailable = (walletData.available as number) ?? 0;

    creditAvailableInTransaction(tx, uid, walletRef, walletData, currentAvailable, {}, targetAvailable);
  });
}

// Directly overwrites the user's available balance (as opposed to creditUserWallet's
// increment-by-amount), for the inline "Total Money" edit in the users table. Still logs
// the resulting delta as a transaction so the balance change stays auditable.
export async function setUserWalletBalance(uid: string, newAvailable: number, previousAvailable: number): Promise<void> {
  const delta = newAvailable - previousAvailable;
  if (delta === 0) return;

  const walletRef = doc(db, "wallets", uid);
  await runTransaction(db, async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const walletData = walletSnap.data() ?? {};

    creditAvailableInTransaction(tx, uid, walletRef, walletData, newAvailable);
    tx.set(doc(collection(db, "transactions")), {
      uid,
      type: "admin_balance_adjustment",
      amount: delta,
      note: "Admin balance adjustment",
      createdAt: serverTimestamp(),
    });
  });
}

// Directly overwrites the user's Pending Order Balance, for the inline "Pending Order
// Balance" edit in the users table — an admin-controlled alternative to the user submitting
// a "Fund Order Balance" deposit request. Raising it counts as a deposit and runs the same
// creditPendingOrderAndRecoverLocked recovery (dollar-for-dollar out of Locked Balance);
// lowering it is just a plain field write. Still logs the resulting delta as a transaction.
export async function setUserPendingOrderBalance(uid: string, newPendingOrder: number, previousPendingOrder: number): Promise<void> {
  const delta = newPendingOrder - previousPendingOrder;
  if (delta === 0) return;

  const walletRef = doc(db, "wallets", uid);
  await runTransaction(db, async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const walletData = walletSnap.data() ?? {};

    if (delta > 0) {
      creditPendingOrderAndRecoverLocked(tx, uid, walletRef, walletData, delta);
    } else {
      tx.update(walletRef, { pendingOrder: newPendingOrder });
    }
    tx.set(doc(collection(db, "transactions")), {
      uid,
      type: "admin_pending_order_adjustment",
      amount: delta,
      note: "Admin Pending Order Balance adjustment",
      createdAt: serverTimestamp(),
    });
  });
}

// Directly overwrites the user's Locked Balance, for the inline "Locked Balance" edit in the
// users table. Same plain-field-write shape as setUserPendingOrderBalance — it does not run
// the unlockTarget check itself, so if you set a locked amount while an unlockTarget is
// already satisfied by the current available balance, it will sit locked until the next
// event that does check (a balance credit, or re-saving the Unlock Target field).
export async function setUserLockedBalance(uid: string, newLocked: number, previousLocked: number): Promise<void> {
  const delta = newLocked - previousLocked;
  if (delta === 0) return;

  const batch = writeBatch(db);
  batch.update(doc(db, "wallets", uid), { locked: newLocked });
  batch.set(doc(collection(db, "transactions")), {
    uid,
    type: "admin_locked_adjustment",
    amount: delta,
    note: "Admin Locked Balance adjustment",
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

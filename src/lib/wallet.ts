import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type DocumentReference,
  type Transaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAppConfig } from "@/lib/config";
import { uploadToCloudinary } from "@/lib/cloudinary";

export type DepositPurpose = "wallet" | "investment" | "order";

// Every code path that can raise a wallet's `available` balance (deposit approval, admin
// "Add Money", admin "Total Money" override) must set the new value through this helper —
// it's the only place that checks an admin-set unlockTarget and sweeps Locked straight into
// Available when the new available balance reaches it. Call it from inside an already-open
// transaction so the credit and the unlock sweep stay atomic with whatever else that write does.
// `unlockTargetOverride` lets a caller check against a target that isn't in `walletData` yet —
// e.g. setUnlockTarget uses it to unlock immediately if the wallet already qualifies the
// moment a new target is set, instead of only checking on the next balance credit.
export function creditAvailableInTransaction(
  tx: Transaction,
  uid: string,
  walletRef: DocumentReference,
  walletData: Record<string, unknown>,
  newAvailable: number,
  extraWalletFields: Record<string, unknown> = {},
  unlockTargetOverride?: number | null
): { unlockedAmount: number } {
  const currentLocked = (walletData.locked as number) ?? 0;
  const unlockTarget =
    unlockTargetOverride !== undefined ? unlockTargetOverride : ((walletData.unlockTarget as number | null) ?? null);
  const shouldUnlock = unlockTarget != null && currentLocked > 0 && newAvailable >= unlockTarget;

  const walletUpdate: Record<string, unknown> = { ...extraWalletFields, available: newAvailable };
  if (shouldUnlock) {
    walletUpdate.locked = 0;
    walletUpdate.available = newAvailable + currentLocked;
    walletUpdate.unlockTarget = null;
  } else if (unlockTargetOverride !== undefined) {
    walletUpdate.unlockTarget = unlockTargetOverride;
  }
  tx.update(walletRef, walletUpdate);

  if (shouldUnlock) {
    tx.set(doc(collection(db, "transactions")), {
      uid,
      type: "balance_unlock",
      amount: currentLocked,
      note: "Balance unlocked — moved to Available Balance",
      createdAt: serverTimestamp(),
    });
  }

  return { unlockedAmount: shouldUnlock ? currentLocked : 0 };
}

// Pending Order Balance's only role now is recovering Locked Balance: depositing into it
// (an approved "Fund Order Balance" deposit, or an admin setting it directly) converts an
// equal dollar amount from Locked into Available, capped at whatever's actually locked — any
// deposit beyond that just accumulates in Pending Order Balance with nothing left to recover.
// It is no longer involved in placing trades (see api/openTrade.js / api/closeTrade.js, which
// use Available directly).
export function creditPendingOrderAndRecoverLocked(
  tx: Transaction,
  uid: string,
  walletRef: DocumentReference,
  walletData: Record<string, unknown>,
  depositAmount: number,
  extraWalletFields: Record<string, unknown> = {}
): { recoveredAmount: number } {
  const currentLocked = (walletData.locked as number) ?? 0;
  const recoveredAmount = Math.min(depositAmount, Math.max(0, currentLocked));

  const walletUpdate: Record<string, unknown> = { ...extraWalletFields, pendingOrder: increment(depositAmount) };
  if (recoveredAmount > 0) {
    walletUpdate.locked = increment(-recoveredAmount);
    walletUpdate.available = increment(recoveredAmount);
  }
  tx.update(walletRef, walletUpdate);

  if (recoveredAmount > 0) {
    tx.set(doc(collection(db, "transactions")), {
      uid,
      type: "balance_unlock",
      amount: recoveredAmount,
      note: "Locked balance recovered via Pending Order Balance deposit",
      createdAt: serverTimestamp(),
    });
  }

  return { recoveredAmount };
}

interface CreateDepositParams {
  uid: string;
  amount: number;
  method: string;
  proofFile: File;
  purpose: DepositPurpose;
  plan?: string;
}

export async function createDepositRequest({
  uid,
  amount,
  method,
  proofFile,
  purpose,
  plan,
}: CreateDepositParams) {
  const proofUrl = await uploadToCloudinary(proofFile, `deposit-proofs/${uid}`);

  await addDoc(collection(db, "deposits"), {
    uid,
    amount,
    method,
    proofUrl,
    purpose,
    plan: plan ?? null,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

interface CreateWithdrawParams {
  uid: string;
  amount: number;
  method: string;
  destination: string;
}

export async function createWithdrawRequest({ uid, amount, method, destination }: CreateWithdrawParams) {
  const walletRef = doc(db, "wallets", uid);

  await runTransaction(db, async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const available = (walletSnap.data()?.available as number) ?? 0;
    if (amount <= 0) throw new Error("Amount must be greater than zero.");
    if (amount > available) throw new Error("Amount exceeds your available balance.");

    tx.update(walletRef, {
      available: increment(-amount),
      pending: increment(amount),
    });

    const withdrawalRef = doc(collection(db, "withdrawals"));
    tx.set(withdrawalRef, {
      uid,
      amount,
      method,
      destination,
      status: "pending",
      createdAt: serverTimestamp(),
    });
  });
}

export async function approveDeposit(depositId: string, reviewedBy: string) {
  const depositRef = doc(db, "deposits", depositId);
  const depositSnap = await getDoc(depositRef);
  if (!depositSnap.exists() || depositSnap.data().status !== "pending") return;
  const deposit = depositSnap.data() as {
    uid: string;
    amount: number;
    purpose: DepositPurpose;
    plan: string | null;
  };

  const walletRef = doc(db, "wallets", deposit.uid);

  if (deposit.purpose === "wallet") {
    // Reads the wallet so a top-up that pushes `available` past an admin-set unlockTarget
    // can also sweep locked -> available in the same transaction.
    await runTransaction(db, async (tx) => {
      const walletSnap = await tx.get(walletRef);
      const walletData = walletSnap.data() ?? {};
      const currentAvailable = (walletData.available as number) ?? 0;

      creditAvailableInTransaction(tx, deposit.uid, walletRef, walletData, currentAvailable + deposit.amount, {
        totalDeposits: increment(deposit.amount),
      });
      tx.update(depositRef, { status: "approved", reviewedAt: serverTimestamp(), reviewedBy });
      tx.set(doc(collection(db, "transactions")), {
        uid: deposit.uid,
        type: "deposit",
        amount: deposit.amount,
        note: "Wallet deposit",
        createdAt: serverTimestamp(),
      });
    });
    return;
  }

  if (deposit.purpose === "order") {
    // Reads the wallet so this deposit can also recover Locked Balance in the same transaction.
    await runTransaction(db, async (tx) => {
      const walletSnap = await tx.get(walletRef);
      const walletData = walletSnap.data() ?? {};

      creditPendingOrderAndRecoverLocked(tx, deposit.uid, walletRef, walletData, deposit.amount, {
        totalDeposits: increment(deposit.amount),
      });
      tx.update(depositRef, { status: "approved", reviewedAt: serverTimestamp(), reviewedBy });
      tx.set(doc(collection(db, "transactions")), {
        uid: deposit.uid,
        type: "deposit",
        amount: deposit.amount,
        note: "Order balance funding",
        createdAt: serverTimestamp(),
      });
    });
    return;
  }

  // purpose === "investment"
  const config = await getAppConfig();
  const batch = writeBatch(db);

  batch.update(depositRef, {
    status: "approved",
    reviewedAt: serverTimestamp(),
    reviewedBy,
  });
  batch.update(walletRef, {
    totalDeposits: increment(deposit.amount),
  });

  const plan = deposit.plan ? config.plans[deposit.plan] : undefined;
  batch.set(doc(collection(db, "investments")), {
    uid: deposit.uid,
    plan: deposit.plan,
    amount: deposit.amount,
    dailyRoiPercent: plan?.dailyRoiPercent ?? 0,
    status: "active",
    startDate: serverTimestamp(),
  });

  batch.set(doc(collection(db, "transactions")), {
    uid: deposit.uid,
    type: "deposit",
    amount: deposit.amount,
    note: `Investment (${deposit.plan})`,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function rejectDeposit(depositId: string, reviewedBy: string) {
  await writeBatch(db)
    .update(doc(db, "deposits", depositId), {
      status: "rejected",
      reviewedAt: serverTimestamp(),
      reviewedBy,
    })
    .commit();
}

export async function approveWithdrawal(withdrawalId: string, reviewedBy: string) {
  const withdrawalRef = doc(db, "withdrawals", withdrawalId);
  const snap = await getDoc(withdrawalRef);
  if (!snap.exists() || snap.data().status !== "pending") return;
  const withdrawal = snap.data() as { uid: string; amount: number };

  const batch = writeBatch(db);
  batch.update(withdrawalRef, {
    status: "approved",
    reviewedAt: serverTimestamp(),
    reviewedBy,
  });
  batch.update(doc(db, "wallets", withdrawal.uid), {
    pending: increment(-withdrawal.amount),
    totalWithdrawals: increment(withdrawal.amount),
  });
  batch.set(doc(collection(db, "transactions")), {
    uid: withdrawal.uid,
    type: "withdrawal",
    amount: withdrawal.amount,
    note: "Withdrawal",
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function rejectWithdrawal(withdrawalId: string, reviewedBy: string) {
  const withdrawalRef = doc(db, "withdrawals", withdrawalId);
  const snap = await getDoc(withdrawalRef);
  if (!snap.exists() || snap.data().status !== "pending") return;
  const withdrawal = snap.data() as { uid: string; amount: number };

  const batch = writeBatch(db);
  batch.update(withdrawalRef, {
    status: "rejected",
    reviewedAt: serverTimestamp(),
    reviewedBy,
  });
  batch.update(doc(db, "wallets", withdrawal.uid), {
    pending: increment(-withdrawal.amount),
    available: increment(withdrawal.amount),
  });
  await batch.commit();
}

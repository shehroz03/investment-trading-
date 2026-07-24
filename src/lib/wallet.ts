import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAppConfig } from "@/lib/config";
import { uploadToCloudinary } from "@/lib/cloudinary";

export type DepositPurpose = "wallet" | "investment";

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

  const config = await getAppConfig();
  const batch = writeBatch(db);

  batch.update(depositRef, {
    status: "approved",
    reviewedAt: serverTimestamp(),
    reviewedBy,
  });

  const walletRef = doc(db, "wallets", deposit.uid);

  if (deposit.purpose === "investment") {
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
  } else {
    batch.update(walletRef, {
      available: increment(deposit.amount),
      totalDeposits: increment(deposit.amount),
    });
  }

  batch.set(doc(collection(db, "transactions")), {
    uid: deposit.uid,
    type: "deposit",
    amount: deposit.amount,
    note: deposit.purpose === "investment" ? `Investment (${deposit.plan})` : "Wallet deposit",
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

import { doc, getDoc, serverTimestamp, writeBatch, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type VipStatus = "none" | "pending" | "approved" | "rejected";

export interface VipRecord {
  note: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: Timestamp | null;
  reviewedAt?: Timestamp | null;
}

// Approved VIP status raises the $5,000 per-withdrawal cap enforced in
// createWithdrawRequest (src/lib/wallet.ts) and mirrored in firestore.rules.
export async function submitVipRequest(uid: string, note: string): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, "vip", uid), {
    note,
    status: "pending",
    submittedAt: serverTimestamp(),
  });
  batch.update(doc(db, "users", uid), { vipStatus: "pending" });
  await batch.commit();
}

export async function getVipRecord(uid: string): Promise<VipRecord | null> {
  const snap = await getDoc(doc(db, "vip", uid));
  return snap.exists() ? (snap.data() as VipRecord) : null;
}

export async function reviewVipRequest(uid: string, status: "approved" | "rejected"): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "vip", uid), { status, reviewedAt: serverTimestamp() });
  batch.update(doc(db, "users", uid), { vipStatus: status });
  await batch.commit();
}

import { collection, getDocs, orderBy, query, where, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "roi"
  | "trade_pnl"
  | "admin_credit"
  | "admin_balance_adjustment"
  | "admin_pending_order_adjustment"
  | "admin_locked_adjustment"
  | "order_lock"
  | "balance_unlock";

export interface TransactionRecord {
  id: string;
  uid: string;
  type: TransactionType;
  amount: number;
  note: string;
  createdAt: Timestamp | null;
}

export async function getUserTransactions(uid: string): Promise<TransactionRecord[]> {
  const snap = await getDocs(
    query(collection(db, "transactions"), where("uid", "==", uid), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TransactionRecord);
}

export interface PeriodGroup {
  key: string;
  count: number;
  total: number;
  rows: TransactionRecord[];
}

export function groupByPeriod(rows: TransactionRecord[], granularity: "day" | "month"): PeriodGroup[] {
  const groups = new Map<string, PeriodGroup>();

  for (const row of rows) {
    const date = row.createdAt?.toDate();
    if (!date) continue;
    const key =
      granularity === "day"
        ? date.toISOString().slice(0, 10)
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const existing = groups.get(key) ?? { key, count: 0, total: 0, rows: [] };
    existing.count += 1;
    existing.total += row.amount;
    existing.rows.push(row);
    groups.set(key, existing);
  }

  return [...groups.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

export function exportTransactionsToCsv(rows: TransactionRecord[], filename: string) {
  const header = ["Date", "Type", "Amount", "Note"];
  const lines = rows.map((r) => [
    r.createdAt ? r.createdAt.toDate().toISOString() : "",
    r.type,
    r.amount.toFixed(2),
    r.note.replace(/,/g, ";"),
  ]);
  const csv = [header, ...lines].map((line) => line.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

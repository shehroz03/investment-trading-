import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface SignUpParams {
  name: string;
  username: string;
  email: string;
  password: string;
}

export async function signUp({ name, username, email, password }: SignUpParams) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });

  const uid = credential.user.uid;
  const batch = writeBatch(db);

  batch.set(doc(db, "users", uid), {
    name,
    username,
    email,
    role: "user",
    kycStatus: "none",
    vipStatus: "none",
    creditScore: 50,
    profileCompletionPercent: 0,
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, "wallets", uid), {
    available: 0,
    locked: 0,
    pending: 0,
    pendingOrder: 0,
    unlockTarget: null,
    firstTradePlaced: false,
    lastInterestAt: serverTimestamp(),
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalEarnings: 0,
  });

  await batch.commit();

  return credential.user;
}

export async function logIn(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logOut() {
  await signOut(auth);
}

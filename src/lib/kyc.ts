import { doc, getDoc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";

export interface KycPersonalInfo {
  fullName: string;
  dateOfBirth: string;
  address: string;
  country: string;
}

export interface KycRecord {
  personalInfo: KycPersonalInfo;
  idProofUrl: string;
  addressProofUrl: string;
  selfieUrl: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: unknown;
}

async function uploadKycFile(uid: string, label: string, file: File) {
  return uploadToCloudinary(file, `kyc/${uid}/${label}`);
}

export async function submitKyc(
  uid: string,
  personalInfo: KycPersonalInfo,
  files: { idProof: File; addressProof: File; selfie: File }
) {
  const [idProofUrl, addressProofUrl, selfieUrl] = await Promise.all([
    uploadKycFile(uid, "id-proof", files.idProof),
    uploadKycFile(uid, "address-proof", files.addressProof),
    uploadKycFile(uid, "selfie", files.selfie),
  ]);

  const batch = writeBatch(db);
  batch.set(doc(db, "kyc", uid), {
    personalInfo,
    idProofUrl,
    addressProofUrl,
    selfieUrl,
    status: "pending",
    submittedAt: serverTimestamp(),
  });
  batch.update(doc(db, "users", uid), { kycStatus: "pending" });
  await batch.commit();
}

export async function getKyc(uid: string): Promise<KycRecord | null> {
  const snap = await getDoc(doc(db, "kyc", uid));
  return snap.exists() ? (snap.data() as KycRecord) : null;
}

export async function reviewKyc(uid: string, status: "approved" | "rejected") {
  const batch = writeBatch(db);
  batch.update(doc(db, "kyc", uid), { status, reviewedAt: serverTimestamp() });
  batch.update(doc(db, "users", uid), { kycStatus: status });
  await batch.commit();
}

// Lets an admin correct a submitted KYC record (e.g. a typo'd name or address) before
// approving/rejecting it. Firestore rules already allow admins full write access to `kyc/{uid}`,
// so this is a plain client-side update — no serverless endpoint needed.
export async function updateKycInfo(uid: string, personalInfo: KycPersonalInfo): Promise<void> {
  await updateDoc(doc(db, "kyc", uid), { personalInfo });
}

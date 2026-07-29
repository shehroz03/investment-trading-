import { supabase } from "@/lib/supabase";
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

  const { error: kycError } = await supabase.from('kyc').insert({
    uid,
    "personalInfo": personalInfo,
    "idProofUrl": idProofUrl,
    "addressProofUrl": addressProofUrl,
    "selfieUrl": selfieUrl,
    status: "pending",
  });
  if (kycError) throw kycError;

  const { error: userError } = await supabase.from('users').update({ kyc_status: "pending" }).eq('id', uid);
  if (userError) throw userError;
}

export async function getKyc(uid: string): Promise<KycRecord | null> {
  const { data, error } = await supabase.from('kyc').select('*').eq('uid', uid).single();
  if (error || !data) return null;
  
  return {
    personalInfo: data.personalInfo,
    idProofUrl: data.idProofUrl,
    addressProofUrl: data.addressProofUrl,
    selfieUrl: data.selfieUrl,
    status: data.status,
    submittedAt: data.submittedAt,
  } as KycRecord;
}

export async function reviewKyc(uid: string, status: "approved" | "rejected") {
  const { error: kycError } = await supabase.from('kyc').update({ status }).eq('uid', uid);
  if (kycError) throw kycError;

  const { error: userError } = await supabase.from('users').update({ kyc_status: status }).eq('id', uid);
  if (userError) throw userError;
}

export async function updateKycInfo(uid: string, personalInfo: KycPersonalInfo): Promise<void> {
  const { error } = await supabase.from('kyc').update({ "personalInfo": personalInfo }).eq('uid', uid);
  if (error) throw error;
}

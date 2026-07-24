import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  createdAt: unknown;
}

export interface GuideItem {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
}

export interface BannerItem {
  id: string;
  title: string;
  imageUrl: string;
}

export async function getNews(): Promise<NewsItem[]> {
  const snap = await getDocs(query(collection(db, "news"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NewsItem);
}

export async function getGuides(): Promise<GuideItem[]> {
  const snap = await getDocs(collection(db, "guides"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GuideItem);
}

export async function getBanners(): Promise<BannerItem[]> {
  const snap = await getDocs(collection(db, "banners"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BannerItem);
}

export async function createNews(title: string, body: string) {
  await addDoc(collection(db, "news"), { title, body, createdAt: serverTimestamp() });
}

export async function deleteNews(id: string) {
  await deleteDoc(doc(db, "news", id));
}

export async function createGuide(title: string, description: string, fileUrl: string) {
  await addDoc(collection(db, "guides"), { title, description, fileUrl });
}

export async function deleteGuide(id: string) {
  await deleteDoc(doc(db, "guides", id));
}

export async function createBanner(title: string, imageUrl: string) {
  await addDoc(collection(db, "banners"), { title, imageUrl });
}

export async function deleteBanner(id: string) {
  await deleteDoc(doc(db, "banners", id));
}

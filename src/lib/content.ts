import { supabase } from "@/lib/supabase";

export interface NewsItem {
  id: string;
  title: string;
  content: string; // was body in firestore, but we used content in supabase SQL
  createdAt: string;
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
  const { data, error } = await supabase.from('news').select('*').order('createdAt', { ascending: false });
  if (error) throw error;
  return data as NewsItem[];
}

export async function getGuides(): Promise<GuideItem[]> {
  const { data, error } = await supabase.from('guides').select('*');
  if (error) throw error;
  return data as GuideItem[];
}

export async function getBanners(): Promise<BannerItem[]> {
  const { data, error } = await supabase.from('banners').select('*');
  if (error) throw error;
  return data as BannerItem[];
}

export async function createNews(title: string, content: string) {
  const { error } = await supabase.from('news').insert({ title, content });
  if (error) throw error;
}

export async function deleteNews(id: string) {
  const { error } = await supabase.from('news').delete().eq('id', id);
  if (error) throw error;
}

export async function createGuide(title: string, description: string, fileUrl: string) {
  const { error } = await supabase.from('guides').insert({ title, description, "fileUrl": fileUrl });
  if (error) throw error;
}

export async function deleteGuide(id: string) {
  const { error } = await supabase.from('guides').delete().eq('id', id);
  if (error) throw error;
}

export async function createBanner(title: string, imageUrl: string) {
  const { error } = await supabase.from('banners').insert({ title, "imageUrl": imageUrl });
  if (error) throw error;
}

export async function deleteBanner(id: string) {
  const { error } = await supabase.from('banners').delete().eq('id', id);
  if (error) throw error;
}

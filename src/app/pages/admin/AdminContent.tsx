import { useEffect, useState } from "react";
import { Newspaper, FileDown, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import {
  getNews,
  createNews,
  deleteNews,
  getGuides,
  createGuide,
  deleteGuide,
  getBanners,
  createBanner,
  deleteBanner,
  type NewsItem,
  type GuideItem,
  type BannerItem,
} from "@/lib/content";

function NewsSection() {
  const { textPrimary, textMuted, inputBg, divider } = useThemeClasses();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => getNews().then(setItems);
  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      await createNews(title, body);
      setTitle("");
      setBody("");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel>
      <div className="flex items-center gap-2 mb-4">
        <Newspaper size={16} className="text-blue-400" />
        <h3 className={`font-semibold text-sm ${textPrimary}`}>News & Updates</h3>
      </div>
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={`flex-1 px-3 py-2 rounded-lg border text-sm outline-none ${inputBg}`} />
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" className={`flex-1 px-3 py-2 rounded-lg border text-sm outline-none ${inputBg}`} />
        <button type="submit" disabled={submitting} className="flex items-center justify-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold bg-violet-500/15 text-violet-400 border border-violet-500/30 disabled:opacity-60">
          <Plus size={13} /> Post
        </button>
      </form>
      <div className="space-y-2">
        {items.length === 0 && <p className={`text-xs ${textMuted}`}>No news posted yet.</p>}
        {items.map((n) => (
          <div key={n.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${divider}`}>
            <div>
              <p className={`text-sm font-medium ${textPrimary}`}>{n.title}</p>
              <p className={`text-xs ${textMuted}`}>{n.body}</p>
            </div>
            <button onClick={() => deleteNews(n.id).then(load)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 flex-shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function GuidesSection() {
  const { textPrimary, textMuted, inputBg, divider } = useThemeClasses();
  const [items, setItems] = useState<GuideItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => getGuides().then(setItems);
  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !fileUrl.trim()) return;
    setSubmitting(true);
    try {
      await createGuide(title, description, fileUrl);
      setTitle("");
      setDescription("");
      setFileUrl("");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel>
      <div className="flex items-center gap-2 mb-4">
        <FileDown size={16} className="text-orange-400" />
        <h3 className={`font-semibold text-sm ${textPrimary}`}>PDF Guides</h3>
      </div>
      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={`px-3 py-2 rounded-lg border text-sm outline-none ${inputBg}`} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className={`px-3 py-2 rounded-lg border text-sm outline-none ${inputBg}`} />
        <div className="flex gap-2">
          <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="PDF URL" className={`flex-1 px-3 py-2 rounded-lg border text-sm outline-none ${inputBg}`} />
          <button type="submit" disabled={submitting} className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-violet-500/15 text-violet-400 border border-violet-500/30 disabled:opacity-60 flex-shrink-0">
            <Plus size={13} />
          </button>
        </div>
      </form>
      <div className="space-y-2">
        {items.length === 0 && <p className={`text-xs ${textMuted}`}>No guides published yet.</p>}
        {items.map((g) => (
          <div key={g.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${divider}`}>
            <div>
              <p className={`text-sm font-medium ${textPrimary}`}>{g.title}</p>
              <p className={`text-xs ${textMuted}`}>{g.description}</p>
            </div>
            <button onClick={() => deleteGuide(g.id).then(load)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 flex-shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function BannersSection() {
  const { textPrimary, textMuted, inputBg, divider } = useThemeClasses();
  const [items, setItems] = useState<BannerItem[]>([]);
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => getBanners().then(setItems);
  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !imageUrl.trim()) return;
    setSubmitting(true);
    try {
      await createBanner(title, imageUrl);
      setTitle("");
      setImageUrl("");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel>
      <div className="flex items-center gap-2 mb-4">
        <ImageIcon size={16} className="text-purple-400" />
        <h3 className={`font-semibold text-sm ${textPrimary}`}>Social Banners</h3>
      </div>
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={`flex-1 px-3 py-2 rounded-lg border text-sm outline-none ${inputBg}`} />
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL" className={`flex-1 px-3 py-2 rounded-lg border text-sm outline-none ${inputBg}`} />
        <button type="submit" disabled={submitting} className="flex items-center justify-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold bg-violet-500/15 text-violet-400 border border-violet-500/30 disabled:opacity-60">
          <Plus size={13} /> Add
        </button>
      </form>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.length === 0 && <p className={`text-xs col-span-full ${textMuted}`}>No banners uploaded yet.</p>}
        {items.map((b) => (
          <div key={b.id} className={`rounded-lg border overflow-hidden ${divider}`}>
            <img src={b.imageUrl} alt={b.title} className="w-full aspect-video object-cover" />
            <div className="flex items-center justify-between p-2">
              <p className={`text-xs truncate ${textPrimary}`}>{b.title}</p>
              <button onClick={() => deleteBanner(b.id).then(load)} className="p-1 rounded text-red-400 hover:bg-red-500/10 flex-shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function AdminContent() {
  return (
    <>
      <PageHeader icon={<Newspaper size={20} />} title="Content" subtitle="Manage News, PDF Guides, and Social Banners shown to users" />
      <NewsSection />
      <GuidesSection />
      <BannersSection />
    </>
  );
}

import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getNews, type NewsItem } from "@/lib/content";

export default function News() {
  const { textPrimary, textMuted } = useThemeClasses();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getNews().then((n) => {
      setNews(n);
      setLoaded(true);
    });
  }, []);

  return (
    <>
      <PageHeader icon={<Newspaper size={20} />} title="News & Updates" subtitle="Announcements from the WealthHub team" />

      {loaded && news.length === 0 && (
        <Panel className="text-center py-12">
          <Newspaper size={28} className={`mx-auto mb-3 ${textMuted}`} />
          <p className={`text-sm ${textMuted}`}>No news yet. Check back soon.</p>
        </Panel>
      )}

      <div className="space-y-3">
        {news.map((n) => (
          <Panel key={n.id}>
            <h3 className={`font-semibold text-sm mb-1 ${textPrimary}`}>{n.title}</h3>
            <p className={`text-sm ${textMuted}`}>{n.body}</p>
            {n.createdAt && (
              <p className={`text-xs mt-2 ${textMuted}`}>
                {(n.createdAt as { toDate?: () => Date }).toDate?.()?.toLocaleDateString()}
              </p>
            )}
          </Panel>
        ))}
      </div>
    </>
  );
}

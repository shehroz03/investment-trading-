import { useEffect, useState } from "react";
import { Image as ImageIcon, Download } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getBanners, type BannerItem } from "@/lib/content";

export default function SocialBanners() {
  const { textPrimary, textMuted } = useThemeClasses();
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getBanners().then((b) => {
      setBanners(b);
      setLoaded(true);
    });
  }, []);

  return (
    <>
      <PageHeader icon={<ImageIcon size={20} />} title="Social Banners" subtitle="Download promotional banners to share on your social channels" />

      {loaded && banners.length === 0 && (
        <Panel className="text-center py-12">
          <ImageIcon size={28} className={`mx-auto mb-3 ${textMuted}`} />
          <p className={`text-sm ${textMuted}`}>No banners have been published yet. Check back soon.</p>
        </Panel>
      )}

      {banners.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {banners.map((b) => (
            <Panel key={b.id} className="!p-0 overflow-hidden">
              <img src={b.imageUrl} alt={b.title} className="w-full aspect-video object-cover" />
              <div className="p-4 flex items-center justify-between">
                <p className={`text-sm font-medium ${textPrimary}`}>{b.title}</p>
                <a
                  href={b.imageUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/30"
                >
                  <Download size={14} />
                </a>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import { FileDown, Download } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { Panel, useThemeClasses } from "@/app/components/Panel";
import { getGuides, type GuideItem } from "@/lib/content";

export default function Guides() {
  const { textPrimary, textMuted } = useThemeClasses();
  const [guides, setGuides] = useState<GuideItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getGuides().then((g) => {
      setGuides(g);
      setLoaded(true);
    });
  }, []);

  return (
    <>
      <PageHeader icon={<FileDown size={20} />} title="PDF Guides" subtitle="Downloadable guides to help you get the most out of Creator Zone" />

      {loaded && guides.length === 0 && (
        <Panel className="text-center py-12">
          <FileDown size={28} className={`mx-auto mb-3 ${textMuted}`} />
          <p className={`text-sm ${textMuted}`}>No guides published yet. Check back soon.</p>
        </Panel>
      )}

      <div className="space-y-3">
        {guides.map((g) => (
          <Panel key={g.id} className="flex items-center justify-between">
            <div>
              <h3 className={`font-semibold text-sm ${textPrimary}`}>{g.title}</h3>
              <p className={`text-sm ${textMuted}`}>{g.description}</p>
            </div>
            <a
              href={g.fileUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-500/15 text-teal-400 border border-teal-500/30 rounded-lg text-sm font-semibold flex-shrink-0"
            >
              <Download size={14} /> Download
            </a>
          </Panel>
        ))}
      </div>
    </>
  );
}

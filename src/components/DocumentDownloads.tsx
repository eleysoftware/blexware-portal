import { Button } from "@/components/ui/button";

export type DocumentDownload = { id: string; format: string };

export function DocumentDownloads({
  docs,
  onOpen,
}: {
  docs: DocumentDownload[];
  onOpen: (id: string) => void;
}) {
  const latest = new Map<string, DocumentDownload>();
  for (const doc of docs) {
    if (!latest.has(doc.format)) latest.set(doc.format, doc);
  }
  const ordered = [...latest.values()].sort((a, b) => a.format.localeCompare(b.format));
  if (!ordered.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {ordered.map((doc) => (
        <Button key={doc.id} size="sm" variant="outline" onClick={() => onOpen(doc.id)}>
          Download {doc.format.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}

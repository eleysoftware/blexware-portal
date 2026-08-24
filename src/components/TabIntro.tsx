export function TabIntro({ purpose }: { purpose: string | null }) {
  if (!purpose) return null;
  return <p className="text-sm text-slate">{purpose}</p>;
}

export function TabEmptyState({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-2xl border border-dashed border-border bg-background p-6 text-sm text-slate">
      {message}
    </div>
  );
}

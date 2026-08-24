import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type WorkspaceTab = {
  id: string;
  label: string;
  disabled?: boolean;
  /** "action" = the viewer owes the next step here, "pending" = the upcoming step lands here. */
  state?: "action" | "pending";
};

/** Accessible tab strip. Panels stay mounted (hidden) so form state survives. */
export function WorkspaceTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: WorkspaceTab[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Project sections"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
            aria-selected={active}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-slate hover:text-foreground",
              tab.disabled ? "cursor-not-allowed opacity-40 hover:text-slate" : "",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function WorkspacePanel({
  id,
  active,
  children,
}: {
  id: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={!active}
      className={active ? "space-y-6" : undefined}
    >
      {children}
    </div>
  );
}

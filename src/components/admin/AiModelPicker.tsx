import { useEffect, useState } from "react";

export type AiProviderOption = {
  id: string;
  label: string;
  defaultModel: string;
  models: string[];
};

export type AiChoice = { provider?: string; model?: string };

const STORAGE_KEY = "blex.ai-choice";

/** Remembers the admin's last platform/version choice across visits. */
export function useAiChoice(providers: AiProviderOption[] | undefined): [AiChoice, (next: AiChoice) => void] {
  const [choice, setChoice] = useState<AiChoice>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setChoice(JSON.parse(raw) as AiChoice);
    } catch {
      /* ignore unreadable storage */
    }
  }, []);

  useEffect(() => {
    if (!providers?.length) return;
    setChoice((current) => {
      const provider = providers.find((entry) => entry.id === current.provider) ?? providers[0]!;
      const model = provider.models.includes(current.model ?? "") ? current.model! : provider.defaultModel;
      if (provider.id === current.provider && model === current.model) return current;
      return { provider: provider.id, model };
    });
  }, [providers]);

  const update = (next: AiChoice) => {
    setChoice(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — the choice still applies for this session */
    }
  };

  return [choice, update];
}

const selectClass =
  "h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

/** Platform + version selector shown next to every AI action. */
export function AiModelPicker({
  providers,
  choice,
  onChange,
  disabled,
}: {
  providers: AiProviderOption[] | undefined;
  choice: AiChoice;
  onChange: (next: AiChoice) => void;
  disabled?: boolean;
}) {
  if (!providers?.length) return null;
  const active = providers.find((entry) => entry.id === choice.provider) ?? providers[0]!;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {providers.length > 1 ? (
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="sr-only">AI platform</span>
          <select
            className={selectClass}
            value={active.id}
            disabled={disabled}
            onChange={(event) => {
              const next = providers.find((entry) => entry.id === event.target.value)!;
              onChange({ provider: next.id, model: next.defaultModel });
            }}
          >
            {providers.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span className="text-xs text-muted-foreground">{active.label}</span>
      )}
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="sr-only">Model version</span>
        <select
          className={selectClass}
          value={choice.model ?? active.defaultModel}
          disabled={disabled}
          onChange={(event) => onChange({ provider: active.id, model: event.target.value })}
        >
          {active.models.map((model) => (
            <option key={model} value={model}>
              {model}
              {model === active.defaultModel ? " (default)" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

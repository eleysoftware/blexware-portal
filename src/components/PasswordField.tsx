import { Check, Eye, EyeOff, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { passwordRules, strengthLabels } from "@/lib/password";

type Props = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  disabled?: boolean;
};

const meterTone = [
  "bg-destructive",
  "bg-destructive",
  "bg-amber-500",
  "bg-primary/70",
  "bg-primary",
];

export function PasswordField({
  id = "password",
  label = "Password",
  value,
  onChange,
  autoComplete = "new-password",
  disabled,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [score, setScore] = useState(0);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  // zxcvbn is browser-only and sizeable: load it lazily after first keystroke.
  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setScore(0);
      setSuggestion(null);
      return;
    }
    void (async () => {
      const [{ ZxcvbnFactory }, common, en] = await Promise.all([
        import("@zxcvbn-ts/core"),
        import("@zxcvbn-ts/language-common"),
        import("@zxcvbn-ts/language-en"),
      ]);
      const zxcvbn = new ZxcvbnFactory({
        dictionary: { ...common.dictionary, ...en.dictionary },
        graphs: common.adjacencyGraphs,
        translations: en.translations,
      });
      const result = zxcvbn.check(value);
      if (cancelled) return;
      setScore(result.score);
      setSuggestion(result.feedback.warning || result.feedback.suggestions[0] || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [value]);

  const filled = value ? score + 1 : 0;

  return (
    <div className="space-y-3">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="pr-11"
          aria-describedby={`${id}-rules`}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <div>
        <div className="flex gap-1" aria-hidden>
          {[0, 1, 2, 3, 4].map((index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                index < filled ? meterTone[score] : "bg-muted",
              )}
            />
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate" role="status">
          {value ? `Strength: ${strengthLabels[score]}` : "Use a long, unique passphrase."}
          {suggestion ? ` — ${suggestion}` : ""}
        </p>
      </div>

      <ul id={`${id}-rules`} className="grid gap-1 sm:grid-cols-2">
        {passwordRules.map((rule) => {
          const passed = rule.test(value);
          return (
            <li
              key={rule.id}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                passed ? "text-primary" : "text-slate",
              )}
            >
              {passed ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 opacity-60" />
              )}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

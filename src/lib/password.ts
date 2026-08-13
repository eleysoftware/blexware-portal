import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt byte ceiling used by Supabase Auth

export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const passwordRules: PasswordRule[] = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (v) => v.length >= PASSWORD_MIN_LENGTH,
  },
  { id: "upper", label: "An uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "A lowercase letter", test: (v) => /[a-z]/.test(v) },
  { id: "number", label: "A number", test: (v) => /[0-9]/.test(v) },
  {
    id: "symbol",
    label: "A special symbol",
    test: (v) => /[^A-Za-z0-9]/.test(v),
  },
];

/** Returns the labels of every rule the password fails. */
export function failedPasswordRules(value: string): string[] {
  return passwordRules.filter((rule) => !rule.test(value)).map((rule) => rule.label);
}

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`)
  .refine((v) => /[A-Z]/.test(v), { message: "Password needs an uppercase letter" })
  .refine((v) => /[a-z]/.test(v), { message: "Password needs a lowercase letter" })
  .refine((v) => /[0-9]/.test(v), { message: "Password needs a number" })
  .refine((v) => /[^A-Za-z0-9]/.test(v), { message: "Password needs a special symbol" });

export const signUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(160),
  password: passwordSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const BREACHED_PASSWORD_MESSAGE =
  "This password has been found in a known data breach. Please choose a safer password.";

export const strengthLabels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"] as const;

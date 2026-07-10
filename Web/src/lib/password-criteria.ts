import { INPUT_RULES } from "@/lib/input-rules";

export type PasswordCriterion = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_CRITERIA: PasswordCriterion[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    test: (password) => /\d/.test(password),
  },
  {
    id: "special",
    label: "One special character",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export function isPasswordValid(password: string): boolean {
  if (
    password.length < INPUT_RULES.password.minLength ||
    password.length > INPUT_RULES.password.maxLength
  ) {
    return false;
  }
  return PASSWORD_CRITERIA.every((criterion) => criterion.test(password));
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

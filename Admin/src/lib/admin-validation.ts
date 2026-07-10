import { INPUT_RULES } from "@/lib/input-rules";

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (
    trimmed.length < INPUT_RULES.email.minLength ||
    trimmed.length > INPUT_RULES.email.maxLength
  ) {
    return false;
  }
  return new RegExp(`^${INPUT_RULES.email.pattern}$`).test(trimmed);
}

export function isValidOtp(code: string): boolean {
  return new RegExp(`^${INPUT_RULES.otp.pattern}$`).test(code.trim());
}

export function isValidPassword(password: string): boolean {
  return (
    password.length >= INPUT_RULES.password.minLength &&
    password.length <= INPUT_RULES.password.maxLength
  );
}

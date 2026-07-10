"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  getAdminSession,
  saveAdminSession,
  SEED_SUPER_ADMIN,
} from "@/lib/admin-session";
import { isValidEmail, isValidOtp, isValidPassword } from "@/lib/admin-validation";
import { clampToMaxLength, inputRuleProps, INPUT_RULES } from "@/lib/input-rules";

const underlineInputClass = "auth-input-underline";

type LoginStep = "credentials" | "mfa";

export function AdminLoginCard() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (getAdminSession()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleCredentialsSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    let hasError = false;

    if (!isValidEmail(email)) {
      setEmailError(INPUT_RULES.email.title);
      hasError = true;
    } else {
      setEmailError("");
    }

    if (!isValidPassword(password)) {
      setPasswordError(INPUT_RULES.password.title);
      hasError = true;
    } else {
      setPasswordError("");
    }

    if (hasError) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setOtp("");
      setOtpError("");
      setStep("mfa");
      setIsSubmitting(false);
    }, 300);
  };

  const handleMfaSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidOtp(otp)) {
      setOtpError(INPUT_RULES.otp.title);
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const normalizedEmail = email.trim().toLowerCase();
      const isSeedAdmin = normalizedEmail === SEED_SUPER_ADMIN.email;

      saveAdminSession({
        email: normalizedEmail,
        role: isSeedAdmin ? SEED_SUPER_ADMIN.role : "admin",
        displayName: isSeedAdmin ? SEED_SUPER_ADMIN.displayName : normalizedEmail.split("@")[0],
        mfaVerified: true,
      });

      router.push("/dashboard");
    }, 300);
  };

  return (
    <Card className="admin-login-card w-full max-w-[400px] ring-0">
      <div className="admin-login-accent" aria-hidden="true" />

      <CardContent className="px-8 pb-8 pt-7">
        <div className="mb-7 flex flex-col items-center gap-3.5 text-center">
          <div className="admin-logo-placeholder" aria-hidden="true" />
          <h1 className="font-heading text-h4 font-semibold tracking-tight text-foreground">
            <span className="admin-login-title-brand">ZYND</span> Admin Console
          </h1>
        </div>

        {step === "credentials" ? (
          <form onSubmit={handleCredentialsSubmit}>
            <FieldGroup className="gap-5">
              <Field data-invalid={!!emailError}>
                <FieldLabel htmlFor="admin-email" className="sr-only">
                  Email
                </FieldLabel>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(clampToMaxLength(event.target.value, "email"));
                    if (emailError) setEmailError("");
                  }}
                  aria-invalid={!!emailError}
                  className={underlineInputClass}
                  {...inputRuleProps("email")}
                />
                <FieldError>{emailError}</FieldError>
              </Field>

              <Field data-invalid={!!passwordError}>
                <FieldLabel htmlFor="admin-password" className="sr-only">
                  Password
                </FieldLabel>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  required
                  value={password}
                  onChange={(event) => {
                    setPassword(clampToMaxLength(event.target.value, "password"));
                    if (passwordError) setPasswordError("");
                  }}
                  aria-invalid={!!passwordError}
                  className={underlineInputClass}
                  {...inputRuleProps("password")}
                />
                <FieldError>{passwordError}</FieldError>
              </Field>
            </FieldGroup>

            <Button
              type="submit"
              className="mt-7 h-11 w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Please wait..." : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit}>
            {email.trim() ? (
              <p className="mb-5 truncate text-center text-caption text-muted-foreground">
                {email.trim()}
              </p>
            ) : null}

            <FieldGroup className="gap-4">
              <Field data-invalid={!!otpError}>
                <FieldLabel htmlFor="admin-otp" className="sr-only">
                  Authentication code
                </FieldLabel>
                <OtpInput
                  id="admin-otp"
                  value={otp}
                  error={!!otpError}
                  onChange={(value) => {
                    setOtp(value);
                    if (otpError) setOtpError("");
                  }}
                />
                <FieldError>{otpError}</FieldError>
              </Field>
            </FieldGroup>

            <div className="mt-7 space-y-4">
              <Button
                type="submit"
                className="h-11 w-full"
                size="lg"
                disabled={isSubmitting || !isValidOtp(otp)}
              >
                {isSubmitting ? "Please wait..." : "Continue"}
              </Button>

              <button
                type="button"
                className="auth-link mx-auto"
                onClick={() => {
                  setStep("credentials");
                  setOtp("");
                  setOtpError("");
                }}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

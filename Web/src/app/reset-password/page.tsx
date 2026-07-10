"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { resetPassword } from "@/lib/auth-api";
import { isPasswordValid } from "@/lib/password-criteria";
import { PasswordCriteriaList } from "@/components/auth/auth-shared";
import { FieldMessage } from "@/components/ui/ui-message";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError("Invalid reset link.");
      return;
    }
    if (!isPasswordValid(password)) {
      setError("Choose a stronger password.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-h3 font-semibold text-foreground">Invalid reset link</h1>
        <p className="mt-2 text-compact text-muted-foreground">
          Request a new password reset from the sign-in screen.
        </p>
        <Button className="mt-6" onClick={() => router.push("/")}>
          Back to home
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-h3 font-semibold text-foreground">Password updated</h1>
        <p className="mt-2 text-compact text-muted-foreground">
          You can now sign in with your new password.
        </p>
        <Button className="mt-6" onClick={() => router.push("/")}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-h3 font-semibold text-foreground">Reset your password</h1>
      <p className="mt-2 text-compact text-muted-foreground">
        Choose a new password for your ZYND account.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (error) setError("");
          }}
          aria-invalid={!!error}
          className="h-11"
        />
        <PasswordCriteriaList password={password} />
        <FieldMessage message={error} />
        <Button
          type="submit"
          className="h-11 w-full"
          disabled={!isPasswordValid(password) || isSubmitting}
        >
          {isSubmitting ? "Updating..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-1 items-center justify-center">
          <p className="text-compact text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

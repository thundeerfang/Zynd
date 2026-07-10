"use client";

import { Check, Copy, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import QRCode from "react-qr-code";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldMessage } from "@/components/ui/ui-message";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";
import { mfaEnrollConfirm, mfaEnrollStart } from "@/lib/auth-api";
import { cn } from "@/lib/utils";

type MfaEnrollDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type EnrollStep = "start" | "confirm" | "backup";

const STEPS: { id: EnrollStep; label: string }[] = [
  { id: "start", label: "Get started" },
  { id: "confirm", label: "Verify app" },
  { id: "backup", label: "Backup codes" },
];

const STEP_COPY: Record<EnrollStep, { title: string; description: string }> = {
  start: {
    title: "Enable two-factor authentication",
    description: "Required before you can transfer or invest funds.",
  },
  confirm: {
    title: "Scan your authenticator",
    description: "Add ZYND to Google Authenticator, Authy, or a similar app.",
  },
  backup: {
    title: "Save your backup codes",
    description: "Each code works once if you lose access to your authenticator.",
  },
};

const START_POINTS = [
  "Protects your account when moving money",
  "Works with any standard authenticator app",
  "Backup codes are shown once — store them safely",
];

function MfaEnrollProgress({ step }: { step: EnrollStep }) {
  const currentIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <div className="mb-5">
      <span className="inline-flex items-center rounded-[var(--radius-control)] border border-border bg-muted/50 px-2.5 py-1 text-caption font-medium text-muted-foreground">
        Step {currentIndex + 1} of {STEPS.length}
      </span>
      <div className="mt-3 flex gap-1.5">
        {STEPS.map((item, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <div
              key={item.id}
              className={cn(
                "h-1.5 flex-1 rounded-[var(--radius-full)] transition-all duration-300",
                done && "bg-success",
                active && "bg-primary",
                !done && !active && "bg-border"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function MfaEnrollDialog({ open, onOpenChange }: MfaEnrollDialogProps) {
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<EnrollStep>("start");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"secret" | "backup" | null>(null);
  const [enrollToken, setEnrollToken] = useState("");
  const [qrUri, setQrUri] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const reset = () => {
    setStep("start");
    setError("");
    setCopied(null);
    setEnrollToken("");
    setQrUri("");
    setManualSecret("");
    setTotpCode("");
    setBackupCodes([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const startEnrollment = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await mfaEnrollStart();
      setEnrollToken(result.enroll_token);
      setQrUri(result.qr_uri);
      setManualSecret(result.manual_secret);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start MFA enrollment.");
    } finally {
      setLoading(false);
    }
  };

  const confirmEnrollment = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await mfaEnrollConfirm(enrollToken, totpCode);
      setBackupCodes(result.backup_codes);
      await refreshUser();
      setStep("backup");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid authenticator code.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = async () => {
    if (!manualSecret) return;
    await copyText(manualSecret);
    setCopied("secret");
    window.setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyBackupCodes = async () => {
    if (!backupCodes.length) return;
    await copyText(backupCodes.join("\n"));
    setCopied("backup");
    window.setTimeout(() => setCopied(null), 2000);
  };

  const { title, description } = STEP_COPY[step];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div className="relative overflow-hidden bg-gradient-brand px-6 py-5">
          <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-20" />
          <div className="relative z-10 flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] border border-primary-foreground/20 bg-primary-foreground/10 backdrop-blur-[var(--blur-sm)]">
              <ShieldCheck className="size-5 text-primary-foreground" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 className="text-h4 font-semibold leading-tight text-primary-foreground">
                {title}
              </h2>
              <p className="mt-1 text-caption leading-relaxed text-primary-foreground/85">
                {description}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <MfaEnrollProgress step={step} />

          {step === "start" ? (
            <div className="space-y-5">
              <ul className="space-y-2.5">
                {START_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-compact text-muted-foreground">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3" strokeWidth={2.5} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2">
                {["Google Authenticator", "Authy", "1Password"].map((app) => (
                  <span
                    key={app}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-muted/40 px-2.5 py-1 text-caption text-foreground"
                  >
                    <Smartphone className="size-3.5 text-muted-foreground" />
                    {app}
                  </span>
                ))}
              </div>

              <FieldMessage message={error} />

              <AuthSubmitFooter>
                <Button className="w-full" onClick={startEnrollment} disabled={loading}>
                  {loading ? "Preparing..." : "Continue"}
                </Button>
              </AuthSubmitFooter>
            </div>
          ) : null}

          {step === "confirm" ? (
            <div className="space-y-5">
              <div className="rounded-[var(--radius-card)] border border-border bg-muted/30 p-4 shadow-zynd-low">
                {qrUri ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-[var(--radius-control)] border border-border bg-white p-3 shadow-zynd-low">
                      <QRCode value={qrUri} size={168} />
                    </div>
                    <p className="text-center text-caption text-muted-foreground">
                      Scan this code with your authenticator app
                    </p>
                  </div>
                ) : null}

                <div className="relative my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-caption text-muted-foreground">or enter manually</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="rounded-[var(--radius-control)] border border-border bg-background p-3">
                  <div className="mb-2 flex items-center gap-2 text-caption font-medium text-muted-foreground">
                    <KeyRound className="size-3.5" />
                    Setup key
                  </div>
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 break-all font-mono text-compact leading-relaxed">
                      {manualSecret}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="shrink-0"
                      aria-label="Copy setup key"
                      onClick={handleCopySecret}
                    >
                      {copied === "secret" ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="mfa-enroll-code" className="mb-2 block text-caption font-medium text-foreground">
                  Verification code
                </label>
                <input
                  id="mfa-enroll-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={totpCode}
                  onChange={(event) =>
                    setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  maxLength={6}
                  className="auth-input-underline w-full text-center tracking-[0.35em] text-body font-medium"
                />
              </div>

              <FieldMessage message={error} />

              <AuthSubmitFooter>
                <Button
                  className="w-full"
                  onClick={confirmEnrollment}
                  disabled={loading || totpCode.length !== 6}
                >
                  {loading ? "Verifying..." : "Verify and enable MFA"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={loading}
                  onClick={() => {
                    setStep("start");
                    setError("");
                    setTotpCode("");
                  }}
                >
                  Back
                </Button>
              </AuthSubmitFooter>
            </div>
          ) : null}

          {step === "backup" ? (
            <div className="space-y-5">
              <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-success/20 bg-success/5 px-3 py-2.5 text-compact text-success">
                <Check className="size-4 shrink-0" />
                Two-factor authentication is now enabled on your account.
              </div>

              <div className="rounded-[var(--radius-card)] border border-border bg-muted/30 p-4 shadow-zynd-low">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-caption font-medium text-foreground">Your backup codes</p>
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyBackupCodes}>
                    {copied === "backup" ? (
                      <>
                        <Check className="size-3.5 text-success" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        Copy all
                      </>
                    )}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-compact">
                  {backupCodes.map((code) => (
                    <span
                      key={code}
                      className="rounded-[var(--radius-control)] border border-border bg-background px-2.5 py-2 text-center"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>

              <AuthSubmitFooter hint="Keep these codes offline. You will not see them again.">
                <Button className="w-full" onClick={() => handleOpenChange(false)}>
                  Done
                </Button>
              </AuthSubmitFooter>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FundEligibilityBanner() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user || user.fund_movement_eligible || user.mfa_enrolled) {
    return null;
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 shadow-zynd-low sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-compact font-medium text-foreground">Enable MFA to move funds</p>
          <p className="text-caption text-muted-foreground">
            Two-factor authentication is required before transfers or investments.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>Set up MFA</Button>
      </div>
      <MfaEnrollDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

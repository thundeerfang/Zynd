"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Laptop, Shield, Trash2 } from "lucide-react";

import { MfaEnrollDialog } from "@/components/dashboard/mfa-enroll-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldMessage } from "@/components/ui/ui-message";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";
import {
  cancelAccountDeletion,
  changeEmailConfirm,
  changeEmailStart,
  changePassword,
  fetchSessions,
  requestAccountDeletion,
  revokeAllOtherSessions,
  revokeSession,
  type UserSession,
} from "@/lib/auth-api";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

function formatSessionLabel(session: UserSession) {
  const parts = [session.browser, session.os].filter(Boolean);
  return parts.length ? parts.join(" on ") : "Unknown device";
}

export function AccountSecuritySettings() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [mfaOpen, setMfaOpen] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    totp: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [emailForm, setEmailForm] = useState({
    newEmail: "",
    currentPassword: "",
    totp: "",
    otp: "",
    changeToken: "",
  });
  const [emailStep, setEmailStep] = useState<"form" | "confirm">("form");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const [deleteForm, setDeleteForm] = useState({ currentPassword: "", totp: "" });
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const result = await fetchSessions();
      setSessions(result.sessions);
    } catch (error) {
      setSessionsError(getErrorMessage(error, "Could not load sessions."));
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  if (!user) {
    return null;
  }

  const mfaEnabled = user.mfa_enrolled;

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordLoading(true);
    setPasswordError("");
    setPasswordSuccess("");
    try {
      await changePassword({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
        totpCode: passwordForm.totp || undefined,
      });
      setPasswordForm({ current: "", next: "", totp: "" });
      setPasswordSuccess("Password updated. Other sessions were signed out.");
      await loadSessions();
    } catch (error) {
      setPasswordError(getErrorMessage(error, "Could not change password."));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleEmailStart = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailLoading(true);
    setEmailError("");
    setEmailSuccess("");
    try {
      const result = await changeEmailStart({
        newEmail: emailForm.newEmail,
        currentPassword: emailForm.currentPassword,
        totpCode: emailForm.totp || undefined,
      });
      setEmailForm((current) => ({ ...current, changeToken: result.change_token, otp: "" }));
      setEmailStep("confirm");
      setEmailSuccess("Verification code sent to your new email address.");
    } catch (error) {
      setEmailError(getErrorMessage(error, "Could not start email change."));
    } finally {
      setEmailLoading(false);
    }
  };

  const handleEmailConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailLoading(true);
    setEmailError("");
    try {
      await changeEmailConfirm(emailForm.changeToken, emailForm.otp);
      setEmailForm({ newEmail: "", currentPassword: "", totp: "", otp: "", changeToken: "" });
      setEmailStep("form");
      setEmailSuccess("Email updated successfully.");
      await refreshUser();
      await loadSessions();
    } catch (error) {
      setEmailError(getErrorMessage(error, "Could not confirm email change."));
    } finally {
      setEmailLoading(false);
    }
  };

  const handleDeleteRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await requestAccountDeletion({
        currentPassword: deleteForm.currentPassword,
        totpCode: deleteForm.totp || undefined,
      });
      setDeleteForm({ currentPassword: "", totp: "" });
      await refreshUser();
    } catch (error) {
      setDeleteError(getErrorMessage(error, "Could not request account deletion."));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
        <h1 className="text-h2 font-bold text-foreground">Settings</h1>
        <p className="mt-2 text-compact text-muted-foreground">
          Manage MFA, passwords, active sessions, and account deletion.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Two-factor authentication
          </CardTitle>
          <CardDescription>
            {mfaEnabled
              ? "MFA is enabled. Required before fund transfers or investments."
              : "Enable MFA before you move funds."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mfaEnabled ? (
            <p className="text-compact text-muted-foreground">
              Enrolled on{" "}
              {user.mfa_enrolled_at
                ? new Date(user.mfa_enrolled_at).toLocaleString()
                : "your account"}
              .
            </p>
          ) : (
            <Button onClick={() => setMfaOpen(true)}>Set up MFA</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Re-authentication required. Other sessions will be signed out.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handlePasswordChange}>
            <Input
              type="password"
              placeholder="Current password"
              value={passwordForm.current}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, current: event.target.value }))
              }
            />
            <Input
              type="password"
              placeholder="New password"
              value={passwordForm.next}
              onChange={(event) =>
                setPasswordForm((current) => ({ ...current, next: event.target.value }))
              }
            />
            {mfaEnabled ? (
              <Input
                inputMode="numeric"
                placeholder="Authenticator code"
                value={passwordForm.totp}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    totp: event.target.value.replace(/\D/g, "").slice(0, 6),
                  }))
                }
              />
            ) : null}
            <FieldMessage message={passwordError} />
            {passwordSuccess ? (
              <p className="text-compact text-success">{passwordSuccess}</p>
            ) : null}
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change email</CardTitle>
          <CardDescription>
            Verify your password and confirm the code sent to your new email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailStep === "form" ? (
            <form className="space-y-3" onSubmit={handleEmailStart}>
              <Input
                type="email"
                placeholder="New email address"
                value={emailForm.newEmail}
                onChange={(event) =>
                  setEmailForm((current) => ({ ...current, newEmail: event.target.value }))
                }
              />
              <Input
                type="password"
                placeholder="Current password"
                value={emailForm.currentPassword}
                onChange={(event) =>
                  setEmailForm((current) => ({ ...current, currentPassword: event.target.value }))
                }
              />
              {mfaEnabled ? (
                <Input
                  inputMode="numeric"
                  placeholder="Authenticator code"
                  value={emailForm.totp}
                  onChange={(event) =>
                    setEmailForm((current) => ({
                      ...current,
                      totp: event.target.value.replace(/\D/g, "").slice(0, 6),
                    }))
                  }
                />
              ) : null}
              <FieldMessage message={emailError} />
              {emailSuccess ? <p className="text-compact text-success">{emailSuccess}</p> : null}
              <Button type="submit" disabled={emailLoading}>
                {emailLoading ? "Sending code..." : "Send verification code"}
              </Button>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={handleEmailConfirm}>
              <Input
                inputMode="numeric"
                placeholder="6-digit code from new email"
                value={emailForm.otp}
                onChange={(event) =>
                  setEmailForm((current) => ({
                    ...current,
                    otp: event.target.value.replace(/\D/g, "").slice(0, 6),
                  }))
                }
              />
              <FieldMessage message={emailError} />
              {emailSuccess ? <p className="text-compact text-success">{emailSuccess}</p> : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={emailLoading || emailForm.otp.length !== 6}>
                  {emailLoading ? "Confirming..." : "Confirm new email"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEmailStep("form")}>
                  Back
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Laptop className="size-5" />
            Active sessions
          </CardTitle>
          <CardDescription>Up to 3 devices can stay signed in at once.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldMessage message={sessionsError} />
          {sessionsLoading ? (
            <p className="text-compact text-muted-foreground">Loading sessions...</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border px-4 py-3"
                >
                  <div>
                    <p className="text-compact font-medium text-foreground">
                      {formatSessionLabel(session)}
                      {session.is_current ? " (This device)" : ""}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      Last active {new Date(session.last_used_at).toLocaleString()}
                    </p>
                  </div>
                  {!session.is_current ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await revokeSession(session.id);
                          await loadSessions();
                        } catch (error) {
                          setSessionsError(getErrorMessage(error, "Could not revoke session."));
                        }
                      }}
                    >
                      Sign out
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await revokeAllOtherSessions();
                await loadSessions();
              } catch (error) {
                setSessionsError(getErrorMessage(error, "Could not revoke sessions."));
              }
            }}
          >
            Sign out all other devices
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-5" />
            Delete account
          </CardTitle>
          <CardDescription>
            Your account enters a 30-day grace period. You can cancel before deletion runs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.account_status === "deletion_pending" ? (
            <div className="space-y-3">
              <p className="text-compact text-muted-foreground">
                Deletion scheduled for{" "}
                {user.deletion_scheduled_at
                  ? new Date(user.deletion_scheduled_at).toLocaleString()
                  : "soon"}
                .
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await cancelAccountDeletion();
                    await refreshUser();
                  } catch (error) {
                    setDeleteError(getErrorMessage(error, "Could not cancel deletion."));
                  }
                }}
              >
                Cancel deletion request
              </Button>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={handleDeleteRequest}>
              <Input
                type="password"
                placeholder="Current password"
                value={deleteForm.currentPassword}
                onChange={(event) =>
                  setDeleteForm((current) => ({ ...current, currentPassword: event.target.value }))
                }
              />
              {mfaEnabled ? (
                <Input
                  inputMode="numeric"
                  placeholder="Authenticator code"
                  value={deleteForm.totp}
                  onChange={(event) =>
                    setDeleteForm((current) => ({
                      ...current,
                      totp: event.target.value.replace(/\D/g, "").slice(0, 6),
                    }))
                  }
                />
              ) : null}
              <FieldMessage message={deleteError} />
              <Button type="submit" variant="destructive" disabled={deleteLoading}>
                {deleteLoading ? "Submitting..." : "Request account deletion"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <MfaEnrollDialog open={mfaOpen} onOpenChange={setMfaOpen} />
    </div>
  );
}

"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  AuthBrandPanel,
  AuthFormHeader,
  AuthMobileBrandBar,
  AuthProgress,
  AuthSubmitFooter,
  EmailChip,
  MobileChip,
  OtpInfoBanner,
  OtpInput,
  PasswordCriteriaList,
  ProfileNameHeader,
  stepPanelClass,
  type SignupStepId,
  underlineInputClass,
  profileInputClass,
} from "@/components/auth/auth-shared";
import { IndiaFlagIcon } from "@/components/auth/india-flag-icon";
import { TurnstileWidget, isTurnstileRequired } from "@/components/auth/turnstile-widget";
import { Button } from "@/components/ui/button";
import { ClearableInput } from "@/components/ui/clearable-input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import { Separator } from "@/components/ui/separator";
import {
  checkEmail,
  forgotPassword,
  confirmOAuthLink,
  isAuthenticatedResponse,
  signupComplete,
  signupSendMobileOtp,
  signupSetPassword,
  signupStart,
  signupVerifyEmail,
  signupVerifyMobile,
  verifyMfaLogin,
} from "@/lib/auth-api";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import {
  clampToMaxLength,
  digitsOnly,
  inputRuleProps,
  lettersOnly,
} from "@/lib/input-rules";
import {
  DEFAULT_COUNTRY,
  isProfileValid,
  isValidEmail,
  isValidMobile,
  isValidOtp,
  validateProfile,
} from "@/lib/auth-validation";
import { env } from "@/lib/env";
import { isPasswordValid } from "@/lib/password-criteria";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="currentColor"
        className="text-info"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="currentColor"
        className="text-success"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="currentColor"
        className="text-warning"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="currentColor"
        className="text-destructive"
      />
    </svg>
  );
}

type AuthStep =
  | "email"
  | "login"
  | "mfa-challenge"
  | "oauth-link"
  | "email-otp"
  | "password"
  | "mobile"
  | "mobile-otp"
  | "profile"
  | "forgot-password";

const STEP_COPY: Record<AuthStep, { title: string; description: string }> = {
  email: {
    title: "Welcome to ZYND",
    description: "Sign in or create an account to continue.",
  },
  login: {
    title: "Welcome back",
    description: "Enter your password to sign in to ZYND.",
  },
  "mfa-challenge": {
    title: "Two-factor authentication",
    description: "Enter the code from your authenticator app.",
  },
  "oauth-link": {
    title: "Confirm account linking",
    description: "Verify your existing account before linking Google.",
  },
  "email-otp": {
    title: "Join ZYND",
    description: "Verify your email with the one-time code we sent you.",
  },
  password: {
    title: "Create your password",
    description: "Choose a strong password to secure your account.",
  },
  mobile: {
    title: "Verify your mobile",
    description: "Enter your mobile number to receive an OTP.",
  },
  "mobile-otp": {
    title: "Confirm mobile OTP",
    description: "Enter the code sent to your mobile number.",
  },
  profile: {
    title: "Complete your profile",
    description: "Tell us your name to finish setting up your account.",
  },
  "forgot-password": {
    title: "Reset your password",
    description: "We will send a reset link to your registered email.",
  },
};

function getProgressStep(step: AuthStep): SignupStepId | null {
  if (step === "email" || step === "login" || step === "forgot-password" || step === "mfa-challenge" || step === "oauth-link") {
    return null;
  }
  return step as SignupStepId;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

export function AuthDialog() {
  const router = useRouter();
  const { signIn, signInWithGoogle, setUser, completeAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<AuthStep>("email");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupToken, setSignupToken] = useState("");

  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");

  const [emailError, setEmailError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [emailOtpError, setEmailOtpError] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [mobileOtpError, setMobileOtpError] = useState("");
  const [profileErrors, setProfileErrors] = useState<
    Partial<Record<"firstName" | "middleName" | "lastName", string>>
  >({});

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotEmailError, setForgotEmailError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const [mfaToken, setMfaToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [mfaError, setMfaError] = useState("");

  const [linkToken, setLinkToken] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [oauthLinkOtp, setOauthLinkOtp] = useState("");
  const [oauthLinkPassword, setOauthLinkPassword] = useState("");
  const [oauthLinkError, setOauthLinkError] = useState("");

  const resetTurnstile = () => {
    setTurnstileToken("");
    setTurnstileError("");
    setTurnstileResetKey((key) => key + 1);
  };

  useEffect(() => {
    resetTurnstile();
  }, [step]);

  const ensureTurnstile = () => {
    if (!isTurnstileRequired()) return true;
    if (!turnstileToken) {
      setTurnstileError("Complete the verification check.");
      return false;
    }
    setTurnstileError("");
    return true;
  };

  const resetForm = () => {
    setStep("email");
    setSignupToken("");
    setIsSubmitting(false);
    setEmail("");
    setEmailOtp("");
    setPassword("");
    setMobile("");
    setMobileOtp("");
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setEmailError("");
    setLoginError("");
    setEmailOtpError("");
    setMobileError("");
    setMobileOtpError("");
    setProfileErrors({});
    setForgotEmail("");
    setForgotEmailError("");
    setForgotSent(false);
    setMfaToken("");
    setMfaCode("");
    setBackupCode("");
    setUseBackupCode(false);
    setMfaError("");
    setLinkToken("");
    setEmailHint("");
    setOauthLinkOtp("");
    setOauthLinkPassword("");
    setOauthLinkError("");
    resetTurnstile();
  };

  const handleAuthFlowResult = (result: Awaited<ReturnType<typeof signIn>>) => {
    if (result.next === "mfa_required") {
      setMfaToken(result.mfa_token);
      setMfaCode("");
      setBackupCode("");
      setUseBackupCode(false);
      setStep("mfa-challenge");
      return;
    }
    if (result.next === "oauth_link_confirmation_required") {
      setLinkToken(result.link_token);
      setEmailHint(result.email_hint);
      setOauthLinkOtp("");
      setOauthLinkPassword("");
      setStep("oauth-link");
      return;
    }
    completeAuth(result.user);
    finishAuth();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) resetForm();
  };

  const finishAuth = () => {
    setOpen(false);
    resetForm();
    router.push("/dashboard");
  };

  const completeSignup = async () => {
    const errors = validateProfile({ firstName, middleName, lastName });
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const result = await signupComplete(signupToken, {
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
      });
      setUser(result.user);
      finishAuth();
    } catch (error) {
      setProfileErrors({
        firstName: getErrorMessage(error, "Could not complete signup. Try again."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailContinue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (!ensureTurnstile()) return;

    setIsSubmitting(true);
    setEmailError("");
    try {
      const result = await checkEmail(email);
      if (result.next === "login") {
        setPassword("");
        setLoginError("");
        setStep("login");
        return;
      }

      const started = await signupStart(email, turnstileToken);
      setSignupToken(started.signup_token);
      setEmailOtp("");
      setStep("email-otp");
    } catch (error) {
      setEmailError(getErrorMessage(error, "Could not continue. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setLoginError("Enter your password.");
      return;
    }
    if (!ensureTurnstile()) return;

    setIsSubmitting(true);
    setLoginError("");
    try {
      const result = await signIn(email, password, turnstileToken);
      handleAuthFlowResult(result);
    } catch (error) {
      setLoginError(getErrorMessage(error, "Invalid email or password."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!useBackupCode && !isValidOtp(mfaCode)) {
      setMfaError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    if (useBackupCode && backupCode.trim().length < 8) {
      setMfaError("Enter a valid backup code.");
      return;
    }

    setIsSubmitting(true);
    setMfaError("");
    try {
      const result = await verifyMfaLogin({
        mfaToken,
        totpCode: useBackupCode ? undefined : mfaCode,
        backupCode: useBackupCode ? backupCode : undefined,
      });
      completeAuth(result.user);
      finishAuth();
    } catch (error) {
      setMfaError(getErrorMessage(error, "Invalid verification code."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthLinkSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidOtp(oauthLinkOtp)) {
      setOauthLinkError("Enter the 6-digit code sent to your email.");
      return;
    }
    if (oauthLinkPassword.length < 8) {
      setOauthLinkError("Enter your account password.");
      return;
    }

    setIsSubmitting(true);
    setOauthLinkError("");
    try {
      const result = await confirmOAuthLink({
        linkToken,
        emailOtp: oauthLinkOtp,
        password: oauthLinkPassword,
      });
      if (isAuthenticatedResponse(result)) {
        completeAuth(result.user);
        finishAuth();
        return;
      }
      handleAuthFlowResult(result);
    } catch (error) {
      setOauthLinkError(getErrorMessage(error, "Could not link Google account."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailOtpContinue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidOtp(emailOtp)) {
      setEmailOtpError("Enter the 6-digit code sent to your email.");
      return;
    }

    setIsSubmitting(true);
    setEmailOtpError("");
    try {
      await signupVerifyEmail(signupToken, emailOtp);
      setPassword("");
      setStep("password");
    } catch (error) {
      setEmailOtpError(getErrorMessage(error, "Invalid or expired verification code."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordContinue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isPasswordValid(password)) return;

    setIsSubmitting(true);
    try {
      await signupSetPassword(signupToken, password);
      setStep("mobile");
    } catch (error) {
      setLoginError(getErrorMessage(error, "Could not save password. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMobileContinue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidMobile(mobile)) {
      setMobileError("Enter a valid 10-digit mobile number.");
      return;
    }

    setIsSubmitting(true);
    setMobileError("");
    try {
      await signupSendMobileOtp(signupToken, mobile);
      setMobileOtp("");
      setStep("mobile-otp");
    } catch (error) {
      setMobileError(getErrorMessage(error, "Could not send OTP. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMobileOtpContinue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidOtp(mobileOtp)) {
      setMobileOtpError("Enter the 6-digit code sent to your mobile.");
      return;
    }

    setIsSubmitting(true);
    setMobileOtpError("");
    try {
      await signupVerifyMobile(signupToken, mobileOtp);
      setStep("profile");
    } catch (error) {
      setMobileOtpError(getErrorMessage(error, "Invalid or expired verification code."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileContinue = (event: React.FormEvent) => {
    event.preventDefault();
    void completeSignup();
  };

  const handleForgotSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidEmail(forgotEmail)) {
      setForgotEmailError("Enter a valid email address.");
      return;
    }
    if (!ensureTurnstile()) return;

    setIsSubmitting(true);
    setForgotEmailError("");
    try {
      await forgotPassword(forgotEmail, turnstileToken);
      setForgotSent(true);
    } catch (error) {
      setForgotEmailError(getErrorMessage(error, "Could not send reset link. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (!env.googleClientId) {
      setEmailError("Google Sign-In is not configured yet.");
      return;
    }

    const google = (window as typeof window & { google?: any }).google;
    if (!google?.accounts?.id) {
      setEmailError("Google Sign-In is still loading. Try again in a moment.");
      return;
    }

    google.accounts.id.initialize({
      client_id: env.googleClientId,
      callback: async (response: { credential?: string }) => {
        if (!response.credential) {
          setEmailError("Google Sign-In was cancelled.");
          return;
        }
        setIsSubmitting(true);
        setEmailError("");
        try {
          const result = await signInWithGoogle(response.credential);
          handleAuthFlowResult(result);
        } catch (error) {
          setEmailError(getErrorMessage(error, "Google Sign-In failed."));
        } finally {
          setIsSubmitting(false);
        }
      },
    });
    google.accounts.id.prompt();
  };

  const { title, description } = STEP_COPY[step];
  const progressStep = getProgressStep(step);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {env.googleClientId ? (
        <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" />
      ) : null}
      <DialogTrigger render={<Button />}>Login / Signup</DialogTrigger>

      <DialogContent
        showCloseButton
        className="grid w-full max-w-[860px] overflow-hidden sm:max-w-[860px]"
      >
        <DialogTitle className="sr-only">Login or Sign up to ZYND</DialogTitle>

        <AuthMobileBrandBar />

        <div className="grid min-h-[520px] grid-cols-1 md:grid-cols-[88fr_112fr]">
          <AuthBrandPanel />

          <div className="flex min-h-0 flex-col bg-background p-6 sm:p-8">
            <AuthProgress currentStep={progressStep} />
            <AuthFormHeader title={title} description={description} />

            <div className="relative flex flex-1 flex-col overflow-hidden">
              {/* 1. Email */}
              <form
                onSubmit={handleEmailContinue}
                className={stepPanelClass(step === "email")}
              >
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full gap-2 border-border bg-background text-foreground shadow-zynd-low hover:bg-muted"
                  disabled={isSubmitting}
                  onClick={handleGoogleSignIn}
                >
                  <GoogleIcon />
                  Continue with Google
                </Button>

                <div className="my-5 flex items-center gap-3">
                  <Separator className="flex-1 bg-border" />
                  <span className="rounded-[var(--radius-control)] bg-muted px-2 py-0.5 text-caption text-muted-foreground">
                    Or
                  </span>
                  <Separator className="flex-1 bg-border" />
                </div>

                <ClearableInput
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Your Email Address"
                  required
                  value={email}
                  onClear={() => {
                    setEmail("");
                    setEmailError("");
                  }}
                  onChange={(event) => {
                    setEmail(clampToMaxLength(event.target.value, "email"));
                    if (emailError) setEmailError("");
                  }}
                  aria-invalid={!!emailError}
                  className={underlineInputClass}
                  {...inputRuleProps("email")}
                />
                <FieldMessage message={emailError} />

                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotSent(false);
                    setStep("forgot-password");
                  }}
                  className="auth-link mt-3"
                >
                  Forgot password?
                </button>

                <TurnstileWidget
                  resetKey={`email-${turnstileResetKey}`}
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken("")}
                  className="mt-4 mb-4"
                />
                <FieldMessage message={turnstileError} />

                <AuthSubmitFooter
                  hint={
                    <>
                      By proceeding, I agree to{" "}
                      <button type="button" className="text-primary hover:underline">
                        T&amp;C
                      </button>
                      ,{" "}
                      <button type="button" className="text-primary hover:underline">
                        Privacy Policy
                      </button>{" "}
                      &amp;{" "}
                      <button type="button" className="text-primary hover:underline">
                        Tariff Rates
                      </button>
                    </>
                  }
                >
                  <Button
                    type="submit"
                    className="h-11 w-full shadow-zynd-mid"
                    size="lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Please wait..." : "Continue"}
                  </Button>
                </AuthSubmitFooter>
              </form>

              {/* Login — existing user */}
              <form
                onSubmit={handleLoginSubmit}
                className={stepPanelClass(step === "login")}
              >
                <EmailChip email={email} onEdit={() => setStep("email")} />

                <Input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  required
                  value={password}
                  onChange={(event) => {
                    setPassword(clampToMaxLength(event.target.value, "password"));
                    if (loginError) setLoginError("");
                  }}
                  aria-invalid={!!loginError}
                  className={underlineInputClass}
                  {...inputRuleProps("password")}
                />
                <FieldMessage message={loginError} />

                <TurnstileWidget
                  resetKey={`login-${turnstileResetKey}`}
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken("")}
                  className="mt-4 mb-4"
                />
                <FieldMessage message={turnstileError} />

                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotSent(false);
                    setStep("forgot-password");
                  }}
                  className="auth-link mt-3"
                >
                  Forgot password?
                </button>

                <AuthSubmitFooter>
                  <Button
                    type="submit"
                    className="h-11 w-full shadow-zynd-mid"
                    size="lg"
                    disabled={isSubmitting || password.length < 8}
                  >
                    {isSubmitting ? "Signing in..." : "Sign in"}
                  </Button>
                </AuthSubmitFooter>
              </form>

              {/* MFA challenge */}
              <form
                onSubmit={handleMfaSubmit}
                className={stepPanelClass(step === "mfa-challenge")}
              >
                <OtpInfoBanner
                  message={
                    useBackupCode
                      ? "Enter one of your backup codes."
                      : "Open your authenticator app and enter the 6-digit code."
                  }
                />

                {useBackupCode ? (
                  <Input
                    placeholder="Backup code"
                    value={backupCode}
                    onChange={(event) => {
                      setBackupCode(event.target.value.toUpperCase());
                      if (mfaError) setMfaError("");
                    }}
                    className={underlineInputClass}
                  />
                ) : (
                  <OtpInput
                    id="mfaCode"
                    value={mfaCode}
                    error={!!mfaError}
                    onChange={(value) => {
                      setMfaCode(value);
                      if (mfaError) setMfaError("");
                    }}
                  />
                )}
                <FieldMessage message={mfaError} />

                <button
                  type="button"
                  className="auth-link mt-3"
                  onClick={() => {
                    setUseBackupCode((current) => !current);
                    setMfaError("");
                  }}
                >
                  {useBackupCode ? "Use authenticator app instead" : "Use a backup code instead"}
                </button>

                <AuthSubmitFooter>
                  <Button
                    type="submit"
                    className="h-11 w-full shadow-zynd-mid"
                    size="lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Verifying..." : "Verify and sign in"}
                  </Button>
                </AuthSubmitFooter>
              </form>

              {/* OAuth link confirmation */}
              <form
                onSubmit={handleOAuthLinkSubmit}
                className={stepPanelClass(step === "oauth-link")}
              >
                <OtpInfoBanner
                  message={`We sent a verification code to ${emailHint || "your registered email"}. Enter it with your password to link Google.`}
                />

                <OtpInput
                  id="oauthLinkOtp"
                  value={oauthLinkOtp}
                  error={!!oauthLinkError}
                  onChange={(value) => {
                    setOauthLinkOtp(value);
                    if (oauthLinkError) setOauthLinkError("");
                  }}
                />

                <Input
                  type="password"
                  placeholder="Your account password"
                  value={oauthLinkPassword}
                  onChange={(event) => {
                    setOauthLinkPassword(clampToMaxLength(event.target.value, "password"));
                    if (oauthLinkError) setOauthLinkError("");
                  }}
                  className={`${underlineInputClass} mt-4`}
                  {...inputRuleProps("password")}
                />
                <FieldMessage message={oauthLinkError} />

                <AuthSubmitFooter>
                  <Button
                    type="submit"
                    className="h-11 w-full shadow-zynd-mid"
                    size="lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Linking..." : "Confirm and link Google"}
                  </Button>
                </AuthSubmitFooter>
              </form>

              {/* 2. Email OTP — Join ZYND */}
              <form
                onSubmit={handleEmailOtpContinue}
                className={stepPanelClass(step === "email-otp")}
              >
                <EmailChip email={email} onEdit={() => setStep("email")} />

                <OtpInfoBanner
                  message={`A 6-digit code was sent to ${email}. Enter it below to join ZYND.`}
                />

                <OtpInput
                  id="emailOtp"
                  value={emailOtp}
                  error={!!emailOtpError}
                  onChange={(value) => {
                    setEmailOtp(value);
                    if (emailOtpError) setEmailOtpError("");
                  }}
                />
                <FieldMessage message={emailOtpError} />

                <button type="button" className="auth-link mt-3">
                  Resend code
                </button>

                <AuthSubmitFooter>
                  <Button
                    type="submit"
                    className="h-11 w-full shadow-zynd-mid"
                    size="lg"
                    disabled={!isValidOtp(emailOtp)}
                  >
                    Join ZYND
                  </Button>
                </AuthSubmitFooter>
              </form>

              {/* 3. Password */}
              <form
                onSubmit={handlePasswordContinue}
                className={stepPanelClass(step === "password")}
              >
                <EmailChip email={email} onEdit={() => setStep("email")} />

                <Input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="Create your password"
                  required
                  value={password}
                  onChange={(event) =>
                    setPassword(clampToMaxLength(event.target.value, "password"))
                  }
                  className={underlineInputClass}
                  {...inputRuleProps("password")}
                />

                <div className="flex min-h-0 flex-1 flex-col justify-end">
                  <PasswordCriteriaList password={password} />
                  <AuthSubmitFooter className="mt-4">
                    <Button
                      type="submit"
                      className="h-11 w-full shadow-zynd-mid"
                      size="lg"
                      disabled={!isPasswordValid(password)}
                    >
                      Continue
                    </Button>
                  </AuthSubmitFooter>
                </div>
              </form>

              {/* 4. Mobile */}
              <form
                onSubmit={handleMobileContinue}
                className={stepPanelClass(step === "mobile")}
              >
                <EmailChip email={email} onEdit={() => setStep("email")} />

                <FieldGroup className="gap-3">
                  <Field>
                    <FieldLabel htmlFor="country">Country</FieldLabel>
                    <div className="flex h-11 items-center gap-2.5 rounded-[var(--radius-control)] border border-border bg-muted/30 px-3 text-compact text-foreground">
                      <IndiaFlagIcon />
                      <span>
                        {DEFAULT_COUNTRY.label} ({DEFAULT_COUNTRY.dialCode})
                      </span>
                    </div>
                  </Field>

                  <Field data-invalid={!!mobileError}>
                    <FieldLabel htmlFor="mobile">Mobile number</FieldLabel>
                    <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-border bg-muted/20 px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
                      <span className="shrink-0 text-compact font-medium text-muted-foreground">
                        {DEFAULT_COUNTRY.dialCode}
                      </span>
                      <Input
                        id="mobile"
                        name="mobile"
                        type="tel"
                        autoComplete="tel-national"
                        inputMode="numeric"
                        placeholder="10-digit mobile number"
                        required
                        value={mobile}
                        onChange={(event) => {
                          setMobile(digitsOnly(event.target.value, "mobile"));
                          if (mobileError) setMobileError("");
                        }}
                        aria-invalid={!!mobileError}
                        className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                        {...inputRuleProps("mobile")}
                      />
                    </div>
                    <FieldMessage message={mobileError} />
                  </Field>
                </FieldGroup>

                <AuthSubmitFooter>
                  <Button
                    type="submit"
                    className="h-11 w-full shadow-zynd-mid"
                    size="lg"
                    disabled={!isValidMobile(mobile)}
                  >
                    Send OTP
                  </Button>
                </AuthSubmitFooter>
              </form>

              {/* 5. Mobile OTP */}
              <form
                onSubmit={handleMobileOtpContinue}
                className={stepPanelClass(step === "mobile-otp")}
              >
                <EmailChip email={email} onEdit={() => setStep("email")} />
                <MobileChip mobile={mobile} onEdit={() => setStep("mobile")} />

                <OtpInfoBanner message="Enter the 6-digit OTP sent to your mobile number." />

                <OtpInput
                  id="mobileOtp"
                  value={mobileOtp}
                  error={!!mobileOtpError}
                  onChange={(value) => {
                    setMobileOtp(value);
                    if (mobileOtpError) setMobileOtpError("");
                  }}
                />
                <FieldMessage message={mobileOtpError} />

                <button type="button" className="auth-link mt-3">
                  Resend OTP
                </button>

                <AuthSubmitFooter>
                  <Button
                    type="submit"
                    className="h-11 w-full shadow-zynd-mid"
                    size="lg"
                    disabled={!isValidOtp(mobileOtp)}
                  >
                    Verify mobile
                  </Button>
                </AuthSubmitFooter>
              </form>

              {/* 6. Profile */}
              <form
                onSubmit={handleProfileContinue}
                className={stepPanelClass(step === "profile")}
              >
                <ProfileNameHeader
                  firstName={firstName}
                  middleName={middleName}
                  lastName={lastName}
                />

                <FieldGroup className="gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field data-invalid={!!profileErrors.firstName}>
                      <FieldLabel htmlFor="firstName">First name</FieldLabel>
                      <Input
                        id="firstName"
                        name="firstName"
                        autoComplete="given-name"
                        placeholder="e.g. Harshit"
                        required
                        value={firstName}
                        onChange={(event) => {
                          setFirstName(lettersOnly(event.target.value, "firstName"));
                          if (profileErrors.firstName) {
                            setProfileErrors((prev) => ({ ...prev, firstName: undefined }));
                          }
                        }}
                        aria-invalid={!!profileErrors.firstName}
                        className={profileInputClass}
                        {...inputRuleProps("firstName")}
                      />
                      <FieldMessage message={profileErrors.firstName} />
                    </Field>

                    <Field data-invalid={!!profileErrors.lastName}>
                      <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                      <Input
                        id="lastName"
                        name="lastName"
                        autoComplete="family-name"
                        placeholder="e.g. Kushwah"
                        required
                        value={lastName}
                        onChange={(event) => {
                          setLastName(lettersOnly(event.target.value, "lastName"));
                          if (profileErrors.lastName) {
                            setProfileErrors((prev) => ({ ...prev, lastName: undefined }));
                          }
                        }}
                        aria-invalid={!!profileErrors.lastName}
                        className={profileInputClass}
                        {...inputRuleProps("lastName")}
                      />
                      <FieldMessage message={profileErrors.lastName} />
                    </Field>
                  </div>

                  <Field data-invalid={!!profileErrors.middleName}>
                    <FieldLabel htmlFor="middleName">
                      Middle name{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </FieldLabel>
                    <Input
                      id="middleName"
                      name="middleName"
                      autoComplete="additional-name"
                      placeholder="Middle name if applicable"
                      value={middleName}
                      onChange={(event) => {
                        setMiddleName(lettersOnly(event.target.value, "middleName"));
                        if (profileErrors.middleName) {
                          setProfileErrors((prev) => ({ ...prev, middleName: undefined }));
                        }
                      }}
                      aria-invalid={!!profileErrors.middleName}
                      className={profileInputClass}
                      {...inputRuleProps("middleName")}
                    />
                    <FieldMessage message={profileErrors.middleName} />
                  </Field>
                </FieldGroup>

                <AuthSubmitFooter>
                  <Button
                    type="submit"
                    className="h-11 w-full shadow-zynd-mid"
                    size="lg"
                    disabled={!isProfileValid({ firstName, middleName, lastName })}
                  >
                    Complete &amp; go to dashboard
                  </Button>
                </AuthSubmitFooter>
              </form>

              {/* Forgot password */}
              <form
                onSubmit={handleForgotSubmit}
                className={stepPanelClass(step === "forgot-password")}
              >
                {forgotSent ? (
                  <UiMessage variant="success" className="mt-0">
                    Reset link sent to{" "}
                    <span className="font-medium">{forgotEmail}</span>. Check your inbox and
                    follow the instructions.
                  </UiMessage>
                ) : (
                  <>
                    <ClearableInput
                      type="email"
                      name="forgotEmail"
                      autoComplete="email"
                      placeholder="Your Email Address"
                      required
                      value={forgotEmail}
                      onClear={() => {
                        setForgotEmail("");
                        setForgotEmailError("");
                      }}
                      onChange={(event) => {
                        setForgotEmail(clampToMaxLength(event.target.value, "email"));
                        if (forgotEmailError) setForgotEmailError("");
                      }}
                      aria-invalid={!!forgotEmailError}
                      className={underlineInputClass}
                      {...inputRuleProps("email")}
                    />
                    <FieldMessage message={forgotEmailError} />

                    <TurnstileWidget
                      resetKey={`forgot-${turnstileResetKey}`}
                      onVerify={setTurnstileToken}
                      onExpire={() => setTurnstileToken("")}
                      className="mt-4 mb-4"
                    />
                    <FieldMessage message={turnstileError} />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="auth-link mt-3"
                >
                  Back to sign in
                </button>

                <AuthSubmitFooter>
                  {!forgotSent ? (
                    <Button type="submit" className="h-11 w-full shadow-zynd-mid" size="lg">
                      Send reset link
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="h-11 w-full shadow-zynd-mid"
                      size="lg"
                      onClick={() => setStep("email")}
                    >
                      Back to sign in
                    </Button>
                  )}
                </AuthSubmitFooter>
              </form>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

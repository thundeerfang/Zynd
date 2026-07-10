import { apiRequest, setAccessToken } from "@/lib/api-client";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";

export type AuthUser = {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  role: string;
  country_code: string;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  mfa_enrolled: boolean;
  mfa_enrolled_at: string | null;
  fund_movement_eligible: boolean;
  account_status: string;
  deletion_scheduled_at: string | null;
};

type AuthSuccessResponse = {
  next: "authenticated";
  access_token: string;
  token_type: string;
  user: AuthUser;
  new_device?: boolean;
};

type MfaRequiredResponse = {
  next: "mfa_required";
  mfa_token: string;
  expires_in: number;
};

type OAuthLinkRequiredResponse = {
  next: "oauth_link_confirmation_required";
  link_token: string;
  expires_in: number;
  email_hint: string;
};

export type LoginFlowResponse =
  | AuthSuccessResponse
  | MfaRequiredResponse
  | OAuthLinkRequiredResponse;

function storeAuthResponse(data: AuthSuccessResponse) {
  setAccessToken(data.access_token);
  return data;
}

export async function checkEmail(email: string) {
  return apiRequest<{ exists: boolean; next: "login" | "signup" }>("/auth/check-email", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function signupStart(email: string, turnstileToken?: string | null) {
  return apiRequest<{ signup_token: string }>("/auth/signup/start", {
    method: "POST",
    body: JSON.stringify({ email, turnstile_token: turnstileToken ?? null }),
  });
}

export async function signupVerifyEmail(signupToken: string, otp: string) {
  return apiRequest<{ verified: boolean }>("/auth/signup/verify-email", {
    method: "POST",
    body: JSON.stringify({ signup_token: signupToken, otp }),
  });
}

export async function signupSetPassword(signupToken: string, password: string) {
  return apiRequest<{ ok: boolean }>("/auth/signup/set-password", {
    method: "POST",
    body: JSON.stringify({ signup_token: signupToken, password }),
  });
}

export async function signupSendMobileOtp(signupToken: string, mobile: string) {
  return apiRequest<{ ok: boolean }>("/auth/signup/send-mobile-otp", {
    method: "POST",
    body: JSON.stringify({ signup_token: signupToken, mobile, country_code: "IN" }),
  });
}

export async function signupVerifyMobile(signupToken: string, otp: string) {
  return apiRequest<{ verified: boolean }>("/auth/signup/verify-mobile", {
    method: "POST",
    body: JSON.stringify({ signup_token: signupToken, otp }),
  });
}

export async function signupComplete(
  signupToken: string,
  profile: { firstName: string; middleName?: string; lastName: string }
) {
  const data = await apiRequest<AuthSuccessResponse>("/auth/signup/complete", {
    method: "POST",
    body: JSON.stringify({
      signup_token: signupToken,
      first_name: profile.firstName,
      middle_name: profile.middleName || null,
      last_name: profile.lastName,
      device_fingerprint: getDeviceFingerprint(),
    }),
  });
  return storeAuthResponse(data);
}

export async function login(
  email: string,
  password: string,
  turnstileToken?: string | null
): Promise<LoginFlowResponse> {
  return apiRequest<LoginFlowResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      turnstile_token: turnstileToken ?? null,
      device_fingerprint: getDeviceFingerprint(),
    }),
  });
}

export async function loginWithGoogle(idToken: string): Promise<LoginFlowResponse> {
  return apiRequest<LoginFlowResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify({
      id_token: idToken,
      device_fingerprint: getDeviceFingerprint(),
    }),
  });
}

export async function verifyMfaLogin(payload: {
  mfaToken: string;
  totpCode?: string;
  backupCode?: string;
}) {
  const data = await apiRequest<AuthSuccessResponse>("/auth/mfa/verify", {
    method: "POST",
    body: JSON.stringify({
      mfa_token: payload.mfaToken,
      totp_code: payload.totpCode ?? null,
      backup_code: payload.backupCode ?? null,
    }),
  });
  return storeAuthResponse(data);
}

export async function confirmOAuthLink(payload: {
  linkToken: string;
  emailOtp: string;
  password: string;
}) {
  const data = await apiRequest<LoginFlowResponse>("/auth/oauth/link/confirm", {
    method: "POST",
    body: JSON.stringify({
      link_token: payload.linkToken,
      email_otp: payload.emailOtp,
      password: payload.password,
      device_fingerprint: getDeviceFingerprint(),
    }),
  });
  if (data.next === "authenticated") {
    return storeAuthResponse(data);
  }
  return data;
}

export async function mfaEnrollStart() {
  return apiRequest<{
    enroll_token: string;
    qr_uri: string;
    manual_secret: string;
    expires_in: number;
  }>("/auth/mfa/enroll/start", { method: "POST" });
}

export async function mfaEnrollConfirm(enrollToken: string, totpCode: string) {
  return apiRequest<{
    enrolled: boolean;
    backup_codes: string[];
    mfa_enrolled_at: string | null;
  }>("/auth/mfa/enroll/confirm", {
    method: "POST",
    body: JSON.stringify({ enroll_token: enrollToken, totp_code: totpCode }),
  });
}

export async function checkFundEligibility() {
  return apiRequest<{ eligible: boolean; reasons: string[] }>("/auth/fund-eligibility/check");
}

export type UserSession = {
  id: string;
  is_current: boolean;
  os: string | null;
  browser: string | null;
  last_used_at: string;
  created_at: string;
};

export async function fetchSessions() {
  return apiRequest<{ sessions: UserSession[] }>("/auth/sessions");
}

export async function revokeSession(sessionId: string) {
  return apiRequest<{ ok: boolean }>("/auth/sessions/revoke", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export async function revokeAllOtherSessions() {
  return apiRequest<{ revoked: number }>("/auth/sessions/revoke-all", {
    method: "POST",
  });
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
  totpCode?: string;
}) {
  return apiRequest<{ ok: boolean }>("/auth/account/change-password", {
    method: "POST",
    body: JSON.stringify({
      current_password: payload.currentPassword,
      new_password: payload.newPassword,
      totp_code: payload.totpCode ?? null,
    }),
  });
}

export async function changeEmailStart(payload: {
  newEmail: string;
  currentPassword: string;
  totpCode?: string;
}) {
  return apiRequest<{ change_token: string }>("/auth/account/change-email/start", {
    method: "POST",
    body: JSON.stringify({
      new_email: payload.newEmail,
      current_password: payload.currentPassword,
      totp_code: payload.totpCode ?? null,
    }),
  });
}

export async function changeEmailConfirm(changeToken: string, otp: string) {
  return apiRequest<{ ok: boolean }>("/auth/account/change-email/confirm", {
    method: "POST",
    body: JSON.stringify({ change_token: changeToken, otp }),
  });
}

export async function requestAccountDeletion(payload: {
  currentPassword: string;
  totpCode?: string;
}) {
  return apiRequest<{ ok: boolean; deletion_scheduled_at: string | null }>(
    "/auth/account/delete-request",
    {
      method: "POST",
      body: JSON.stringify({
        current_password: payload.currentPassword,
        totp_code: payload.totpCode ?? null,
      }),
    }
  );
}

export async function cancelAccountDeletion() {
  return apiRequest<{ ok: boolean }>("/auth/account/delete-cancel", {
    method: "POST",
  });
}

export async function fetchCurrentUser() {
  return apiRequest<AuthUser>("/auth/me");
}

export async function logout() {
  await apiRequest<{ ok: boolean }>("/auth/logout", { method: "POST" });
  setAccessToken(null);
}

export async function forgotPassword(email: string, turnstileToken?: string | null) {
  return apiRequest<{ ok: boolean }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email, turnstile_token: turnstileToken ?? null }),
  });
}

export async function resetPassword(token: string, newPassword: string) {
  return apiRequest<{ ok: boolean }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export async function bootstrapSession() {
  try {
    const refreshed = await apiRequest<AuthSuccessResponse>("/auth/refresh", { method: "POST" });
    storeAuthResponse(refreshed);
    return refreshed.user;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export function getDisplayName(user: AuthUser) {
  return [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(" ");
}

export function isAuthenticatedResponse(
  response: LoginFlowResponse
): response is AuthSuccessResponse {
  return response.next === "authenticated";
}

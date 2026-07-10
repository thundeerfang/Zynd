from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class CheckEmailRequest(BaseModel):
    email: EmailStr


class CheckEmailResponse(BaseModel):
    exists: bool
    next: str


class SignupStartRequest(BaseModel):
    email: EmailStr
    turnstile_token: Optional[str] = None


class SignupStartResponse(BaseModel):
    signup_token: str


class SignupVerifyEmailRequest(BaseModel):
    signup_token: str
    otp: str = Field(min_length=6, max_length=6)


class SignupSetPasswordRequest(BaseModel):
    signup_token: str
    password: str = Field(min_length=8, max_length=128)


class SignupSendMobileRequest(BaseModel):
    signup_token: str
    mobile: str = Field(min_length=10, max_length=15)
    country_code: str = "IN"


class SignupVerifyMobileRequest(BaseModel):
    signup_token: str
    otp: str = Field(min_length=6, max_length=6)


class SignupCompleteRequest(BaseModel):
    signup_token: str
    first_name: str = Field(min_length=2, max_length=50)
    last_name: str = Field(min_length=2, max_length=50)
    middle_name: Optional[str] = Field(default=None, max_length=50)
    device_fingerprint: str = Field(min_length=8, max_length=256)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    turnstile_token: Optional[str] = None
    device_fingerprint: str = Field(min_length=8, max_length=256)


class GoogleLoginRequest(BaseModel):
    id_token: str
    device_fingerprint: str = Field(min_length=8, max_length=256)


class MfaVerifyRequest(BaseModel):
    mfa_token: str
    totp_code: Optional[str] = Field(default=None, min_length=6, max_length=6)
    backup_code: Optional[str] = Field(default=None, min_length=8, max_length=12)


class OAuthLinkConfirmRequest(BaseModel):
    link_token: str
    email_otp: str = Field(min_length=6, max_length=6)
    password: str = Field(min_length=8, max_length=128)
    device_fingerprint: str = Field(min_length=8, max_length=256)


class MfaEnrollConfirmRequest(BaseModel):
    enroll_token: str
    totp_code: str = Field(min_length=6, max_length=6)


class StepUpRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    totp_code: Optional[str] = Field(default=None, min_length=6, max_length=6)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    totp_code: Optional[str] = Field(default=None, min_length=6, max_length=6)


class ChangeEmailStartRequest(BaseModel):
    new_email: EmailStr
    current_password: str = Field(min_length=8, max_length=128)
    totp_code: Optional[str] = Field(default=None, min_length=6, max_length=6)


class ChangeEmailConfirmRequest(BaseModel):
    change_token: str
    otp: str = Field(min_length=6, max_length=6)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    turnstile_token: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: UUID
    email: str
    phone: Optional[str]
    first_name: Optional[str]
    middle_name: Optional[str]
    last_name: Optional[str]
    role: str
    country_code: str
    email_verified_at: Optional[datetime]
    phone_verified_at: Optional[datetime]
    mfa_enrolled: bool = False
    mfa_enrolled_at: Optional[datetime] = None
    fund_movement_eligible: bool = False
    account_status: str = "active"
    deletion_scheduled_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    next: Literal["authenticated"] = "authenticated"
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    new_device: bool = False


class MfaRequiredResponse(BaseModel):
    next: Literal["mfa_required"] = "mfa_required"
    mfa_token: str
    expires_in: int = 300


class OAuthLinkRequiredResponse(BaseModel):
    next: Literal["oauth_link_confirmation_required"] = "oauth_link_confirmation_required"
    link_token: str
    expires_in: int
    email_hint: str


class MfaEnrollStartResponse(BaseModel):
    enroll_token: str
    qr_uri: str
    manual_secret: str
    expires_in: int


class MfaEnrollConfirmResponse(BaseModel):
    enrolled: bool = True
    backup_codes: list[str]
    mfa_enrolled_at: Optional[datetime]


class FundEligibilityResponse(BaseModel):
    eligible: bool
    reasons: list[str]


class SessionItemResponse(BaseModel):
    id: UUID
    is_current: bool
    os: Optional[str] = None
    browser: Optional[str] = None
    last_used_at: datetime
    created_at: datetime


class SessionListResponse(BaseModel):
    sessions: list[SessionItemResponse]


class RevokeSessionRequest(BaseModel):
    session_id: UUID


class RevokeSessionsResponse(BaseModel):
    revoked: int


LoginFlowResponse = Union[AuthResponse, MfaRequiredResponse, OAuthLinkRequiredResponse]


class OkResponse(BaseModel):
    ok: bool = True


class VerifiedResponse(BaseModel):
    verified: bool = True

"""auth hardening sprint 1

Revision ID: 002_auth_hardening
Revises: 001_initial_auth
Create Date: 2026-07-10
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_auth_hardening"
down_revision: Union[str, None] = "001_initial_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_AUDIT_VALUES = [
    "mfa_enrolled",
    "mfa_challenge_success",
    "mfa_challenge_failure",
    "backup_code_used",
    "oauth_link_requested",
    "oauth_link_confirmed",
    "sessions_revoked_all",
    "email_change_requested",
    "email_changed",
    "password_changed",
    "fund_gate_blocked_mfa",
    "account_deletion_requested",
    "account_deletion_cancelled",
]


def upgrade() -> None:
    user_status = postgresql.ENUM(
        "active", "deletion_pending", "deleted", name="userstatus", create_type=False
    )
    deletion_event_type = postgresql.ENUM(
        "deletion_requested",
        "deletion_cancelled",
        "deletion_executed",
        name="deletioneventtype",
        create_type=False,
    )
    user_status.create(op.get_bind(), checkfirst=True)
    deletion_event_type.create(op.get_bind(), checkfirst=True)

    op.execute("ALTER TYPE oauthprovider ADD VALUE IF NOT EXISTS 'apple'")
    for value in NEW_AUDIT_VALUES:
        op.execute(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{value}'")

    op.add_column("users", sa.Column("mfa_enrolled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("mfa_required_for_funds", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "users",
        sa.Column("status", user_status, nullable=False, server_default="active"),
    )
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("deletion_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("deletion_scheduled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("email_changed_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "user_mfa_secrets",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("secret_ciphertext", sa.Text(), nullable=False),
        sa.Column("secret_key_version", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "user_backup_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code_hash", sa.String(255), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_user_backup_codes_user_id", "user_backup_codes", ["user_id"])

    op.create_table(
        "oauth_link_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "provider",
            postgresql.ENUM("google", "apple", name="oauthprovider", create_type=False),
            nullable=False,
        ),
        sa.Column("provider_user_id", sa.String(255), nullable=False),
        sa.Column("provider_email", sa.String(254), nullable=True),
        sa.Column("confirmation_token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_oauth_link_requests_user_id", "oauth_link_requests", ["user_id"])

    op.create_table(
        "deletion_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", deletion_event_type, nullable=False),
        sa.Column("retention_policy", sa.String(64), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_deletion_ledger_user_id", "deletion_ledger", ["user_id"])

    op.create_table(
        "data_retention_schedule",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("data_class", sa.String(64), nullable=False, unique=True),
        sa.Column("min_retention_days", sa.Integer(), nullable=False),
        sa.Column("legal_basis", sa.String(128), nullable=False),
        sa.Column("can_delete_on_request", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    retention = sa.table(
        "data_retention_schedule",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("data_class", sa.String()),
        sa.column("min_retention_days", sa.Integer()),
        sa.column("legal_basis", sa.String()),
        sa.column("can_delete_on_request", sa.Boolean()),
        sa.column("notes", sa.Text()),
    )
    op.bulk_insert(
        retention,
        [
            {
                "id": "00000000-0000-4000-8000-000000000001",
                "data_class": "auth_credentials",
                "min_retention_days": 30,
                "legal_basis": "DPDP",
                "can_delete_on_request": True,
                "notes": "Grace period after deletion request",
            },
            {
                "id": "00000000-0000-4000-8000-000000000002",
                "data_class": "profile_pii",
                "min_retention_days": 30,
                "legal_basis": "DPDP",
                "can_delete_on_request": True,
                "notes": "Anonymized after grace window",
            },
            {
                "id": "00000000-0000-4000-8000-000000000003",
                "data_class": "kyc_documents",
                "min_retention_days": 1825,
                "legal_basis": "PMLA",
                "can_delete_on_request": False,
                "notes": "Placeholder — confirm with compliance counsel",
            },
            {
                "id": "00000000-0000-4000-8000-000000000004",
                "data_class": "transaction_records",
                "min_retention_days": 2920,
                "legal_basis": "PMLA/SEBI",
                "can_delete_on_request": False,
                "notes": "Placeholder — confirm with compliance counsel",
            },
            {
                "id": "00000000-0000-4000-8000-000000000005",
                "data_class": "audit_logs",
                "min_retention_days": 2920,
                "legal_basis": "Compliance",
                "can_delete_on_request": False,
                "notes": "Append-only retention",
            },
            {
                "id": "00000000-0000-4000-8000-000000000006",
                "data_class": "deletion_ledger",
                "min_retention_days": 3650,
                "legal_basis": "Compliance",
                "can_delete_on_request": False,
                "notes": "Proof of deletion handling",
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("data_retention_schedule")
    op.drop_table("deletion_ledger")
    op.drop_index("ix_oauth_link_requests_user_id", table_name="oauth_link_requests")
    op.drop_table("oauth_link_requests")
    op.drop_index("ix_user_backup_codes_user_id", table_name="user_backup_codes")
    op.drop_table("user_backup_codes")
    op.drop_table("user_mfa_secrets")

    op.drop_column("users", "email_changed_at")
    op.drop_column("users", "password_changed_at")
    op.drop_column("users", "deletion_scheduled_at")
    op.drop_column("users", "deletion_requested_at")
    op.drop_column("users", "deleted_at")
    op.drop_column("users", "status")
    op.drop_column("users", "mfa_required_for_funds")
    op.drop_column("users", "mfa_enrolled_at")

    postgresql.ENUM(name="deletioneventtype").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="userstatus").drop(op.get_bind(), checkfirst=True)

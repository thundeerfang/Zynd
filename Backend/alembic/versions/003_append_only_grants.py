"""append-only grants for audit and deletion ledger

Revision ID: 003_append_only_grants
Revises: 002_auth_hardening
Create Date: 2026-07-10
"""

from typing import Sequence, Union

from alembic import op

revision: str = "003_append_only_grants"
down_revision: Union[str, None] = "002_auth_hardening"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE
            app_role name := current_user;
        BEGIN
            EXECUTE format('REVOKE UPDATE, DELETE ON audit_logs FROM %I', app_role);
            EXECUTE format('REVOKE UPDATE, DELETE ON deletion_ledger FROM %I', app_role);
            EXECUTE format('GRANT SELECT, INSERT ON audit_logs TO %I', app_role);
            EXECUTE format('GRANT SELECT, INSERT ON deletion_ledger TO %I', app_role);
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE
            app_role name := current_user;
        BEGIN
            EXECUTE format('GRANT UPDATE, DELETE ON audit_logs TO %I', app_role);
            EXECUTE format('GRANT UPDATE, DELETE ON deletion_ledger TO %I', app_role);
        END $$;
        """
    )

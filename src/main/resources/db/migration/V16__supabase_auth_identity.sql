ALTER TABLE platform_accounts ADD COLUMN supabase_user_id VARCHAR(36);

CREATE UNIQUE INDEX idx_platform_accounts_supabase_user_id
    ON platform_accounts (supabase_user_id);

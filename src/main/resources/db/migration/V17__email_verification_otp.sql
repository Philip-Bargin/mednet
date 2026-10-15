ALTER TABLE platform_accounts
    ADD COLUMN verification_code_hash VARCHAR(100);

ALTER TABLE platform_accounts
    ADD COLUMN verification_code_expires_at TIMESTAMP WITH TIME ZONE;

DROP INDEX IF EXISTS "account_issuer_accountId_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_providerId_accountId_uidx" ON "account" ("provider_id","account_id");
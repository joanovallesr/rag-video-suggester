DROP INDEX "account_issuer_accountId_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "account_providerId_accountId_uidx" ON "account" ("provider_id","account_id");
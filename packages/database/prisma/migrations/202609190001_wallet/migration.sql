CREATE TYPE "WalletAccountKind" AS ENUM ('USER', 'CLEARING');
CREATE TYPE "WalletDirection" AS ENUM ('CREDIT', 'DEBIT');

CREATE TABLE "WalletAccount" (
  "id" TEXT PRIMARY KEY,
  "kind" "WalletAccountKind" NOT NULL,
  "userId" TEXT REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "unit" "MoneyUnit" NOT NULL,
  "balanceMinor" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletAccount_owner_check" CHECK (
    ("kind" = 'USER' AND "userId" IS NOT NULL) OR
    ("kind" = 'CLEARING' AND "userId" IS NULL)
  ),
  CONSTRAINT "WalletAccount_nonnegative_check" CHECK ("kind" <> 'USER' OR "balanceMinor" >= 0)
);
CREATE UNIQUE INDEX "WalletAccount_userId_unit_key" ON "WalletAccount"("userId", "unit");
-- NULL userId cannot enforce this through the ordinary composite unique index.
CREATE UNIQUE INDEX "WalletAccount_clearing_unit_key" ON "WalletAccount"("unit") WHERE "kind" = 'CLEARING';

CREATE TABLE "WalletTransfer" (
  "id" TEXT PRIMARY KEY,
  "sequence" BIGSERIAL NOT NULL UNIQUE,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "requestHash" TEXT NOT NULL,
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "direction" "WalletDirection" NOT NULL,
  "description" TEXT NOT NULL,
  "unit" "MoneyUnit" NOT NULL,
  "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" > 0),
  "fromAccountId" TEXT NOT NULL REFERENCES "WalletAccount"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "toAccountId" TEXT NOT NULL REFERENCES "WalletAccount"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "fromBalanceAfterMinor" BIGINT NOT NULL DEFAULT 0,
  "toBalanceAfterMinor" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletTransfer_distinct_accounts_check" CHECK ("fromAccountId" <> "toAccountId")
);
CREATE UNIQUE INDEX "WalletTransfer_referenceType_referenceId_direction_key" ON "WalletTransfer"("referenceType", "referenceId", "direction");
CREATE INDEX "WalletTransfer_fromAccountId_sequence_idx" ON "WalletTransfer"("fromAccountId", "sequence");
CREATE INDEX "WalletTransfer_toAccountId_sequence_idx" ON "WalletTransfer"("toAccountId", "sequence");

CREATE FUNCTION wallet_guard_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."balanceMinor" <> 0 THEN RAISE EXCEPTION 'WALLET_DIRECT_BALANCE_WRITE'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'WALLET_ACCOUNT_IMMUTABLE'; END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."userId" IS DISTINCT FROM OLD."userId"
    OR NEW."unit" IS DISTINCT FROM OLD."unit" OR NEW."kind" IS DISTINCT FROM OLD."kind"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'WALLET_ACCOUNT_IMMUTABLE';
  END IF;
  -- Only the nested ledger trigger may maintain the cached balance. This is an integrity
  -- guard, not a substitute for denying DDL/TRUNCATE privileges to the production app role.
  IF pg_trigger_depth() < 2 THEN RAISE EXCEPTION 'WALLET_DIRECT_BALANCE_WRITE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wallet_guard_account BEFORE INSERT OR UPDATE OR DELETE ON "WalletAccount"
FOR EACH ROW EXECUTE FUNCTION wallet_guard_account();

CREATE FUNCTION wallet_post_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source_account "WalletAccount"%ROWTYPE;
  destination_account "WalletAccount"%ROWTYPE;
BEGIN
  -- Global ordering prevents opposite-direction transfers taking locks in different orders.
  PERFORM "id" FROM "WalletAccount"
    WHERE "id" IN (NEW."fromAccountId", NEW."toAccountId") ORDER BY "id" FOR UPDATE;
  SELECT * INTO STRICT source_account FROM "WalletAccount" WHERE "id" = NEW."fromAccountId";
  SELECT * INTO STRICT destination_account FROM "WalletAccount" WHERE "id" = NEW."toAccountId";
  IF NEW."amountMinor" <= 0 OR NEW."fromAccountId" = NEW."toAccountId"
    OR source_account."unit" <> NEW."unit" OR destination_account."unit" <> NEW."unit"
    OR (NEW."direction" = 'CREDIT' AND (source_account."kind" <> 'CLEARING' OR destination_account."kind" <> 'USER'))
    OR (NEW."direction" = 'DEBIT' AND (source_account."kind" <> 'USER' OR destination_account."kind" <> 'CLEARING')) THEN
    RAISE EXCEPTION 'WALLET_INVALID_TRANSFER';
  END IF;
  IF source_account."kind" = 'USER' AND source_account."balanceMinor" < NEW."amountMinor" THEN
    RAISE EXCEPTION 'WALLET_INSUFFICIENT_FUNDS';
  END IF;
  IF source_account."balanceMinor" < '-9223372036854775808'::bigint + NEW."amountMinor"
    OR destination_account."balanceMinor" > '9223372036854775807'::bigint - NEW."amountMinor" THEN
    RAISE EXCEPTION 'WALLET_OVERFLOW';
  END IF;
  NEW."fromBalanceAfterMinor" := source_account."balanceMinor" - NEW."amountMinor";
  NEW."toBalanceAfterMinor" := destination_account."balanceMinor" + NEW."amountMinor";
  RETURN NEW;
END $$;
CREATE TRIGGER wallet_post_transfer BEFORE INSERT ON "WalletTransfer"
FOR EACH ROW EXECUTE FUNCTION wallet_post_transfer();

CREATE FUNCTION wallet_apply_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Apply only AFTER a row is actually inserted. A raw INSERT ... ON CONFLICT DO NOTHING
  -- must never update balances for a skipped journal row. BEFORE still holds both locks.
  UPDATE "WalletAccount" SET "balanceMinor" = NEW."fromBalanceAfterMinor" WHERE "id" = NEW."fromAccountId";
  UPDATE "WalletAccount" SET "balanceMinor" = NEW."toBalanceAfterMinor" WHERE "id" = NEW."toAccountId";
  RETURN NEW;
END $$;
CREATE TRIGGER wallet_apply_transfer AFTER INSERT ON "WalletTransfer"
FOR EACH ROW EXECUTE FUNCTION wallet_apply_transfer();

CREATE FUNCTION wallet_reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'WALLET_LEDGER_IMMUTABLE';
END $$;
CREATE TRIGGER wallet_reject_ledger_mutation BEFORE UPDATE OR DELETE ON "WalletTransfer"
FOR EACH ROW EXECUTE FUNCTION wallet_reject_ledger_mutation();
CREATE TRIGGER wallet_reject_ledger_truncate BEFORE TRUNCATE ON "WalletTransfer"
FOR EACH STATEMENT EXECUTE FUNCTION wallet_reject_ledger_mutation();
CREATE TRIGGER wallet_reject_account_truncate BEFORE TRUNCATE ON "WalletAccount"
FOR EACH STATEMENT EXECUTE FUNCTION wallet_reject_ledger_mutation();

COMMENT ON TABLE "WalletTransfer" IS 'Immutable double-entry transfer journal. Correct mistakes with a separately authorized compensating transfer, never UPDATE or DELETE.';
COMMENT ON TABLE "WalletAccount" IS 'Balance projection maintained by wallet_post_transfer. CLEARING is an internal accounting counterparty, not proof of third-party settlement.';

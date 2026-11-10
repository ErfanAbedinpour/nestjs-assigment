-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "PaymentEventType" AS ENUM ('CREATED', 'QUEUED', 'PROCESSING_STARTED', 'SUCCEEDED', 'FAILED', 'RETRY_TRIGGERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_fingerprint" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failure_code" TEXT,
    "failure_reason" TEXT,
    "next_dispatch_at" TIMESTAMPTZ(3) NOT NULL,
    "queued_at" TIMESTAMPTZ(3),
    "processing_started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "payment_id" UUID,
    "reference" TEXT,
    "description" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "type" "PaymentEventType" NOT NULL,
    "attempt" INTEGER NOT NULL,
    "from_status" "PaymentStatus",
    "to_status" "PaymentStatus" NOT NULL,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "payments_status_next_dispatch_at_idx" ON "payments"("status", "next_dispatch_at");

-- CreateIndex
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_user_id_idempotency_key_key" ON "payments"("user_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_payment_id_key" ON "transactions"("payment_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_created_at_idx" ON "transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_user_id_idempotency_key_key" ON "transactions"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payment_events_payment_id_occurred_at_idx" ON "payment_events"("payment_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Financial invariants enforced by the database, independent of application code.
ALTER TABLE "users" ADD CONSTRAINT "users_balance_non_negative" CHECK ("balance" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_attempts_non_negative" CHECK ("attempts" >= 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_balance_after_non_negative" CHECK ("balance_after" >= 0);
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_attempt_non_negative" CHECK ("attempt" >= 0);

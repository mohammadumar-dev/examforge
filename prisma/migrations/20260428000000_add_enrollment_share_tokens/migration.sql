-- CreateTable
CREATE TABLE "enrollment_share_tokens" (
    "id" TEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "label" VARCHAR(100),
    "admin_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollment_share_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_share_tokens_token_key" ON "enrollment_share_tokens"("token");

-- CreateIndex
CREATE INDEX "enrollment_share_tokens_token_idx" ON "enrollment_share_tokens"("token");

-- AddForeignKey
ALTER TABLE "enrollment_share_tokens" ADD CONSTRAINT "enrollment_share_tokens_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

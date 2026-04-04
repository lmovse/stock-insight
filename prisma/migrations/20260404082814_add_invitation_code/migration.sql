-- CreateTable
CREATE TABLE "InvitationCode" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "InvitationCode_usedAt_idx" ON "InvitationCode"("usedAt");

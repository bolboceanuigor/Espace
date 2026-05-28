CREATE TABLE "superadmin_search_history" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "query" TEXT,
  "selectedResultType" TEXT,
  "selectedResultId" TEXT,
  "selectedResultTitle" TEXT,
  "selectedUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "superadmin_search_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "superadmin_search_history_userId_createdAt_idx" ON "superadmin_search_history"("userId", "createdAt");
CREATE INDEX "superadmin_search_history_selectedResultType_selectedResultId_idx" ON "superadmin_search_history"("selectedResultType", "selectedResultId");

ALTER TABLE "superadmin_search_history"
  ADD CONSTRAINT "superadmin_search_history_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

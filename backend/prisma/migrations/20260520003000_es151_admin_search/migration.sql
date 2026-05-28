CREATE TABLE "admin_search_history" (
  "id" TEXT NOT NULL,
  "associationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "query" TEXT,
  "selectedResultType" TEXT,
  "selectedResultId" TEXT,
  "selectedResultTitle" TEXT,
  "selectedUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_search_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_search_history_associationId_userId_createdAt_idx" ON "admin_search_history"("associationId", "userId", "createdAt");
CREATE INDEX "admin_search_history_selectedResultType_selectedResultId_idx" ON "admin_search_history"("selectedResultType", "selectedResultId");

ALTER TABLE "admin_search_history"
  ADD CONSTRAINT "admin_search_history_associationId_fkey"
  FOREIGN KEY ("associationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_search_history"
  ADD CONSTRAINT "admin_search_history_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

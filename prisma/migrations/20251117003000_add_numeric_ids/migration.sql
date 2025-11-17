-- AlterTable
ALTER TABLE "Route" ADD COLUMN IF NOT EXISTS "routeNumericId" INTEGER;

-- AlterTable
ALTER TABLE "Stop" ADD COLUMN IF NOT EXISTS "stopNumericId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Route_routeNumericId_key" ON "Route"("routeNumericId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Route_routeNumericId_idx" ON "Route"("routeNumericId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Stop_stopNumericId_idx" ON "Stop"("stopNumericId");


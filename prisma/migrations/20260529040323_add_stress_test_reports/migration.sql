-- CreateTable
CREATE TABLE "stress_test_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testName" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "connections" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "totalRequests" INTEGER NOT NULL,
    "successfulReqs" INTEGER NOT NULL,
    "failedReqs" INTEGER NOT NULL,
    "errors" INTEGER NOT NULL,
    "timeouts" INTEGER NOT NULL,
    "avgLatencyMs" REAL NOT NULL,
    "p50LatencyMs" REAL NOT NULL,
    "p99LatencyMs" REAL NOT NULL,
    "maxLatencyMs" REAL NOT NULL,
    "avgThroughput" REAL NOT NULL,
    "statusCodes" TEXT NOT NULL,
    "assessment" TEXT NOT NULL,
    "assessmentMsg" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "health_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuUsagePercent" REAL,
    "memoryUsageMb" REAL,
    "activeConnections" INTEGER,
    "queuedRequests" INTEGER,
    "responseTime50" REAL,
    "responseTime99" REAL,
    "errorRate" REAL,
    "description" TEXT
);

-- CreateIndex
CREATE INDEX "stress_test_reports_createdAt_idx" ON "stress_test_reports"("createdAt");

-- CreateIndex
CREATE INDEX "stress_test_reports_endpoint_idx" ON "stress_test_reports"("endpoint");

-- CreateIndex
CREATE INDEX "health_metrics_timestamp_idx" ON "health_metrics"("timestamp");

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentState" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "error" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "correlationId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueOpportunityLog" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "buyerId" TEXT,
    "opportunityType" TEXT NOT NULL,
    "expectedImpactMinor" INTEGER NOT NULL,
    "realizedImpactMinor" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "orderId" TEXT,
    "paymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "convertedAt" TIMESTAMP(3),

    CONSTRAINT "RevenueOpportunityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceMessage" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "protocolVersion" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CommerceMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantCapability" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scope_idempotencyKey_key" ON "IdempotencyRecord"("scope", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_providerEventId_key" ON "WebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_eventId_key" ON "OutboxEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceMessage_messageId_key" ON "CommerceMessage"("messageId");

-- CreateIndex
CREATE INDEX "CommerceMessage_sessionId_idx" ON "CommerceMessage"("sessionId");

-- CreateIndex
CREATE INDEX "CommerceMessage_correlationId_idx" ON "CommerceMessage"("correlationId");

-- CreateIndex
CREATE INDEX "CommerceMessage_messageType_idx" ON "CommerceMessage"("messageType");

-- CreateIndex
CREATE INDEX "CommerceMessage_createdAt_idx" ON "CommerceMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantCapability_merchantId_capability_key" ON "MerchantCapability"("merchantId", "capability");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_key" ON "Inventory"("productId");

-- AddForeignKey
ALTER TABLE "RevenueOpportunityLog" ADD CONSTRAINT "RevenueOpportunityLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantCapability" ADD CONSTRAINT "MerchantCapability_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

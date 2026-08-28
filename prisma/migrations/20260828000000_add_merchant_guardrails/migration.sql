-- CreateTable
CREATE TABLE "MerchantGuardrail" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "revenueGoal" TEXT NOT NULL DEFAULT 'BALANCED',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "autonomousPaymentLimitMinor" INTEGER NOT NULL DEFAULT 0,
    "approvalAboveMinor" INTEGER NOT NULL DEFAULT 0,
    "maxDiscountBps" INTEGER NOT NULL DEFAULT 0,
    "minimumMarginBps" INTEGER NOT NULL DEFAULT 0,
    "negotiationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "upsellEnabled" BOOLEAN NOT NULL DEFAULT false,
    "crossSellEnabled" BOOLEAN NOT NULL DEFAULT false,
    "disabledSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantGuardrail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantGuardrail_merchantId_key" ON "MerchantGuardrail"("merchantId");

-- AddForeignKey
ALTER TABLE "MerchantGuardrail" ADD CONSTRAINT "MerchantGuardrail_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


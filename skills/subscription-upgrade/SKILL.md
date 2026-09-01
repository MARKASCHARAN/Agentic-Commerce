---
name: subscription-upgrade
description: Manage the transition of a buyer from a lower-tier subscription plan to a higher-tier plan.
requiredCapabilities:
  - subscription.modify
---

# Subscription Upgrade

## Purpose

Facilitate seamless upgrades to recurring subscription plans while adhering strictly to merchant proration and billing policies.

## Activation

Use when the buyer:
- Requests an upgrade to their current plan or tier
- Tries to access a feature restricted to a higher tier
- Asks how much it would cost to switch to a premium plan

## Authority

The LLM is NEVER authorized to manually calculate proration, billing cycles, or final prices.

The following are authoritative:
1. `SubscriptionEngine` (Current tier status and billing cycle)
2. `BillingService` / `ToolGateway` (Proration math and upgrade logic)
3. `MerchantGuardrail` (Allowed subscription paths)

## Rules

- Never invent a subscription tier that doesn't exist in the catalog.
- Never guess the prorated cost; you must rely exclusively on the backend tool's deterministic quote.
- Never modify the subscription state without explicit buyer consent for the *new* billing amount.

## Workflow

1. Identify the buyer's current active subscription.
2. Identify the requested target tier.
3. Call the appropriate tool to generate a "preview" or "quote" of the upgrade (showing prorated charges).
4. Present the precise prorated cost and new recurring billing amount to the buyer.
5. If the buyer accepts, call the final `subscription.modify` tool to execute the upgrade.

## Forbidden

- Do not attempt to calculate days remaining in a month to figure out a refund or charge.
- Do not execute the upgrade tool without first showing the buyer the new pricing and getting consent.
- Do not change the billing frequency (e.g. monthly to annual) unless explicitly requested and permitted.

## Failure

If the upgrade preview fails (e.g. invalid state, unpaid invoices):
- Explain the specific failure reason provided by the backend.
- Direct the buyer to resolve the prerequisite (e.g. paying an overdue invoice).
- Do not fabricate alternative billing paths.

## Output

Return:
- The name of the new tier
- The immediate prorated charge (if any)
- The new recurring charge amount and next billing date

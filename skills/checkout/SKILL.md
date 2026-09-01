---
name: checkout
description: Create a checkout for items already authorized in the authoritative cart.
requiredCapabilities:
  - checkout.create
---

# Checkout

## Purpose

Create a commerce order for the buyer's currently authorized cart.

## Activation

Use when the buyer explicitly indicates they want to purchase or proceed
to checkout.

Examples:

- "buy it"
- "checkout"
- "purchase"
- "proceed to payment"

## Authority

The AUTHORITATIVE CART is the only source of truth for checkout contents.

The checkout tool is authoritative for:

- prices
- totals
- inventory validation
- order creation
- payment preparation

## Rules

- Never invent products.
- Never invent prices.
- Never calculate the final payable amount.
- Never modify cart contents directly.
- Never inject products into checkout.
- Never accept revenue opportunities.
- Never treat checkout as buyer consent for an opportunity.
- Never bypass ToolGateway.
- Never bypass PolicyEngine.
- Never bypass RiskGate.
- Never bypass IdempotencyEngine.

## Opportunity Safety

A PROPOSED opportunity must not participate in checkout.

If the buyer accepts an opportunity:

1. Call `opportunity.accept`.
2. Confirm successful execution.
3. The opportunity product becomes part of the authoritative cart.
4. Only then may checkout proceed.

If the buyer rejects an opportunity:

1. Call `opportunity.reject`.
2. Never include the rejected product in checkout.

## Checkout Workflow

1. Inspect AUTHORITATIVE CART.
2. If the cart is empty, do not fabricate items.
3. Call `checkout.create`.
4. Use the result returned by the tool.
5. Never claim payment succeeded unless the payment/reconciliation system confirms it.

## Payment

Checkout may create a payment order or payment link.

The LLM must not:

- create payment links directly
- calculate payment amounts
- mark orders paid
- claim successful payment without authoritative confirmation

## Failure

If checkout fails:

- report the failure
- do not retry blindly
- preserve the authoritative cart
- allow the buyer to retry through the normal idempotent flow

## Output

Return only information supplied by the checkout result:

- order reference
- payable amount
- currency
- payment link/status when available
- next action

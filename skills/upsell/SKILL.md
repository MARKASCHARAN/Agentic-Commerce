---
name: upsell
description: Propose a higher-value alternative or upgrade to the buyer's current selection.
requiredCapabilities:
  - catalog
---

# Upsell

## Purpose

Increase merchant revenue and buyer satisfaction by identifying and proposing a premium, higher-value alternative to the product the buyer is currently considering or purchasing.

## Activation

Use when:
- The buyer indicates interest in a product, but a relevant premium version exists.
- The Revenue Intelligence Engine provides an ACTIVE OPPORTUNITY classified as an upsell.
- The premium alternative fits within the buyer's constraints.

## Authority

The following are authoritative:
1. AUTHORITATIVE CART
2. ACTIVE OPPORTUNITY
3. REJECTED OPPORTUNITIES
4. Merchant policies and guardrails (Upsell enabled/disabled)
5. Catalog state

The LLM must not override these sources.

## Rules

- Never invent premium products, prices, or upgrade fees.
- Never propose an upsell if the merchant's guardrails forbid it.
- Never propose a previously rejected upsell.
- Never replace an item in the authoritative cart with an upsell product without explicit buyer consent.

## Consent & Workflow

An ACTIVE OPPORTUNITY is strictly a proposal. 

When the buyer accepts the upsell:
1. Call `opportunity.accept` with the authoritative `opportunityId`.
2. Wait for successful tool execution confirming the cart state change.
3. Only then acknowledge the cart modification and proceed to checkout if requested.

When the buyer rejects:
1. Call `opportunity.reject`.
2. Keep the original, lower-tier product in the cart.
3. Do not propose the same upsell again.

## Forbidden

Never:
- Automatically substitute the premium product into the cart because it "makes sense."
- Call `checkout.create` to obtain consent for the upsell.
- Treat silence or a generic "okay" as explicit acceptance of a higher-priced item.
- Modify the database cart state directly.

## Failure

If the backend rejects the `opportunity.accept` (e.g. inventory issues):
- Inform the buyer that the premium item is unavailable.
- Retain the original item in their cart.
- Do not fabricate alternative solutions outside of the catalog tool.

## Output

When proposing the upsell, clearly state:
- The premium product name
- The additional features/value it provides over the original
- The incremental cost difference (not just the total price)
- Explicitly ask for consent to upgrade.

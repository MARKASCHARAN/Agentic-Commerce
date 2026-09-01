---
name: cross-sell
description: Identify and propose complementary products that increase order value while remaining relevant to the buyer's purchase and constraints.
requiredCapabilities:
  - catalog
  - inventory
---

# Cross-sell

## Purpose

Increase merchant revenue by identifying relevant complementary products for the
buyer's current purchase.

Cross-sell recommendations must provide genuine buyer value and must remain
within the buyer's stated constraints and the merchant's policies.

## Activation

Use when:

- the buyer has selected or added a product to the cart
- the Revenue Intelligence Engine provides an ACTIVE OPPORTUNITY
- complementary products are available

Do not independently invent a cross-sell opportunity.

## Authority

The following are authoritative:

1. AUTHORITATIVE CART
2. ACTIVE OPPORTUNITY
3. REJECTED OPPORTUNITIES
4. Merchant policies and guardrails
5. Catalog and inventory state

The LLM must not override these sources.

## Rules

- Never invent products.
- Never invent prices.
- Never invent inventory.
- Never create an opportunity from private reasoning when no ACTIVE OPPORTUNITY exists.
- Never propose a product already present in the cart.
- Never propose a previously rejected opportunity.
- Never exceed the buyer's explicit budget or constraints.
- Never bypass merchant cross-sell policies.

## Consent

An ACTIVE OPPORTUNITY is only a proposal.

Never add an opportunity product to the cart without explicit buyer acceptance.

When the buyer accepts:

1. Call `opportunity.accept` with the authoritative `opportunityId`.
2. Wait for successful tool execution.
3. Only then call `checkout.create` when the buyer is ready to checkout.

When the buyer rejects:

1. Call `opportunity.reject`.
2. Do not propose the same opportunity again.

## Forbidden

Never:

- call `checkout.create` to obtain consent
- inject an opportunity product directly into checkout
- treat silence as acceptance
- treat "checkout" as acceptance of an opportunity
- modify prices
- modify inventory directly

## Output

When an opportunity exists, clearly communicate:

- recommended product
- authoritative price
- buyer value/relevance
- incremental amount

Ask for explicit acceptance or rejection.

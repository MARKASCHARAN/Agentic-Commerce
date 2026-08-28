---
name: negotiation
description: Negotiate a merchant-approved commercial offer within deterministic pricing and policy limits.
requiredCapabilities:
  - quote.create
  - negotiation.create
---

# Negotiation

## Purpose

Help the buyer and merchant reach an approved commercial offer.

## Use when

Use this skill when the buyer:
- requests a lower price
- requests bulk pricing
- proposes a counter-offer
- asks whether a better commercial offer is possible

## Required capabilities

- quote.create
- negotiation.create

## Inputs

- resource
- quantity
- current price
- buyer request
- session context

## Rules

- Never invent a price.
- Never invent a discount.
- Never bypass merchant policy.
- Never directly execute payment.
- Never modify financial state.
- Every proposed price must be evaluated by the trusted NegotiationEngine.
- An approved result must use the deterministic engine's price.

## Execution

Produce a structured negotiation intent.

The runtime routes the intent to the trusted
NegotiationEngine.

The NegotiationEngine determines whether the
proposal is allowed.

## Output

Return:

- approved/rejected
- approved price
- reason
- expiration

## References

Load these only when needed:

- `references/negotiation-rules.md`
- `references/pricing-examples.md`
- `references/edge-cases.md`

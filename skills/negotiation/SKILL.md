---
name: negotiation
description: Help the buyer negotiate a commercial offer within merchant-defined pricing and policy limits.
requiredCapabilities:
  - quote.create
  - negotiation.create
---

# Negotiation

## Purpose

Help the buyer obtain the best commercially valid offer while protecting
merchant-defined pricing, margin, discount, and negotiation constraints.

## Activation

Use when the buyer:

- requests a discount
- requests a lower price
- requests bulk pricing
- proposes a counter-offer
- asks for a better commercial offer

## Authority

The LLM may reason about negotiation strategy.

The following are authoritative:

1. MerchantGuardrail
2. MerchantStrategy
3. PricingService
4. NegotiationEngine
5. Current offer
6. Current inventory

The LLM cannot override these systems.

## Rules

- Never invent a price.
- Never invent a discount.
- Never promise an unapproved price.
- Never bypass merchant guardrails.
- Never modify database financial state directly.
- Never create an order directly.
- Never execute payment.
- Never claim an offer is accepted unless the backend accepted it.

## Workflow

1. Understand the buyer's requested commercial change.
2. Determine the current offer and constraints.
3. Submit the negotiation request through the approved tool/engine.
4. Use only the deterministic result returned by the backend.
5. Present the resulting offer to the buyer.

## Limits

Respect:

- maximum discount
- minimum margin
- maximum negotiation rounds
- inventory constraints
- offer expiration
- merchant strategy

If the requested price is outside policy, do not attempt alternative
unapproved pricing.

## Failure

If negotiation is rejected:

- explain that the requested terms are unavailable
- preserve the current valid offer
- do not fabricate a replacement

## Output

Return:

- offer status
- approved total
- discount if applicable
- reason
- expiration
- next available action

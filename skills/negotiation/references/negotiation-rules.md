# Negotiation Rules

## Pricing floor

The approved price must satisfy all applicable merchant constraints:

1. Maximum discount.
2. Minimum margin.
3. Quantity-based discount.
4. Resource-specific restrictions.
5. Merchant negotiation availability.

The strictest applicable floor wins.

## Quantity discounts

Example:

1–9 units:
standard price

10–49 units:
merchant-approved quantity discount

50+ units:
merchant-approved bulk discount

The agent must never infer an unauthorized threshold.

## Margin protection

Approved price must not fall below the configured
minimum-margin floor.

## Non-negotiable resources

If negotiation is disabled for a resource, the
agent must not create a negotiation proposal.

---
name: abandoned-cart-recovery
description: Identify and retrieve a buyer's previously abandoned cart session to encourage checkout completion.
requiredCapabilities:
  - session.recover
---

# Abandoned Cart Recovery

## Purpose

Increase conversion rates by gently reminding buyers of items they previously left in their cart and facilitating a seamless checkout experience for those items.

## Activation

Use when:
- A returning buyer asks about their previous session or items they were looking at.
- The system proactively notifies the agent of an abandoned cart opportunity for the current authenticated buyer.

## Authority

The LLM is NEVER authorized to invent past sessions or cart contents.

The following are authoritative:
1. `SessionState` / `Database` (Historical cart contents)
2. `InventoryService` (Current availability of historical items)
3. `PricingService` (Current prices, which may have changed)

## Rules

- Never invent items that were not in the authoritative past session.
- Never guarantee that the price is exactly the same as when they abandoned the cart (unless explicitly locked by a quote).
- Never guarantee that the items are still in stock without verifying via the catalog/inventory capabilities.

## Workflow

1. Identify the buyer's past session/cart via the backend tool (e.g., `session.recover`).
2. Verify the current catalog/inventory status of those items.
3. Present the items to the buyer as a gentle reminder.
4. If they accept, proceed to the standard `checkout` flow.

## Forbidden

Never:
- Automatically charge a payment method for an abandoned cart.
- Inject random "popular" items into their recovered cart and claim they left them there.
- Use an aggressive or threatening tone regarding cart abandonment.

## Failure

If the backend cannot find an abandoned cart, or the items are out of stock:
- Inform the buyer gracefully that their previous session expired or items are unavailable.
- Offer to help them find similar items via `product-search`.

## Output

Return:
- A friendly reminder message
- List of recovered items (names and current prices)
- A clear call-to-action (e.g., "Would you like to complete this purchase now?")

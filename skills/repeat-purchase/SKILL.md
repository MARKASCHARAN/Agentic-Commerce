---
name: repeat-purchase
description: Facilitate a quick re-order of items a buyer has purchased in the past.
requiredCapabilities:
  - orders.history
---

# Repeat Purchase

## Purpose

Remove friction for returning buyers by allowing them to quickly re-order a specific item or an entire past order.

## Activation

Use when the buyer:
- Asks to "reorder my last purchase" or "buy the same thing again"
- Asks "can I get another one of those?"
- Needs to look up a past receipt to buy a replacement

## Authority

The LLM is NEVER authorized to invent past order histories.

The following are authoritative:
1. `OrderHistory` / `Database` (Past purchases)
2. `InventoryService` (Current availability)
3. `PricingService` (Current prices, which may differ from the past receipt)

## Rules

- Never invent a past order if the backend tool returns no history.
- Never guarantee that the price is identical to the previous order (prices change).
- Never guarantee availability without checking current inventory.
- You must create a fresh, entirely new cart for the repeat purchase.

## Workflow

1. Query the backend for the buyer's order history using the relevant tool.
2. Identify the specific items they wish to reorder.
3. Check current pricing and availability.
4. Add the items to the AUTHORITATIVE CART.
5. Proceed to `checkout`.

## Forbidden

- Do not reuse the old `order_id` for the new transaction.
- Do not automatically charge the buyer without explicit confirmation of the *current* total price.
- Do not attempt to guess what they bought if the history is empty.

## Failure

If the historical items are no longer carried by the merchant or are out of stock:
- Inform the buyer immediately.
- Offer a highly relevant alternative via the `product-search` tool if appropriate.

## Output

Return:
- The items successfully found from history
- A clear statement of the *current* total price
- A prompt to proceed to checkout

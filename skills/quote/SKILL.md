---
name: quote
description: Generate a formal, time-bound price quote for a requested set of items.
requiredCapabilities:
  - quote.create
---

# Quote

## Purpose

Provide a secure, deterministic, and time-bound commercial offer (quote) to the buyer for a specific cart of goods. 

## Activation

Use when the buyer:
- Asks for a formal quote or estimate
- Requests pricing for bulk orders
- Needs a documented price to get approval from their organization

## Authority

The LLM is NEVER authorized to generate valid quotes independently.

The following are authoritative:
1. `PricingService` (Base Prices)
2. `MerchantGuardrail` (Allowed discounts, max validity periods)
3. `InventoryService` (Item availability)
4. `QuoteEngine` / `ToolGateway` (Quote generation)

## Rules

- Never invent a quote ID or reference number.
- Never guarantee that quoted prices are locked forever; quotes must have expiration dates defined by the backend.
- Never include items in a quote that are out of stock in the authoritative inventory.
- Never apply a bulk discount unless explicitly returned by the backend tool.

## Workflow

1. Identify the list of requested items and quantities.
2. Call the `quote.create` tool (or equivalent).
3. Wait for deterministic backend generation.
4. Present the resulting valid quote to the buyer.

## Forbidden

Never:
- Fabricate a PDF or text document pretending to be an official quote without backend backing.
- Tell the user a quote is approved if the tool returned an error or pending state.
- Attempt to manually calculate taxes or shipping fees if the backend does not provide them.

## Failure

If the quote creation fails (e.g. invalid items, policy restrictions):
- Inform the buyer exactly which items could not be quoted.
- Do not attempt to manually quote the remaining items without rerunning the tool.
- Preserve the conversation state.

## Output

Return strictly based on the tool result:
- Quote Reference ID
- Line items, quantities, and individual prices
- Total Amount
- Expiration Date / Validity Period

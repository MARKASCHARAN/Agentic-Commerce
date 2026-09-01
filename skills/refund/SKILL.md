---
name: refund
description: Process a full or partial refund for a captured payment.
requiredCapabilities:
  - refund.create
---

# Refund

## Purpose

Provide customer support and resolve payment disputes by safely processing a refund against an already captured payment.

## Activation

Use when the buyer:
- Explicitly requests a refund or money back
- Wants to cancel a paid order
- Is owed a partial credit due to negotiation or failure to deliver

## Authority

The LLM is NEVER authorized to determine if a refund is financially permissible.

The following are authoritative:
1. `PaymentProvider` state (PaymentIntent)
2. `MerchantGuardrail` (Refund policies and limits)
3. `ToolGateway` (Execution authority)

## Rules

- Never invent a payment history that doesn't exist.
- Never promise a refund amount before the `refund.create` tool has executed successfully.
- Never bypass the `IdempotencyEngine` when calling refund tools.
- Do not attempt to process a refund if the payment is still in a "pending" or "created" state.

## Workflow

1. Identify the buyer's target payment/order reference.
2. Determine if it is a full or partial refund request.
3. Execute the `refund.create` tool (or equivalent).
4. Wait for deterministic backend execution.
5. Only if the tool returns success, inform the buyer of the refund.

## Forbidden

Never:
- Modify database payment intent states directly.
- Send API requests directly to third-party payment gateways (e.g. Razorpay) bypassing the internal backend provider.
- Assume that a refund request implies an automatic approval.

## Failure

If the backend rejects the refund (e.g. past refund window, insufficient funds, policy block):
- Clearly communicate the rejection reason provided by the backend to the buyer.
- Do not fabricate alternative compensation unless strictly guided by merchant policy.
- Retain the current PaymentIntent state.

## Output

Return strictly based on the tool result:
- Refund Status (Successful/Failed)
- Refunded Amount
- Original Payment Reference
- Expected timeline for funds to return to the buyer (if provided by the tool)

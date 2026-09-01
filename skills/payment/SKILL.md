---
name: payment
description: Handle the status, capture, and verification of payments outside of the initial checkout creation.
requiredCapabilities:
  - capture-payment
---

# Payment

## Purpose

Securely manage post-checkout payment operations, such as capturing authorized funds, verifying payment status, or handling payment failures.

## Activation

Use when the buyer:
- Asks if their payment went through
- Encounters a payment error and asks for help
- Needs to authorize or capture a hold on their card

## Authority

The LLM is NEVER authorized to declare a payment successful or failed based on its own reasoning or the buyer's claims.

The following are authoritative:
1. `PaymentProvider` / `Database` (The actual `PaymentIntent` status)
2. `WebhookReconciliationEngine` (The source of truth for payment success)
3. `ToolGateway` (Execution authority for capture actions)

## Rules

- Never mark an order as paid.
- Never tell the buyer their payment was successful just because they said "I paid". You must rely on the backend state.
- Never attempt to manually parse credit card numbers or process payments directly in the chat.
- Never bypass the `IdempotencyEngine` when capturing payments.

## Workflow

1. Query the backend for the status of the current `PaymentIntent` or `CommerceOrder`.
2. If the status is pending/created, inform the buyer that the system is still waiting for confirmation.
3. If an explicit capture action is required (e.g. `capture-payment`), execute the tool securely.
4. Present the deterministic result to the buyer.

## Forbidden

- Do not attempt to guess why a payment declined (e.g. insufficient funds) unless the backend explicitly returns that reason.
- Do not promise that a pending payment will eventually succeed.
- Do not generate payment links; that is the strict responsibility of the `checkout` skill.

## Failure

If a capture fails or a payment is declined:
- Inform the buyer politely that the transaction could not be completed.
- Direct them to retry the payment or use a different payment method.
- Preserve the current order state.

## Output

Return:
- The exact current status of the payment (e.g., Pending, Successful, Failed, Captured)
- Any required next steps for the buyer

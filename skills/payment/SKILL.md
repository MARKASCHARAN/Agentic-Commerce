---
name: payment
description: Process a payment for an order.
requiredCapabilities:
  - payment.create
---

# Payment

## Purpose
Process a financial payment for a completed checkout/order.

## When to use
Use when the buyer provides payment intent for an existing order.

## Required capabilities
- payment.create

## Inputs
- order ID
- payment details

## Rules
- Never bypass ToolGateway.
- Never bypass IdempotencyEngine.
- Never bypass PolicyEngine.
- Never directly execute external provider APIs.

## Expected output
A payment status result (SUCCESS, FAILED).

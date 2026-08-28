---
name: refund
description: Process a refund for a previous payment.
requiredCapabilities:
  - refund.create
---

# Refund

## Purpose
Process a partial or full refund for a previous transaction.

## When to use
Use when a buyer requests a refund and meets policy conditions.

## Required capabilities
- refund.create

## Inputs
- payment ID
- refund amount

## Rules
- Never bypass ToolGateway.
- Never bypass PolicyEngine (refund limits).
- Never bypass IdempotencyEngine.

## Expected output
A refund status result.

---
name: abandoned-cart-recovery
description: Recover an abandoned cart by reaching out or offering incentives.
requiredCapabilities:
  - order.create
---

# Abandoned Cart Recovery

## Purpose
Recover revenue from a cart or checkout that was abandoned.

## When to use
Use when identifying an abandoned session or when instructed by a recovery workflow.

## Required capabilities
- order.create

## Inputs
- abandoned session ID
- cart items

## Rules
- Never invent unauthorized discounts.
- Must respect merchant recovery policies.

## Expected output
Recovery attempt strategy and communication.

---
name: checkout
description: Initiate a checkout process.
requiredCapabilities:
  - checkout.create
---

# Checkout

## Purpose
Initiate a checkout process for the buyer's selected items.

## When to use
Use when the buyer is ready to purchase and needs an order created.

## Required capabilities
- checkout.create

## Inputs
- list of items and quantities

## Rules
- Never bypass merchant policy.
- Never directly execute payment without ToolGateway.
- `checkout.create` consumes the AUTHORITATIVE CART.
- Do not use `checkout.create` to obtain buyer consent for cross-sells or upsells.
- Do not directly inject PROPOSED opportunity products into `checkout.create`.
- A revenue opportunity must already be ACCEPTED (via `opportunity.accept`) before its product can participate in checkout.

## Expected output
An order reference ready for payment.

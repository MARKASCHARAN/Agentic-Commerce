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
- When the buyer says "buy", "checkout", or "purchase" for a product recently searched or displayed in the conversation, use that product's productId and call checkout.create with quantity 1.

## Expected output
An order reference ready for payment.

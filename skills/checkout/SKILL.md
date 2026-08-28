---
name: checkout
description: Initiate a checkout process.
requiredCapabilities:
  - order.create
---

# Checkout

## Purpose
Initiate a checkout process for the buyer's selected items.

## When to use
Use when the buyer is ready to purchase and needs an order created.

## Required capabilities
- order.create

## Inputs
- list of items and quantities

## Rules
- Never bypass merchant policy.
- Never directly execute payment without ToolGateway.

## Expected output
An order reference ready for payment.

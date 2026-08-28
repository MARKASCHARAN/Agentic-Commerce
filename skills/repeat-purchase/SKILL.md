---
name: repeat-purchase
description: Facilitate a repeat purchase of previously bought items.
requiredCapabilities:
  - order.create
  - catalog
---

# Repeat Purchase

## Purpose
Streamline the purchase of items the buyer has ordered before.

## When to use
Use when a buyer asks to reorder or when a consumable item is due for replenishment.

## Required capabilities
- order.create
- catalog

## Inputs
- past order ID
- items to reorder

## Rules
- Never invent prices.
- Never bypass ToolGateway for order creation.

## Expected output
Prepared cart or order for the repeat purchase.

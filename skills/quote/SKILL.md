---
name: quote
description: Generate a commercial quote for a buyer.
requiredCapabilities:
  - quote.create
---

# Quote

## Purpose
Generate a formal commercial quote for products.

## When to use
Use when the buyer requests pricing for a specific list of items or bulk quantities.

## Required capabilities
- quote.create

## Inputs
- resource ID
- quantity

## Rules
- Never invent prices.
- Never bypass merchant policy.
- Never modify financial state directly.

## Expected output
A formal quote with items, quantities, and valid prices.

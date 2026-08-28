---
name: upsell
description: Propose an upsell for an item in the cart or order.
requiredCapabilities:
  - catalog
---

# Upsell

## Purpose
Propose a higher-value alternative or upgrade to the buyer's current selection.

## When to use
Use when a buyer is considering a product but a relevant premium version is available.

## Required capabilities
- catalog

## Inputs
- current product
- proposed premium product

## Rules
- Never invent products or prices.
- Must respect merchant upsell policies.

## Expected output
Recommendation for the premium product.

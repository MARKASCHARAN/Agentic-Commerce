---
name: cross-sell
description: Propose complementary products to the buyer.
requiredCapabilities:
  - catalog
---

# Cross-sell

## Purpose
Propose complementary items that enhance the primary product being purchased.

## When to use
Use when a buyer selects a product that frequently pairs well with accessories or related items.

## Required capabilities
- catalog

## Inputs
- selected product
- complementary products

## Rules
- Never invent products or prices.
- Must respect merchant cross-sell policies.
- Never add a product merely because an opportunity exists. A proposed cross-sell (ACTIVE OPPORTUNITY) requires explicit buyer acceptance.
- A rejected opportunity (REJECTED OPPORTUNITIES) must never be proposed or added again.
- When the buyer explicitly accepts a proposed opportunity, you MUST call opportunity.accept with the opportunityId BEFORE calling checkout.create.
- When the buyer explicitly rejects a proposed opportunity (e.g. "no thanks"), you MUST call opportunity.reject with the opportunityId.

## Expected output
Recommendations for complementary products.

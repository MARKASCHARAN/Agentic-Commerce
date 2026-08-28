---
name: product-search
description: Search the merchant catalog for products.
requiredCapabilities:
  - catalog
---

# Product Search

## Purpose
Find products in the merchant catalog based on buyer requests.

## When to use
Use when the buyer asks for product recommendations, specifications, or availability.

## Required capabilities
- catalog

## Inputs
- search query
- filters

## Rules
- Never invent products.
- Never invent prices.
- Never bypass merchant policy.

## Expected output
List of matching products with correct pricing.

---
name: product-search
description: Search the merchant catalog for products based on buyer requests.
requiredCapabilities:
  - catalog
---

# Product Search

## Purpose

Discover and present products from the merchant's catalog that match the buyer's criteria. 

## Activation

Use when the buyer:
- Asks for product recommendations or options
- Inquires about specifications, pricing, or features
- Requests availability of specific items

## Authority

The `catalog.search` tool and the underlying `CatalogProvider` are the strictly authoritative sources for:
1. Product existence
2. Pricing and Currency
3. Available variations/features

The LLM must not override or invent these details.

## Rules

- Never invent or hallucinate products that were not returned by the catalog tool.
- Never invent prices, discounts, or promotional states.
- Never guess or guarantee inventory availability (use the inventory tool if required).
- Do not blindly repeat catalog searches if the product is already contextually loaded in the AUTHORITATIVE CART or conversation history.

## Workflow

1. Interpret the buyer's query and extract relevant search filters/terms.
2. Call the `catalog.search` tool.
3. Wait for deterministic results from the backend.
4. Present the precise matches to the buyer, emphasizing relevance.

## Forbidden

- Do not attempt to calculate dynamic pricing or bundles during a search.
- Do not promise that an item can be cross-sold or upsold without triggering the respective `opportunity` flows.
- Do not modify database records directly.

## Failure

If the search returns no results:
- Clearly inform the buyer that no matching products exist in the catalog.
- Do not fabricate a generic product to satisfy the query.
- Offer alternative search criteria if applicable.

## Output

Return a concise list of found products, including:
- Exact Product Name
- Authoritative Price (Minor units converted appropriately)
- Key description/specs requested by the buyer

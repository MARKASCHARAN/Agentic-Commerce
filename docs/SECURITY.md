# Agentic Commerce OS — Product Vision, Positioning & Security Architecture

---

# Part 1: Product Vision & Architecture Positioning

## Track 01 Alignment — AI Growth & Agentic Commerce

> **Core Mission**: Turn any traditional business into an AI-buyable, agent-native merchant to systematically maximize merchant revenue and Average Order Value (AOV) whenever AI Buyers (like Claude, ChatGPT, or autonomous procurement agents) shop online. Every financial action is explainable, bounded, and human-gated.

---

## 📈 Revenue Maximization Engine (4 Pillars)

```text
                               AI BUYERS
                        (Claude / Procurement)
                                  │
                                  ▼
                        ┌───────────────────┐
                        │   MCP Commerce    │
                        └─────────┬─────────┘
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      ▼                           ▼                           ▼
1. CROSS-SELL UPLIFT       2. UPSELL EXPANSION        3. MARGIN PROTECTION
   Add-on product pairs      Higher-tier model          10% max discount cap
   (e.g., GaN Charger)       upgrades (256G->512G)      guards profit margins
      │                           │                           │
      └───────────────────────────┼───────────────────────────┘
                                  ▼
                      4. INSTANT AI BUYABILITY
                      Converts static CSV catalogs 
                      into AI-transactable endpoints
                                  │
                                  ▼
                         MAXIMIZED REVENUE 🚀
```

1. **Autonomous Cross-Sell Expansion**: When an AI Buyer requests an item (e.g. Laptop), our Revenue Intelligence Engine automatically identifies high-margin complementary add-ons (e.g. 65W GaN Fast Charger + Protection Sleeve) to boost basket size.
2. **Smart Upsell Recommendations**: When an AI Buyer requests an entry-level product, our Revenue Engine suggests value-adding higher-tier upgrades (e.g. 256GB → 512GB model).
3. **Margin-Protected Discount Guardrails**: Dynamic pricing caps discounts (max 10%) so transactions close quickly without destroying merchant profit margins.
4. **100% Instant AI Buyability**: Converts static merchant CSV catalogs into AI-buyable MCP endpoints in under 3 seconds.

---

## 🏗️ High-Level System Architecture

```text
                    AI BUYERS
             Claude / future agents
                       │
                       ▼
             ┌──────────────────┐
             │  Merchant Agent  │
             │      via MCP     │
             └────────┬─────────┘
                      │
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
   Catalog        Revenue        Negotiation
   Discovery      Intelligence   + Policy
       │              │              │
       └──────────────┼──────────────┘
                      ▼
               Human Approval Gate
                      │
                      ▼
                Razorpay
             Payment / Checkout
                      │
                      ▼
             Webhook Reconciliation
                      │
                      ▼
             Merchant Control Plane
```

### Key Differentiation
Razorpay provides payment infrastructure for the agentic era (**Razorpay Agentic Payments**, **UPI Reserve Pay**, **AI-ready MCP/APIs**).

Our platform sits on top as the **Merchant Enablement & Revenue Control Layer**:

> **"Make any business ready to participate in agentic commerce."**

---

## 🌐 Protocol Evolution Roadmap (NPCI UAP, ACP, AP2, x402)

India's **NPCI Unified Agent Protocol (UAP)** and global open standards (**ACP**, **AP2**, **x402**) represent the future of agentic payment rails.

Our architecture decouples merchant enablement from the underlying payment transport via a pluggable **Payment Adapter Interface**:

```text
                    AI BUYER
                       │
          ┌────────────┴────────────┐
          │                         │
       MCP Today             Future Protocols
   (Model Context Protocol)  NPCI UAP / ACP / AP2 / x402
          │                         │
          └────────────┬────────────┘
                       ▼
                 Merchant Agent
                       │
             Agentic Commerce OS
                       │
              PaymentAdapter Boundary
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     Razorpay       NPCI UAP       x402 / ACP
```

> **Key Judge Message**: *"As agentic payment protocols evolve — from NPCI UAP and UPI to ACP, AP2, and x402 — our merchant revenue layer doesn't need to change. The merchant becomes agent-ready once."*

---

## 🏆 Official Judge Pitch

> **"Agentic Commerce OS turns any merchant into an AI-native seller to maximize merchant revenue in the AI economy. A merchant uploads its existing CSV catalog, configures pricing policies, and immediately becomes discoverable and transactable by AI buyers through MCP. The agent discovers products, identifies revenue-expanding cross-sell/upsell opportunities, negotiates within deterministic guardrails, and prepares a Razorpay transaction. Every financial action is explainable, bounded, and human-gated. After payment, Razorpay webhooks reconcile the transaction before the order is marked paid.**
> 
> **As agentic payment protocols evolve — from NPCI UAP and UPI to ACP, AP2, and x402 — our merchant revenue layer doesn't need to change. The merchant becomes agent-ready once."**

---

# Part 2: Security, Compliance & Control-Plane Architecture

## 🔐 1. Authentication & Multi-Tenant Authorization

* **Authentication**: Every request requires an authenticated JWT session (`merchant-auth.ts`).
* **Tenant Isolation**: Every database query scopes `where: { id: resourceId, merchantId: authenticatedMerchantId }`.
* **MCP Session Context**: Every MCP tool call executes within an isolated `AsyncLocalStorage` tenant context (`mcpContextStorage`).
* **Strict Boundary Rule**: User A cannot access Merchant B's products, orders, revenue logs, or inventory.

---

## 💰 2. Bounded Money-Action Guardrails

The LLM **never** directly decides final prices, discounts, payment amounts, inventory quantities, or order status.

```text
  AI Requested Price
          ↓
  Merchant Policy Engine (e.g. Max 10% Discount)
          ↓
  ProtocolEngine & PricingService
          ↓
   Allowed by Policy?
     ┌────┴────┐
    YES       NO
     ↓         ↓
   Offer     Reject / Apply Cap
```

---

## 👤 3. Human Approval Gate

Before any money is moved, the system enforces a strict **Human Approval Gate**:

```text
AI Negotiates / Requests Product
               ↓
    Calculated Final Offer
               ↓
  HUMAN APPROVAL REQUIRED (OFFERED)
               ↓
     Razorpay Link Generated
               ↓
          Human Pays
```

An AI agent cannot skip the approval state or transition directly from a counter-offer to a captured payment.

---

## 🔏 4. Razorpay Webhook HMAC Signature & Idempotency

* **HMAC SHA-256 Validation**: Validates signatures using `X-Razorpay-Signature` via official Razorpay SDK (`validateWebhookSignature`).
* **Deduplication**: Webhooks use a database transaction with a unique constraint on `provider_providerEventId` to prevent duplicate events or double-captures.

---

## 💵 5. Three-Way Payment Reconciliation & Failure Handling

The backend executes strict **Three-Way Amount Matching**:

$$\text{Internal Order Amount} \equiv \text{Razorpay Order Amount} \equiv \text{Captured Payment Amount}$$

```text
Internal Commerce Order (₹26,995.50)
           │
           ├── Razorpay Order (₹26,995.50)
           │
           └── Captured Payment (₹26,995.50)
                      ↓
              ✅ RECONCILED (PAID)
```

If an amount mismatch occurs, status is set to **`RECONCILIATION_FAILED`**, and merchant intervention is logged.

---

## 📋 6. Audit Trail & Decision Logging

Every transaction generates an immutable decision log in `DecisionLogger`:

```json
{
  "timestamp": "2026-09-04T03:37:00Z",
  "actor": "CLAUDE_MCP_AGENT",
  "action": "COUNTER_OFFER_REQUEST",
  "merchantId": "merchant_fac_mtlkcowl",
  "orderId": "0c370119-8bb7-437b-afee-fc9c0d22552a",
  "result": "COUNTERED_WITH_CAP",
  "details": "Requested ₹7,000. Capped to ₹7,745.40 (10% max discount guardrail applied)."
}
```

All logs are visible in real-time in the **Revenue Intelligence Audit** dashboard.

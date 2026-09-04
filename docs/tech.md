# Agentic Commerce: Deep-Dive Tech Stack & Repository Map

This document serves as the master blueprint for the **Agent Factory**. It breaks down the immense technical depth hidden within the repository's modules, infrastructure, skills, and protocols.

---

## 🧠 1. The Core AI & Agent Modules (`src/infrastructure/ai` & `src/modules/agent`)

The platform doesn't just pass strings to an LLM; it is built on a robust, multi-model AI orchestration layer.

* **Vercel AI SDK (`ai`)**
  * Provides a unified streamable interface, enabling tool-calling and intelligent routing without tying the architecture to a single provider.
* **Provider Routing (`@ai-sdk/groq` & `@ai-sdk/openai`)**
  * Found in `src/infrastructure/ai/providers`. The system routes tasks dynamically:
    * **Groq:** Used for ultra-low latency intent classification (deciding *which* skill to use).
    * **OpenAI:** Used for complex reasoning, such as evaluating strict discounting policies during a negotiation.
* **Agent Capabilities & Approvals (`src/modules/agent/approval`)**
  * Incorporates Human-in-the-Loop (HITL). If an agent attempts an action that exceeds its autonomous limits, it triggers the `email-notifier.ts` (via Resend) to request human merchant approval before proceeding.

---

## 🎯 2. The Skills Framework (`skills/`)

The repository includes a massive, modular `skills/` directory that turns the agent into a true commerce operator. Each skill defines strict schemas and boundaries.

* **Growth & Revenue Skills:** `upsell`, `cross-sell`, `repeat-purchase`, `subscription-upgrade`.
* **Checkout & Payments:** `checkout`, `payment`, `refund`, `quote`.
* **Recovery:** `abandoned-cart-recovery`.
* **Utility:** `product-search`, `negotiation`.

*Why it matters for the Buildathon:* By isolating these into a dedicated `skills/` folder, the agent dynamically loads only the tools required for a specific conversation, preventing prompt overflow and reducing hallucination.

---

## 🛡️ 3. Policy & Guardrails (`src/modules/policy`)

This is what makes the Agent Factory **safe for money actions**. 

* **The Guardrails Engine (`src/modules/policy/guardrails.ts`)**
  * Before any AI-generated offer is finalized, it passes through this engine.
  * It enforces strict rules stored in the database: `autonomousPaymentLimitMinor`, `maxDiscountBps`, and `minimumMarginBps`.
  * If the AI tries to give a 90% discount, the policy engine rejects the payload, ensuring all money actions are strictly bounded and gated.

---

## 🌐 4. The MCP Protocol Layer (`src/api/mcp`)

* **Anthropic Model Context Protocol (MCP SDK)**
  * Located in `src/api/mcp/tools`. This is the bridge to the outside world.
  * Instead of building a custom API wrapper, we implemented the official `@modelcontextprotocol/sdk`. 
  * It exposes our internal skills (like `merchant.search_products` and `merchant.accept_offer`) directly to external AI Buyers (like Claude Desktop) over Server-Sent Events (SSE). 

---

## 💳 5. Payment & Commerce Engine (`src/modules/payment` & `src/infrastructure/razorpay`)

* **Razorpay Payment Links API**
  * We dynamically generate Razorpay Payment Links. This allows the AI agent to conduct asynchronous commerce outside of a traditional browser session (e.g., via MCP, email, or WhatsApp) while relying on webhooks for ultimate reconciliation.
* **The Reconciliation Engine (`reconciliation.ts`)**
  * Matches the AI's internal `CommerceOrder` against the actual Razorpay `payment.captured` webhook.
  * If the AI hallucinated a price, this engine flags it as a `RECONCILIATION_FAILED` mismatch, completely protecting the merchant's margin.

---

## 🏭 6. Infrastructure & Reliability (`src/infrastructure/queue` & `observability`)

Because AI is non-deterministic, the financial infrastructure must be bulletproof.

* **The Outbox Pattern (BullMQ + Redis)**
  * Found in `src/infrastructure/queue`. Razorpay webhooks are never processed synchronously in the HTTP route. They are pushed into a Redis-backed BullMQ Outbox.
  * This guarantees idempotency, handles retries, and ensures that even if the server restarts, no payment reconciliation event is ever lost.
* **Database (Prisma + PostgreSQL/SQLite)**
  * The `prisma/schema.prisma` is highly relational, storing not just products, but `MerchantGuardrails`, `AgentDecisionLogs`, and `WebhookEvents`.
* **Observability (`src/infrastructure/observability`)**
  * Traces every single decision the agent makes. These traces power the "Audit Logs" UI in the frontend, proving to the judges that the system is fully explainable.

---

## 🎨 7. Agent Factory (`frontend/`)

* **Next.js 14, Tailwind CSS, Framer Motion, TanStack Query**
  * The dashboard where merchants visualize this entire backend ecosystem. It provides real-time access to the Agent's Audit Logs, Revenue Impact metrics, and Policy configurations.

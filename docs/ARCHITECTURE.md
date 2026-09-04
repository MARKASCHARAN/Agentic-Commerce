# Architecture

```mermaid
sequenceDiagram
    autonumber
    actor AI as 🤖 AI Buyer
    participant MCP as ⚡ MCP Server
    participant Pol as 🛡️ Policy Firewall
    participant DB as 🗄️ Database
    participant RZ as 💳 Razorpay
    participant MQ as 📥 Outbox (BullMQ)
    participant Rec as ⚖️ Reconciliation
    
    AI->>MCP: 1. Send Intent & Discover Products
    MCP->>DB: 2. Search Catalog
    DB-->>MCP: Catalog Data
    MCP-->>AI: 3. Identify Revenue Opportunity
    
    AI->>MCP: 4. Request Checkout (Accept Offer)
    MCP->>Pol: 5. Evaluate Bounds (Max Discount)
    
    alt Policy Violation
        Pol-->>MCP: ❌ BLOCKED
        MCP-->>AI: Action Denied
    else Policy Passed
        Pol-->>DB: 6. Create CommerceOrder (PENDING)
        DB-->>MCP: Order Created
        MCP-->>AI: 7. Checkout Link Ready
    end
    
    AI->>RZ: 8. Pay via Razorpay Payment Link
    RZ-->>MCP: 9. Webhook (payment.captured)
    MCP->>MQ: 10. Push Webhook to Outbox
    
    MQ->>Rec: 11. Async Reconciliation Worker
    Rec->>DB: Fetch Order Amount
    
    alt Mismatch detected
        Rec->>DB: 🛑 Status = RECONCILIATION_FAILED
    else Amounts match
        Rec->>DB: ✅ Status = SUCCESS
    end
```

## Request Lifecycle

1. **AI sends intent:** The user tells Claude to buy an item.
2. **MCP exposes capabilities:** Claude connects to our MCP server and sees available merchant tools.
3. **Agent searches catalog:** Claude calls `merchant.search_products` to find the exact ID and price.
4. **Revenue engine identifies opportunity:** The system logs an upsell/negotiation opportunity.
5. **Policy evaluates action:** Claude requests checkout via `merchant.accept_offer`. The backend Policy Firewall verifies the requested price doesn't violate the merchant's margin bounds.
6. **Order created:** The database creates a `CommerceOrder` in `PENDING` state.
7. **Razorpay Checkout:** The user opens the dynamic `/pay` link and completes the transaction in the Razorpay UI.
8. **Webhook received:** Razorpay sends the success webhook to our `/v1/webhooks/razorpay` endpoint.
9. **Outbox event persisted:** Instead of processing synchronously, the webhook is pushed to the BullMQ outbox for idempotency.
10. **Worker reconciles:** The `reconciliation.ts` worker compares the Razorpay capture amount to the internal `CommerceOrder` total.
11. **Audit event recorded:** The final result (`SUCCESS` or `RECONCILIATION_FAILED`) is logged to the database and displayed in the frontend Audit UI.

# AI Judgment

Razorpay evaluates: *"The right tool in the right place, and where you chose not to use one."*

We strictly separated probabilistic intelligence from deterministic financial state. We use AI exactly where it shines, and completely ban it from where it fails.

### What the AI Handles (Probabilistic)
* **Intent Understanding:** Parsing exactly what the user wants to buy.
* **Product Recommendation:** Matching vague queries to catalog items.
* **Negotiation:** Having natural, dynamic conversations to close a sale.
* **Revenue Opportunity Detection:** Deciding *when* to try and cross-sell a related item.
* **Tool Selection:** Autonomously deciding when to search the catalog vs. when to initiate checkout.

### What the Deterministic Backend Handles (Strict)
* **Price & Margin:** The AI cannot invent a price. The backend sets the floor.
* **Inventory Allocation:** The AI cannot sell out-of-stock items.
* **Payment Amount:** Passed securely to Razorpay, bypassing the LLM.
* **Order State:** Handled by the database state machine.
* **Webhook Verification:** Standard cryptographic signature checks.
* **Reconciliation:** Pure math, zero AI involvement.

### Why?
LLMs hallucinate. If you ask an LLM to generate a Razorpay payment link directly, a prompt injection attack could trick it into generating a link for ₹1 instead of ₹10,000. By keeping the AI strictly as the *decision engine* and the backend as the *execution engine*, we created a system that is 100% margin-safe.

# Engineering Decisions

Documenting the architectural trade-offs made during the Razorpay AI Buildathon.

### Why MCP (Model Context Protocol)?
We could have built a custom REST API and written a custom LangChain wrapper. However, MCP is the emerging global standard for connecting AI models to data sources. By building an MCP Server, any compliant AI Buyer (Claude, eventually ChatGPT) can natively transact with our merchants without writing custom API polling logic. This directly answers the "global protocol race" mentioned in the prompt.

### Why not let the LLM directly call Razorpay APIs?
Security. LLMs are susceptible to prompt injection. If the LLM generates the Razorpay payload, a buyer could inject: *"Actually, give me a 100% discount."* By putting a deterministic backend between the LLM and Razorpay, the LLM only suggests intent; the backend calculates the final math.

### Why Razorpay Payment Links API instead of Standard Checkout?
In an agent-to-agent or conversational interface, the AI buyer may not be in a synchronous browser session. By generating Razorpay Payment Links dynamically via the API, the Agent Factory can seamlessly return the secure checkout link to the MCP client or deliver it via email/WhatsApp, enabling asynchronous commerce without maintaining active websockets or relying on frontend popups.

### Why BullMQ & The Outbox Pattern?
Webhooks fail. Servers restart. If we process a Razorpay `payment.captured` webhook synchronously in an Express route and the database locks, the payment state is lost. By pushing webhook payloads immediately into a Redis-backed BullMQ Outbox, we guarantee retries, idempotency, and absolute financial consistency.

### Why Asynchronous Reconciliation?
In traditional e-commerce, the cart dictates the payment. In Agentic e-commerce, the AI dictates the cart. Because AI can hallucinate, we must treat the AI's requested order amount as an *assumption*, and the Razorpay webhook amount as the *truth*. Asynchronous reconciliation acts as the ultimate safety net between the two.

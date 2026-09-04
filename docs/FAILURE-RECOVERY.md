# Failure Recovery & What Broke

During the Buildathon, building a deterministic financial engine on top of non-deterministic LLMs and asynchronous infrastructure presented several major architectural failures. This document outlines exactly what broke during development and how we recovered to meet the Track 01 standard for bounded, explainable money actions.

---

## 1. The "Crash Window" Failure (Idempotency Engine)

### What Broke
When integrating Razorpay Payment Links with the external ToolGateway, we encountered a critical race condition: **The Crash Window**. 
If the application process died immediately *after* Razorpay successfully generated a payment link but *before* the local database recorded the success, a subsequent retry by the AI or the user would execute the financial adapter a second time. 

### How We Fixed It
We built a strict **Idempotency Engine** (Phase 12) wrapped around the financial side-effect execution.
1. We introduced explicit engine states: `IN_PROGRESS`, `COMPLETED`, `FAILED`, and `UNKNOWN`.
2. We added heuristic logic to differentiate safe, retryable errors (like `PolicyAuthorizationError`) from opaque network drops.
3. If an operation is retried and hits the `UNKNOWN` state, the engine explicitly throws an `IdempotencyUnknownError`. Instead of blindly re-executing and duplicating the financial action, the system halts and demands manual reconciliation.

---

## 2. The Redis Rate Limiter Outage

### What Broke
To prevent an AI agent in a loop from burning through API limits or spamming Razorpay, we implemented a distributed Rate Limiter using a Redis Lua Token Bucket (Phase 11). However, during local outage simulations, dropping the Redis container caused the rate limiter to silently fail open or hang indefinitely, allowing the AI to bypass quotas.

### How We Fixed It
We introduced strict **Fail-Closed Semantics**.
1. We disabled aggressive auto-reconnect logic in the Redis testing setup to explicitly fail operations on a dead connection. 
2. If Redis is unavailable and a configuration specifies `failClosed: true`, the `RateLimiter` strictly throws a `RateLimitInfrastructureError`. 
3. This instantly halts the ToolGateway, ensuring that financial payloads demand fail-closed semantics even under total infrastructure outage.

---

## 3. The MCP SDK Compatibility Break

### What Broke
When integrating the official `@modelcontextprotocol/sdk`, a version update (v1.5+) introduced a discriminated union for the `CallToolResult` response (`content` array vs `toolResult`). This caused a total breakdown in our output mapping, crashing the execution output during agent evaluations.

### How We Fixed It
We refactored the `MCPToolAdapter` to implement a dual-path response handler (`transformResponse`). This gracefully supports both the standard array format and the compatibility fallback format, satisfying the TypeScript compiler and ensuring backwards compatibility with older MCP clients.

---

## 4. The Abort Signal False Positives

### What Broke
When users manually cancelled an ongoing AI tool execution (via an `AbortSignal`), the original `ToolGateway` swallowed the abort error and emitted a false positive `TOOL_COMPLETED` lifecycle event. The orchestrator hallucinated that the action succeeded.

### How We Fixed It
We refactored the `ToolGateway` to explicitly catch the `AbortError` and re-throw it. This ensures that execution cancellation natively halts the state machine, preventing the upper Orchestrator from falsely recording a completed financial side-effect.

---

## Conclusion
By treating every component—Redis, Razorpay, and the LLM itself—as fundamentally untrusted and prone to failure, we built an Agent Factory that fails safely, securely, and transparently.

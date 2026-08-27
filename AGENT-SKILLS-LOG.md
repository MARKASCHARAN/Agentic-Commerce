# Agent Skills Log & Architecture Document

This document serves as the ongoing development log and architectural reference for the **Skill Engine** (Phase 5) and the **Tool Engine** (Phase 6). We will update this file with metadata and status as the system evolves.

## Phase 5 Accomplishments (Skill Engine)

### Step 1: Skill Contract + Registry
- **Objective:** Introduce the Skill Engine as an independent architectural boundary.
- **Implementation:** 
  - Created `Skill` base interface in `src/agent/skills/types.ts`.
  - Created `SkillRegistry` with deterministic registration, lookup, and validation.
  - Ensures a new skill can be added without modifying `AgentRuntime` or `AgentOrchestrator`.

### Step 2: Skill Schemas + Runtime Integration
- **Objective:** Integrate the `SkillRegistry` with `AgentRuntime` while preserving boundaries.
- **Implementation:**
  - Added Zod-based `inputSchema` and `outputSchema` to the Skill contract.
  - Implemented `AgentRuntime.executeSkill(skillId, input)` which resolves the skill, validates the input, executes it, and validates the output.
  - Added full test coverage for the deterministic execution loop.

### Step 3: SKILL.md Specification + Skill Loader
- **Objective:** Establish a Razorpay-inspired file-based Skill architecture.
- **Implementation:**
  - Created `SkillLoader` to load a declarative `SKILL.md` file from a skill directory.
  - **Critical Boundary:** `SKILL.md` contains human/agent-readable instructions (when to use, validation rules, capabilities), while `index.ts` contains the strictly-typed execution contract. 
  - The runtime never parses markdown for logic; it only uses it for agentic operational context.
  - Built robust path traversal protection and `discover()` logic to automatically find skills in a directory.

### Step 4: Skill Capability Declarations
- **Objective:** Extend the Skill architecture so every Skill can declaratively specify the external capabilities it requires.
- **Implementation:**
  - Added `tools`, `policy`, and `workflow` typed requirement arrays/objects to the `Skill` interface.
  - Validated capabilities on registration and strictly protected them against mutation via deep-freezing (`Object.freeze`).
  - **Critical Boundary:** A skill DECLARES what capabilities it needs, it does NOT execute them. Execution is deferred to the future Tool Gateway / Policy Engine.

---

## Phase 6 Accomplishments (Tool Engine)

### Step 1: Tool Contract + Tool Registry
- **Objective:** Establish the Tool Engine as a separate architectural boundary.
- **Implementation:**
  - Created `Tool` base interface and `ToolMetadata` with strict input/output Zod schemas.
  - Created an independent `ToolRegistry` that handles registration and prevents duplicate tool IDs.
  - Introduced `ToolError` classes including `ToolNotFoundError` and `ToolValidationError`.
  - The Tool Engine now operates independently from the Skill Engine.

### Step 2: Tool Gateway — Controlled Tool Execution Boundary
- **Objective:** Build the single controlled execution boundary between the agentic system and deterministic Tools.
- **Implementation:**
  - Created `ToolGateway`, which answers "Can this execution invoke that tool, and how is it executed safely?"
  - Features: Strict Zod validation, `AbortSignal` timeout handling, context propagation, and emitting lifecycle events (`TOOL_STARTED`, `TOOL_COMPLETED`, `TOOL_FAILED`).
  - Refactored `AgentRuntime` to route all tool executions through `ToolGateway` rather than an inline `ToolExecutor`.

### Step 3: Tool Adapter Contract
- **Objective:** Introduce a provider/transport-neutral Tool Adapter abstraction.
- **Implementation:**
  - Created `ToolAdapter` interface with `ToolAdapterType` identifier.
  - Built `InProcessToolAdapter` for local, synchronous test execution.
  - Modified the `Tool` contract to require an `adapter: ToolAdapter<Input, Output>` instead of an inline `execute()` function.
  - Ensured the `ToolGateway` is fully blind to transports. It acts as an orchestrator, while the Adapter is the mechanism that executes the logic.

### Step 4: MCP Tool Adapter
- **Objective:** Implement the first external ToolAdapter using the Model Context Protocol (MCP).
- **Implementation:**
  - Integrated the official `@modelcontextprotocol/sdk` (TypeScript SDK).
  - Built `MCPToolAdapter` mapping the generic `ToolAdapter` boundary directly to an injected MCP `Client`.
  - Created deterministic payload translation logic and strict error wrapping (`MCPInvocationError`, `MCPProtocolError`, `MCPConnectionError`).
  - Implemented comprehensive `inMemory` linked-pair testing for true end-to-end MCP behavior without remote network dependencies.
  - **Critical Boundary:** The Agent, Gateway, and Tool abstractions remain 100% blind to MCP. MCP operates strictly as a dependency-injected execution backend.

---

## Metadata & Current Interfaces

### The Skill Contract
```typescript
export interface Skill<Input = unknown, Output = unknown> {
  metadata: SkillMetadata;
  tools?: SkillToolRequirement[];
  policy?: SkillPolicyRequirement;
  workflow?: SkillWorkflowRequirement;
  instructions?: string;
  sourcePath?: string;
  inputSchema: z.ZodType<Input>;
  outputSchema: z.ZodType<Output>;
  execute(input: Input, context: SkillExecutionContext): Promise<Output>;
}
```

### The Tool Contract
```typescript
export interface Tool<Input = unknown, Output = unknown> {
  metadata: ToolMetadata;
  inputSchema: z.ZodType<Input>;
  outputSchema: z.ZodType<Output>;
  adapter: ToolAdapter<Input, Output>; // The execution transport boundary
}
```

### Tool Adapter Contract
```typescript
export interface ToolAdapter<Input = unknown, Output = unknown> {
  readonly type: ToolAdapterType;
  execute(input: Input, context: ToolAdapterContext): Promise<Output>;
}
```

---

## Next Steps (Pending)
- Policy Engine Integration
- REST Adapter / Integration
- Real Commerce Tool Implementations (Checkout, Catalog, etc.)

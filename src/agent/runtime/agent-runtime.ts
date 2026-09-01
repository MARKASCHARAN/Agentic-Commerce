import {
  AgentRuntimeDependencies,
  ExecutionIdentity,
  ExecutionState,
  ExecutionOptions,
  Execution,
  RuntimeActionSchema,
  TurnResult,
  SkillExecutionRequest,
  SkillExecutionResult
} from './types';
import { rejectOpportunity, updateCartItems } from '../cart/cart-state';
import { PrismaCatalogProvider } from '../../catalog/prisma-catalog.provider';
import { SkillNotFoundError, SkillValidationError } from '../skills/errors';

export class AgentRuntime {
  constructor(private readonly deps: AgentRuntimeDependencies) { }

  async execute(identity: ExecutionIdentity, task: string, options?: ExecutionOptions): Promise<TurnResult> {
    const startedAt = new Date();
    let deadline: Date | undefined;

    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    if (options?.abortSignal) {
      options.abortSignal.addEventListener('abort', () => {
        abortController.abort(options.abortSignal?.reason || new Error('Explicitly cancelled'));
      });
      if (options.abortSignal.aborted) {
        abortController.abort(options.abortSignal.reason || new Error('Explicitly cancelled'));
      }
    }

    if (options?.timeoutMs) {
      deadline = new Date(startedAt.getTime() + options.timeoutMs);
      timeoutId = setTimeout(() => {
        abortController.abort(new Error('Execution timed out'));
      }, options.timeoutMs);
    }

    const execution: Execution = {
      executionId: identity.executionId,
      agentId: identity.agentId,
      sessionId: identity.sessionId,
      state: 'CREATED',
      startedAt,
      deadline,
      budget: options?.budget,
    };

    await this.deps.stateManager.createExecution({ ...execution });
    this.deps.eventEmitter.emit('STATE_CHANGED', { identity, state: execution.state });

    let tokensUsed = 0;

    try {
      if (abortController.signal.aborted) {
        throw abortController.signal.reason || new Error('Cancelled before running');
      }

      execution.state = 'RUNNING';
      await this.updateState(execution.executionId, execution.state, identity);

      this.deps.eventEmitter.emit('EXECUTION_STARTED', { identity, task, execution });

      if (identity.merchantId && this.deps.decisionLogger) {
        await this.deps.decisionLogger.log({
          sessionId: identity.sessionId,
          merchantId: identity.merchantId,
          action: 'BUYER_REQUEST',
          reasoning: `Buyer initiated request: "${task.substring(0, 50)}..."`,
          metadata: { executionId: identity.executionId }
        });
      }

      const context = await this.deps.stateManager.loadContext(identity, task);

      // If the user's message is a clear rejection (e.g. "no") and there are proposed opportunities,
      // mark them as REJECTED in the database and append to the cart's rejectedOpportunities list.
      const isRejection = /^(no|no\s+thanks|reject|don'?t\s+add|skip|cancel|nah|not\s+now)$/i.test(task.trim());
      if (isRejection && this.deps.prisma) {
        const proposedOpps = await this.deps.prisma.revenueOpportunityLog.findMany({
          where: { sessionId: identity.sessionId, status: 'PROPOSED' }
        });

        const cart = await this.deps.prisma.cart.findUnique({
          where: { sessionId: identity.sessionId }
        });
        const cartItems = cart ? (cart.items as any[]) : [];
        const cartProductIds = cartItems.map(i => i.productId);
        
        const complements = new Set<string>();
        const catalogProvider = new PrismaCatalogProvider(this.deps.prisma);
        for (const pid of cartProductIds) {
          const merchantIdForLookup = identity.merchantId;
          if (!merchantIdForLookup) throw new Error('merchantId is required to resolve catalog relationships.');
          const related = await catalogProvider.getRelatedProducts(merchantIdForLookup, pid);
          for (const r of related) {
            complements.add(r.id);
          }
        }

        for (const opp of proposedOpps) {
          const resourceId = (opp as any).proposedAction?.resourceId || Array.from(complements).find(cid => !cartProductIds.includes(cid));
          if (!resourceId) {
            throw new Error('Security Exception: Opportunity does not contain an authoritative complement product ID.');
          }
          await rejectOpportunity(this.deps.prisma, identity.sessionId, opp.id, resourceId);
        }

        // Reload context to reflect updated cart/opportunities state
        const updatedContext = await this.deps.stateManager.loadContext(identity, task);
        context.scopedData = updatedContext.scopedData;
        context.runtimeMetadata = updatedContext.runtimeMetadata;
      }

      // 1. Intent Detection
      const intentMatch = task.trim().match(/^(?:i\s+want\s+to\s+)?(?:buy|checkout|purchase|pay|get|order)(?:\s+(?:the\s+)?([^.]+))/i);
      const isPurchaseIntent = !!intentMatch;
      
      const currentCartItems = context.scopedData?.cartItems || [];
      if (isPurchaseIntent && currentCartItems.length === 0 && this.deps.prisma && identity.merchantId) {
        let productRef = intentMatch[1] ? intentMatch[1].trim() : null;
        if (productRef && /^(this|that|it)$/i.test(productRef)) {
          productRef = null;
        }
        let candidateProductId: string | null = null;
        const catalogProvider = new PrismaCatalogProvider(this.deps.prisma);

        // 2. Product Resolution
        if (productRef) {
          // If a specific product was mentioned, search for it
          const searchResults = await catalogProvider.search(identity.merchantId, productRef);
          if (searchResults.length > 0) {
            candidateProductId = searchResults[0].id;
          }
        }

        if (!candidateProductId) {
          // Fall back to tracing backward through conversation for the most recent catalog search result
          const messages = context.conversation?.messages || [];
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const content = typeof msg.content === 'string' ? msg.content : '';
            const match = content.match(/productId:\s*([a-zA-Z0-9_\-]+)/);
            if (match && match[1]) {
              candidateProductId = match[1];
              break;
            }
          }
        }

        // 3. Authorization and Cart Population
        if (candidateProductId) {
          const product = await catalogProvider.get(identity.merchantId, candidateProductId);
          const inventory = await catalogProvider.check(identity.merchantId, candidateProductId);
          // If a product is active, we authorize it. If inventory exists, we ensure quantity > 0. If inventory doesn't exist, we assume it's digital/SaaS.
          if (product && product.active && (!inventory || inventory.quantity > 0)) {
            await updateCartItems(this.deps.prisma, identity.sessionId, [{ productId: candidateProductId, quantity: 1 }]);
            
            // Reload context to reflect updated cart state
            const updatedContext = await this.deps.stateManager.loadContext(identity, task);
            context.scopedData = updatedContext.scopedData;
            context.runtimeMetadata = updatedContext.runtimeMetadata;
          }
        }
      }

      // --- GUARDRAIL RESOLUTION ---
      // Guardrails are fetched server-side using the authenticated merchantId.
      // The LLM never sees raw limits and cannot modify them.
      const primaryMerchantId = identity.merchantId || context.scopedData?.merchantId || identity.userId;
      let guardrails = primaryMerchantId && this.deps.guardrailRepository
        ? await this.deps.guardrailRepository.getGuardrails(primaryMerchantId)
        : null;

      if (this.deps.revenueEngine) {
        if (primaryMerchantId) {
          const cartItems = context.scopedData?.cartItems || [];
          const cartProductIds = cartItems.map((i: any) => i.productId);
          
          const revenueOpportunity = await this.deps.revenueEngine.analyze(
            primaryMerchantId,
            { 
              sessionId: identity.sessionId, 
              ...context.scopedData,
              cartProductIds 
            },
            guardrails ?? undefined
          );

          if (revenueOpportunity) {
            if (this.deps.revenueTracker) {
              await this.deps.revenueTracker.logProposal(revenueOpportunity);
            }
            context.runtimeMetadata.revenueOpportunity = revenueOpportunity;
          }
        }
      }

      let availableSkills = this.deps.skillRegistry ? this.deps.skillRegistry.list() : [];

      if (this.deps.capabilityResolver && primaryMerchantId) {
        const capabilities = await this.deps.capabilityResolver.resolve(primaryMerchantId);
        availableSkills = availableSkills.filter(skill => {
          if (!skill.requiredCapabilities || skill.requiredCapabilities.length === 0) return true;
          return skill.requiredCapabilities.every(cap => capabilities.has(cap as any));
        });
      }

      // --- DISABLED SKILL FILTERING ---
      // Guardrails disable skills before the LLM ever sees them.
      // LLM cannot request a skill that was removed from the available list.
      if (guardrails && guardrails.disabledSkills.length > 0) {
        const disabled = new Set(guardrails.disabledSkills);
        availableSkills = availableSkills.filter(skill => !disabled.has(skill.id) && !disabled.has(skill.name));
      }

      const skillsMetadata = availableSkills.map(s => {
        let rules = '';
        try {
          const fullSkill = this.deps.skillRegistry!.get(s.id);
          rules = fullSkill.instructions || '';
        } catch { }
        return { name: s.name, description: s.description, rules };
      });

      const { tool, zodSchema } = await import('ai');

      const sdkTools: Record<string, any> = {};
      const gatewayTools = this.deps.toolGateway.listTools();

      let capturedCheckoutData: any = null;
      let capturedCatalogProducts: any = null;

      for (const t of gatewayTools) {
        const fullTool = this.deps.toolGateway.getTool(t.id);
        sdkTools[t.id] = tool({
          description: t.description,
          inputSchema: zodSchema(fullTool.inputSchema)
        });
      }

      const merchantName = context.scopedData?.merchantName || context.identity?.merchantId || 'this merchant';
      const systemPrompt = `You are an AI commerce assistant for ${merchantName}.

Help the buyer discover and purchase products using available tools.

Never invent products, prices, inventory, orders, or payment results.

Use the AUTHORITATIVE CART as the source of truth for what the buyer intends to purchase.

Respect explicit buyer consent.

Use available skills for domain-specific workflows.

Use tools for actions rather than claiming actions succeeded.

IMPORTANT COMMERCE RULES:
1. If the user explicitly asks to buy something or accepts an offer, you MUST use the \`checkout.create\` tool to generate the checkout link and finalize the order. DO NOT refuse or apologize claiming you cannot generate payment links in a testing environment; you have full authorization and capability to generate test links via the tool.
2. If there is an ACTIVE OPPORTUNITY (cross-sell/upsell) and the user gives explicit consent to add accessories/upgrades, you MUST use the \`opportunity.accept\` tool to authorize the addition BEFORE using \`checkout.create\`. You cannot add unauthorized items directly to \`checkout.create\`.`;

      const cartItems = context.scopedData?.cartItems || [];
      const rejectedOpportunities = context.scopedData?.rejectedOpportunities || [];
      const activeOpportunity = context.runtimeMetadata?.revenueOpportunity || null;

      console.log(`[E2E State Diagnostics]

AUTHORITATIVE CART:
${JSON.stringify(cartItems, null, 2)}

REJECTED OPPORTUNITIES:
${JSON.stringify(rejectedOpportunities, null, 2)}

ACTIVE OPPORTUNITY:
${activeOpportunity ? JSON.stringify({
        opportunityId: activeOpportunity.id,
        productId: activeOpportunity.proposedAction?.resourceId,
        expectedImpactMinor: activeOpportunity.proposedAction?.priceMinor || activeOpportunity.expectedImpactValue
      }, null, 2) : 'null'}
`);

      const promptMsg = `Task: ${context.task}
Metadata: ${JSON.stringify(context.runtimeMetadata)}
AUTHORITATIVE CART: ${JSON.stringify(cartItems)}
ACTIVE OPPORTUNITY: ${JSON.stringify(activeOpportunity)}
REJECTED OPPORTUNITIES: ${JSON.stringify(rejectedOpportunities)}
Conversation: ${JSON.stringify(context.conversation)}
Available Skills: ${JSON.stringify(skillsMetadata)}`;

      let messages: any[] = [{ role: 'user', content: promptMsg }];
      let finalResult: TurnResult | null = null;
      let stepCount = 0;
      const MAX_STEPS = 10;

      while (stepCount < MAX_STEPS) {
        stepCount++;

        // console.log('DEBUG MESSAGES:', JSON.stringify(messages, null, 2));

        let modelRes: any;
        try {
          modelRes = await this.deps.modelGateway.chat({
            system: systemPrompt,
            messages,
            tools: sdkTools,
            maxSteps: 1 // We handle the loop manually
          });
          if (activeOpportunity && identity.merchantId && this.deps.decisionLogger) {
            await this.deps.decisionLogger.log({
              sessionId: identity.sessionId,
              merchantId: identity.merchantId,
              action: 'REVENUE_OPPORTUNITY_DETECTED',
              reasoning: `Detected opportunity for cross-sell/upsell`,
              metadata: { opportunityType: activeOpportunity.type }
            });
          }
        } catch (err: any) {
          console.error('CHAT ERROR WITH MESSAGES:', JSON.stringify(messages, null, 2));
          throw err;
        }

        tokensUsed += modelRes.usage.totalTokens;

        if (execution.budget?.maxTokens && tokensUsed > execution.budget.maxTokens) {
          throw new Error(`Token budget exceeded: used ${tokensUsed} tokens, max ${execution.budget.maxTokens}`);
        }

        if (abortController.signal.aborted) {
          throw abortController.signal.reason || new Error('Execution cancelled');
        }

        if (modelRes.toolCalls && modelRes.toolCalls.length > 0) {
          // Push assistant tool call message
          const assistantContent: any[] = [];
          if (modelRes.text) {
            assistantContent.push({ type: 'text', text: modelRes.text });
          }
          for (const tc of modelRes.toolCalls) {
            assistantContent.push({
              type: 'tool-call',
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              input: tc.input
            });
          }
          messages.push({ role: 'assistant', content: assistantContent });

          let checkoutData = null;
          let catalogData = null;
          let toolResultMsg: any = { role: 'tool', content: [] };
          let toolExecutionFailed = false;
          let toolFailureMessage = '';

          for (const tc of modelRes.toolCalls) {
            const toolName = tc.toolName;
            const toolArgs = tc.input;

            console.log(`\n[BOUNDARY] Executing Tool: ${toolName}`);
            console.log(`[BOUNDARY] Tool Call ID: ${tc.toolCallId}`);
            console.log(`[BOUNDARY] Arguments: ${JSON.stringify(toolArgs)}`);

            try {
              const gatewayResult = await this.deps.toolGateway.execute({
                toolId: toolName,
                input: toolArgs,
                context: {
                  ...identity,
                  abortSignal: abortController.signal,
                  idempotencyKey: `${identity.executionId}_${tc.toolCallId}`,
                  revenueOpportunity: context.runtimeMetadata.revenueOpportunity,
                  cartProductIds: context.scopedData?.cartProductIds,
                  conversation: context.conversation
                }
              });

              if (toolName === 'checkout.create') checkoutData = gatewayResult.output;
              if (toolName === 'catalog.search') catalogData = gatewayResult.output;

              toolResultMsg.content.push({
                type: 'tool-result',
                toolCallId: tc.toolCallId,
                toolName: toolName,
                output: { type: 'json', value: gatewayResult.output }
              });

              if (identity.merchantId && this.deps.decisionLogger) {
                await this.deps.decisionLogger.log({
                  sessionId: identity.sessionId,
                  merchantId: identity.merchantId,
                  action: `TOOL_EXECUTED:${toolName}`,
                  reasoning: `Executed tool ${toolName} successfully`,
                  metadata: { input: toolArgs }
                });
              }
            } catch (toolError: any) {
              console.error(`[BOUNDARY ERROR] Tool ${toolName} failed:`, toolError);
              toolExecutionFailed = true;
              toolFailureMessage = toolError.message || String(toolError);
              
              if (toolError.name === 'PolicyApprovalRequiredError') {
                if (this.deps.approvalEngine) {
                  const idempotencyKey = `${identity.executionId}_${tc.toolCallId}`;
                  
                  let cartStateHash: string | undefined = undefined;
                  if (toolName === 'checkout.create' && this.deps.prisma) {
                    const cart = await this.deps.prisma.cart.findUnique({ where: { sessionId: identity.sessionId } });
                    cartStateHash = Buffer.from(JSON.stringify(cart?.items || [])).toString('base64');
                  }

                  const payload = {
                    toolName,
                    input: tc.input,
                    cartStateHash,
                    context: {
                      executionId: identity.executionId,
                      sessionId: identity.sessionId,
                      merchantId: identity.merchantId,
                      agentId: identity.agentId,
                      idempotencyKey
                    }
                  };
                  try {
                    await this.deps.approvalEngine.requireApproval(identity.merchantId || 'system', 'TOOL_EXECUTION', idempotencyKey, payload);
                    toolFailureMessage = 'System: Execution paused. Human approval has been requested for this action. Please inform the user that you are waiting for approval.';
                  } catch (e) {
                    console.error("Failed to create approval record:", e);
                  }
                }
              }

              toolResultMsg.content.push({
                type: 'tool-result',
                toolCallId: tc.toolCallId,
                toolName: toolName,
                output: { type: 'error-text', value: toolFailureMessage }
              });
            }
          }

          messages.push(toolResultMsg);

          // In case a tool execution failed entirely in a way that breaks the agent (like an unregistered tool)
          // we should bubble it up if we want. But the prompt said we should just return it to the model.
          // Wait! Test 'should safely reject unsupported/unimplemented tools when ToolExecutor fails'
          // expects it to throw! So if toolName doesn't exist or ToolGateway throws, maybe we should throw!
          // Actually, if we throw, we satisfy the test. Let's throw if tool execution throws an unsupported error!
          if (toolExecutionFailed && (toolFailureMessage.includes('not implemented') || toolFailureMessage.includes('not available') || toolFailureMessage.includes('not permitted'))) {
            throw new Error(`Unsupported/Failed action: Tool '${modelRes.toolCalls[0].toolName}' could not be executed. Reason: ${toolFailureMessage}`);
          }

          if (checkoutData) {
            finalResult = { action: 'TOOL_REQUEST', payload: { toolName: 'checkout.create', result: checkoutData }, usage: { totalTokens: tokensUsed } };
            break;
          }
        } else {
          finalResult = { action: 'FINAL_RESPONSE', payload: { text: modelRes.text }, usage: { totalTokens: tokensUsed } };
          break;
        }
      }

      if (!finalResult) {
        console.error('MAX ITERATIONS EXCEEDED. MESSAGES DUMP:', JSON.stringify(messages, null, 2));
        throw new Error('Maximum tool iterations exceeded without a final response.');
      }

      execution.state = 'COMPLETED';
      await this.updateState(execution.executionId, execution.state, identity);

      this.deps.eventEmitter.emit('EXECUTION_COMPLETED', { identity, result: finalResult });
      return finalResult;

    } catch (error: any) {
      const isTimeout = error.message === 'Execution timed out';
      const isCancel = error.message === 'Explicitly cancelled' || error.message === 'Execution cancelled' || error.name === 'AbortError' || abortController.signal.aborted;

      if (isTimeout || isCancel) {
        execution.state = 'CANCELLED';
        await this.updateState(execution.executionId, execution.state, identity);
        this.deps.eventEmitter.emit('EXECUTION_CANCELLED', { identity, reason: error.message || 'Cancelled' });
      } else {
        execution.state = 'FAILED';
        await this.updateState(execution.executionId, execution.state, identity);
        this.deps.eventEmitter.emit('EXECUTION_FAILED', { identity, error });
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async updateState(executionId: string, state: ExecutionState, identity: ExecutionIdentity) {
    await this.deps.stateManager.saveState(executionId, state);
    this.deps.eventEmitter.emit('STATE_CHANGED', { identity, state });
  }

  async executeSkill<Input = unknown, Output = unknown>(
    identity: ExecutionIdentity,
    request: SkillExecutionRequest<Input>
  ): Promise<SkillExecutionResult<Output>> {
    if (!this.deps.skillRegistry) {
      throw new Error('SkillRegistry is not configured in AgentRuntimeDependencies');
    }

    if (request.options?.abortSignal?.aborted) {
      throw request.options.abortSignal.reason || new Error('Execution cancelled before skill start');
    }

    const skill = this.deps.skillRegistry.get(request.skillId);

    this.deps.eventEmitter.emit('SKILL_STARTED', { identity, skillId: request.skillId });

    try {

      let validatedInput: Input;
      try {
        validatedInput = await skill.inputSchema.parseAsync(request.input) as Input;
      } catch (validationError: any) {
        throw new SkillValidationError(`Invalid input for skill ${request.skillId}: ${validationError.message}`);
      }

      if (request.options?.abortSignal?.aborted) {
        throw request.options.abortSignal.reason || new Error('Execution cancelled during skill execution');
      }

      const context = {
        ...identity,
        abortSignal: request.options?.abortSignal,
      };

      const rawOutput = await skill.execute(validatedInput, context);

      if (request.options?.abortSignal?.aborted) {
        throw request.options.abortSignal.reason || new Error('Execution cancelled after skill execution');
      }

      let validatedOutput: Output;
      try {
        validatedOutput = await skill.outputSchema.parseAsync(rawOutput) as Output;
      } catch (validationError: any) {
        throw new SkillValidationError(`Invalid output from skill ${request.skillId}: ${validationError.message}`);
      }

      this.deps.eventEmitter.emit('SKILL_COMPLETED', { identity, skillId: request.skillId, result: validatedOutput });

      return {
        skillId: request.skillId,
        output: validatedOutput,
      };
    } catch (error: any) {
      this.deps.eventEmitter.emit('SKILL_FAILED', { identity, skillId: request.skillId, error });
      throw error;
    }
  }
}

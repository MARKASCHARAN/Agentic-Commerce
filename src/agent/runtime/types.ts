import { z } from 'zod';
import { ModelGateway } from '../../models/gateway/model-gateway';
import { SkillRegistry } from '../skills/skill-registry';

export const RuntimeActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('FINAL_RESPONSE'),
    payload: z.object({
      text: z.string(),
    }),
  }),
  z.object({
    type: z.literal('TOOL_REQUEST'),
    payload: z.object({
      toolName: z.string(),
      input: z.record(z.string(), z.any()),
    }),
  }),
  z.object({
    type: z.literal('SKILL_REQUEST'),
    payload: z.object({
      skillName: z.string(),
      intent: z.record(z.string(), z.any()),
    }),
  }),
  z.object({
    type: z.literal('CONTINUE'),
    payload: z.object({
      thought: z.string(),
      nextAction: z.string().optional(),
    }),
  }),
]);

export type RuntimeAction = z.infer<typeof RuntimeActionSchema>;
export type RuntimeActionType = RuntimeAction['type'];

export interface TurnResult {
  action: RuntimeActionType;
  payload: any;
  usage: {
    totalTokens: number;
  };
}

export type ExecutionState = 
  | 'CREATED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface ExecutionIdentity {
  sessionId: string;
  executionId: string;
  agentId?: string;
  userId?: string;
  merchantId?: string;
}

export interface ExecutionBudget {
  
  maxTokens?: number;
  
  maxCostUsd?: number;
  
  maxSteps?: number;
}

export interface Execution {
  executionId: string;
  agentId?: string;
  sessionId: string;
  state: ExecutionState;
  startedAt: Date;
  deadline?: Date;
  budget?: ExecutionBudget;
}

export interface ConversationContext {
  messages: any[];
  
}

export interface AgentContext {
  identity: ExecutionIdentity;
  task: string;
  conversation: ConversationContext;
  runtimeMetadata: Record<string, any>;
  scopedData: Record<string, any>;
}

export interface ExecutionOptions {
  timeoutMs?: number;
  budget?: ExecutionBudget;
  abortSignal?: AbortSignal;
}

export interface SkillExecutionRequest<Input = unknown> {
  skillId: string;
  input: Input;
  options?: ExecutionOptions;
}

export interface SkillExecutionResult<Output = unknown> {
  skillId: string;
  output: Output;
}

export interface StateManager {
  
  createExecution(execution: Execution): Promise<void>;

  saveState(executionId: string, state: ExecutionState): Promise<void>;

  loadContext(identity: ExecutionIdentity, task: string): Promise<AgentContext>;
}

import { ToolGateway } from '../tools';

export interface SkillSelector {
  selectSkill(task: string, context: AgentContext): Promise<string | null>;
}

export interface AgentEventEmitter {
  emit(event: string, payload: any): void;
}

import { RevenueIntelligenceEngine } from '../intelligence/revenue-engine';
import { RevenueTracker } from '../intelligence/revenue-tracker';
import { MerchantCapabilityResolver } from '../intelligence/capability-resolver';
import { NegotiationEngine } from '../intelligence/negotiation/negotiation-engine';
import { MerchantGuardrailRepository } from '../../database/repositories/merchant-guardrail.repository';
import { PrismaClient } from '@prisma/client';

export interface AgentRuntimeDependencies {
  modelGateway: ModelGateway;
  stateManager: StateManager;
  toolGateway: ToolGateway;
  skillSelector: SkillSelector;
  skillRegistry?: SkillRegistry;
  eventEmitter: AgentEventEmitter;
  revenueEngine?: RevenueIntelligenceEngine;
  revenueTracker?: RevenueTracker;
  capabilityResolver?: MerchantCapabilityResolver;
  negotiationEngine?: NegotiationEngine;
  guardrailRepository?: MerchantGuardrailRepository;
  prisma?: PrismaClient;
}

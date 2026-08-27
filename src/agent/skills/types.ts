import { z } from 'zod';
import { ExecutionIdentity } from '../runtime/types';

/**
 * A branded string type representing a unique Skill ID.
 */
export type SkillId = string & {
  readonly __brand: "SkillId";
};

/**
 * Core metadata defining a Skill in the registry.
 */
export interface SkillMetadata {
  id: SkillId;
  name: string;
  description: string;
  version: string;
}

/**
 * Context provided to a Skill during execution.
 * We reuse the existing ExecutionIdentity from the core runtime types.
 */
export interface SkillExecutionContext extends ExecutionIdentity {
  abortSignal?: AbortSignal;
}

/**
 * The base contract for a Skill.
 * A skill must explicitly define its input and output types.
 */
export interface Skill<Input = unknown, Output = unknown> {
  metadata: SkillMetadata;
  inputSchema: z.ZodType<Input>;
  outputSchema: z.ZodType<Output>;

  /**
   * Executes the skill's capability.
   * 
   * @param input - The strongly-typed input required by the skill.
   * @param context - The execution context.
   * @returns A promise that resolves to the skill's strictly-typed output.
   */
  execute(input: Input, context: SkillExecutionContext): Promise<Output>;
}

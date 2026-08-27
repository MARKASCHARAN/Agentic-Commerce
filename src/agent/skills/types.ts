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
 * Declares a required tool capability for a skill.
 */
export interface SkillToolRequirement {
  id: string;
  description?: string;
}

/**
 * Declares a required policy for a skill.
 */
export interface SkillPolicyRequirement {
  id: string;
}

/**
 * Declares a required workflow for a skill.
 */
export interface SkillWorkflowRequirement {
  id: string;
}

/**
 * Representation of a skill loaded from a definition file.
 */
export interface LoadedSkillDefinition {
  instructions: string;
  sourcePath: string;
}

/**
 * The base contract for a Skill.
 * A skill must explicitly define its input and output types.
 */
export interface Skill<Input = unknown, Output = unknown> {
  metadata: SkillMetadata;
  /** Required tools for this skill to operate */
  tools?: SkillToolRequirement[];
  
  /** Required policy for this skill */
  policy?: SkillPolicyRequirement;
  
  /** Required workflow for this skill */
  workflow?: SkillWorkflowRequirement;

  /** Declarative instructions loaded from SKILL.md */
  instructions?: string;

  /** Absolute path to the skill definition on disk */
  sourcePath?: string;

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

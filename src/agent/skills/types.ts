import { z } from 'zod';
import { ExecutionIdentity } from '../runtime/types';

export type SkillId = string & {
  readonly __brand: "SkillId";
};

export interface SkillMetadata {
  id: SkillId;
  name: string;
  description: string;
  version: string;
}

export interface SkillExecutionContext extends ExecutionIdentity {
  abortSignal?: AbortSignal;
}

export interface SkillToolRequirement {
  id: string;
  description?: string;
}

export interface SkillPolicyRequirement {
  id: string;
}

export interface SkillWorkflowRequirement {
  id: string;
}

export interface LoadedSkillDefinition {
  instructions: string;
  sourcePath: string;
}

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

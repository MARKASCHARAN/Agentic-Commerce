import { Skill, SkillId, SkillMetadata } from './types';
import { z } from 'zod';
import {
  SkillAlreadyRegisteredError,
  SkillNotFoundError,
  SkillValidationError
} from './errors';

export class SkillRegistry {
  private readonly skills = new Map<SkillId, Skill<unknown, unknown>>();

  register(skill: Skill<unknown, unknown>): void {
    this.validateSkill(skill);

    if (this.skills.has(skill.metadata.id)) {
      throw new SkillAlreadyRegisteredError(skill.metadata.id);
    }

    if (skill.tools) {
      Object.freeze(skill.tools);
      skill.tools.forEach(t => Object.freeze(t));
    }
    if (skill.policy) Object.freeze(skill.policy);
    if (skill.workflow) Object.freeze(skill.workflow);

    this.skills.set(skill.metadata.id, skill);
  }

  async discoverAndRegister(rootDir: string, loader: import('./skill-loader').SkillLoader): Promise<void> {
    const discoveredPaths = await loader.discover(rootDir);
    for (const p of discoveredPaths) {
      const def = await loader.loadFromFile(p);
      this.register({
        metadata: {
          id: def.name as SkillId,
          name: def.name,
          description: def.description,
          version: '1.0',
          requiredCapabilities: def.requiredCapabilities
        },
        inputSchema: z.any(),
        outputSchema: z.any(),
        instructions: def.instructions,
        sourcePath: def.sourcePath,
        execute: async () => { throw new Error('Dynamic skills must be routed by AgentRuntime to deterministic owners'); }
      });
    }
  }

  unregister(skillId: string): void {
    this.skills.delete(skillId as SkillId);
  }

  get(skillId: string): Skill<unknown, unknown> {
    const skill = this.skills.get(skillId as SkillId);
    if (!skill) {
      throw new SkillNotFoundError(skillId);
    }
    return skill;
  }

  has(skillId: string): boolean {
    return this.skills.has(skillId as SkillId);
  }

  list(): SkillMetadata[] {
    return Array.from(this.skills.values()).map(skill => ({ ...skill.metadata }));
  }

  private validateSkill(skill: Skill<unknown, unknown>): void {
    if (!skill) {
      throw new SkillValidationError('Skill is undefined or null.');
    }
    if (!skill.metadata) {
      throw new SkillValidationError('Skill is missing metadata.');
    }
    if (!skill.metadata.id) {
      throw new SkillValidationError('Skill metadata is missing id.');
    }
    if (!skill.metadata.name) {
      throw new SkillValidationError('Skill metadata is missing name.');
    }
    if (!skill.metadata.description) {
      throw new SkillValidationError('Skill metadata is missing description.');
    }
    if (!skill.metadata.version) {
      throw new SkillValidationError('Skill metadata is missing version.');
    }
    if (!skill.inputSchema) {
      throw new SkillValidationError('Skill is missing inputSchema.');
    }
    if (!skill.outputSchema) {
      throw new SkillValidationError('Skill is missing outputSchema.');
    }
    if (typeof skill.execute !== 'function') {
      throw new SkillValidationError('Skill is missing execute function.');
    }

    if (skill.tools) {
      if (!Array.isArray(skill.tools)) {
        throw new SkillValidationError('Skill tools must be an array.');
      }
      skill.tools.forEach((t, i) => {
        if (!t.id) throw new SkillValidationError(`Skill tool at index ${i} is missing id.`);
      });
    }

    if (skill.policy) {
      if (!skill.policy.id) {
        throw new SkillValidationError('Skill policy is missing id.');
      }
    }

    if (skill.workflow) {
      if (!skill.workflow.id) {
        throw new SkillValidationError('Skill workflow is missing id.');
      }
    }
  }
}

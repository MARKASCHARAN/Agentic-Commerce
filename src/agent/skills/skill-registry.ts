import { Skill, SkillId, SkillMetadata } from './types';
import {
  SkillAlreadyRegisteredError,
  SkillNotFoundError,
  SkillValidationError
} from './errors';

/**
 * A deterministic registry that manages discovery and lookup for all Skills.
 * The registry acts as the source of truth for available capabilities.
 */
export class SkillRegistry {
  private readonly skills = new Map<SkillId, Skill<unknown, unknown>>();

  /**
   * Registers a skill in the registry.
   * Rejects invalid skills and duplicate IDs.
   * 
   * @param skill - The skill to register.
   * @throws {SkillValidationError} If the skill definition is invalid.
   * @throws {SkillAlreadyRegisteredError} If the skill ID is already registered.
   */
  register(skill: Skill<unknown, unknown>): void {
    this.validateSkill(skill);

    if (this.skills.has(skill.metadata.id)) {
      throw new SkillAlreadyRegisteredError(skill.metadata.id);
    }

    // Freeze capability declarations to prevent mutation after registration
    if (skill.tools) {
      Object.freeze(skill.tools);
      skill.tools.forEach(t => Object.freeze(t));
    }
    if (skill.policy) Object.freeze(skill.policy);
    if (skill.workflow) Object.freeze(skill.workflow);

    this.skills.set(skill.metadata.id, skill);
  }

  /**
   * Unregisters a skill by ID.
   * 
   * @param skillId - The ID of the skill to remove.
   */
  unregister(skillId: string): void {
    this.skills.delete(skillId as SkillId);
  }

  /**
   * Retrieves a skill by ID.
   * 
   * @param skillId - The ID of the skill to fetch.
   * @returns The requested skill.
   * @throws {SkillNotFoundError} If the skill does not exist.
   */
  get(skillId: string): Skill<unknown, unknown> {
    const skill = this.skills.get(skillId as SkillId);
    if (!skill) {
      throw new SkillNotFoundError(skillId);
    }
    return skill;
  }

  /**
   * Checks if a skill exists in the registry.
   * 
   * @param skillId - The ID of the skill to check.
   * @returns True if the skill exists, false otherwise.
   */
  has(skillId: string): boolean {
    return this.skills.has(skillId as SkillId);
  }

  /**
   * Returns a read-only list of all registered skill metadata.
   * This encapsulates the internal Map to prevent external mutation.
   * 
   * @returns An array of skill metadata.
   */
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

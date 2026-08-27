export class SkillError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillError';
  }
}

export class SkillAlreadyRegisteredError extends SkillError {
  constructor(public readonly skillId: string) {
    super(`Skill already registered: ${skillId}`);
    this.name = 'SkillAlreadyRegisteredError';
  }
}

export class SkillNotFoundError extends SkillError {
  constructor(public readonly skillId: string) {
    super(`Skill not found: ${skillId}`);
    this.name = 'SkillNotFoundError';
  }
}

export class SkillValidationError extends SkillError {
  constructor(message: string) {
    super(`Skill validation failed: ${message}`);
    this.name = 'SkillValidationError';
  }
}

export class SkillFileNotFoundError extends SkillError {
  constructor(message: string) {
    super(message);
    this.name = 'SkillFileNotFoundError';
  }
}

export class SkillDefinitionError extends SkillError {
  constructor(message: string) {
    super(message);
    this.name = 'SkillDefinitionError';
  }
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillLoader, SkillDefinitionError, SkillFileNotFoundError } from '../../src/agent/skills';
import * as path from 'path';
import * as fs from 'fs/promises';
import { echoSkill } from '../../src/agent/skills/test-echo';

describe('SkillLoader', () => {
  const rootDir = path.resolve(__dirname, '../../src/agent/skills');
  let loader: SkillLoader;

  beforeEach(() => {
    loader = new SkillLoader(rootDir);
  });

  describe('loadFromFile', () => {
    it('should load a valid SKILL.md file and return instructions and sourcePath', async () => {
      const skillPath = path.join(rootDir, 'test-echo', 'SKILL.md');
      const loaded = await loader.loadFromFile(skillPath);
      
      expect(loaded.sourcePath).toBe(skillPath);
      expect(loaded.instructions).toContain('# Echo');
      expect(loaded.instructions).toContain('Returns the supplied message unchanged.');
    });

    it('should reject a missing SKILL.md with SkillFileNotFoundError', async () => {
      const missingPath = path.join(rootDir, 'non-existent', 'SKILL.md');
      await expect(loader.loadFromFile(missingPath)).rejects.toThrowError(SkillFileNotFoundError);
    });

    it('should reject path traversal attempts outside the root directory', async () => {
      const traversalPath = path.join(rootDir, '../../../../etc/passwd');
      await expect(loader.loadFromFile(traversalPath)).rejects.toThrowError(SkillDefinitionError);
      await expect(loader.loadFromFile(traversalPath)).rejects.toThrowError(/Path traversal detected/);
    });

    it('should handle empty files deterministically (rejecting)', async () => {
      const emptyDir = path.join(rootDir, 'test-empty');
      const emptyPath = path.join(emptyDir, 'SKILL.md');
      
      await fs.mkdir(emptyDir, { recursive: true });
      await fs.writeFile(emptyPath, '   \n   '); 
      
      try {
        await expect(loader.loadFromFile(emptyPath)).rejects.toThrowError(SkillDefinitionError);
        await expect(loader.loadFromFile(emptyPath)).rejects.toThrowError(/empty/);
      } finally {
        await fs.rm(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe('load', () => {
    it('should load SKILL.md when given a valid skill directory', async () => {
      const dirPath = path.join(rootDir, 'test-echo');
      const loaded = await loader.load(dirPath);
      
      expect(loaded.sourcePath).toBe(path.join(dirPath, 'SKILL.md'));
      expect(loaded.instructions).toContain('# Echo');
    });
  });

  describe('discover', () => {
    it('should discover valid skills in the root directory', async () => {
      const discovered = await loader.discover(rootDir);

      expect(discovered.length).toBeGreaterThanOrEqual(1);
      expect(discovered).toContain(path.join(rootDir, 'test-echo', 'SKILL.md'));
    });

    it('should not blow up if discovering in an empty or valid directory without skills', async () => {
      const emptyDir = path.join(rootDir, 'test-empty-discover');
      await fs.mkdir(emptyDir, { recursive: true });
      
      try {
        const discovered = await loader.discover(emptyDir);
        expect(discovered).toHaveLength(0);
      } finally {
        await fs.rm(emptyDir, { recursive: true, force: true });
      }
    });

    it('should throw if the discover root directory does not exist', async () => {
      const missingDir = path.join(rootDir, 'does-not-exist');
      await expect(loader.discover(missingDir)).rejects.toThrowError(SkillFileNotFoundError);
    });
  });

  describe('Registry Association', () => {
    it('can associate loaded instructions with a typescript skill execution contract', async () => {
      const loaded = await loader.load(path.join(rootDir, 'test-echo'));

      const registeredSkill = { ...echoSkill, instructions: loaded.instructions, sourcePath: loaded.sourcePath };
      
      expect(registeredSkill.metadata.id).toBe('test.echo');
      expect(registeredSkill.instructions).toContain('# Echo');
      expect(registeredSkill.sourcePath).toBeDefined();
    });
  });
});

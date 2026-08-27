import * as fs from 'fs/promises';
import * as path from 'path';
import { SkillFileNotFoundError, SkillDefinitionError } from './errors';
import { LoadedSkillDefinition } from './types';

export class SkillLoader {
  constructor(private readonly rootDir: string) {}

  /**
   * Ensures the requested path doesn't escape the root directory (path traversal).
   */
  private validatePath(targetPath: string): string {
    const resolvedPath = path.resolve(targetPath);
    const resolvedRoot = path.resolve(this.rootDir);
    
    if (!resolvedPath.startsWith(resolvedRoot)) {
      throw new SkillDefinitionError(`Path traversal detected: ${targetPath}`);
    }
    return resolvedPath;
  }

  /**
   * Loads a specific SKILL.md file by its direct path.
   * 
   * @param skillFile Absolute or relative path to the SKILL.md file.
   * @returns The loaded definition containing instructions and source path.
   */
  async loadFromFile(skillFile: string): Promise<LoadedSkillDefinition> {
    const safePath = this.validatePath(skillFile);
    
    try {
      const content = await fs.readFile(safePath, 'utf-8');
      
      if (!content || !content.trim()) {
        throw new SkillDefinitionError(`Skill definition is empty: ${safePath}`);
      }
      
      return {
        instructions: content,
        sourcePath: safePath
      };
    } catch (error: any) {
      if (error instanceof SkillDefinitionError) {
        throw error;
      }
      if (error.code === 'ENOENT') {
        throw new SkillFileNotFoundError(`SKILL.md not found at ${safePath}`);
      }
      throw new SkillDefinitionError(`Failed to load skill definition: ${error.message}`);
    }
  }

  /**
   * Loads a SKILL.md from a specific skill directory.
   * 
   * @param skillDirectory Directory containing the SKILL.md file.
   * @returns The loaded definition.
   */
  async load(skillDirectory: string): Promise<LoadedSkillDefinition> {
    const skillFile = path.join(skillDirectory, 'SKILL.md');
    return this.loadFromFile(skillFile);
  }

  /**
   * Discovers all SKILL.md files within a root directory (one level deep).
   * 
   * @param searchDir The root directory containing skill subdirectories.
   * @returns An array of absolute paths to discovered SKILL.md files.
   */
  async discover(searchDir: string): Promise<string[]> {
    const safeDir = this.validatePath(searchDir);
    const results: string[] = [];
    
    try {
      const entries = await fs.readdir(safeDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const potentialSkillMd = path.join(safeDir, entry.name, 'SKILL.md');
          try {
            await fs.access(potentialSkillMd);
            results.push(potentialSkillMd);
          } catch {
            // No SKILL.md found in this directory, skip it silently
          }
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new SkillFileNotFoundError(`Search directory not found: ${safeDir}`);
      }
      throw new SkillDefinitionError(`Failed to discover skills in ${safeDir}: ${error.message}`);
    }
    
    return results;
  }
}

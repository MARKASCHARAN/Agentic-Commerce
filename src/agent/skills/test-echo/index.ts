import { z } from 'zod';
import { Skill, SkillId } from '../types';

export const echoSkill: Skill<{ message: string }, { message: string }> = {
  metadata: {
    id: 'test.echo' as SkillId,
    name: 'Echo',
    description: 'Returns the supplied message unchanged.',
    version: '1.0.0',
  },
  inputSchema: z.object({ message: z.string() }),
  outputSchema: z.object({ message: z.string() }),
  execute: async (input) => {
    return { message: input.message };
  }
};

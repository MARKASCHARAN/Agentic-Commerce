import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Disable parallel execution of test files because integration tests 
    // share a single PostgreSQL database state and run Prisma deleteMany() teardowns.
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 30000
  }
});

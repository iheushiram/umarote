import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      all: true,
      include: ['src/services/**/*.ts'],
      exclude: [
        'src/**/setup.ts',
        'src/**/__tests__/**',
        '**/*.d.ts'
      ],
      thresholds: {
        // 100%を目標に。必要に応じて微調整可。
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    }
  }
})

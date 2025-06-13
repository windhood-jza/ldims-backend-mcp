/**
 * Jest 配置文件
 *
 * 为LDIMS MCP服务提供单元测试和集成测试配置
 */

/** @type {import('jest').Config} */
export default {
  // 基础配置
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],

  // 环境配置
  testEnvironment: "node",

  // 文件模式
  testMatch: ["**/tests/**/*.test.ts", "**/tests/**/*.spec.ts"],

  // TypeScript 转换
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ESNext",
          target: "ES2022"
        }
      }
    ]
  },

  // 模块解析
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },

  // 覆盖率配置
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/index.ts"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // 设置文件
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],

  // 测试超时
  testTimeout: 10000,

  // 清理模式
  clearMocks: true,
  restoreMocks: true,

  // 详细输出
  verbose: true
};

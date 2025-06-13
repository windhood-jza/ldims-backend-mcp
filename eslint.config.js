/**
 * ESLint 配置文件
 *
 * 为LDIMS MCP服务提供代码质量检查规则
 */

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // 基础JavaScript规则
  js.configs.recommended,

  // TypeScript推荐规则
  ...tseslint.configs.recommended,

  // 自定义配置
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // TypeScript 特定规则
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-require-imports": "off",

      // 代码质量规则
      "no-console": "off", // MCP服务需要日志输出
      "no-debugger": "error",
      "no-alert": "error",
      "no-var": "error",
      "prefer-const": "error",
      "prefer-arrow-callback": "off",
      "arrow-spacing": "off",
      "no-duplicate-imports": "off",
      "no-useless-return": "off",
      "no-useless-concat": "off",
      "no-useless-escape": "off",

      // 代码风格规则 - 大部分禁用
      indent: "off",
      quotes: "off",
      semi: "off",
      "comma-dangle": "off",
      "object-curly-spacing": "off",
      "array-bracket-spacing": "off",
      "space-before-function-paren": "off",

      // 复杂度控制 - 全部禁用
      complexity: "off",
      "max-depth": "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-params": "off",

      // 安全性规则
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
    },
  },

  // 测试文件特殊规则
  {
    files: ["**/*.test.{ts,js}", "**/*.spec.{ts,js}", "tests/**/*.{ts,js}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "max-lines-per-function": "off",
      complexity: "off",
    },
  },

  // 配置文件特殊规则
  {
    files: ["**/*.config.{ts,js}", "**/config/**/*.{ts,js}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },

  // 忽略文件
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "scripts/**",
      "*.d.ts",
      "**/*.min.js",
      "docs/**",
    ],
  }
);

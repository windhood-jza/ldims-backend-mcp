/**
 * 配置管理模块单元测试
 */

import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { loadConfig, validateConfig } from "../../src/config/index.js";

describe("配置管理模块", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("loadConfig", () => {
    test("应该加载默认配置", () => {
      // 设置基本环境变量
      process.env.LDIMS_API_BASE_URL = "http://localhost:3000/api";

      const config = loadConfig();

      expect(config).toBeDefined();
      expect(config.ldims).toBeDefined();
      expect(config.ldims.baseUrl).toBe("http://localhost:3000/api");
    });

    test("应该使用环境变量覆盖默认值", () => {
      process.env.LDIMS_API_BASE_URL = "http://test.com/api";
      process.env.LDIMS_API_VERSION = "v2";
      process.env.LDIMS_API_TIMEOUT = "5000";

      const config = loadConfig();

      expect(config.ldims.baseUrl).toBe("http://test.com/api");
      expect(config.ldims.version).toBe("v2");
      expect(config.ldims.timeout).toBe(5000);
    });

    test("应该处理无效的数字环境变量", () => {
      process.env.LDIMS_API_BASE_URL = "http://localhost:3000/api";
      process.env.LDIMS_API_TIMEOUT = "invalid";

      const config = loadConfig();

      // 应该使用默认值
      expect(config.ldims.timeout).toBe(30000);
    });

    test("应该在缺少必需配置时抛出错误", () => {
      // 清除必需的环境变量
      delete process.env.LDIMS_API_BASE_URL;

      expect(() => {
        loadConfig();
      }).toThrow();
    });
  });

  describe("validateConfig", () => {
    test("应该验证有效配置", () => {
      const validConfig = {
        ldims: {
          baseUrl: "http://localhost:3000/api",
          version: "v1",
          timeout: 30000,
          authToken: "test-token"
        },
        server: {
          name: "test-server",
          version: "1.0.0"
        },
        logging: {
          level: "info" as const,
          format: "json" as const
        }
      };

      expect(() => {
        validateConfig(validConfig);
      }).not.toThrow();
    });

    test("应该拒绝无效的URL", () => {
      const invalidConfig = {
        ldims: {
          baseUrl: "invalid-url",
          version: "v1",
          timeout: 30000
        },
        server: {
          name: "test-server",
          version: "1.0.0"
        },
        logging: {
          level: "info" as const,
          format: "json" as const
        }
      };

      expect(() => {
        validateConfig(invalidConfig);
      }).toThrow();
    });

    test("应该拒绝负数超时值", () => {
      const invalidConfig = {
        ldims: {
          baseUrl: "http://localhost:3000/api",
          version: "v1",
          timeout: -1000
        },
        server: {
          name: "test-server",
          version: "1.0.0"
        },
        logging: {
          level: "info" as const,
          format: "json" as const
        }
      };

      expect(() => {
        validateConfig(invalidConfig);
      }).toThrow();
    });
  });

  describe("环境特定配置", () => {
    test("开发环境应该有详细日志", () => {
      process.env.NODE_ENV = "development";
      process.env.LDIMS_API_BASE_URL = "http://localhost:3000/api";

      const config = loadConfig();

      expect(config.logging.level).toBe("debug");
    });

    test("生产环境应该有简化日志", () => {
      process.env.NODE_ENV = "production";
      process.env.LDIMS_API_BASE_URL = "http://localhost:3000/api";

      const config = loadConfig();

      expect(config.logging.level).toBe("info");
    });

    test("测试环境应该禁用详细日志", () => {
      process.env.NODE_ENV = "test";
      process.env.LDIMS_API_BASE_URL = "http://localhost:3000/api";

      const config = loadConfig();

      expect(config.logging.level).toBe("error");
    });
  });
});

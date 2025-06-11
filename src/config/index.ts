/**
 * 配置管理模块
 *
 * 负责加载、验证和管理应用配置
 */

import { z } from "zod";
import type { McpServiceConfig } from "../types/mcp.js";
import {
  EnvironmentConfigSchema,
  type EnvironmentConfig,
} from "../types/mcp.js";

/**
 * 配置错误类
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public override cause?: unknown
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * 配置管理器
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: McpServiceConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  /**
   * 获取配置管理器单例
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 加载配置
   */
  private loadConfig(): McpServiceConfig {
    try {
      console.log("[Config] 开始加载配置...");

      // 加载环境变量
      const env = this.loadEnvironmentVariables();

      // 构建完整配置
      const config: McpServiceConfig = {
        server: {
          name: env.MCP_SERVER_NAME,
          version: env.MCP_SERVER_VERSION,
          description: "LDIMS文档管理系统MCP接口服务",
          author: "LDIMS Team",
          license: "MIT",
        },
        ldims: {
          baseUrl: env.LDIMS_API_BASE_URL,
          version: env.LDIMS_API_VERSION,
          ...(env.LDIMS_AUTH_TOKEN && { authToken: env.LDIMS_AUTH_TOKEN }),
          timeout: Number(env.LDIMS_API_TIMEOUT),
          retryCount: Number(env.LDIMS_API_RETRY_COUNT),
        },
        logging: {
          level: env.LOG_LEVEL,
          console: true,
          ...(env.LOG_FILE && { file: env.LOG_FILE }),
          format: env.LOG_FORMAT,
        },
      };

      // 验证配置
      this.validateConfig(config);

      console.log("[Config] 配置加载成功");
      if (env.NODE_ENV === "development") {
        console.log("[Config] 当前配置:", JSON.stringify(config, null, 2));
      }

      return config;
    } catch (error) {
      console.error("[Config] 配置加载失败:", error);
      throw new ConfigError("配置加载失败", error);
    }
  }

  /**
   * 加载环境变量
   */
  private loadEnvironmentVariables(): EnvironmentConfig {
    try {
      // 尝试加载 .env 文件（如果存在）
      try {
        const dotenv = require("dotenv");
        dotenv.config();
        console.log("[Config] .env 文件加载成功");
      } catch (error) {
        console.log("[Config] 未找到 .env 文件或dotenv模块，使用系统环境变量");
      }

      // 验证和转换环境变量
      const env = EnvironmentConfigSchema.parse(process.env);

      return env;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("\n");

        throw new ConfigError(`环境变量验证失败:\n${issues}`);
      }

      throw error;
    }
  }

  /**
   * 验证配置完整性
   */
  private validateConfig(config: McpServiceConfig): void {
    // 验证LDIMS API配置
    if (!config.ldims.baseUrl) {
      throw new ConfigError("LDIMS API基础URL不能为空");
    }

    try {
      new URL(config.ldims.baseUrl);
    } catch (error) {
      throw new ConfigError(`无效的LDIMS API URL: ${config.ldims.baseUrl}`);
    }

    if (config.ldims.timeout <= 0) {
      throw new ConfigError("API超时时间必须大于0");
    }

    if (config.ldims.retryCount < 0) {
      throw new ConfigError("重试次数不能为负数");
    }

    // 验证日志配置
    if (config.logging.file) {
      const path = require("path");
      const dir = path.dirname(config.logging.file);

      // 检查日志目录是否存在（如果不存在尝试创建）
      try {
        const fs = require("fs");
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`[Config] 创建日志目录: ${dir}`);
        }
      } catch (error) {
        console.warn(`[Config] 无法创建日志目录 ${dir}:`, error);
      }
    }
  }

  /**
   * 获取完整配置
   */
  getConfig(): Readonly<McpServiceConfig> {
    return { ...this.config };
  }

  /**
   * 获取服务器配置
   */
  getServerConfig() {
    return { ...this.config.server };
  }

  /**
   * 获取LDIMS API配置
   */
  getLdimsConfig() {
    return { ...this.config.ldims };
  }

  /**
   * 获取日志配置
   */
  getLoggingConfig() {
    return { ...this.config.logging };
  }

  /**
   * 检查是否为开发模式
   */
  isDevelopment(): boolean {
    return process.env.NODE_ENV === "development";
  }

  /**
   * 检查是否为生产模式
   */
  isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  }

  /**
   * 检查是否为测试模式
   */
  isTest(): boolean {
    return process.env.NODE_ENV === "test";
  }
}

/**
 * 获取全局配置实例
 */
export function getConfig(): ConfigManager {
  return ConfigManager.getInstance();
}

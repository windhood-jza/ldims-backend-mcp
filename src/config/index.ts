/**
 * 配置管理模块
 *
 * 负责加载、验证和管理应用配置
 *
 * @deprecated 建议使用 enhanced-config.ts 中的 EnhancedConfigManager
 */

import { z } from "zod";
import type { McpServiceConfig } from "../types/mcp.js";
import { EnvironmentConfigSchema, type EnvironmentConfig } from "../types/mcp.js";
import { getEnhancedConfig, type ConfigLoadOptions, ConfigValidationLevel } from "./enhanced-config.js";

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
 * 配置检查结果
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * 配置管理器
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: McpServiceConfig;
  private validationResult: ConfigValidationResult;

  private constructor() {
    this.config = this.loadConfig();
    this.validationResult = this.performConfigCheck();
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
          license: "MIT"
        },
        ldims: {
          baseUrl: env.LDIMS_API_BASE_URL,
          version: env.LDIMS_API_VERSION,
          ...(env.LDIMS_AUTH_TOKEN && { authToken: env.LDIMS_AUTH_TOKEN }),
          timeout: env.LDIMS_API_TIMEOUT,
          retryCount: env.LDIMS_API_RETRY_COUNT
        },
        logging: {
          level: env.LOG_LEVEL,
          console: true,
          ...(env.LOG_FILE && { file: env.LOG_FILE }),
          format: env.LOG_FORMAT
        },
        errorHandling: {
          detailed: env.ERROR_DETAILED ?? env.NODE_ENV === "development",
          stackTrace: env.ERROR_STACK_TRACE ?? env.NODE_ENV === "development",
          retryDelay: env.ERROR_RETRY_DELAY ?? 1000,
          maxRetries: env.ERROR_MAX_RETRIES ?? 3
        }
      };

      // 验证配置
      this.validateConfig(config);

      console.log("[Config] 配置加载成功");

      // 开发模式下显示配置详情
      if (env.NODE_ENV === "development") {
        console.log("[Config] 当前配置:", JSON.stringify(config, null, 2));
      }

      return config;
    } catch (_error) {
      console.error("[Config] 配置加载失败:", _error);
      this.printConfigurationHelp();
      throw new ConfigError("配置加载失败", _error);
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
        const result = dotenv.config();

        if (result.error) {
          console.log("[Config] .env 文件不存在，使用系统环境变量");
        } else {
          console.log("[Config] .env 文件加载成功");
        }
      } catch (_error) {
        console.log("[Config] dotenv模块未安装，使用系统环境变量");
      }

      // 验证和转换环境变量
      const env = EnvironmentConfigSchema.parse(process.env);

      console.log(`[Config] 运行环境: ${env.NODE_ENV}`);
      return env;
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        console.error("[Config] 环境变量验证失败:");

        const issues = _error.issues.map((issue: any) => {
          const path = issue.path.join(".");
          return `  • ${path}: ${issue.message}`;
        });

        console.error(issues.join("\n"));
        this.printEnvironmentHelp(_error.issues);

        throw new ConfigError(`环境变量验证失败:\n${issues.join("\n")}`);
      }

      throw _error;
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
    } catch (_error) {
      throw new ConfigError(
        `无效的LDIMS API URL: ${config.ldims.baseUrl}\n` + "请确保URL格式正确，例如: http://localhost:3000"
      );
    }

    if (config.ldims.timeout <= 0) {
      throw new ConfigError("API超时时间必须大于0毫秒");
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
      } catch (_error) {
        console.warn(`[Config] 无法创建日志目录 ${dir}:`, _error);
        console.warn("[Config] 日志将仅输出到控制台");
      }
    }
  }

  /**
   * 执行配置检查
   */
  private performConfigCheck(): ConfigValidationResult {
    const result: ConfigValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // 检查LDIMS API连接性（仅在开发模式下警告）
    if (this.config.ldims.baseUrl.includes("localhost") && this.isProduction()) {
      result.warnings.push("生产环境中使用localhost作为API地址");
      result.suggestions.push("建议在生产环境中使用实际的API服务器地址");
    }

    // 检查日志配置
    if (this.isProduction()) {
      if (this.config.logging.level === "debug") {
        result.warnings.push("生产环境中使用debug日志级别");
        result.suggestions.push("生产环境建议使用warn或error日志级别");
      }

      if (!this.config.logging.file) {
        result.suggestions.push("生产环境建议配置日志文件存储");
      }
    }

    // 检查超时配置
    if (this.config.ldims.timeout > 60000) {
      result.warnings.push("API超时时间设置过长（>60秒）");
      result.suggestions.push("建议将超时时间设置在15-30秒之间");
    }

    // 输出检查结果
    if (result.warnings.length > 0) {
      console.warn("[Config] 配置警告:");
      result.warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
    }

    if (result.suggestions.length > 0 && this.isDevelopment()) {
      console.log("[Config] 建议:");
      result.suggestions.forEach(suggestion => console.log(`  💡 ${suggestion}`));
    }

    return result;
  }

  /**
   * 打印配置帮助信息
   */
  private printConfigurationHelp(): void {
    console.log("\n" + "=".repeat(60));
    console.log("📋 LDIMS MCP 服务配置帮助");
    console.log("=".repeat(60));
    console.log("配置加载失败。请检查以下步骤：\n");

    console.log("1. 创建 .env 文件:");
    console.log("   cp .env.example .env\n");

    console.log("2. 必须配置的环境变量:");
    console.log("   LDIMS_API_BASE_URL=http://localhost:8080");
    console.log("   LDIMS_API_VERSION=v1");
    console.log("   # LOG_LEVEL=debug");
    console.log("=".repeat(60));

    console.log("3. 可选配置项:");
    console.log("   LDIMS_API_TIMEOUT=30000");
    console.log("   LDIMS_API_RETRY_COUNT=3");
    console.log("   LOG_FORMAT=text\n");

    console.log("4. 更多信息请参考 .env.example 文件");
    console.log("=".repeat(60) + "\n");
  }

  /**
   * 打印环境变量帮助信息
   */
  private printEnvironmentHelp(issues: z.ZodIssue[]): void {
    console.log("\n" + "=".repeat(60));
    console.log("🔧 环境变量配置错误修复建议");
    console.log("=".repeat(60));

    issues.forEach(issue => {
      const envVar = issue.path[0];
      console.log(`\n❌ ${envVar}:`);
      console.log(`   问题: ${issue.message}`);

      // 提供具体的修复建议
      switch (envVar) {
        case "LDIMS_API_BASE_URL":
          console.log("   建议: LDIMS_API_BASE_URL=http://localhost:8080");
          break;
        case "LDIMS_API_TIMEOUT":
          console.log("   建议: LDIMS_API_TIMEOUT=30000");
          break;
        case "LDIMS_API_RETRY_COUNT":
          console.log("   建议: LDIMS_API_RETRY_COUNT=3");
          break;
        case "LOG_LEVEL":
          console.log("   建议: LOG_LEVEL=info");
          break;
        case "LOG_FORMAT":
          console.log("   建议: LOG_FORMAT=text");
          break;
        case "NODE_ENV":
          console.log("   建议: NODE_ENV=development");
          break;
        default:
          console.log(`   请查看 .env.example 文件中的 ${envVar} 配置示例`);
      }
    });

    console.log("\n" + "=".repeat(60) + "\n");
  }

  /**
   * 获取配置验证结果
   */
  getValidationResult(): ConfigValidationResult {
    return { ...this.validationResult };
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
   * 获取错误处理配置
   */
  getErrorHandlingConfig() {
    return { ...this.config.errorHandling };
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

  /**
   * 获取当前环境名称
   */
  getEnvironment(): string {
    return process.env.NODE_ENV || "development";
  }

  /**
   * 重新加载配置
   */
  reload(): void {
    console.log("[Config] 重新加载配置...");
    this.config = this.loadConfig();
    this.validationResult = this.performConfigCheck();
    console.log("[Config] 配置重新加载完成");
  }
}

/**
 * 获取全局配置实例
 */
export function getConfig(): ConfigManager {
  return ConfigManager.getInstance();
}

/**
 * 获取增强配置管理器实例
 *
 * 推荐使用此方法替代 getConfig()
 */
export function getEnhancedConfigManager(options?: ConfigLoadOptions) {
  return getEnhancedConfig(options);
}

/**
 * 快速配置设置 - 开发环境
 */
export function getDevConfig() {
  return getEnhancedConfig({
    strategy: require("./enhanced-config.js").ConfigLoadStrategy.ENVIRONMENT_WITH_FALLBACK,
    validationLevel: ConfigValidationLevel.STRICT,
    verbose: true,
    environment: "development"
  });
}

/**
 * 快速配置设置 - 生产环境
 */
export function getProdConfig() {
  return getEnhancedConfig({
    strategy: require("./enhanced-config.js").ConfigLoadStrategy.ENVIRONMENT_SPECIFIC,
    validationLevel: ConfigValidationLevel.COMPREHENSIVE,
    verbose: false,
    environment: "production"
  });
}

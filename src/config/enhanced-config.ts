/**
 * 增强的配置管理模块
 *
 * 支持环境特定配置、智能配置验证和友好的错误提示
 */

import { z } from "zod";
import * as path from "path";
import * as fs from "fs";
import {
  type McpServiceConfig,
  type EnvironmentConfig,
  type ErrorHandlingConfig,
  EnvironmentConfigSchema,
} from "../types/mcp.js";

/**
 * 配置加载策略
 */
export enum ConfigLoadStrategy {
  /** 仅加载 .env 文件 */
  ENV_ONLY = "env_only",
  /** 仅加载环境特定文件 */
  ENVIRONMENT_SPECIFIC = "environment_specific",
  /** 优先环境特定，回退到 .env */
  ENVIRONMENT_WITH_FALLBACK = "environment_with_fallback",
  /** 合并所有配置文件 */
  MERGE_ALL = "merge_all",
}

/**
 * 配置验证级别
 */
export enum ConfigValidationLevel {
  /** 基础验证 */
  BASIC = "basic",
  /** 严格验证 */
  STRICT = "strict",
  /** 完整验证（包括连接性测试） */
  COMPREHENSIVE = "comprehensive",
}

/**
 * 配置问题类型
 */
export enum ConfigIssueType {
  ERROR = "error",
  WARNING = "warning",
  SUGGESTION = "suggestion",
  INFO = "info",
}

/**
 * 配置问题
 */
export interface ConfigIssue {
  type: ConfigIssueType;
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
  severity: "low" | "medium" | "high" | "critical";
}

/**
 * 配置验证结果
 */
export interface EnhancedConfigValidationResult {
  isValid: boolean;
  issues: ConfigIssue[];
  summary: {
    errors: number;
    warnings: number;
    suggestions: number;
    infos: number;
  };
  environment: string;
  loadedFiles: string[];
  validationLevel: ConfigValidationLevel;
}

/**
 * 配置加载选项
 */
export interface ConfigLoadOptions {
  /** 配置文件根目录 */
  configDir?: string;
  /** 加载策略 */
  strategy?: ConfigLoadStrategy;
  /** 验证级别 */
  validationLevel?: ConfigValidationLevel;
  /** 是否显示详细日志 */
  verbose?: boolean;
  /** 自定义环境名称 */
  environment?: string;
}

/**
 * 增强的配置错误类
 */
export class EnhancedConfigError extends Error {
  constructor(
    message: string,
    public readonly issues: ConfigIssue[],
    public override cause?: unknown,
  ) {
    super(message);
    this.name = "EnhancedConfigError";
  }

  /**
   * 获取错误摘要
   */
  getSummary(): string {
    const errors = this.issues.filter((i) => i.type === ConfigIssueType.ERROR);
    const warnings = this.issues.filter(
      (i) => i.type === ConfigIssueType.WARNING,
    );

    return `配置验证失败: ${errors.length} 个错误, ${warnings.length} 个警告`;
  }

  /**
   * 获取修复建议
   */
  getFixSuggestions(): string[] {
    return this.issues
      .filter((i) => i.suggestion)
      .map((i) => i.suggestion!)
      .filter((suggestion, index, arr) => arr.indexOf(suggestion) === index);
  }
} /**
 * 增强的配置管理器
 */
export class EnhancedConfigManager {
  private static instance: EnhancedConfigManager;
  private config: McpServiceConfig;
  private validationResult: EnhancedConfigValidationResult;
  private loadOptions: Required<ConfigLoadOptions>;

  private constructor(options: ConfigLoadOptions = {}) {
    this.loadOptions = {
      configDir: options.configDir ?? process.cwd(),
      strategy:
        options.strategy ?? ConfigLoadStrategy.ENVIRONMENT_WITH_FALLBACK,
      validationLevel: options.validationLevel ?? ConfigValidationLevel.STRICT,
      verbose: options.verbose ?? process.env.NODE_ENV === "development",
      environment: options.environment ?? process.env.NODE_ENV ?? "development",
    };

    this.log("🔧 初始化增强配置管理器...");
    this.config = this.loadConfiguration();
    this.validationResult = this.validateConfiguration();
    this.log("✅ 配置管理器初始化完成");
  }

  /**
   * 获取配置管理器单例
   */
  static getInstance(options?: ConfigLoadOptions): EnhancedConfigManager {
    if (!EnhancedConfigManager.instance) {
      EnhancedConfigManager.instance = new EnhancedConfigManager(options);
    }
    return EnhancedConfigManager.instance;
  }

  /**
   * 重置单例（主要用于测试）
   */
  static reset(): void {
    EnhancedConfigManager.instance = undefined as any;
  }

  /**
   * 加载配置
   */
  private loadConfiguration(): McpServiceConfig {
    try {
      this.log("📂 开始加载配置文件...");

      // 加载环境变量
      const env = this.loadEnvironmentVariables();

      // 构建配置对象
      const config = this.buildConfiguration(env);

      this.log("✅ 配置加载成功");
      return config;
    } catch (_error) {
      this.logError("❌ 配置加载失败", _error);
      throw _error;
    }
  }

  /**
   * 加载环境变量
   */
  private loadEnvironmentVariables(): EnvironmentConfig {
    const loadedFiles: string[] = [];

    try {
      // 根据策略加载配置文件
      switch (this.loadOptions.strategy) {
        case ConfigLoadStrategy.ENV_ONLY:
          this.loadEnvFile(".env", loadedFiles);
          break;

        case ConfigLoadStrategy.ENVIRONMENT_SPECIFIC:
          this.loadEnvFile(`.env.${this.loadOptions.environment}`, loadedFiles);
          break;

        case ConfigLoadStrategy.ENVIRONMENT_WITH_FALLBACK:
          if (
            !this.loadEnvFile(
              `.env.${this.loadOptions.environment}`,
              loadedFiles,
            )
          ) {
            this.loadEnvFile(".env", loadedFiles);
          }
          break;

        case ConfigLoadStrategy.MERGE_ALL:
          this.loadEnvFile(".env", loadedFiles);
          this.loadEnvFile(`.env.${this.loadOptions.environment}`, loadedFiles);
          break;
      }

      this.log(`📁 已加载配置文件: ${loadedFiles.join(", ") || "无"}`);

      // 验证环境变量
      const env = EnvironmentConfigSchema.parse(process.env);
      this.log(`🌍 运行环境: ${env.NODE_ENV}`);

      return env;
    } catch (_error) {
      if (_error instanceof z.ZodError) {
        const issues = this.convertZodErrorToIssues(_error);
        throw new EnhancedConfigError("环境变量验证失败", issues, _error);
      }
      throw _error;
    }
  }

  /**
   * 加载单个 .env 文件
   */
  private loadEnvFile(filename: string, loadedFiles: string[]): boolean {
    const filePath = path.join(this.loadOptions.configDir, filename);

    try {
      if (fs.existsSync(filePath)) {
        // 手动解析 .env 文件以避免 ES 模块导入问题
        const envContent = fs.readFileSync(filePath, "utf8");
        const envVars = this.parseEnvFile(envContent);

        // 将解析的环境变量设置到 process.env
        Object.entries(envVars).forEach(([key, value]) => {
          if (process.env[key] === undefined) {
            process.env[key] = value;
          }
        });

        loadedFiles.push(filename);
        this.log(
          `✅ ${filename} 文件加载成功 (${Object.keys(envVars).length} 个变量)`,
        );
        return true;
      } else {
        this.log(`ℹ️  ${filename} 文件不存在`);
        return false;
      }
    } catch (_error) {
      this.log(`❌ ${filename} 文件加载出错: ${_error}`);
      return false;
    }
  }

  /**
   * 手动解析 .env 文件内容
   */
  private parseEnvFile(content: string): Record<string, string> {
    const envVars: Record<string, string> = {};

    content.split("\n").forEach((line) => {
      // 移除注释和空行
      line = line.trim();
      if (!line || line.startsWith("#")) {
        return;
      }

      // 解析 KEY=VALUE 格式
      const equalIndex = line.indexOf("=");
      if (equalIndex === -1) {
        return;
      }

      const key = line.substring(0, equalIndex).trim();
      let value = line.substring(equalIndex + 1).trim();

      // 移除引号
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      envVars[key] = value;
    });

    return envVars;
  } /**
   * 构建配置对象
   */
  private buildConfiguration(env: EnvironmentConfig): McpServiceConfig {
    // 构建错误处理配置
    const errorHandling: ErrorHandlingConfig = {
      detailed: env.ERROR_DETAILED ?? env.NODE_ENV === "development",
      stackTrace: env.ERROR_STACK_TRACE ?? env.NODE_ENV === "development",
      retryDelay: env.ERROR_RETRY_DELAY ?? 1000,
      maxRetries: env.ERROR_MAX_RETRIES ?? 3,
    };

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
      errorHandling,
    };

    // 开发模式下显示配置详情
    if (this.loadOptions.verbose && env.NODE_ENV === "development") {
      this.log("🔍 当前配置详情:");
      console.log(JSON.stringify(config, null, 2));
    }

    return config;
  }

  /**
   * 验证配置
   */
  private validateConfiguration(): EnhancedConfigValidationResult {
    const issues: ConfigIssue[] = [];
    const loadedFiles: string[] = []; // 这里应该从实际加载过程中获取

    this.log("🔍 开始配置验证...");

    // 基础验证
    this.performBasicValidation(issues);

    // 严格验证
    if (this.loadOptions.validationLevel !== ConfigValidationLevel.BASIC) {
      this.performStrictValidation(issues);
    }

    // 完整验证
    if (
      this.loadOptions.validationLevel === ConfigValidationLevel.COMPREHENSIVE
    ) {
      this.performComprehensiveValidation(issues);
    }

    const summary = {
      errors: issues.filter((i) => i.type === ConfigIssueType.ERROR).length,
      warnings: issues.filter((i) => i.type === ConfigIssueType.WARNING).length,
      suggestions: issues.filter((i) => i.type === ConfigIssueType.SUGGESTION)
        .length,
      infos: issues.filter((i) => i.type === ConfigIssueType.INFO).length,
    };

    const result: EnhancedConfigValidationResult = {
      isValid: summary.errors === 0,
      issues,
      summary,
      environment: this.loadOptions.environment,
      loadedFiles,
      validationLevel: this.loadOptions.validationLevel,
    };

    this.reportValidationResults(result);
    return result;
  }

  /**
   * 基础验证
   */
  private performBasicValidation(issues: ConfigIssue[]): void {
    // 验证必需配置
    if (!this.config.ldims.baseUrl) {
      issues.push({
        type: ConfigIssueType.ERROR,
        code: "MISSING_API_URL",
        message: "LDIMS API基础URL不能为空",
        field: "LDIMS_API_BASE_URL",
        suggestion: "请设置 LDIMS_API_BASE_URL 环境变量",
        severity: "critical",
      });
    }

    // 验证URL格式
    if (this.config.ldims.baseUrl) {
      try {
        new URL(this.config.ldims.baseUrl);
      } catch (_error) {
        issues.push({
          type: ConfigIssueType.ERROR,
          code: "INVALID_API_URL",
          message: `无效的LDIMS API URL: ${this.config.ldims.baseUrl}`,
          field: "LDIMS_API_BASE_URL",
          suggestion: "请确保URL格式正确，例如: http://localhost:3000",
          severity: "high",
        });
      }
    }

    // 验证超时配置
    if (this.config.ldims.timeout <= 0) {
      issues.push({
        type: ConfigIssueType.ERROR,
        code: "INVALID_TIMEOUT",
        message: "API超时时间必须大于0毫秒",
        field: "LDIMS_API_TIMEOUT",
        suggestion: "建议设置为15000-60000毫秒之间",
        severity: "medium",
      });
    }

    // 验证重试次数
    if (this.config.ldims.retryCount < 0) {
      issues.push({
        type: ConfigIssueType.ERROR,
        code: "INVALID_RETRY_COUNT",
        message: "重试次数不能为负数",
        field: "LDIMS_API_RETRY_COUNT",
        suggestion: "建议设置为0-5之间",
        severity: "medium",
      });
    }
  } /**
   * 严格验证
   */
  private performStrictValidation(issues: ConfigIssue[]): void {
    const isProduction = this.loadOptions.environment === "production";
    const isDevelopment = this.loadOptions.environment === "development";

    // 生产环境特定检查
    if (isProduction) {
      // 检查认证配置
      if (!this.config.ldims.authToken) {
        issues.push({
          type: ConfigIssueType.WARNING,
          code: "MISSING_AUTH_TOKEN",
          message: "生产环境中未配置API认证令牌",
          field: "LDIMS_AUTH_TOKEN",
          suggestion: "强烈建议在生产环境中配置LDIMS_AUTH_TOKEN",
          severity: "high",
        });
      }

      // 检查localhost使用
      if (this.config.ldims.baseUrl.includes("localhost")) {
        issues.push({
          type: ConfigIssueType.WARNING,
          code: "LOCALHOST_IN_PRODUCTION",
          message: "生产环境中使用localhost作为API地址",
          field: "LDIMS_API_BASE_URL",
          suggestion: "生产环境应使用实际的API服务器地址",
          severity: "high",
        });
      }

      // 检查日志级别
      if (this.config.logging.level === "debug") {
        issues.push({
          type: ConfigIssueType.WARNING,
          code: "DEBUG_LOG_IN_PRODUCTION",
          message: "生产环境中使用debug日志级别",
          field: "LOG_LEVEL",
          suggestion: "生产环境建议使用warn或error日志级别",
          severity: "medium",
        });
      }

      // 检查日志文件
      if (!this.config.logging.file) {
        issues.push({
          type: ConfigIssueType.SUGGESTION,
          code: "NO_LOG_FILE_IN_PRODUCTION",
          message: "生产环境中未配置日志文件",
          field: "LOG_FILE",
          suggestion: "生产环境建议配置日志文件存储",
          severity: "low",
        });
      }
    }

    // 开发环境特定检查
    if (isDevelopment) {
      if (this.config.logging.level === "error") {
        issues.push({
          type: ConfigIssueType.SUGGESTION,
          code: "ERROR_LOG_IN_DEVELOPMENT",
          message: "开发环境中使用error日志级别",
          field: "LOG_LEVEL",
          suggestion: "开发环境建议使用debug或info日志级别",
          severity: "low",
        });
      }
    }

    // 通用配置检查
    if (this.config.ldims.timeout > 60000) {
      issues.push({
        type: ConfigIssueType.WARNING,
        code: "LONG_TIMEOUT",
        message: "API超时时间设置过长（>60秒）",
        field: "LDIMS_API_TIMEOUT",
        suggestion: "建议将超时时间设置在15-30秒之间",
        severity: "medium",
      });
    }

    if (this.config.ldims.retryCount > 5) {
      issues.push({
        type: ConfigIssueType.WARNING,
        code: "HIGH_RETRY_COUNT",
        message: "重试次数设置过高（>5次）",
        field: "LDIMS_API_RETRY_COUNT",
        suggestion: "建议将重试次数设置在0-5之间",
        severity: "low",
      });
    }

    // 检查日志目录
    if (this.config.logging.file) {
      const logDir = path.dirname(this.config.logging.file);
      try {
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
          issues.push({
            type: ConfigIssueType.INFO,
            code: "LOG_DIR_CREATED",
            message: `创建日志目录: ${logDir}`,
            severity: "low",
          });
        }
      } catch (_error) {
        issues.push({
          type: ConfigIssueType.WARNING,
          code: "LOG_DIR_CREATE_FAILED",
          message: `无法创建日志目录 ${logDir}`,
          field: "LOG_FILE",
          suggestion: "请检查目录权限或使用其他路径",
          severity: "medium",
        });
      }
    }
  } /**
   * 完整验证（包括连接性测试）
   */
  private performComprehensiveValidation(issues: ConfigIssue[]): void {
    // 这里可以添加API连接性测试等
    // 由于是异步操作，实际实现时可能需要调整架构
    issues.push({
      type: ConfigIssueType.INFO,
      code: "COMPREHENSIVE_VALIDATION_SKIPPED",
      message: "连接性测试已跳过（需要异步支持）",
      suggestion: "可以在服务启动后手动测试API连接",
      severity: "low",
    });
  }

  /**
   * 转换Zod错误为配置问题
   */
  private convertZodErrorToIssues(error: z.ZodError): ConfigIssue[] {
    return error.issues.map((issue) => {
      const field = issue.path[0] as string;
      return {
        type: ConfigIssueType.ERROR,
        code: "VALIDATION_ERROR",
        message: issue.message,
        field,
        suggestion: this.getFieldSuggestion(field),
        severity: "high",
      };
    });
  }

  /**
   * 获取字段建议
   */
  private getFieldSuggestion(field: string): string {
    const suggestions: Record<string, string> = {
      LDIMS_API_BASE_URL: "设置为 http://localhost:3000 或实际API地址",
      LDIMS_API_TIMEOUT: "设置为 30000 (30秒)",
      LDIMS_API_RETRY_COUNT: "设置为 3",
      LOG_LEVEL: "设置为 info、warn 或 error",
      LOG_FORMAT: "设置为 text 或 json",
      NODE_ENV: "设置为 development、production 或 test",
      ERROR_RETRY_DELAY: "设置为 1000 (1秒)",
      ERROR_MAX_RETRIES: "设置为 3",
    };
    return (
      suggestions[field] || `请查看 .env.example 文件中的 ${field} 配置示例`
    );
  }

  /**
   * 报告验证结果
   */
  private reportValidationResults(
    result: EnhancedConfigValidationResult,
  ): void {
    const { summary, issues } = result;

    if (summary.errors > 0) {
      this.logError(`❌ 配置验证失败: ${summary.errors} 个错误`);
      issues
        .filter((i) => i.type === ConfigIssueType.ERROR)
        .forEach((issue) => {
          console.error(`   • ${issue.message}`);
          if (issue.suggestion) {
            console.error(`     建议: ${issue.suggestion}`);
          }
        });
    }

    if (summary.warnings > 0) {
      this.log(`⚠️  配置警告: ${summary.warnings} 个警告`);
      if (this.loadOptions.verbose) {
        issues
          .filter((i) => i.type === ConfigIssueType.WARNING)
          .forEach((issue) => {
            console.warn(`   • ${issue.message}`);
            if (issue.suggestion) {
              console.warn(`     建议: ${issue.suggestion}`);
            }
          });
      }
    }

    if (summary.suggestions > 0 && this.loadOptions.verbose) {
      this.log(`💡 配置建议: ${summary.suggestions} 个建议`);
      issues
        .filter((i) => i.type === ConfigIssueType.SUGGESTION)
        .forEach((issue) => {
          console.log(`   • ${issue.message}`);
          if (issue.suggestion) {
            console.log(`     建议: ${issue.suggestion}`);
          }
        });
    }

    if (result.isValid) {
      this.log("✅ 配置验证通过");
    } else {
      this.printConfigurationHelp();
    }
  } /**
   * 打印配置帮助信息
   */
  private printConfigurationHelp(): void {
    console.log("\n" + "=".repeat(70));
    console.log("📋 LDIMS MCP 服务配置帮助");
    console.log("=".repeat(70));
    console.log("配置验证失败。请按照以下步骤修复：\n");

    console.log("1. 📁 创建配置文件:");
    console.log("   cp .env.example .env");
    console.log("   # 或者使用环境特定配置:");
    console.log(`   cp .env.example .env.${this.loadOptions.environment}\n`);

    console.log("2. ⚙️  必须配置的环境变量:");
    console.log("   LDIMS_API_BASE_URL=http://localhost:3000");
    console.log("   NODE_ENV=development\n");

    console.log("3. 🔧 可选配置项:");
    console.log("   LDIMS_AUTH_TOKEN=your_token_here");
    console.log("   LOG_LEVEL=info");
    console.log("   LOG_FILE=logs/mcp-service.log\n");

    console.log("4. 🌍 环境特定配置:");
    console.log("   .env.development - 开发环境配置");
    console.log("   .env.production  - 生产环境配置");
    console.log("   .env.test        - 测试环境配置\n");

    console.log("5. 📖 更多信息:");
    console.log("   查看 .env.example 文件获取完整配置说明");
    console.log("   查看项目文档或联系开发团队");
    console.log("=".repeat(70) + "\n");
  }

  /**
   * 日志输出
   */
  private log(message: string): void {
    if (this.loadOptions.verbose) {
      console.log(`[Config] ${message}`);
    }
  }

  /**
   * 错误日志输出
   */
  private logError(message: string, error?: unknown): void {
    console.error(`[Config] ${message}`);
    if (error && this.loadOptions.verbose) {
      console.error(error);
    }
  }

  // =============================================================================
  // 公共方法
  // =============================================================================

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
   * 获取配置验证结果
   */
  getValidationResult(): EnhancedConfigValidationResult {
    return { ...this.validationResult };
  }

  /**
   * 检查是否为开发模式
   */
  isDevelopment(): boolean {
    return this.loadOptions.environment === "development";
  }

  /**
   * 检查是否为生产模式
   */
  isProduction(): boolean {
    return this.loadOptions.environment === "production";
  }

  /**
   * 检查是否为测试模式
   */
  isTest(): boolean {
    return this.loadOptions.environment === "test";
  }

  /**
   * 获取当前环境名称
   */
  getEnvironment(): string {
    return this.loadOptions.environment;
  }

  /**
   * 重新加载配置
   */
  reload(options?: Partial<ConfigLoadOptions>): void {
    this.log("🔄 重新加载配置...");

    if (options) {
      this.loadOptions = { ...this.loadOptions, ...options };
    }

    this.config = this.loadConfiguration();
    this.validationResult = this.validateConfiguration();

    this.log("✅ 配置重新加载完成");
  }

  /**
   * 检查配置是否有效
   */
  isValid(): boolean {
    return this.validationResult.isValid;
  }

  /**
   * 获取配置问题摘要
   */
  getIssuesSummary(): string {
    const { summary } = this.validationResult;
    return `错误: ${summary.errors}, 警告: ${summary.warnings}, 建议: ${summary.suggestions}`;
  }
}

/**
 * 获取增强配置管理器实例
 */
export function getEnhancedConfig(
  options?: ConfigLoadOptions,
): EnhancedConfigManager {
  return EnhancedConfigManager.getInstance(options);
}

/**
 * 创建新的配置管理器实例（主要用于测试）
 */
export function createEnhancedConfig(
  options?: ConfigLoadOptions,
): EnhancedConfigManager {
  EnhancedConfigManager.reset();
  return EnhancedConfigManager.getInstance(options);
}

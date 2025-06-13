/**
 * MCP错误处理工具模块
 *
 * 提供统一的错误处理、日志记录和错误恢复机制
 */

import { z } from "zod";
import {
  McpError,
  McpErrorCode,
  McpErrorSeverity,
  type EnhancedMcpErrorResponse,
  type McpToolResult,
} from "../types/mcp.js";

/**
 * 错误处理器配置
 */
interface ErrorHandlerConfig {
  /** 是否启用详细错误信息 */
  enableDetailedErrors: boolean;
  /** 是否记录错误堆栈 */
  logStackTrace: boolean;
  /** 默认重试延迟（毫秒） */
  defaultRetryDelay: number;
  /** 最大重试次数 */
  maxRetryAttempts: number;
}

/**
 * 错误统计信息
 */
interface ErrorStats {
  /** 错误总数 */
  totalErrors: number;
  /** 按错误码分组的统计 */
  errorsByCode: Map<McpErrorCode, number>;
  /** 按严重级别分组的统计 */
  errorsBySeverity: Map<McpErrorSeverity, number>;
  /** 最近错误时间 */
  lastErrorTime?: Date;
}

/**
 * MCP错误处理器
 */
export class McpErrorHandler {
  private config: ErrorHandlerConfig;
  private stats: ErrorStats;
  private errorHistory: McpError[] = [];
  private readonly maxHistorySize = 100;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      enableDetailedErrors: config.enableDetailedErrors ?? true,
      logStackTrace: config.logStackTrace ?? true,
      defaultRetryDelay: config.defaultRetryDelay ?? 1000,
      maxRetryAttempts: config.maxRetryAttempts ?? 3,
    };

    this.stats = {
      totalErrors: 0,
      errorsByCode: new Map(),
      errorsBySeverity: new Map(),
    };
  }

  /**
   * 处理并记录错误
   */
  handleError(error: unknown, context?: Record<string, unknown>): McpError {
    let mcpError: McpError;

    // 转换为标准MCP错误
    if (error instanceof McpError) {
      mcpError = error;
    } else if (error instanceof z.ZodError) {
      mcpError = this.handleZodError(error);
    } else if (error instanceof Error) {
      mcpError = this.handleGenericError(error);
    } else {
      mcpError = new McpError(
        McpErrorCode.UNKNOWN_ERROR,
        `未知错误: ${String(error)}`,
        {
          severity: McpErrorSeverity.MEDIUM,
          details: { originalError: error, context },
        },
      );
    }

    // 添加上下文信息
    if (context && mcpError.details) {
      mcpError.details.context = context;
    }

    // 记录错误
    this.recordError(mcpError);

    // 输出日志
    this.logError(mcpError);

    return mcpError;
  }

  /**
   * 处理Zod验证错误
   */
  private handleZodError(error: z.ZodError): McpError {
    const errorDetails = error.errors.map((err) => ({
      path: err.path.join("."),
      message: err.message,
      code: err.code,
    }));

    const message = errorDetails
      .map((err) => `${err.path}: ${err.message}`)
      .join(", ");

    return new McpError(
      McpErrorCode.INVALID_PARAMS,
      `参数验证失败: ${message}`,
      {
        severity: McpErrorSeverity.LOW,
        recoverable: true,
        userMessage: "请检查输入参数格式是否正确",
        details: { validationErrors: errorDetails },
      },
    );
  }

  /**
   * 处理通用错误
   */
  private handleGenericError(error: Error): McpError {
    // 根据错误消息判断错误类型
    if (error.message.includes("fetch") || error.message.includes("network")) {
      return McpError.apiConnectionFailed(error.message, {
        originalError: error.name,
        stack: this.config.logStackTrace ? error.stack : undefined,
      });
    }

    if (error.message.includes("timeout")) {
      return new McpError(McpErrorCode.API_TIMEOUT, error.message, {
        severity: McpErrorSeverity.MEDIUM,
        recoverable: true,
        retryAfter: this.config.defaultRetryDelay,
        userMessage: "请求超时，请稍后重试",
      });
    }

    if (error.message.includes("not found")) {
      return new McpError(McpErrorCode.RESOURCE_NOT_FOUND, error.message, {
        severity: McpErrorSeverity.MEDIUM,
        recoverable: false,
        userMessage: "请求的资源不存在",
      });
    }

    // 默认内部错误
    return McpError.internalError(error.message, error);
  }

  /**
   * 记录错误统计
   */
  private recordError(error: McpError): void {
    this.stats.totalErrors++;
    this.stats.lastErrorTime = new Date();

    // 按错误码统计
    const codeCount = this.stats.errorsByCode.get(error.code) || 0;
    this.stats.errorsByCode.set(error.code, codeCount + 1);

    // 按严重级别统计
    const severityCount = this.stats.errorsBySeverity.get(error.severity) || 0;
    this.stats.errorsBySeverity.set(error.severity, severityCount + 1);

    // 保存到历史记录
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  /**
   * 输出错误日志
   */
  private logError(error: McpError): void {
    const logData = {
      code: error.code,
      message: error.message,
      severity: error.severity,
      timestamp: error.timestamp,
      traceId: error.traceId,
      recoverable: error.recoverable,
      ...(this.config.enableDetailedErrors && { details: error.details }),
    };

    switch (error.severity) {
      case McpErrorSeverity.CRITICAL:
        console.error("🚨 [CRITICAL ERROR]", logData);
        if (this.config.logStackTrace && error.stack) {
          console.error("Stack trace:", error.stack);
        }
        break;
      case McpErrorSeverity.HIGH:
        console.error("❌ [HIGH ERROR]", logData);
        break;
      case McpErrorSeverity.MEDIUM:
        console.warn("⚠️ [MEDIUM ERROR]", logData);
        break;
      case McpErrorSeverity.LOW:
        console.info("ℹ️ [LOW ERROR]", logData);
        break;
    }
  }

  /**
   * 将错误转换为MCP工具结果
   */
  errorToToolResult(error: McpError): McpToolResult {
    const response = error.toMcpResponse();

    return {
      content: [
        {
          type: "text",
          text: this.config.enableDetailedErrors
            ? this.formatDetailedErrorMessage(response)
            : (response.userMessage ?? response.errorMessage),
        },
      ],
      isError: true,
    };
  }

  /**
   * 格式化详细错误消息
   */
  private formatDetailedErrorMessage(
    response: EnhancedMcpErrorResponse,
  ): string {
    let message = "❌ 操作失败\n\n";
    message += `错误类型: ${response.errorCode}\n`;
    message += `错误信息: ${response.errorMessage}\n`;
    message += `严重级别: ${response.severity}\n`;
    message += `发生时间: ${response.timestamp}\n`;

    if (response.userMessage) {
      message += `\n💡 建议: ${response.userMessage}\n`;
    }

    if (response.recoverable && response.retryAfter) {
      message += `\n🔄 可重试: 建议 ${response.retryAfter / 1000} 秒后重试\n`;
    }

    if (response.traceId) {
      message += `\n🔍 追踪ID: ${response.traceId}\n`;
    }

    return message;
  }

  /**
   * 获取错误统计信息
   */
  getStats(): ErrorStats {
    return {
      ...this.stats,
      errorsByCode: new Map(this.stats.errorsByCode),
      errorsBySeverity: new Map(this.stats.errorsBySeverity),
    };
  }

  /**
   * 获取最近的错误历史
   */
  getRecentErrors(limit: number = 10): McpError[] {
    return this.errorHistory.slice(-limit);
  }

  /**
   * 清除错误统计和历史
   */
  clearStats(): void {
    this.stats = {
      totalErrors: 0,
      errorsByCode: new Map(),
      errorsBySeverity: new Map(),
    };
    this.errorHistory = [];
  }

  /**
   * 检查是否应该重试
   */
  shouldRetry(error: McpError, attemptCount: number): boolean {
    return (
      error.recoverable &&
      attemptCount < this.config.maxRetryAttempts &&
      error.severity !== McpErrorSeverity.CRITICAL
    );
  }

  /**
   * 获取重试延迟时间
   */
  getRetryDelay(error: McpError, attemptCount: number): number {
    const baseDelay = error.retryAfter ?? this.config.defaultRetryDelay;
    // 指数退避策略
    return baseDelay * Math.pow(2, attemptCount - 1);
  }

  /**
   * 执行带重试的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context?: Record<string, unknown>,
  ): Promise<T> {
    let lastError: McpError | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetryAttempts; attempt++) {
      try {
        return await operation();
      } catch (_error) {
        lastError = this.handleError(_error, {
          ...context,
          attempt,
          maxAttempts: this.config.maxRetryAttempts,
        });

        if (!this.shouldRetry(lastError, attempt)) {
          throw lastError;
        }

        if (attempt < this.config.maxRetryAttempts) {
          const delay = this.getRetryDelay(lastError, attempt);
          console.info(
            `🔄 重试操作 (${attempt}/${this.config.maxRetryAttempts})，${delay}ms 后重试...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }
}

/**
 * 全局错误处理器实例
 */
export const globalErrorHandler = new McpErrorHandler({
  enableDetailedErrors: process.env.NODE_ENV === "development",
  logStackTrace: process.env.NODE_ENV === "development",
  defaultRetryDelay: 1000,
  maxRetryAttempts: 3,
});

/**
 * 便捷的错误处理函数
 */
export function handleMcpError(
  error: unknown,
  context?: Record<string, unknown>,
): McpError {
  return globalErrorHandler.handleError(error, context);
}

/**
 * 便捷的错误转换函数
 */
export function errorToToolResult(error: unknown): McpToolResult {
  const mcpError = handleMcpError(error);
  return globalErrorHandler.errorToToolResult(mcpError);
}

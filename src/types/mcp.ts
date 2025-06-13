/**
 * LDIMS MCP Service 类型定义
 *
 * 定义MCP服务中使用的类型和接口
 */

import { z } from "zod";

/**
 * LDIMS文档文件内容响应类型
 */
export interface DocumentFileContentResponse {
  /** 文件ID */
  file_id: string;
  /** 文件内容 */
  content: string;
  /** 内容格式 */
  format: "text" | "base64";
  /** 文件元数据（可选） */
  metadata?: {
    /** 文件名 */
    filename: string;
    /** 文件大小（字节） */
    size: number;
    /** 创建时间 */
    created_at: string;
    /** MIME类型 */
    mime_type: string;
    /** 最后修改时间（可选） */
    updated_at?: string;
    /** 文件哈希值（可选） */
    hash?: string;
  };
}

/**
 * MCP工具调用结果
 */
export interface McpToolResult {
  /** 结果内容 */
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  /** 是否为错误结果 */
  isError?: boolean;
}

/**
 * MCP服务器配置
 */
export interface McpServerConfig {
  /** 服务器名称 */
  name: string;
  /** 服务器版本 */
  version: string;
  /** 服务器描述 */
  description: string;
  /** 作者信息 */
  author: string;
  /** 许可证 */
  license: string;
}

/**
 * MCP错误信息
 */
export interface McpErrorInfo {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 详细信息（可选） */
  details?: unknown;
}

/**
 * LDIMS API集成配置
 */
export interface LdimsApiConfig {
  /** API基础URL */
  baseUrl: string;
  /** API版本 */
  version: string;
  /** 认证令牌 */
  authToken?: string;
  /** 请求超时时间（毫秒） */
  timeout: number;
  /** 重试次数 */
  retryCount: number;
}

/**
 * 日志级别
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * 日志配置
 */
export interface LogConfig {
  /** 日志级别 */
  level: LogLevel;
  /** 是否输出到控制台 */
  console: boolean;
  /** 日志文件路径（可选） */
  file?: string;
  /** 日志格式 */
  format: "json" | "text";
}

/**
 * 错误处理配置
 */
export interface ErrorHandlingConfig {
  /** 是否显示详细错误信息 */
  detailed: boolean;
  /** 是否记录错误堆栈 */
  stackTrace: boolean;
  /** 默认重试延迟（毫秒） */
  retryDelay: number;
  /** 最大重试次数 */
  maxRetries: number;
}

/**
 * MCP服务完整配置
 */
export interface McpServiceConfig {
  /** 服务器配置 */
  server: McpServerConfig;
  /** LDIMS API配置 */
  ldims: LdimsApiConfig;
  /** 日志配置 */
  logging: LogConfig;
  /** 错误处理配置 */
  errorHandling: ErrorHandlingConfig;
}

// =============================================================================
// Zod验证Schema
// =============================================================================

/**
 * 获取文档文件内容的参数Schema
 */
export const GetDocumentFileContentSchema = z.object({
  file_id: z
    .string()
    .min(1, "文件ID不能为空")
    .describe("LDIMS系统中的文档文件ID"),
  include_metadata: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否包含文件元数据信息"),
  format: z
    .enum(["text", "base64"])
    .optional()
    .default("text")
    .describe("返回内容的格式：text(文本) 或 base64(二进制编码)"),
});

/**
 * 搜索文档工具的参数Schema
 */
export const SearchDocumentsSchema = z.object({
  query: z
    .string()
    .min(1, "搜索查询不能为空")
    .describe("自然语言或关键词搜索查询。请具体描述您要查找的信息内容。"),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(5)
    .describe("返回结果的最大数量。如需更全面的结果可使用更大的数值。"),
  filters: z
    .object({
      dateFrom: z
        .string()
        .optional()
        .describe("文档创建/修改起始日期过滤（ISO格式）"),
      dateTo: z
        .string()
        .optional()
        .describe("文档创建/修改结束日期过滤（ISO格式）"),
      documentType: z.string().optional().describe("按文档类型/格式过滤"),
      submitter: z.string().optional().describe("按文档提交人过滤"),
      searchMode: z
        .enum(["exact", "semantic"])
        .optional()
        .default("semantic")
        .describe("搜索模式：'exact'精确匹配，'semantic'语义匹配"),
    })
    .optional()
    .describe("搜索过滤条件"),
});

/**
 * 搜索文档响应接口
 */
export interface SearchDocumentsResponse {
  results: Array<{
    documentId: string;
    documentName: string;
    relevanceScore: number;
    matchedContext: string;
    metadata: {
      createdAt: string;
      submitter: string;
      documentType: string;
      departmentName?: string;
      handoverDate?: string;
    };
  }>;
  totalMatches: number;
  searchMetadata: {
    executionTime: string;
    searchMode: "exact" | "semantic";
    queryProcessed: string;
  };
}

/**
 * 文档内容提取资源响应接口
 */
export interface DocumentExtractedContentResponse {
  uri: string;
  text: string;
  metadata: {
    documentName: string;
    extractedAt: string;
    format: string;
    documentId: string;
    fileSize?: number;
    processingStatus: "completed" | "processing" | "failed";
  };
}

/**
 * MCP资源请求接口
 */
export interface McpResourceRequest {
  uri: string;
  metadata?: Record<string, unknown>;
}

/**
 * MCP资源响应接口
 */
export interface McpResourceResponse {
  contents: Array<{
    uri: string;
    text: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * MCP错误响应接口
 */
export interface McpErrorResponse {
  isError: true;
  errorCode: string;
  errorMessage: string;
  errorDetails?: Record<string, unknown>;
}

/**
 * 标准错误码枚举
 */
export enum McpErrorCode {
  // 参数验证错误
  INVALID_PARAMS = "INVALID_PARAMS",
  MISSING_REQUIRED_PARAM = "MISSING_REQUIRED_PARAM",
  INVALID_PARAM_TYPE = "INVALID_PARAM_TYPE",
  INVALID_PARAM_VALUE = "INVALID_PARAM_VALUE",

  // 资源错误
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  RESOURCE_ACCESS_DENIED = "RESOURCE_ACCESS_DENIED",
  INVALID_RESOURCE_URI = "INVALID_RESOURCE_URI",

  // 工具执行错误
  TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
  TOOL_EXECUTION_FAILED = "TOOL_EXECUTION_FAILED",
  TOOL_TIMEOUT = "TOOL_TIMEOUT",

  // API集成错误
  API_CONNECTION_FAILED = "API_CONNECTION_FAILED",
  API_TIMEOUT = "API_TIMEOUT",
  API_AUTHENTICATION_FAILED = "API_AUTHENTICATION_FAILED",
  API_RATE_LIMITED = "API_RATE_LIMITED",
  API_SERVER_ERROR = "API_SERVER_ERROR",
  API_INVALID_RESPONSE = "API_INVALID_RESPONSE",

  // 配置错误
  CONFIG_INVALID = "CONFIG_INVALID",
  CONFIG_MISSING = "CONFIG_MISSING",
  CONFIG_LOAD_FAILED = "CONFIG_LOAD_FAILED",

  // 系统错误
  INTERNAL_ERROR = "INTERNAL_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

/**
 * 错误严重级别
 */
export enum McpErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * 增强的MCP错误响应接口
 */
export interface EnhancedMcpErrorResponse extends McpErrorResponse {
  /** 错误严重级别 */
  severity: McpErrorSeverity;
  /** 错误发生时间戳 */
  timestamp: string;
  /** 错误追踪ID */
  traceId?: string;
  /** 可恢复性标识 */
  recoverable: boolean;
  /** 重试建议 */
  retryAfter?: number;
  /** 用户友好的错误消息 */
  userMessage?: string;
}

/**
 * MCP错误处理工具类
 */
export class McpError extends Error {
  public readonly code: McpErrorCode;
  public readonly severity: McpErrorSeverity;
  public readonly timestamp: string;
  public readonly traceId: string | undefined;
  public readonly recoverable: boolean;
  public readonly retryAfter: number | undefined;
  public readonly userMessage: string | undefined;
  public readonly details: Record<string, unknown> | undefined;

  constructor(
    code: McpErrorCode,
    message: string,
    options: {
      severity?: McpErrorSeverity;
      traceId?: string;
      recoverable?: boolean;
      retryAfter?: number;
      userMessage?: string;
      details?: Record<string, unknown>;
      cause?: Error;
    } = {},
  ) {
    super(message);
    this.name = "McpError";
    this.code = code;
    this.severity = options.severity ?? McpErrorSeverity.MEDIUM;
    this.timestamp = new Date().toISOString();
    this.traceId = options.traceId;
    this.recoverable = options.recoverable ?? false;
    this.retryAfter = options.retryAfter;
    this.userMessage = options.userMessage;
    this.details = options.details;

    if (options.cause) {
      this.cause = options.cause;
    }
  }

  /**
   * 转换为MCP错误响应格式
   */
  toMcpResponse(): EnhancedMcpErrorResponse {
    const response: any = {
      isError: true,
      errorCode: this.code,
      errorMessage: this.message,
      severity: this.severity,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
    };

    if (this.traceId !== undefined) {
      response.traceId = this.traceId;
    }
    if (this.retryAfter !== undefined) {
      response.retryAfter = this.retryAfter;
    }
    if (this.userMessage !== undefined) {
      response.userMessage = this.userMessage;
    }
    if (this.details !== undefined) {
      response.errorDetails = this.details;
    }

    return response as EnhancedMcpErrorResponse;
  }

  /**
   * 创建参数验证错误
   */
  static invalidParams(
    message: string,
    details?: Record<string, unknown>,
  ): McpError {
    const options: any = {
      severity: McpErrorSeverity.LOW,
      recoverable: true,
      userMessage: "请检查输入参数是否正确",
    };
    if (details !== undefined) {
      options.details = details;
    }
    return new McpError(McpErrorCode.INVALID_PARAMS, message, options);
  }

  /**
   * 创建资源未找到错误
   */
  static resourceNotFound(
    resourceUri: string,
    details?: Record<string, unknown>,
  ): McpError {
    return new McpError(
      McpErrorCode.RESOURCE_NOT_FOUND,
      `资源未找到: ${resourceUri}`,
      {
        severity: McpErrorSeverity.MEDIUM,
        recoverable: false,
        userMessage: "请求的资源不存在，请检查资源标识符",
        details: { resourceUri, ...details },
      },
    );
  }

  /**
   * 创建API连接错误
   */
  static apiConnectionFailed(
    message: string,
    details?: Record<string, unknown>,
  ): McpError {
    const options: any = {
      severity: McpErrorSeverity.HIGH,
      recoverable: true,
      retryAfter: 5000, // 5秒后重试
      userMessage: "服务暂时不可用，请稍后重试",
    };
    if (details !== undefined) {
      options.details = details;
    }
    return new McpError(McpErrorCode.API_CONNECTION_FAILED, message, options);
  }

  /**
   * 创建内部错误
   */
  static internalError(
    message: string,
    cause?: Error,
    details?: Record<string, unknown>,
  ): McpError {
    const options: any = {
      severity: McpErrorSeverity.CRITICAL,
      recoverable: false,
      userMessage: "系统内部错误，请联系管理员",
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    if (details !== undefined) {
      options.details = details;
    }
    return new McpError(McpErrorCode.INTERNAL_ERROR, message, options);
  }
}

// 导出参数类型
export type GetDocumentFileContentParams = z.infer<
  typeof GetDocumentFileContentSchema
>;
export type SearchDocumentsParams = z.infer<typeof SearchDocumentsSchema>;

/**
 * 环境变量配置Schema
 */
export const EnvironmentConfigSchema = z.object({
  // LDIMS API配置
  LDIMS_API_BASE_URL: z
    .string()
    .url("无效的LDIMS API URL")
    .default("http://localhost:3000"),
  LDIMS_API_VERSION: z.string().default("v1"),
  LDIMS_AUTH_TOKEN: z.string().optional(),
  LDIMS_API_TIMEOUT: z
    .string()
    .transform(Number)
    .refine((n) => n > 0, "超时时间必须大于0")
    .default("30000"),
  LDIMS_API_RETRY_COUNT: z
    .string()
    .transform(Number)
    .refine((n) => n >= 0, "重试次数不能为负数")
    .default("3"),

  // 日志配置
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_FILE: z.string().optional(),
  LOG_FORMAT: z.enum(["json", "text"]).default("text"),

  // 服务配置
  MCP_SERVER_NAME: z.string().default("ldims-document-mcp"),
  MCP_SERVER_VERSION: z.string().default("1.0.0"),

  // 环境设置
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // 错误处理配置
  ERROR_DETAILED: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  ERROR_STACK_TRACE: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  ERROR_RETRY_DELAY: z
    .string()
    .transform(Number)
    .refine((n) => n >= 0, "重试延迟不能为负数")
    .optional(),
  ERROR_MAX_RETRIES: z
    .string()
    .transform(Number)
    .refine((n) => n >= 0, "最大重试次数不能为负数")
    .optional(),
});

export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;

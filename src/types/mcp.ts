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
 * MCP服务完整配置
 */
export interface McpServiceConfig {
  /** 服务器配置 */
  server: McpServerConfig;
  /** LDIMS API配置 */
  ldims: LdimsApiConfig;
  /** 日志配置 */
  logging: LogConfig;
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
 * 搜索文档参数Schema（预留，P1-T7中实现）
 */
export const SearchDocumentsSchema = z.object({
  query: z.string().min(1, "搜索查询不能为空").describe("搜索关键词或查询语句"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe("返回结果的最大数量"),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe("结果偏移量，用于分页"),
  filters: z
    .object({
      file_type: z.string().optional(),
      created_after: z.string().optional(),
      created_before: z.string().optional(),
    })
    .optional()
    .describe("搜索过滤条件"),
});

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
});

export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;

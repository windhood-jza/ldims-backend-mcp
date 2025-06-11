/**
 * LDIMS API 集成服务
 *
 * 负责与LDIMS后端API的通信和数据转换
 */

import { z } from "zod";
import type {
  DocumentFileContentResponse,
  LdimsApiConfig,
} from "../types/mcp.js";

/**
 * LDIMS API响应结构
 */
const LdimsDocumentFileResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      file_id: z.string(),
      filename: z.string(),
      content: z.string(),
      size: z.number(),
      mime_type: z.string(),
      created_at: z.string(),
      updated_at: z.string().optional(),
      file_hash: z.string().optional(),
    })
    .optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
});

/**
 * LDIMS API 错误类
 */
export class LdimsApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "LdimsApiError";
  }
}

/**
 * LDIMS API 服务类
 */
export class LdimsApiService {
  private config: LdimsApiConfig;

  constructor(config: LdimsApiConfig) {
    this.config = config;
  }

  /**
   * 获取文档文件内容
   */
  async getDocumentFileContent(
    fileId: string,
    includeMetadata: boolean = false,
    format: "text" | "base64" = "text"
  ): Promise<DocumentFileContentResponse> {
    try {
      // 构建API URL
      const url = `${this.config.baseUrl}/api/${this.config.version}/files/${fileId}/content`;

      // 构建请求参数
      const params = new URLSearchParams({
        include_metadata: includeMetadata.toString(),
        format: format,
      });

      // 构建请求头
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "LDIMS-MCP-Service/1.0.0",
      };

      // 添加认证头（如果有）
      if (this.config.authToken) {
        headers["Authorization"] = `Bearer ${this.config.authToken}`;
      }

      console.log(`[LDIMS API] 请求文档文件内容: ${fileId}`);
      console.log(`[LDIMS API] URL: ${url}?${params.toString()}`);

      // 发送HTTP请求
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout
      );

      try {
        const response = await fetch(`${url}?${params.toString()}`, {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new LdimsApiError(
            `HTTP_${response.status}`,
            `HTTP request failed: ${response.status} ${response.statusText}`
          );
        }

        const responseData = await response.json();
        console.log(`[LDIMS API] 响应状态: ${response.status}`);

        // 验证响应格式
        const validatedResponse = LdimsDocumentFileResponse.parse(responseData);

        if (!validatedResponse.success) {
          throw new LdimsApiError(
            validatedResponse.error?.code || "UNKNOWN_ERROR",
            validatedResponse.error?.message || "Unknown API error",
            validatedResponse.error?.details
          );
        }

        if (!validatedResponse.data) {
          throw new LdimsApiError("NO_DATA", "API response missing data field");
        }

        // 转换为MCP格式
        const result: DocumentFileContentResponse = {
          file_id: validatedResponse.data.file_id,
          content: validatedResponse.data.content,
          format: format,
          ...(includeMetadata && {
            metadata: {
              filename: validatedResponse.data.filename,
              size: validatedResponse.data.size,
              created_at: validatedResponse.data.created_at,
              mime_type: validatedResponse.data.mime_type,
              ...(validatedResponse.data.updated_at && {
                updated_at: validatedResponse.data.updated_at,
              }),
              ...(validatedResponse.data.file_hash && {
                hash: validatedResponse.data.file_hash,
              }),
            },
          }),
        };

        console.log(`[LDIMS API] 成功获取文件内容: ${fileId}`);
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      console.error(`[LDIMS API] 获取文件内容失败: ${fileId}`, error);

      if (error instanceof LdimsApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new LdimsApiError(
            "TIMEOUT",
            `Request timeout after ${this.config.timeout}ms`
          );
        }

        if (error.message.includes("fetch")) {
          throw new LdimsApiError(
            "NETWORK_ERROR",
            `Network request failed: ${error.message}`
          );
        }

        throw new LdimsApiError(
          "INTERNAL_ERROR",
          `Internal error: ${error.message}`
        );
      }

      throw new LdimsApiError("UNKNOWN_ERROR", "An unknown error occurred");
    }
  }

  /**
   * 检查API连接状态
   */
  async checkHealth(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl}/api/${this.config.version}/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn("[LDIMS API] 健康检查失败:", error);
      return false;
    }
  }

  /**
   * 获取API配置信息
   */
  getConfig(): Readonly<LdimsApiConfig> {
    return { ...this.config };
  }
}

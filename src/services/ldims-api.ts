/**
 * LDIMS API 集成服务
 *
 * 负责与LDIMS后端API的通信和数据转换
 */

import { z } from "zod";
import {
  type DocumentFileContentResponse,
  type LdimsApiConfig,
  type SearchDocumentsResponse,
  type DocumentExtractedContentResponse,
  type McpErrorResponse,
  SearchDocumentsSchema,
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
  private logger = console; // 简化的日志器

  constructor(config: LdimsApiConfig) {
    this.config = config;
  }

  /**
   * 内部HTTP请求方法
   */
  private async makeRequest(endpoint: string): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "LDIMS-MCP-Service/1.0.0",
    };

    if (this.config.authToken) {
      headers["Authorization"] = `Bearer ${this.config.authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout ?? 30000
    );

    try {
      const response = await fetch(url, {
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

      return await response.json();
    } catch (_error) {
      clearTimeout(timeoutId);
      if (_error instanceof Error && _error.name === "AbortError") {
        throw new LdimsApiError("TIMEOUT", "Request timeout");
      }
      throw _error;
    }
  }

  /**
   * 健康检查方法
   */
  async healthCheck(): Promise<{ isHealthy: boolean }> {
    try {
      await this.makeRequest("/api/v1/health");
      return { isHealthy: true };
    } catch (_error) {
      return { isHealthy: false };
    }
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
            validatedResponse.error?.code ?? "UNKNOWN_ERROR",
            validatedResponse.error?.message ?? "Unknown API error",
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
      } catch (_error) {
        clearTimeout(timeoutId);
        throw _error;
      }
    } catch (_error) {
      console.error(`[LDIMS API] 获取文件内容失败: ${fileId}`, _error);

      if (_error instanceof LdimsApiError) {
        throw _error;
      }

      if (_error instanceof Error) {
        if (_error.name === "AbortError") {
          throw new LdimsApiError(
            "TIMEOUT",
            `Request timeout after ${this.config.timeout}ms`
          );
        }

        if (_error.message.includes("fetch")) {
          throw new LdimsApiError(
            "NETWORK_ERROR",
            `Network request failed: ${_error.message}`
          );
        }

        throw new LdimsApiError(
          "INTERNAL_ERROR",
          `Internal error: ${_error.message}`
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
    } catch (_error) {
      console.warn("[LDIMS API] 健康检查失败:", _error);
      return false;
    }
  }

  /**
   * 获取API配置信息
   */
  getConfig(): Readonly<LdimsApiConfig> {
    return { ...this.config };
  }

  /**
   * 搜索文档
   */
  async searchDocuments(
    params: z.infer<typeof SearchDocumentsSchema>
  ): Promise<SearchDocumentsResponse | McpErrorResponse> {
    try {
      this.logger.debug("搜索文档请求", {
        query: params.query,
        maxResults: params.maxResults,
        filters: params.filters,
      });

      // 构建查询参数
      const queryParams = new URLSearchParams({
        query: params.query,
        limit: String(params.maxResults ?? 5),
      });

      // 添加过滤条件
      if (params.filters) {
        if (params.filters.dateFrom)
          queryParams.append("date_from", params.filters.dateFrom);
        if (params.filters.dateTo)
          queryParams.append("date_to", params.filters.dateTo);
        if (params.filters.documentType)
          queryParams.append("document_type", params.filters.documentType);
        if (params.filters.submitter)
          queryParams.append("submitter", params.filters.submitter);
        if (params.filters.searchMode)
          queryParams.append("search_mode", params.filters.searchMode);
      }

      const startTime = Date.now();
      const response = await this.makeRequest(
        `/api/v1/documents/search?${queryParams.toString()}`
      );
      const executionTime = `${Date.now() - startTime}ms`;

      // 处理API响应并转换为MCP格式
      const searchResults: SearchDocumentsResponse = {
        results: (response.data?.results ?? []).map((result: any) => ({
          documentId: result.document_id ?? result.id,
          documentName: result.document_name ?? result.name ?? "未知文档",
          relevanceScore: result.relevance_score ?? result.score ?? 0.5,
          matchedContext:
            result.matched_context ??
            result.snippet ??
            result.content?.substring(0, 200) ??
            "",
          metadata: {
            createdAt:
              result.created_at ?? result.createdAt ?? new Date().toISOString(),
            submitter: result.submitter ?? result.author ?? "未知",
            documentType:
              result.document_type ??
              result.type ??
              result.file_type ??
              "未知类型",
            departmentName: result.department_name ?? result.department,
            handoverDate: result.handover_date ?? result.handoverDate,
          },
        })),
        totalMatches:
          response.data?.total ??
          response.data?.count ??
          response.data?.results?.length ??
          0,
        searchMetadata: {
          executionTime,
          searchMode: params.filters?.searchMode ?? "semantic",
          queryProcessed: params.query,
        },
      };

      this.logger.info("文档搜索完成", {
        query: params.query,
        resultsCount: searchResults.results.length,
        executionTime,
      });

      return searchResults;
    } catch (_error) {
      this.logger.error("文档搜索失败", _error);

      return {
        isError: true,
        errorCode: "SEARCH_FAILED",
        errorMessage: _error instanceof Error ? _error.message : "搜索失败",
        errorDetails: { query: params.query, filters: params.filters },
      };
    }
  }

  /**
   * 获取文档的提取内容
   */
  async getDocumentExtractedContent(
    documentId: string
  ): Promise<DocumentExtractedContentResponse | McpErrorResponse> {
    try {
      this.logger.debug("获取文档提取内容", { documentId });

      const response = await this.makeRequest(
        `/api/v1/documents/${documentId}/extracted-content`
      );

      const result: DocumentExtractedContentResponse = {
        uri: `ldims://docs/${documentId}/extracted_content`,
        text:
          response.data?.content ??
          response.data?.text ??
          response.data?.extracted_content ??
          "",
        metadata: {
          documentName:
            response.data?.document_name ??
            response.data?.name ??
            `文档-${documentId}`,
          extractedAt:
            response.data?.extracted_at ??
            response.data?.extractedAt ??
            new Date().toISOString(),
          format:
            response.data?.format ??
            response.data?.content_type ??
            "text/plain",
          documentId,
          fileSize: response.data?.file_size ?? response.data?.size,
          processingStatus:
            response.data?.processing_status ??
            response.data?.status ??
            "completed",
        },
      };

      this.logger.info("文档内容提取完成", {
        documentId,
        contentLength: result.text.length,
        format: result.metadata.format,
      });

      return result;
    } catch (_error) {
      this.logger.error("文档内容提取失败", _error);

      return {
        isError: true,
        errorCode: "CONTENT_EXTRACTION_FAILED",
        errorMessage: _error instanceof Error ? _error.message : "内容提取失败",
        errorDetails: { documentId },
      };
    }
  }
}

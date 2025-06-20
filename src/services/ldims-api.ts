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
  SearchDocumentsSchema
} from "../types/mcp.js";

/**
 * LDIMS API响应结构 - 匹配真实后端格式
 */
const LdimsDocumentFileResponse = z.object({
  success: z.boolean(),
  data: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      fileName: z.string().optional(),
      extractedContent: z.string().optional(),
      fileSize: z.number().optional(),
      fileType: z.string().optional(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
      processingStatus: z.string().optional()
    })
    .optional(),
  message: z.string().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional()
    })
    .optional()
});

/**
 * LDIMS 文档搜索API响应结构 - 匹配后端实际格式
 */
const LdimsSearchResponse = z.object({
  code: z.number(),
  message: z.string(),
  data: z
    .object({
      list: z.array(
        z.object({
          id: z.union([z.string(), z.number()]),
          docName: z.string().nullish(),
          extractedContent: z.string().nullish(),
          remarks: z.string().nullish(),
          createdAt: z.string().nullish(),
          submitter: z.string().nullish(),
          docTypeName: z.string().nullish(),
          sourceDepartmentName: z.string().nullish(),
          departmentName: z.string().nullish(),
          handoverDate: z.string().nullish(),
          fileCount: z.number().nullish(),
          files: z
            .array(
              z.object({
                id: z.number(),
                fileName: z.string(),
                extractedContent: z.string().nullish(),
                fileType: z.string().nullish(),
                processingStatus: z.string().nullish()
              })
            )
            .optional()
        })
      ),
      total: z.number(),
      page: z.number().nullish(),
      pageSize: z.number().nullish()
    })
    .nullish()
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
      "User-Agent": "LDIMS-MCP-Service/1.0.0"
    };

    if (this.config.authToken) {
      headers["Authorization"] = `Bearer ${this.config.authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout ?? 30000);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal
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
      // 构建API URL - 匹配LDIMS后端实际端点
      const url = `${this.config.baseUrl}/api/v1/documents/files/${fileId}/content`;

      // 构建请求参数
      const params = new URLSearchParams({
        include_metadata: includeMetadata.toString(),
        format: format
      });

      // 构建请求头
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "LDIMS-MCP-Service/1.0.0"
      };

      // 添加认证头（如果有）
      if (this.config.authToken) {
        headers["Authorization"] = `Bearer ${this.config.authToken}`;
      }

      console.log(`[LDIMS API] 请求文档文件内容: ${fileId}`);
      console.log(`[LDIMS API] URL: ${url}?${params.toString()}`);

      // 发送HTTP请求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(`${url}?${params.toString()}`, {
          method: "GET",
          headers,
          signal: controller.signal
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

        // 转换为MCP格式 - 处理LDIMS API响应格式
        const result: DocumentFileContentResponse = {
          file_id: String(validatedResponse.data.id ?? fileId),
          content: validatedResponse.data.extractedContent ?? "",
          format: format,
          ...(includeMetadata && {
            metadata: {
              filename: validatedResponse.data.fileName ?? "未知文件",
              size: validatedResponse.data.fileSize ?? 0,
              created_at: validatedResponse.data.createdAt ?? new Date().toISOString(),
              mime_type: validatedResponse.data.fileType ?? "text/plain",
              ...(validatedResponse.data.updatedAt && {
                updated_at: validatedResponse.data.updatedAt
              })
            }
          })
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
          throw new LdimsApiError("TIMEOUT", `Request timeout after ${this.config.timeout}ms`);
        }

        if (_error.message.includes("fetch")) {
          throw new LdimsApiError("NETWORK_ERROR", `Network request failed: ${_error.message}`);
        }

        throw new LdimsApiError("INTERNAL_ERROR", `Internal error: ${_error.message}`);
      }

      throw new LdimsApiError("UNKNOWN_ERROR", "An unknown error occurred");
    }
  }

  /**
   * 检查API连接状态
   */
  async checkHealth(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl}/api/v1/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal
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
        filters: params.filters
      });

      // 构建查询参数 - 匹配LDIMS后端API
      const queryParams = new URLSearchParams({
        searchText: params.query,
        pageSize: String(params.maxResults ?? 10),
        page: "1"
      });

      // 添加过滤条件
      if (params.filters) {
        if (params.filters.dateFrom) queryParams.append("startDate", params.filters.dateFrom);
        if (params.filters.dateTo) queryParams.append("endDate", params.filters.dateTo);
        if (params.filters.documentType) queryParams.append("docTypeName", params.filters.documentType);
        if (params.filters.submitter) queryParams.append("submitter", params.filters.submitter);
        // 排序参数
        queryParams.append("sortField", "createdAt");
        queryParams.append("sortOrder", "DESC");
      }

      const startTime = Date.now();
      const response = await this.makeRequest(`/api/v1/documents/search/content?${queryParams.toString()}`);
      const executionTime = `${Date.now() - startTime}ms`;

      // 验证响应格式
      const validatedResponse = LdimsSearchResponse.parse(response);

      if (validatedResponse.code !== 200) {
        throw new LdimsApiError("SEARCH_FAILED", validatedResponse.message ?? "搜索请求失败");
      }

      if (!validatedResponse.data) {
        throw new LdimsApiError("NO_DATA", "搜索响应缺少数据");
      }

      // 处理LDIMS API响应并转换为MCP格式
      const searchResults: SearchDocumentsResponse = {
        results: (validatedResponse.data.list ?? []).map((result: any) => {
          // 智能处理匹配内容显示：优先显示文件的extractedContent，然后是remarks
          let matchedContext = "";

          // 如果有文件且包含extractedContent，优先显示
          if (result.files && result.files.length > 0) {
            const filesWithContent = result.files.filter(
              (file: any) => file.extractedContent && file.extractedContent.trim()
            );
            if (filesWithContent.length > 0) {
              // 合并所有文件的提取内容
              matchedContext = filesWithContent
                .map((file: any) => `[${file.fileName}]:\n${file.extractedContent}`)
                .join("\n\n---\n\n");
            }
          }

          // 如果没有文件内容，回退到文档级别的remarks
          if (!matchedContext && result.remarks) {
            matchedContext = `[文档备注]: ${result.remarks}`;
          }

          return {
            documentId: String(result.id),
            documentName: result.docName ?? "未知文档",
            relevanceScore: 0.8, // 暂时固定相关度分数，后续可根据搜索算法优化
            matchedContext,
            metadata: {
              createdAt: result.createdAt ?? new Date().toISOString(),
              submitter: result.submitter ?? "未知",
              documentType: result.docTypeName ?? "未知类型",
              departmentName: result.sourceDepartmentName ?? result.departmentName ?? "未知部门",
              handoverDate: result.handoverDate
            }
          };
        }),
        totalMatches: validatedResponse.data.total ?? 0,
        searchMetadata: {
          executionTime,
          searchMode: params.filters?.searchMode ?? "semantic",
          queryProcessed: params.query
        }
      };

      this.logger.info("文档搜索完成", {
        query: params.query,
        resultsCount: searchResults.results.length,
        executionTime
      });

      return searchResults;
    } catch (_error) {
      this.logger.error("文档搜索失败", _error);

      return {
        isError: true,
        errorCode: "SEARCH_FAILED",
        errorMessage: _error instanceof Error ? _error.message : "搜索失败",
        errorDetails: { query: params.query, filters: params.filters }
      };
    }
  }

  /**
   * 获取文档的提取内容
   */
  async getDocumentExtractedContent(documentId: string): Promise<DocumentExtractedContentResponse | McpErrorResponse> {
    try {
      this.logger.debug("获取文档提取内容", { documentId });

      // 使用文件内容API端点，documentId实际上是fileId
      const response = await this.makeRequest(`/api/v1/documents/files/${documentId}/content`);

      // 处理LDIMS API响应格式: { success: true, data: { fileName, extractedContent, processingStatus, ... }}
      const result: DocumentExtractedContentResponse = {
        uri: `ldims://docs/${documentId}/extracted_content`,
        text: response.data?.extractedContent ?? "",
        metadata: {
          documentName: response.data?.fileName ?? `文档-${documentId}`,
          extractedAt: response.data?.updatedAt ?? response.data?.createdAt ?? new Date().toISOString(),
          format: response.data?.fileType ?? "text/plain",
          documentId,
          fileSize: response.data?.fileSize ?? 0,
          processingStatus: response.data?.processingStatus ?? "completed"
        }
      };

      this.logger.info("文档内容提取完成", {
        documentId,
        contentLength: result.text.length,
        format: result.metadata.format
      });

      return result;
    } catch (_error) {
      this.logger.error("文档内容提取失败", _error);

      return {
        isError: true,
        errorCode: "CONTENT_EXTRACTION_FAILED",
        errorMessage: _error instanceof Error ? _error.message : "内容提取失败",
        errorDetails: { documentId }
      };
    }
  }
}

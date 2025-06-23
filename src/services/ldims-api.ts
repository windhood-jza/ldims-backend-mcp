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

      console.log(`[LDIMS API] 请求文档文件内容: ${fileId}`);
      console.log(`[LDIMS API] URL: ${url}?${params.toString()}`);

      // 构建请求头
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "LDIMS-MCP-Service/1.0.0"
      };

      // 添加认证头（如果有）
      if (this.config.authToken) {
        headers["Authorization"] = `Bearer ${this.config.authToken}`;
      }

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
      // 验证输入参数
      const validatedParams = SearchDocumentsSchema.parse(params);
      const { query, maxResults, filters } = validatedParams;

      // 构建API URL
      const urlParams = new URLSearchParams({
        keyword: query,
        page: "1",
        pageSize: (maxResults ?? 10).toString()
      });

      // **添加过滤条件**
      if (filters?.documentType) {
        urlParams.append("docTypeName", filters.documentType);
      }

      const url = `/api/v1/documents/search?${urlParams.toString()}`;

      this.logger.log(`[LDIMS API] 搜索文档: ${url}`);
      const startTime = Date.now();
      const responseData = await this.makeRequest(url);

      // 验证响应格式
      const validatedResponse = LdimsSearchResponse.parse(responseData);

      if (validatedResponse.code !== 200) {
        throw new LdimsApiError("SEARCH_FAILED", validatedResponse.message ?? "搜索请求失败");
      }

      if (!validatedResponse.data) {
        throw new LdimsApiError("NO_DATA", "搜索响应缺少数据");
      }

      // 处理LDIMS API响应并转换为MCP格式 - 优化为AI对话场景
      const searchResults: SearchDocumentsResponse = {
        results: (validatedResponse.data.list ?? []).map((result: any) => {
          // 构建完整的文档内容，包含所有文件的完整内容
          let fullContent = "";
          const fileDetails: Array<{ fileId: string; fileName: string; contentLength: number }> = [];

          // 处理文档的所有文件
          if (result.files && result.files.length > 0) {
            const contentParts: string[] = [];

            result.files.forEach((file: any, index: number) => {
              if (file.extractedContent && file.extractedContent.trim()) {
                // 为每个文件添加清晰的分隔标识
                const fileHeader = `=== 文件 ${index + 1}: ${file.fileName} ===`;
                const fileContent = file.extractedContent.trim();
                contentParts.push(`${fileHeader}\n${fileContent}`);

                // 记录文件详情
                fileDetails.push({
                  fileId: String(file.id),
                  fileName: file.fileName || `文件${index + 1}`,
                  contentLength: fileContent.length
                });
              }
            });

            // 合并所有文件内容
            if (contentParts.length > 0) {
              fullContent = contentParts.join("\n\n" + "=".repeat(50) + "\n\n");
            }
          }

          // 如果没有文件内容，使用文档备注
          if (!fullContent && result.remarks) {
            fullContent = `[文档说明]\n${result.remarks}`;
          }

          // 如果仍然没有内容，提供基本信息
          if (!fullContent) {
            fullContent = `[文档信息]\n文档名称: ${result.docName}\n文档类型: ${result.docTypeName}\n提交人: ${result.submitter}\n创建时间: ${result.createdAt}`;
          }

          return {
            documentId: String(result.id),
            documentName: result.docName ?? "未知文档",
            relevanceScore: 0.8,
            matchedContext: fullContent, // 现在包含完整内容，不再截断
            metadata: {
              createdAt: result.createdAt ?? new Date().toISOString(),
              submitter: result.submitter ?? "未知",
              documentType: result.docTypeName ?? "未知类型",
              departmentName: result.sourceDepartmentName ?? result.departmentName ?? "未知部门",
              handoverDate: result.handoverDate,
              // 新增：文件详情信息，便于AI理解文档结构
              fileCount: result.files?.length ?? 0,
              fileDetails: fileDetails,
              totalContentLength: fullContent.length,
              hasMultipleFiles: (result.files?.length ?? 0) > 1
            }
          };
        }),
        totalMatches: validatedResponse.data.total ?? 0,
        searchMetadata: {
          executionTime: `${Date.now() - startTime}ms`,
          searchMode: params.filters?.searchMode ?? "semantic",
          queryProcessed: params.query,
          // 新增：内容处理元数据
          contentProcessing: {
            fullContentReturned: true,
            contentNotTruncated: true,
            optimizedForAI: true
          }
        }
      };

      this.logger.info("文档搜索完成（增强版）", {
        query: params.query,
        resultsCount: searchResults.results.length,
        executionTime: `${Date.now() - startTime}ms`,
        totalContentLength: searchResults.results.reduce((sum, r) => sum + r.matchedContext.length, 0),
        avgContentLength:
          searchResults.results.length > 0
            ? Math.round(
                searchResults.results.reduce((sum, r) => sum + r.matchedContext.length, 0) /
                  searchResults.results.length
              )
            : 0
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

      // 首先尝试通过文档ID获取文档信息和所有文件
      const documentResponse = await this.makeRequest(`/api/v1/documents/${documentId}`);

      if (!documentResponse.success || !documentResponse.data) {
        // 如果获取文档信息失败，尝试直接作为文件ID处理
        return await this.getDocumentFileContentById(documentId);
      }

      const document = documentResponse.data;
      let fullContent = "";
      let totalFiles = 0;
      let processedFiles = 0;

      // 如果文档有文件列表，获取所有文件的内容
      if (document.files && document.files.length > 0) {
        totalFiles = document.files.length;
        const contentParts: string[] = [];

        for (const [index, file] of document.files.entries()) {
          try {
            if (file.extractedContent && file.extractedContent.trim()) {
              // 直接使用已提取的内容
              const fileHeader = `=== 文件 ${index + 1}: ${file.fileName || `文件${file.id}`} ===`;
              contentParts.push(`${fileHeader}\n${file.extractedContent.trim()}`);
              processedFiles++;
            } else if (file.id) {
              // 尝试获取文件的提取内容
              try {
                const fileContentResponse = await this.makeRequest(`/api/v1/documents/files/${file.id}/content`);
                if (fileContentResponse.success && fileContentResponse.data?.extractedContent) {
                  const fileHeader = `=== 文件 ${index + 1}: ${file.fileName || `文件${file.id}`} ===`;
                  contentParts.push(`${fileHeader}\n${fileContentResponse.data.extractedContent.trim()}`);
                  processedFiles++;
                }
              } catch (fileError) {
                this.logger.warn(`获取文件 ${file.id} 内容失败:`, fileError);
              }
            }
          } catch (fileError) {
            this.logger.warn(`处理文件 ${file.id || index} 时出错:`, fileError);
          }
        }

        if (contentParts.length > 0) {
          fullContent = contentParts.join("\n\n" + "=".repeat(50) + "\n\n");
        }
      }

      // 如果没有获取到文件内容，使用文档基本信息
      if (!fullContent) {
        const docInfo = [
          `文档名称: ${document.docName || "未知"}`,
          `文档类型: ${document.docTypeName || "未知"}`,
          `提交人: ${document.submitter || "未知"}`,
          `创建时间: ${document.createdAt || "未知"}`,
          `部门: ${document.departmentName || document.sourceDepartmentName || "未知"}`
        ];

        if (document.remarks) {
          docInfo.push(`文档说明: ${document.remarks}`);
        }

        fullContent = `[文档基本信息]\n${docInfo.join("\n")}`;
      }

      const result: DocumentExtractedContentResponse = {
        uri: `ldims://docs/${documentId}/extracted_content`,
        text: fullContent,
        metadata: {
          documentName: document.docName || `文档-${documentId}`,
          extractedAt: new Date().toISOString(),
          format: "text/plain",
          documentId,
          fileSize: fullContent.length,
          processingStatus: "completed",
          // 新增元数据
          totalFiles,
          processedFiles,
          documentType: document.docTypeName,
          submitter: document.submitter,
          createdAt: document.createdAt,
          departmentName: document.departmentName || document.sourceDepartmentName
        }
      };

      this.logger.info("文档内容提取完成（增强版）", {
        documentId,
        contentLength: result.text.length,
        totalFiles,
        processedFiles,
        format: result.metadata.format
      });

      return result;
    } catch (_error) {
      this.logger.error("文档内容提取失败", _error);

      // 如果作为文档ID失败，尝试作为文件ID处理
      if (_error instanceof LdimsApiError && _error.code.includes("404")) {
        this.logger.debug("尝试将ID作为文件ID处理", { documentId });
        return await this.getDocumentFileContentById(documentId);
      }

      return {
        isError: true,
        errorCode: "CONTENT_EXTRACTION_FAILED",
        errorMessage: _error instanceof Error ? _error.message : "内容提取失败",
        errorDetails: { documentId }
      };
    }
  }

  /**
   * 通过文件ID获取文档内容（兼容性方法）
   */
  private async getDocumentFileContentById(
    fileId: string
  ): Promise<DocumentExtractedContentResponse | McpErrorResponse> {
    try {
      this.logger.debug("通过文件ID获取内容", { fileId });

      const response = await this.makeRequest(`/api/v1/documents/files/${fileId}/content`);

      if (!response.success || !response.data) {
        throw new LdimsApiError("FILE_NOT_FOUND", `文件 ${fileId} 不存在或无法访问`);
      }

      const result: DocumentExtractedContentResponse = {
        uri: `ldims://docs/${fileId}/extracted_content`,
        text: response.data.extractedContent || "",
        metadata: {
          documentName: response.data.fileName || `文件-${fileId}`,
          extractedAt: response.data.updatedAt || response.data.createdAt || new Date().toISOString(),
          format: response.data.fileType || "text/plain",
          documentId: fileId,
          fileSize: response.data.fileSize || 0,
          processingStatus: response.data.processingStatus || "completed"
        }
      };

      this.logger.info("文件内容获取完成", {
        fileId,
        contentLength: result.text.length,
        format: result.metadata.format
      });

      return result;
    } catch (_error) {
      this.logger.error("文件内容获取失败", _error);

      return {
        isError: true,
        errorCode: "FILE_CONTENT_EXTRACTION_FAILED",
        errorMessage: _error instanceof Error ? _error.message : "文件内容提取失败",
        errorDetails: { fileId }
      };
    }
  }
}

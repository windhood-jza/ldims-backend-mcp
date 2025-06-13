/**
 * LDIMS API 服务单元测试
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { LdimsApiService, LdimsApiError } from '../../src/services/ldims-api.js';
import type { LdimsApiConfig } from '../../src/types/mcp.js';

// 模拟fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('LDIMS API 服务', () => {
  let apiService: LdimsApiService;
  let mockConfig: LdimsApiConfig;

  beforeEach(() => {
    mockConfig = {
      baseUrl: 'http://localhost:3000/api',
      version: 'v1',
      timeout: 30000,
      authToken: 'test-token'
    };
    
    apiService = new LdimsApiService(mockConfig);
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数', () => {
    test('应该正确初始化配置', () => {
      const config = apiService.getConfig();
      
      expect(config.baseUrl).toBe('http://localhost:3000/api');
      expect(config.version).toBe('v1');
      expect(config.timeout).toBe(30000);
      expect(config.authToken).toBe('test-token');
    });
  });

  describe('healthCheck', () => {
    test('应该在API健康时返回true', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ status: 'healthy' })
      } as unknown as Response;
      
      mockFetch.mockResolvedValue(mockResponse);
      
      const result = await apiService.healthCheck();
      
      expect(result.isHealthy).toBe(true);
    });

    test('应该在API故障时返回false', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as unknown as Response;
      
      mockFetch.mockResolvedValue(mockResponse);
      
      const result = await apiService.healthCheck();
      
      expect(result.isHealthy).toBe(false);
    });
  });

  describe('getDocumentFileContent', () => {
    test('应该成功获取文档内容', async () => {
      const mockResponseData = {
        success: true,
        data: {
          file_id: 'test-file-123',
          filename: 'test.pdf',
          content: 'Base64EncodedContent',
          size: 1024,
          mime_type: 'application/pdf',
          created_at: '2024-01-01T00:00:00Z'
        }
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponseData)
      } as unknown as Response;
      
      mockFetch.mockResolvedValue(mockResponse);
      
      const result = await apiService.getDocumentFileContent('test-file-123');
      
      expect(result.file_id).toBe('test-file-123');
      expect(result.content).toBe('Base64EncodedContent');
      expect(result.format).toBe('text');
    });

    test('应该处理API错误响应', async () => {
      const mockResponseData = {
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found'
        }
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponseData)
      } as unknown as Response;
      
      mockFetch.mockResolvedValue(mockResponse);
      
      await expect(apiService.getDocumentFileContent('nonexistent'))
        .rejects.toThrow(LdimsApiError);
    });
  });

  describe('searchDocuments', () => {
    test('应该成功搜索文档', async () => {
      const mockResponseData = {
        data: {
          results: [
            {
              document_id: 'doc-123',
              document_name: '测试文档',
              relevance_score: 0.95,
              matched_context: '这是测试文档的内容片段',
              created_at: '2024-01-01T00:00:00Z',
              submitter: '张三',
              document_type: 'PDF'
            }
          ],
          total: 1
        }
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponseData)
      } as unknown as Response;
      
      mockFetch.mockResolvedValue(mockResponse);
      
      const result = await apiService.searchDocuments({
        query: '测试文档',
        maxResults: 5
      });
      
      expect('isError' in result).toBe(false);
      if (!('isError' in result)) {
        expect(result.results).toHaveLength(1);
        expect(result.results[0].documentName).toBe('测试文档');
        expect(result.totalMatches).toBe(1);
      }
    });

    test('应该处理搜索错误', async () => {
      mockFetch.mockRejectedValue(new Error('Search failed'));
      
      const result = await apiService.searchDocuments({
        query: '测试查询'
      });
      
      expect('isError' in result).toBe(true);
      if ('isError' in result) {
        expect(result.errorCode).toBe('SEARCH_FAILED');
      }
    });
  });

  describe('getDocumentExtractedContent', () => {
    test('应该成功获取提取内容', async () => {
      const mockResponseData = {
        data: {
          content: '这是提取的文档内容',
          document_name: '测试文档.pdf',
          extracted_at: '2024-01-01T00:00:00Z',
          format: 'text/plain'
        }
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponseData)
      } as unknown as Response;
      
      mockFetch.mockResolvedValue(mockResponse);
      
      const result = await apiService.getDocumentExtractedContent('doc-123');
      
      expect('isError' in result).toBe(false);
      if (!('isError' in result)) {
        expect(result.text).toBe('这是提取的文档内容');
        expect(result.metadata.documentName).toBe('测试文档.pdf');
        expect(result.uri).toBe('ldims://docs/doc-123/extracted_content');
      }
    });

    test('应该处理内容提取错误', async () => {
      mockFetch.mockRejectedValue(new Error('Extraction failed'));
      
      const result = await apiService.getDocumentExtractedContent('doc-123');
      
      expect('isError' in result).toBe(true);
      if ('isError' in result) {
        expect(result.errorCode).toBe('CONTENT_EXTRACTION_FAILED');
      }
    });
  });

  describe('checkHealth', () => {
    test('应该快速检查健康状态', async () => {
      const mockResponse = {
        ok: true
      } as unknown as Response;
      
      mockFetch.mockResolvedValue(mockResponse);
      
      const result = await apiService.checkHealth();
      
      expect(result).toBe(true);
    });

    test('应该在连接失败时返回false', async () => {
      mockFetch.mockRejectedValue(new Error('Connection failed'));
      
      const result = await apiService.checkHealth();
      
      expect(result).toBe(false);
    });
  });
});
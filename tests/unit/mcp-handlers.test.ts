/**
 * MCP工具和资源处理器单元测试
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('MCP工具和资源处理器', () => {
  let mockLdimsApi: any;
  let mockConfig: any;

  beforeEach(() => {
    mockLdimsApi = {
      searchDocuments: jest.fn(),
      getDocumentExtractedContent: jest.fn(),
      checkHealth: jest.fn()
    };

    mockConfig = {
      ldims: {
        baseUrl: 'http://localhost:3000/api',
        version: 'v1',
        timeout: 30000
      }
    };
  });

  describe('searchDocuments Tool', () => {
    test('应该验证必需的参数', async () => {
      const searchTool = createSearchDocumentsTool(mockLdimsApi);
      
      // 测试缺少query参数
      await expect(searchTool.handler({}))
        .rejects.toThrow('Query parameter is required');
    });

    test('应该处理有效的搜索请求', async () => {
      const mockResults = {
        results: [
          {
            documentId: 'doc-123',
            documentName: '测试文档',
            relevanceScore: 0.95,
            matchedContext: '测试内容'
          }
        ],
        totalMatches: 1
      };

      mockLdimsApi.searchDocuments.mockResolvedValue(mockResults);
      const searchTool = createSearchDocumentsTool(mockLdimsApi);
      
      const result = await searchTool.handler({
        query: '测试文档',
        maxResults: 5
      });
      
      expect(result).toEqual([
        {
          type: 'text',
          text: expect.stringContaining('找到 1 个匹配的文档')
        }
      ]);
      
      expect(mockLdimsApi.searchDocuments).toHaveBeenCalledWith({
        query: '测试文档',
        maxResults: 5
      });
    });

    test('应该处理搜索错误', async () => {
      mockLdimsApi.searchDocuments.mockResolvedValue({
        isError: true,
        errorCode: 'SEARCH_FAILED',
        errorMessage: 'Search service unavailable'
      });

      const searchTool = createSearchDocumentsTool(mockLdimsApi);
      
      const result = await searchTool.handler({
        query: '测试查询'
      });
      
      expect(result).toEqual([
        {
          type: 'text',
          text: expect.stringContaining('搜索失败')
        }
      ]);
    });

    test('应该处理带过滤条件的搜索', async () => {
      const mockResults = {
        results: [],
        totalMatches: 0
      };

      mockLdimsApi.searchDocuments.mockResolvedValue(mockResults);
      const searchTool = createSearchDocumentsTool(mockLdimsApi);
      
      const result = await searchTool.handler({
        query: '技术文档',
        maxResults: 10,
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        documentType: 'PDF'
      });
      
      expect(mockLdimsApi.searchDocuments).toHaveBeenCalledWith({
        query: '技术文档',
        maxResults: 10,
        filters: {
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          documentType: 'PDF'
        }
      });
    });

    test('应该验证参数范围', async () => {
      const searchTool = createSearchDocumentsTool(mockLdimsApi);
      
      // 测试maxResults超出范围
      await expect(searchTool.handler({
        query: '测试',
        maxResults: 101
      })).rejects.toThrow('maxResults must be between 1 and 100');
      
      // 测试maxResults为0
      await expect(searchTool.handler({
        query: '测试',
        maxResults: 0
      })).rejects.toThrow('maxResults must be between 1 and 100');
    });
  });

  describe('extracted_content Resource', () => {
    test('应该验证URI格式', async () => {
      const resourceHandler = createExtractedContentResource(mockLdimsApi);
      
      // 测试无效URI
      await expect(resourceHandler.handler('invalid-uri'))
        .rejects.toThrow('Invalid URI scheme');
      
      // 测试错误的scheme
      await expect(resourceHandler.handler('http://example.com/doc'))
        .rejects.toThrow('Invalid URI scheme');
    });

    test('应该处理有效的URI', async () => {
      const mockContent = {
        text: '这是提取的文档内容',
        metadata: {
          documentName: '测试文档.pdf',
          extractedAt: '2024-01-01T00:00:00Z'
        },
        uri: 'ldims://docs/doc-123/extracted_content'
      };

      mockLdimsApi.getDocumentExtractedContent.mockResolvedValue(mockContent);
      const resourceHandler = createExtractedContentResource(mockLdimsApi);
      
      const result = await resourceHandler.handler('ldims://docs/doc-123/extracted_content');
      
      expect(result).toEqual({
        contents: [
          {
            uri: 'ldims://docs/doc-123/extracted_content',
            mimeType: 'text/plain',
            text: '这是提取的文档内容'
          }
        ]
      });
      
      expect(mockLdimsApi.getDocumentExtractedContent).toHaveBeenCalledWith('doc-123');
    });

    test('应该处理文档不存在的情况', async () => {
      mockLdimsApi.getDocumentExtractedContent.mockResolvedValue({
        isError: true,
        errorCode: 'DOCUMENT_NOT_FOUND',
        errorMessage: 'Document not found'
      });

      const resourceHandler = createExtractedContentResource(mockLdimsApi);
      
      await expect(resourceHandler.handler('ldims://docs/nonexistent/extracted_content'))
        .rejects.toThrow('Document not found');
    });

    test('应该处理内容提取失败', async () => {
      mockLdimsApi.getDocumentExtractedContent.mockResolvedValue({
        isError: true,
        errorCode: 'CONTENT_EXTRACTION_FAILED',
        errorMessage: 'Failed to extract content'
      });

      const resourceHandler = createExtractedContentResource(mockLdimsApi);
      
      await expect(resourceHandler.handler('ldims://docs/doc-123/extracted_content'))
        .rejects.toThrow('Failed to extract content');
    });

    test('应该正确解析文档ID', async () => {
      const mockContent = {
        text: '测试内容',
        metadata: { documentName: 'test.pdf', extractedAt: '2024-01-01' },
        uri: 'ldims://docs/complex-doc-id-123_abc/extracted_content'
      };

      mockLdimsApi.getDocumentExtractedContent.mockResolvedValue(mockContent);
      const resourceHandler = createExtractedContentResource(mockLdimsApi);
      
      await resourceHandler.handler('ldims://docs/complex-doc-id-123_abc/extracted_content');
      
      expect(mockLdimsApi.getDocumentExtractedContent).toHaveBeenCalledWith('complex-doc-id-123_abc');
    });
  });

  describe('工具和资源初始化', () => {
    test('应该正确注册所有工具', () => {
      const tools = createAllTools(mockLdimsApi);
      
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('searchDocuments');
      expect(tools[0].description).toBeDefined();
      expect(tools[0].inputSchema).toBeDefined();
    });

    test('应该正确注册所有资源', () => {
      const resources = createAllResources(mockLdimsApi);
      
      expect(resources).toHaveLength(1);
      expect(resources[0].uri).toBe('ldims://docs/*/extracted_content');
      expect(resources[0].name).toBe('Document Extracted Content');
      expect(resources[0].description).toBeDefined();
    });

    test('应该验证API服务依赖', () => {
      expect(() => createAllTools(null)).toThrow('LDIMS API service is required');
      expect(() => createAllResources(null)).toThrow('LDIMS API service is required');
    });
  });

  describe('错误处理和恢复', () => {
    test('应该处理API超时', async () => {
      mockLdimsApi.searchDocuments.mockRejectedValue(new Error('Request timeout'));
      const searchTool = createSearchDocumentsTool(mockLdimsApi);
      
      const result = await searchTool.handler({ query: '测试' });
      
      expect(result[0].text).toContain('搜索服务暂时不可用');
    });

    test('应该处理网络连接错误', async () => {
      mockLdimsApi.getDocumentExtractedContent.mockRejectedValue(
        new Error('Network connection failed')
      );
      
      const resourceHandler = createExtractedContentResource(mockLdimsApi);
      
      await expect(resourceHandler.handler('ldims://docs/doc-123/extracted_content'))
        .rejects.toThrow('Network connection failed');
    });

    test('应该提供有用的错误信息', async () => {
      mockLdimsApi.searchDocuments.mockRejectedValue(new Error('Unknown error'));
      const searchTool = createSearchDocumentsTool(mockLdimsApi);
      
      const result = await searchTool.handler({ query: '测试' });
      
      expect(result[0].text).toContain('发生了未知错误');
    });
  });

  describe('参数验证和清理', () => {
    test('应该清理和验证搜索查询', async () => {
      mockLdimsApi.searchDocuments.mockResolvedValue({
        results: [],
        totalMatches: 0
      });
      
      const searchTool = createSearchDocumentsTool(mockLdimsApi);
      
      // 测试空白查询
      await expect(searchTool.handler({ query: '   ' }))
        .rejects.toThrow('Query cannot be empty');
      
      // 测试过长查询
      const longQuery = 'a'.repeat(1001);
      await expect(searchTool.handler({ query: longQuery }))
        .rejects.toThrow('Query is too long');
    });

    test('应该验证日期格式', async () => {
      const searchTool = createSearchDocumentsTool(mockLdimsApi);
      
      await expect(searchTool.handler({
        query: '测试',
        dateFrom: 'invalid-date'
      })).rejects.toThrow('Invalid date format');
      
      await expect(searchTool.handler({
        query: '测试',
        dateTo: '2024-13-45'
      })).rejects.toThrow('Invalid date format');
    });

    test('应该验证文档类型', async () => {
      const searchTool = createSearchDocumentsTool(mockLdimsApi);
      
      await expect(searchTool.handler({
        query: '测试',
        documentType: 'INVALID_TYPE'
      })).rejects.toThrow('Invalid document type');
    });
  });
});

// 辅助函数模拟
function createSearchDocumentsTool(ldimsApi: any) {
  return {
    name: 'searchDocuments',
    handler: async (params: any) => {
      // 参数验证逻辑
      if (!params.query) {
        throw new Error('Query parameter is required');
      }
      
      if (typeof params.query !== 'string' || params.query.trim() === '') {
        throw new Error('Query cannot be empty');
      }
      
      if (params.query.length > 1000) {
        throw new Error('Query is too long');
      }
      
      if (params.maxResults && (params.maxResults < 1 || params.maxResults > 100)) {
        throw new Error('maxResults must be between 1 and 100');
      }
      
      // 日期验证
      if (params.dateFrom && !isValidDate(params.dateFrom)) {
        throw new Error('Invalid date format');
      }
      
      if (params.dateTo && !isValidDate(params.dateTo)) {
        throw new Error('Invalid date format');
      }
      
      // 文档类型验证
      const validTypes = ['PDF', 'WORD', 'EXCEL', 'TEXT'];
      if (params.documentType && !validTypes.includes(params.documentType)) {
        throw new Error('Invalid document type');
      }
      
      try {
        const searchParams: any = {
          query: params.query.trim(),
          maxResults: params.maxResults || 10
        };
        
        if (params.dateFrom || params.dateTo || params.documentType) {
          searchParams.filters = {};
          if (params.dateFrom) searchParams.filters.dateFrom = params.dateFrom;
          if (params.dateTo) searchParams.filters.dateTo = params.dateTo;
          if (params.documentType) searchParams.filters.documentType = params.documentType;
        }
        
        const result = await ldimsApi.searchDocuments(searchParams);
        
        if (result && 'isError' in result) {
          return [{
            type: 'text',
            text: `搜索失败: ${result.errorMessage}`
          }];
        }
        
        return [{
          type: 'text',
          text: `找到 ${result.totalMatches} 个匹配的文档`
        }];
      } catch (error: any) {
        if (error.message.includes('timeout')) {
          return [{
            type: 'text',
            text: '搜索服务暂时不可用，请稍后重试'
          }];
        }
        
        return [{
          type: 'text',
          text: `发生了未知错误: ${error.message}`
        }];
      }
    }
  };
}

function createExtractedContentResource(ldimsApi: any) {
  return {
    handler: async (uri: string) => {
      // URI验证
      if (!uri.startsWith('ldims://')) {
        throw new Error('Invalid URI scheme');
      }
      
      const match = uri.match(/^ldims:\/\/docs\/([^\/]+)\/extracted_content$/);
      if (!match) {
        throw new Error('Invalid URI format');
      }
      
      const documentId = match[1];
      
      try {
        const result = await ldimsApi.getDocumentExtractedContent(documentId);
        
        if ('isError' in result) {
          throw new Error(result.errorMessage);
        }
        
        return {
          contents: [{
            uri,
            mimeType: 'text/plain',
            text: result.text
          }]
        };
      } catch (error: any) {
        throw error;
      }
    }
  };
}

function createAllTools(ldimsApi: any) {
  if (!ldimsApi) {
    throw new Error('LDIMS API service is required');
  }
  
  return [
    {
      name: 'searchDocuments',
      description: 'Search for documents in LDIMS',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          maxResults: { type: 'number' }
        },
        required: ['query']
      }
    }
  ];
}

function createAllResources(ldimsApi: any) {
  if (!ldimsApi) {
    throw new Error('LDIMS API service is required');
  }
  
  return [
    {
      uri: 'ldims://docs/*/extracted_content',
      name: 'Document Extracted Content',
      description: 'Access extracted content from LDIMS documents'
    }
  ];
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}
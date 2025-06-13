/**
 * 边界条件和错误场景测试
 * 
 * 测试各种边界情况和异常场景
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { LdimsApiService } from '../../src/services/ldims-api.js';
import { ErrorHandler } from '../../src/utils/error-handler.js';
import type { LdimsApiConfig } from '../../src/types/mcp.js';

describe('边界条件和错误场景测试', () => {
  let apiService: LdimsApiService;
  let config: LdimsApiConfig;

  beforeEach(() => {
    config = {
      baseUrl: 'http://localhost:3333/test-api',
      version: 'v1',
      timeout: 5000,
      authToken: 'test-token'
    };
    
    apiService = new LdimsApiService(config);
  });

  describe('输入边界条件测试', () => {
    test('应该处理空字符串查询', async () => {
      const result = await apiService.searchDocuments({
        query: '',
        maxResults: 5
      });
      
      expect('isError' in result).toBe(true);
      if ('isError' in result) {
        expect(result.errorCode).toBe('INVALID_INPUT');
      }
    });

    test('应该处理非常长的查询字符串', async () => {
      const longQuery = 'A'.repeat(10000); // 10KB查询
      
      const result = await apiService.searchDocuments({
        query: longQuery,
        maxResults: 5
      });
      
      // 应该被截断或拒绝
      expect('isError' in result).toBe(true);
      if ('isError' in result) {
        expect(['QUERY_TOO_LONG', 'INVALID_INPUT']).toContain(result.errorCode);
      }
    });

    test('应该处理特殊字符和Unicode', async () => {
      const specialQueries = [
        '中文测试查询 🚀',
        'Test with émojis 😀🎉',
        'Special chars: @#$%^&*()[]{}',
        'SQL injection: \'; DROP TABLE--',
        'XSS: <script>alert("test")</script>',
        'Unicode: ∑∏∆∇∂∫',
        'RTL text: مرحبا بالعالم'
      ];
      
      for (const query of specialQueries) {
        const result = await apiService.searchDocuments({
          query,
          maxResults: 1
        });
        
        // 应该安全处理，不应该崩溃
        expect(result).toBeDefined();
        
        if ('isError' in result) {
          expect(result.errorCode).toBeDefined();
          expect(result.errorMessage).toBeDefined();
        }
      }
    });

    test('应该处理极端的maxResults值', async () => {
      // 测试0
      let result = await apiService.searchDocuments({
        query: '测试',
        maxResults: 0
      });
      expect('isError' in result).toBe(true);
      
      // 测试负数
      result = await apiService.searchDocuments({
        query: '测试',
        maxResults: -5
      });
      expect('isError' in result).toBe(true);
      
      // 测试过大值
      result = await apiService.searchDocuments({
        query: '测试',
        maxResults: 999999
      });
      expect('isError' in result).toBe(true);
    });

    test('应该处理无效的文档ID格式', async () => {
      const invalidIds = [
        '',
        ' ',
        '../../etc/passwd',
        '<script>',
        'null',
        'undefined',
        '非法字符@#$%',
        'x'.repeat(1000), // 过长ID
        '\\x00\\x01\\x02' // 控制字符
      ];
      
      for (const invalidId of invalidIds) {
        const result = await apiService.getDocumentExtractedContent(invalidId);
        
        expect('isError' in result).toBe(true);
        if ('isError' in result) {
          expect(['INVALID_DOCUMENT_ID', 'DOCUMENT_NOT_FOUND']).toContain(result.errorCode);
        }
      }
    });
  });

  describe('网络错误场景测试', () => {
    test('应该处理DNS解析失败', async () => {
      const badConfig = {
        ...config,
        baseUrl: 'http://nonexistent-domain-12345.com/api'
      };
      
      const badApiService = new LdimsApiService(badConfig);
      
      const result = await badApiService.searchDocuments({
        query: '测试',
        maxResults: 5
      });
      
      expect('isError' in result).toBe(true);
      if ('isError' in result) {
        expect(result.errorCode).toBe('NETWORK_ERROR');
      }
    });

    test('应该处理连接超时', async () => {
      const timeoutConfig = {
        ...config,
        baseUrl: 'http://httpbin.org/delay/10', // 10秒延迟
        timeout: 1000 // 1秒超时
      };
      
      const timeoutApiService = new LdimsApiService(timeoutConfig);
      
      const startTime = Date.now();
      const result = await timeoutApiService.searchDocuments({
        query: '测试',
        maxResults: 5
      });
      const endTime = Date.now();
      
      // 应该在超时时间内失败
      expect(endTime - startTime).toBeLessThan(2000);
      expect('isError' in result).toBe(true);
      if ('isError' in result) {
        expect(result.errorCode).toBe('TIMEOUT_ERROR');
      }
    });

    test('应该处理间歇性网络故障', async () => {
      let callCount = 0;
      const originalFetch = global.fetch;
      
      // 模拟间歇性故障
      global.fetch = jest.fn().mockImplementation((...args) => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('Network hiccup'));
        }
        return originalFetch(...args);
      });
      
      try {
        // 应该能够重试并最终成功
        const result = await apiService.searchDocuments({
          query: '测试',
          maxResults: 1
        });
        
        expect(result).toBeDefined();
        expect(callCount).toBeGreaterThan(1); // 证明进行了重试
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('服务器错误场景测试', () => {
    test('应该处理HTTP 500错误', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue({
          error: 'Internal server error'
        })
      } as any);
      
      const result = await apiService.searchDocuments({
        query: '测试',
        maxResults: 5
      });
      
      expect('isError' in result).toBe(true);
      if ('isError' in result) {
        expect(result.errorCode).toBe('SERVER_ERROR');
      }
    });

    test('应该处理HTTP 502/503/504错误', async () => {
      const errorCodes = [502, 503, 504];
      
      for (const statusCode of errorCodes) {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: statusCode,
          statusText: 'Service Unavailable'
        } as any);
        
        const result = await apiService.searchDocuments({
          query: '测试',
          maxResults: 5
        });
        
        expect('isError' in result).toBe(true);
        if ('isError' in result) {
          expect(['SERVICE_UNAVAILABLE', 'SERVER_ERROR']).toContain(result.errorCode);
        }
      }
    });

    test('应该处理认证和授权错误', async () => {
      const authErrors = [
        { status: 401, expected: 'UNAUTHORIZED' },
        { status: 403, expected: 'FORBIDDEN' }
      ];
      
      for (const { status, expected } of authErrors) {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status,
          statusText: status === 401 ? 'Unauthorized' : 'Forbidden'
        } as any);
        
        const result = await apiService.searchDocuments({
          query: '测试',
          maxResults: 5
        });
        
        expect('isError' in result).toBe(true);
        if ('isError' in result) {
          expect(result.errorCode).toBe(expected);
        }
      }
    });
  });

  describe('数据格式错误测试', () => {
    test('应该处理无效的JSON响应', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any);
      
      const result = await apiService.searchDocuments({
        query: '测试',
        maxResults: 5
      });
      
      expect('isError' in result).toBe(true);
      if ('isError' in result) {
        expect(result.errorCode).toBe('PARSE_ERROR');
      }
    });

    test('应该处理缺少必需字段的响应', async () => {
      const invalidResponses = [
        {}, // 完全空对象
        { data: null }, // 空数据
        { data: { results: null } }, // 空结果
        { data: { results: [] } }, // 缺少total字段
        { data: { total: 0 } } // 缺少results字段
      ];
      
      for (const invalidResponse of invalidResponses) {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(invalidResponse)
        } as any);
        
        const result = await apiService.searchDocuments({
          query: '测试',
          maxResults: 5
        });
        
        expect('isError' in result).toBe(true);
        if ('isError' in result) {
          expect(['INVALID_RESPONSE', 'PARSE_ERROR']).toContain(result.errorCode);
        }
      }
    });

    test('应该处理格式错误的搜索结果', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            results: [
              { /* 缺少必需字段 */ },
              { document_id: 123 /* 错误类型 */ },
              { document_id: 'valid', relevance_score: 'invalid' /* 错误类型 */ }
            ],
            total: 'invalid' // 错误类型
          }
        })
      } as any);
      
      const result = await apiService.searchDocuments({
        query: '测试',
        maxResults: 5
      });
      
      expect('isError' in result).toBe(true);
      if ('isError' in result) {
        expect(['INVALID_RESPONSE', 'VALIDATION_ERROR']).toContain(result.errorCode);
      }
    });
  });

  describe('资源限制测试', () => {
    test('应该处理大量并发请求', async () => {
      const concurrentRequests = 50;
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        apiService.searchDocuments({
          query: `并发测试 ${i}`,
          maxResults: 1
        })
      );
      
      const results = await Promise.allSettled(promises);
      
      // 检查结果
      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      const rejected = results.filter(r => r.status === 'rejected').length;
      
      console.log(`并发测试结果: ${fulfilled} 成功, ${rejected} 失败`);
      
      // 应该至少有一些请求成功
      expect(fulfilled).toBeGreaterThan(0);
      
      // 检查失败的请求是否有合理的错误
      results.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason).toBeDefined();
        }
      });
    });

    test('应该处理内存不足情况', async () => {
      // 尝试请求大量数据
      const result = await apiService.searchDocuments({
        query: '测试',
        maxResults: 100 // 最大允许值
      });
      
      if (!('isError' in result)) {
        // 如果成功，检查内存使用情况
        const memUsage = process.memoryUsage();
        expect(memUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // 500MB限制
      }
    });
  });

  describe('错误恢复机制测试', () => {
    test('应该能够从临时故障中恢复', async () => {
      let failureCount = 0;
      const maxFailures = 2;
      
      global.fetch = jest.fn().mockImplementation(() => {
        failureCount++;
        if (failureCount <= maxFailures) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              results: [],
              total: 0
            }
          })
        });
      });
      
      const result = await apiService.searchDocuments({
        query: '恢复测试',
        maxResults: 1
      });
      
      expect(failureCount).toBe(maxFailures + 1);
      expect('isError' in result).toBe(false);
    });

    test('应该在持续故障时放弃重试', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      
      const startTime = Date.now();
      const result = await apiService.searchDocuments({
        query: '失败测试',
        maxResults: 1
      });
      const endTime = Date.now();
      
      expect('isError' in result).toBe(true);
      // 应该在合理时间内放弃
      expect(endTime - startTime).toBeLessThan(15000); // 15秒内
    });
  });

  describe('配置边界测试', () => {
    test('应该处理无效的配置值', async () => {
      const invalidConfigs = [
        { ...config, baseUrl: '' },
        { ...config, baseUrl: 'not-a-url' },
        { ...config, timeout: -1 },
        { ...config, timeout: 0 },
        { ...config, version: '' },
        { ...config, authToken: '' }
      ];
      
      for (const invalidConfig of invalidConfigs) {
        try {
          const invalidApiService = new LdimsApiService(invalidConfig);
          const result = await invalidApiService.searchDocuments({
            query: '测试',
            maxResults: 1
          });
          
          expect('isError' in result).toBe(true);
        } catch (error: any) {
          expect(error.message).toContain('config');
        }
      }
    });

    test('应该处理配置更新', async () => {
      // 测试运行时配置更新
      const newConfig = {
        ...config,
        timeout: 1000,
        baseUrl: 'http://localhost:3334/api'
      };
      
      apiService.updateConfig(newConfig);
      
      const updatedConfig = apiService.getConfig();
      expect(updatedConfig.timeout).toBe(1000);
      expect(updatedConfig.baseUrl).toBe('http://localhost:3334/api');
    });
  });
});
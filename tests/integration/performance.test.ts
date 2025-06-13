/**
 * 性能基准测试
 * 
 * 测试API响应时间、吞吐量和资源使用情况
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { LdimsApiService } from '../../src/services/ldims-api.js';
import type { LdimsApiConfig } from '../../src/types/mcp.js';

interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: number;
  cpuUsage?: number;
  successRate: number;
  throughput: number;
}

describe('性能基准测试', () => {
  let apiService: LdimsApiService;
  let config: LdimsApiConfig;
  let performanceLog: PerformanceMetrics[] = [];

  beforeAll(() => {
    config = {
      baseUrl: process.env.LDIMS_API_BASE_URL || 'http://localhost:3333/mock-api',
      version: 'v1',
      timeout: 30000,
      authToken: process.env.LDIMS_AUTH_TOKEN || 'test-token'
    };
    
    apiService = new LdimsApiService(config);
    
    // 增加测试超时
    jest.setTimeout(60000);
  });

  afterAll(() => {
    // 输出性能报告
    console.log('\n=== 性能测试报告 ===');
    console.table(performanceLog);
  });

  describe('响应时间基准测试', () => {
    test('健康检查应该在100ms内响应', async () => {
      const iterations = 10;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await apiService.healthCheck();
        const endTime = Date.now();
        times.push(endTime - startTime);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      console.log(`健康检查性能: 平均 ${avgTime}ms, 最大 ${maxTime}ms, 最小 ${minTime}ms`);
      
      expect(avgTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(500);
      
      performanceLog.push({
        responseTime: avgTime,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        successRate: 100,
        throughput: iterations / (times.reduce((a, b) => a + b, 0) / 1000)
      });
    });

    test('简单搜索应该在500ms内响应', async () => {
      const queries = [
        '测试',
        '文档',
        'API',
        '技术',
        '规范'
      ];
      
      const times: number[] = [];
      
      for (const query of queries) {
        const startTime = Date.now();
        const result = await apiService.searchDocuments({
          query,
          maxResults: 5
        });
        const endTime = Date.now();
        
        if (!('isError' in result)) {
          times.push(endTime - startTime);
        }
      }
      
      if (times.length > 0) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        
        console.log(`简单搜索性能: 平均 ${avgTime}ms, 最大 ${maxTime}ms`);
        
        expect(avgTime).toBeLessThan(500);
        expect(maxTime).toBeLessThan(2000);
        
        performanceLog.push({
          responseTime: avgTime,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          successRate: (times.length / queries.length) * 100,
          throughput: times.length / (times.reduce((a, b) => a + b, 0) / 1000)
        });
      }
    });

    test('复杂搜索应该在2秒内响应', async () => {
      const complexQueries = [
        {
          query: 'API 接口 OR 技术文档 AND 规范',
          maxResults: 20,
          filters: {
            documentType: 'PDF',
            searchMode: 'semantic'
          }
        },
        {
          query: '系统架构 AND (微服务 OR 分布式)',
          maxResults: 15,
          filters: {
            dateFrom: '2024-01-01',
            dateTo: '2024-12-31'
          }
        }
      ];
      
      const times: number[] = [];
      
      for (const searchParams of complexQueries) {
        const startTime = Date.now();
        const result = await apiService.searchDocuments(searchParams);
        const endTime = Date.now();
        
        if (!('isError' in result)) {
          times.push(endTime - startTime);
        }
      }
      
      if (times.length > 0) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        
        console.log(`复杂搜索性能: 平均 ${avgTime}ms, 最大 ${maxTime}ms`);
        
        expect(avgTime).toBeLessThan(2000);
        expect(maxTime).toBeLessThan(5000);
        
        performanceLog.push({
          responseTime: avgTime,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          successRate: (times.length / complexQueries.length) * 100,
          throughput: times.length / (times.reduce((a, b) => a + b, 0) / 1000)
        });
      }
    });
  });

  describe('吞吐量测试', () => {
    test('应该支持每秒10个搜索请求', async () => {
      const duration = 5000; // 5秒
      const targetRPS = 10; // 每秒10个请求
      const totalRequests = Math.floor((duration / 1000) * targetRPS);
      
      const startTime = Date.now();
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < totalRequests; i++) {
        const promise = apiService.searchDocuments({
          query: `吞吐量测试 ${i}`,
          maxResults: 3
        });
        promises.push(promise);
        
        // 控制请求速率
        if (i > 0 && i % targetRPS === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      
      const actualDuration = endTime - startTime;
      const successfulRequests = results.filter(r => r.status === 'fulfilled').length;
      const actualRPS = (successfulRequests / actualDuration) * 1000;
      
      console.log(`吞吐量测试: ${successfulRequests}/${totalRequests} 成功, ${actualRPS.toFixed(2)} RPS`);
      
      expect(successfulRequests).toBeGreaterThanOrEqual(totalRequests * 0.8); // 80%成功率
      expect(actualRPS).toBeGreaterThanOrEqual(targetRPS * 0.7); // 70%的目标吞吐量
      
      performanceLog.push({
        responseTime: actualDuration / totalRequests,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        successRate: (successfulRequests / totalRequests) * 100,
        throughput: actualRPS
      });
    });

    test('应该支持并发请求处理', async () => {
      const concurrentUsers = 20;
      const requestsPerUser = 5;
      
      const userTasks = Array.from({ length: concurrentUsers }, async (_, userId) => {
        const userResults: any[] = [];
        
        for (let i = 0; i < requestsPerUser; i++) {
          try {
            const result = await apiService.searchDocuments({
              query: `用户${userId}请求${i}`,
              maxResults: 2
            });
            userResults.push(result);
          } catch (error) {
            userResults.push({ error: error.message });
          }
        }
        
        return userResults;
      });
      
      const startTime = Date.now();
      const allResults = await Promise.all(userTasks);
      const endTime = Date.now();
      
      const totalRequests = concurrentUsers * requestsPerUser;
      const successfulRequests = allResults.flat().filter(r => !('error' in r) && !('isError' in r)).length;
      const duration = endTime - startTime;
      
      console.log(`并发测试: ${successfulRequests}/${totalRequests} 成功, 总用时 ${duration}ms`);
      
      expect(successfulRequests).toBeGreaterThanOrEqual(totalRequests * 0.7); // 70%成功率
      expect(duration).toBeLessThan(30000); // 30秒内完成
      
      performanceLog.push({
        responseTime: duration / totalRequests,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        successRate: (successfulRequests / totalRequests) * 100,
        throughput: (successfulRequests / duration) * 1000
      });
    });
  });

  describe('内存使用测试', () => {
    test('应该没有明显的内存泄漏', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 100;
      
      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }
      
      for (let i = 0; i < iterations; i++) {
        await apiService.searchDocuments({
          query: `内存测试 ${i}`,
          maxResults: 3
        });
        
        // 每10次检查一次内存
        if (i % 10 === 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          const memoryIncrease = currentMemory - initialMemory;
          
          // 内存增长不应该超过50MB
          expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        }
      }
      
      // 再次强制垃圾回收
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`内存使用: 初始 ${(initialMemory / 1024 / 1024).toFixed(2)}MB, 最终 ${(finalMemory / 1024 / 1024).toFixed(2)}MB, 增长 ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      // 最终内存增长不应该超过20MB
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
      
      performanceLog.push({
        responseTime: 0,
        memoryUsage: finalMemory / 1024 / 1024,
        successRate: 100,
        throughput: iterations / 10 // 假设测试用时10秒
      });
    });

    test('应该处理大型响应数据', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 请求大量结果
      const result = await apiService.searchDocuments({
        query: '大数据测试',
        maxResults: 100
      });
      
      const afterRequestMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterRequestMemory - initialMemory;
      
      console.log(`大数据处理内存增长: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      // 处理大型响应不应该导致过多内存使用
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB限制
      
      if (!('isError' in result)) {
        expect(result.results).toBeDefined();
        // 如果有结果，检查数据结构是否合理
        if (result.results.length > 0) {
          result.results.forEach(doc => {
            expect(typeof doc.documentId).toBe('string');
            expect(typeof doc.documentName).toBe('string');
            expect(typeof doc.relevanceScore).toBe('number');
          });
        }
      }
    });
  });

  describe('压力测试', () => {
    test('应该在高负载下保持稳定', async () => {
      const testDuration = 10000; // 10秒
      const requestInterval = 100; // 每100ms一个请求
      const maxConcurrent = 10;
      
      const startTime = Date.now();
      let requestCount = 0;
      let successCount = 0;
      let errorCount = 0;
      const activeTasks = new Set<Promise<any>>();
      
      const makeRequest = async (id: number) => {
        try {
          const result = await apiService.searchDocuments({
            query: `压力测试 ${id}`,
            maxResults: 2
          });
          
          if (!('isError' in result)) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
        requestCount++;
      };
      
      const testInterval = setInterval(() => {
        if (Date.now() - startTime >= testDuration) {
          clearInterval(testInterval);
          return;
        }
        
        if (activeTasks.size < maxConcurrent) {
          const requestId = Date.now();
          const task = makeRequest(requestId);
          activeTasks.add(task);
          
          task.finally(() => {
            activeTasks.delete(task);
          });
        }
      }, requestInterval);
      
      // 等待测试完成
      await new Promise(resolve => {
        const checkCompletion = () => {
          if (Date.now() - startTime >= testDuration && activeTasks.size === 0) {
            resolve(void 0);
          } else {
            setTimeout(checkCompletion, 100);
          }
        };
        checkCompletion();
      });
      
      const actualDuration = Date.now() - startTime;
      const successRate = (successCount / requestCount) * 100;
      const throughput = (requestCount / actualDuration) * 1000;
      
      console.log(`压力测试结果: ${requestCount} 请求, ${successCount} 成功, ${errorCount} 失败, 成功率 ${successRate.toFixed(2)}%`);
      
      expect(successRate).toBeGreaterThanOrEqual(70); // 70%成功率
      expect(requestCount).toBeGreaterThan(50); // 至少处理50个请求
      
      performanceLog.push({
        responseTime: actualDuration / requestCount,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        successRate,
        throughput
      });
    });

    test('应该在资源耗尽时优雅降级', async () => {
      // 模拟资源耗尽场景
      const heavyRequests = Array.from({ length: 50 }, (_, i) =>
        apiService.searchDocuments({
          query: `资源测试 ${'heavy'.repeat(100)} ${i}`, // 重负载查询
          maxResults: 50
        })
      );
      
      const results = await Promise.allSettled(heavyRequests);
      
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`资源耗尽测试: ${succeeded} 成功, ${failed} 失败`);
      
      // 即使在重负载下，也应该有一些请求成功
      expect(succeeded).toBeGreaterThan(0);
      
      // 检查失败的请求是否有合理的错误信息
      results.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).toBeDefined();
        }
      });
    });
  });

  describe('性能基准比较', () => {
    test('应该满足性能SLA要求', () => {
      // 定义性能SLA
      const slaRequirements = {
        maxAvgResponseTime: 1000, // 1秒
        minSuccessRate: 95, // 95%
        minThroughput: 5, // 每秒5个请求
        maxMemoryUsage: 200 // 200MB
      };
      
      // 计算平均性能指标
      if (performanceLog.length > 0) {
        const avgMetrics = performanceLog.reduce((acc, metrics) => ({
          responseTime: acc.responseTime + metrics.responseTime,
          successRate: acc.successRate + metrics.successRate,
          throughput: acc.throughput + metrics.throughput,
          memoryUsage: acc.memoryUsage + metrics.memoryUsage
        }), { responseTime: 0, successRate: 0, throughput: 0, memoryUsage: 0 });
        
        const count = performanceLog.length;
        avgMetrics.responseTime /= count;
        avgMetrics.successRate /= count;
        avgMetrics.throughput /= count;
        avgMetrics.memoryUsage /= count;
        
        console.log('\n=== SLA 检查结果 ===');
        console.log(`平均响应时间: ${avgMetrics.responseTime.toFixed(2)}ms (SLA: <${slaRequirements.maxAvgResponseTime}ms)`);
        console.log(`平均成功率: ${avgMetrics.successRate.toFixed(2)}% (SLA: >${slaRequirements.minSuccessRate}%)`);
        console.log(`平均吞吐量: ${avgMetrics.throughput.toFixed(2)} RPS (SLA: >${slaRequirements.minThroughput} RPS)`);
        console.log(`平均内存使用: ${avgMetrics.memoryUsage.toFixed(2)}MB (SLA: <${slaRequirements.maxMemoryUsage}MB)`);
        
        // 验证是否满足SLA
        expect(avgMetrics.responseTime).toBeLessThanOrEqual(slaRequirements.maxAvgResponseTime);
        expect(avgMetrics.successRate).toBeGreaterThanOrEqual(slaRequirements.minSuccessRate);
        expect(avgMetrics.throughput).toBeGreaterThanOrEqual(slaRequirements.minThroughput);
        expect(avgMetrics.memoryUsage).toBeLessThanOrEqual(slaRequirements.maxMemoryUsage);
      } else {
        test.skip('没有性能数据可供比较');
      }
    });
  });
});
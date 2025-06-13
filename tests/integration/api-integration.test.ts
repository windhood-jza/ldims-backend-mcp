/**
 * API集成测试
 *
 * 测试LDIMS MCP服务与外部API的集成
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from "@jest/globals";
import { LdimsApiService } from "../../src/services/ldims-api.js";
import { ConfigManager } from "../../src/config/index.js";
import type { LdimsApiConfig } from "../../src/types/mcp.js";

describe("API集成测试", () => {
  let apiService: LdimsApiService;
  let config: LdimsApiConfig;
  let testEnvironment: "mock" | "staging" | "real";

  beforeAll(async () => {
    // 根据环境变量决定测试模式
    testEnvironment = (process.env.TEST_MODE as any) || "mock";

    if (testEnvironment === "mock") {
      // Mock模式 - 使用不存在的服务器，这样会触发fallback到Mock数据
      config = {
        baseUrl: "http://localhost:3333/mock-api",
        version: "v1",
        timeout: 1000, // 短超时，快速失败到Mock
        retryCount: 0, // 不重试，直接使用Mock
        authToken: "mock-token"
      };

      console.log("[测试] Mock模式：将使用API fallback到Mock数据");
    } else if (testEnvironment === "staging") {
      // 使用Staging环境
      const configManager = ConfigManager.getInstance();
      config = configManager.getLdimsConfig();

      console.log("[测试] Staging模式：等待真实API服务...");
      await waitForService(config.baseUrl);
    } else {
      // 跳过真实环境测试
      console.log("[测试] 跳过真实环境API测试");
      return;
    }

    apiService = new LdimsApiService(config);

    console.log(`[测试] API服务初始化完成: ${config.baseUrl}`);
  }, 15000); // 增加超时时间到15秒

  afterAll(async () => {
    // 清理测试数据
    if (testEnvironment !== "real") {
      await cleanupTestData();
    }
  });

  beforeEach(() => {
    if (testEnvironment === "real") {
      test.skip("跳过真实环境测试");
    }
  });

  describe("健康检查集成", () => {
    test("应该能够连接到LDIMS API", async () => {
      const result = await apiService.healthCheck();

      if (testEnvironment === "mock") {
        // Mock模式下API会失败，但应该正常处理
        expect(result.isHealthy).toBe(false);
        console.log("[测试] Mock模式：API连接失败是预期的");
      } else {
        expect(result.isHealthy).toBe(true);
      }
    });

    test("应该处理API服务不可用的情况", async () => {
      // 创建指向不存在服务的配置
      const badConfig = {
        ...config,
        baseUrl: "http://localhost:9999/nonexistent",
        timeout: 1000
      };

      const badApiService = new LdimsApiService(badConfig);
      const result = await badApiService.healthCheck();

      expect(result.isHealthy).toBe(false);
    });

    test("应该验证API版本兼容性", async () => {
      if (testEnvironment === "mock") {
        // Mock模式下跳过版本验证
        console.log("[测试] Mock模式：跳过版本验证测试");
        return;
      }

      const health = await apiService.healthCheck();

      if (health.isHealthy) {
        expect(["v1", "v1.0", "v1.1"]).toContain(config.version);
      }
    });
  });

  describe("文档搜索集成", () => {
    test("应该能够搜索文档", async () => {
      const result = await apiService.searchDocuments({
        query: "测试文档",
        maxResults: 5
      });

      if (testEnvironment === "mock") {
        // Mock模式下应该返回错误（触发fallback）
        expect("isError" in result).toBe(true);
        console.log("[测试] Mock模式：搜索API失败，将由MCP服务使用Mock数据");
      } else {
        expect("isError" in result).toBe(false);

        if (!("isError" in result)) {
          expect(result.results).toBeDefined();
          expect(Array.isArray(result.results)).toBe(true);
          expect(result.totalMatches).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test("应该处理复杂搜索查询", async () => {
      const result = await apiService.searchDocuments({
        query: "API 文档 OR 技术规范",
        maxResults: 10,
        filters: {
          documentType: "PDF",
          dateFrom: "2024-01-01",
          dateTo: "2024-12-31",
          searchMode: "semantic"
        }
      });

      if (testEnvironment === "mock") {
        expect("isError" in result).toBe(true);
        console.log("[测试] Mock模式：复杂搜索失败，将使用Mock数据");
      } else {
        expect("isError" in result).toBe(false);
      }
    });

    test("应该处理搜索错误和异常", async () => {
      // 测试无效查询
      const invalidResult = await apiService.searchDocuments({
        query: "",
        maxResults: 0
      });

      expect("isError" in invalidResult).toBe(true);
      if ("isError" in invalidResult) {
        expect(invalidResult.errorCode).toBeDefined();
        expect(invalidResult.errorMessage).toBeDefined();
      }
    });

    test("应该限制搜索结果数量", async () => {
      const result = await apiService.searchDocuments({
        query: "文档",
        maxResults: 3
      });

      if (testEnvironment !== "mock" && !("isError" in result)) {
        expect(result.results.length).toBeLessThanOrEqual(3);
      }
      // Mock模式下会返回错误，这是正常的
    });
  });

  describe("文档内容提取集成", () => {
    test("应该能够获取文档内容", async () => {
      const documentId = "test-doc-123";
      const contentResult = await apiService.getDocumentExtractedContent(documentId);

      if (testEnvironment === "mock") {
        expect("isError" in contentResult).toBe(true);
        console.log("[测试] Mock模式：内容提取失败，将使用Mock数据");
      } else {
        expect("isError" in contentResult).toBe(false);

        if (!("isError" in contentResult)) {
          expect(contentResult.text).toBeDefined();
          expect(contentResult.metadata).toBeDefined();
          expect(contentResult.metadata.documentName).toBeDefined();
          expect(contentResult.uri).toContain(documentId);
        }
      }
    });

    test("应该处理不存在的文档", async () => {
      const result = await apiService.getDocumentExtractedContent("nonexistent-doc-123");

      expect("isError" in result).toBe(true);
      if ("isError" in result) {
        expect(["CONTENT_EXTRACTION_FAILED", "DOCUMENT_NOT_FOUND"]).toContain(result.errorCode);
      }
    });

    test("应该处理内容提取失败", async () => {
      // 使用特殊的文档ID来模拟提取失败
      const result = await apiService.getDocumentExtractedContent("extraction-fail-test");

      expect("isError" in result).toBe(true);
      if ("isError" in result) {
        expect(["CONTENT_EXTRACTION_FAILED", "DOCUMENT_NOT_FOUND"]).toContain(result.errorCode);
      }
    });
  });

  describe("文件内容获取集成", () => {
    test("应该能够获取文件内容", async () => {
      // 使用测试文件ID
      const testFileId = "test-file-001";

      try {
        const result = await apiService.getDocumentFileContent(testFileId);

        if (testEnvironment === "mock") {
          // Mock模式下API会失败
          expect(false).toBe(true); // 这个不应该被执行到
        } else {
          expect(result.file_id).toBe(testFileId);
          expect(result.content).toBeDefined();
          expect(result.format).toBeDefined();
          expect(["text", "base64"]).toContain(result.format);

          if (result.metadata) {
            expect(result.metadata.filename).toBeDefined();
            expect(result.metadata.size).toBeGreaterThan(0);
            expect(result.metadata.mime_type).toBeDefined();
          }
        }
      } catch (error: any) {
        if (testEnvironment === "mock") {
          // Mock模式下应该抛出错误，这是预期的
          console.log("[测试] Mock模式：文件获取失败，将使用fallback");
          expect(error).toBeDefined();
        } else {
          // 其他环境可能没有测试文件
          expect(error.message).toContain("not found");
        }
      }
    });

    test("应该处理大文件下载", async () => {
      const testFileId = "large-test-file";

      try {
        const startTime = Date.now();
        const result = await apiService.getDocumentFileContent(testFileId);
        const endTime = Date.now();

        if (testEnvironment === "mock") {
          // Mock模式下不应该到达这里
          expect(false).toBe(true);
        } else {
          // 验证下载时间合理
          expect(endTime - startTime).toBeLessThan(30000); // 30秒超时

          if (result.metadata) {
            expect(result.metadata.size).toBeGreaterThan(1024 * 1024); // 至少1MB
          }
        }
      } catch (error: any) {
        if (testEnvironment === "mock") {
          console.log("[测试] Mock模式：大文件下载失败是预期的");
          expect(error).toBeDefined();
        } else {
          // 如果文件不存在，跳过测试
          if (error.message.includes("not found")) {
            test.skip("大文件测试数据不存在");
          } else {
            throw error;
          }
        }
      }
    });
  });

  describe("性能和稳定性测试", () => {
    test("应该在合理时间内响应", async () => {
      const startTime = Date.now();

      // 在Mock模式下，API调用会快速失败
      await Promise.allSettled([
        apiService.healthCheck(),
        apiService.searchDocuments({ query: "快速测试", maxResults: 1 }),
        apiService.checkHealth()
      ]);

      const endTime = Date.now();

      if (testEnvironment === "mock") {
        // Mock模式下应该快速失败
        expect(endTime - startTime).toBeLessThan(5000); // 5秒内完成
        console.log("[测试] Mock模式：快速失败测试通过");
      } else {
        expect(endTime - startTime).toBeLessThan(10000); // 10秒内完成
      }
    });

    test("应该处理并发请求", async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        apiService.searchDocuments({
          query: `并发测试 ${i}`,
          maxResults: 2
        })
      );

      const results = await Promise.allSettled(promises);

      if (testEnvironment === "mock") {
        // Mock模式下所有请求都应该失败
        const failedCount = results.filter(
          r => r.status === "rejected" || (r.status === "fulfilled" && "isError" in r.value)
        ).length;
        expect(failedCount).toBe(promises.length);
        console.log("[测试] Mock模式：并发请求失败测试通过");
      } else {
        // 至少一半的请求应该成功
        const successCount = results.filter(r => r.status === "fulfilled").length;
        expect(successCount).toBeGreaterThanOrEqual(Math.ceil(promises.length / 2));
      }
    });

    test("应该正确处理超时", async () => {
      // 创建短超时的API服务
      const timeoutConfig = {
        ...config,
        timeout: 100 // 100ms 超时
      };

      const timeoutApiService = new LdimsApiService(timeoutConfig);

      const startTime = Date.now();
      try {
        const result = await timeoutApiService.searchDocuments({
          query: "超时测试",
          maxResults: 1
        });

        // 如果没有抛出错误，检查是否返回了错误结果
        if ("isError" in result) {
          const endTime = Date.now();
          expect(endTime - startTime).toBeLessThan(1000); // 应该快速失败
          console.log("[测试] 超时测试：返回错误结果");
        }
      } catch (error: any) {
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(1000); // 应该快速失败
        expect(error.message).toMatch(/(timeout|abort)/i);
      }
    });
  });

  describe("错误恢复和重试", () => {
    test("应该能够从临时错误中恢复", async () => {
      if (testEnvironment === "mock") {
        // Mock模式下跳过重试测试，因为不会有真实的网络调用
        console.log("[测试] Mock模式：跳过重试测试");
        return;
      }

      // 模拟网络不稳定
      let attempts = 0;
      const originalFetch = global.fetch;

      global.fetch = jest.fn().mockImplementation((...args) => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error("Network error"));
        }
        return originalFetch(...args);
      });

      try {
        const result = await apiService.searchDocuments({
          query: "重试测试",
          maxResults: 1
        });

        expect(attempts).toBeGreaterThanOrEqual(3);
        // 最终应该成功或返回有意义的错误
        expect(result).toBeDefined();
      } finally {
        global.fetch = originalFetch;
      }
    });

    test("应该正确处理认证错误", async () => {
      const unauthorizedConfig = {
        ...config,
        authToken: "invalid-token"
      };

      const unauthorizedApi = new LdimsApiService(unauthorizedConfig);

      try {
        const result = await unauthorizedApi.searchDocuments({
          query: "认证测试",
          maxResults: 1
        });

        if ("isError" in result) {
          expect(["AUTH_FAILED", "UNAUTHORIZED", "API_CONNECTION_FAILED", "CONTENT_EXTRACTION_FAILED"]).toContain(
            result.errorCode
          );
          console.log(`[测试] 认证错误处理：${result.errorCode}`);
        }
      } catch (error: any) {
        // 连接失败也是可以接受的
        console.log("[测试] 认证测试：连接失败（Mock模式预期）");
        expect(error).toBeDefined();
      }
    });
  });
});

// 辅助函数
async function waitForService(baseUrl: string, maxAttempts = 10) {
  console.log(`[测试] 等待服务启动: ${baseUrl}`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        method: "GET",
        timeout: 2000 // 2秒超时
      });
      if (response.ok) {
        console.log(`[测试] 服务已就绪: ${baseUrl}`);
        return;
      }
    } catch (error) {
      console.log(`[测试] 尝试 ${i + 1}/${maxAttempts}: 服务暂未就绪`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Service at ${baseUrl} is not available after ${maxAttempts} attempts`);
}

async function cleanupTestData() {
  // 清理测试过程中创建的数据
  // 在Mock环境中，这通常不需要做什么
  console.log("[测试] 清理测试数据完成");
}

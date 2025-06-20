#!/usr/bin/env node

/**
 * LDIMS API连接测试脚本
 *
 * 用于P3阶段验证真实API集成
 */

import { LdimsApiService } from "./dist/services/ldims-api.js";

// 配置
const API_CONFIG = {
  baseUrl: process.env.LDIMS_API_BASE_URL || "http://localhost:3000",
  version: process.env.LDIMS_API_VERSION || "v1",
  timeout: parseInt(process.env.LDIMS_API_TIMEOUT || "30000"),
  retryCount: parseInt(process.env.LDIMS_API_RETRY_COUNT || "3"),
  authToken:
    process.env.LDIMS_AUTH_TOKEN ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MDMyNjA5MSwiZXhwIjoxNzUwNDEyNDkxfQ.eNi1y91If00iIcanjWfxMEm7nMq6-9LWldor_AFw6Dc"
};

console.log("🔄 开始P3阶段API连接测试...");
console.log("📡 API配置:", API_CONFIG);

async function testApiConnection() {
  const apiService = new LdimsApiService(API_CONFIG);

  console.log("\n=== 测试 1: 健康检查 ===");
  try {
    const healthResult = await apiService.healthCheck();
    console.log("✅ 健康检查结果:", healthResult);
  } catch (error) {
    console.log("❌ 健康检查失败:", error.message);
  }

  console.log("\n=== 测试 2: 快速健康检查 ===");
  try {
    const quickHealth = await apiService.checkHealth();
    console.log("✅ 快速健康检查:", quickHealth ? "正常" : "异常");
  } catch (error) {
    console.log("❌ 快速健康检查失败:", error.message);
  }

  console.log("\n=== 测试 3: 文档搜索 ===");
  try {
    const searchResult = await apiService.searchDocuments({
      query: "测试API",
      maxResults: 3
    });

    if ("isError" in searchResult) {
      console.log("❌ 搜索失败:", searchResult.errorMessage);
    } else {
      console.log("✅ 搜索成功!");
      console.log(`📄 找到 ${searchResult.results.length} 个文档`);
      console.log(`📊 总匹配数: ${searchResult.totalMatches}`);
      console.log(`⏱️  执行时间: ${searchResult.searchMetadata.executionTime}`);

      if (searchResult.results.length > 0) {
        console.log("📋 第一个结果:", {
          id: searchResult.results[0].documentId,
          name: searchResult.results[0].documentName,
          score: searchResult.results[0].relevanceScore
        });
      }
    }
  } catch (error) {
    console.log("❌ 搜索测试异常:", error.message);
  }

  console.log("\n=== 测试总结 ===");
  console.log("🎯 如果以上测试都成功，说明P3阶段API集成完成！");
  console.log("⚠️  如果有失败，请检查LDIMS后端服务是否正常运行");
}

// 运行测试
testApiConnection()
  .then(() => {
    console.log("\n✅ 测试完成！");
    process.exit(0);
  })
  .catch(error => {
    console.error("\n❌ 测试异常:", error);
    process.exit(1);
  });

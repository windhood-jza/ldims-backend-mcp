#!/usr/bin/env node

/**
 * LDIMS API连接测试脚本
 *
 * 用于P3阶段验证真实API集成
 */

import dotenv from "dotenv";
import { LdimsApiService } from "../dist/services/ldims-api.js";

// 加载环境变量
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

// 配置
const API_CONFIG = {
  baseUrl: process.env.LDIMS_API_BASE_URL || "http://localhost:3000",
  version: process.env.LDIMS_API_VERSION || "v1",
  timeout: parseInt(process.env.LDIMS_API_TIMEOUT || "30000"),
  retryCount: parseInt(process.env.LDIMS_API_RETRY_COUNT || "3"),
  authToken:
    process.env.LDIMS_AUTH_TOKEN ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MDQxNzk2OSwiZXhwIjoxOTg2MzQ3NTY5fQ.o-jIKyHGQLEa_0Ukj8ZRBT0PqLJsKAQY3VqwEzDg4yM"
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
  let firstDocumentId = null;
  try {
    const searchResult = await apiService.searchDocuments({
      query: "科学技术奖",
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
        firstDocumentId = searchResult.results[0].documentId;
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

  console.log("\n=== 测试 4: 文档文件内容获取 ===");
  try {
    // 尝试获取文件ID为1的文档内容
    const fileContent = await apiService.getDocumentFileContent("1");
    console.log("✅ 文件内容获取成功!");
    console.log(`📄 文件ID: ${fileContent.file_id}`);
    console.log(`📝 内容长度: ${fileContent.content.length} 字符`);
    console.log(`📋 格式: ${fileContent.format}`);
    if (fileContent.metadata) {
      console.log(`📁 文件名: ${fileContent.metadata.filename}`);
      console.log(`📊 文件大小: ${fileContent.metadata.size} 字节`);
    }
  } catch (error) {
    console.log("❌ 文件内容获取失败:", error.message);

    // 如果第一个测试失败，尝试使用搜索结果中的文档ID
    if (firstDocumentId) {
      console.log(`🔄 尝试使用搜索结果中的文档ID: ${firstDocumentId}`);
      try {
        const fileContent = await apiService.getDocumentFileContent(firstDocumentId);
        console.log("✅ 使用搜索结果文档ID获取成功!");
        console.log(`📄 文件ID: ${fileContent.file_id}`);
        console.log(`📝 内容长度: ${fileContent.content.length} 字符`);
      } catch (retryError) {
        console.log("❌ 重试也失败:", retryError.message);
      }
    }
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

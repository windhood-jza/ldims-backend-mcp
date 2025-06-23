#!/usr/bin/env node

/**
 * LDIMS MCP HTTP API 测试脚本
 * 测试HTTP模式下的MCP功能
 */

import { config } from "dotenv";
import fetch from "node-fetch";

// 加载环境变量
config();

const BASE_URL = process.env.HTTP_BASE_URL || "http://localhost:3001";
const AUTH_TOKEN = process.env.LDIMS_AUTH_TOKEN;

/**
 * 发送HTTP请求
 */
async function httpRequest(url, options = {}) {
  const fullUrl = `${BASE_URL}${url}`;
  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
      ...(AUTH_TOKEN && { Authorization: `Bearer ${AUTH_TOKEN}` })
    }
  };

  const response = await fetch(fullUrl, { ...defaultOptions, ...options });
  const data = await response.json();

  return {
    status: response.status,
    success: response.ok,
    data
  };
}

/**
 * 测试健康检查
 */
async function testHealthCheck() {
  console.log("🔍 Testing Health Check...");
  try {
    const result = await httpRequest("/health");

    if (result.success) {
      console.log("✅ Health Check: PASSED");
      console.log(`   - Status: ${result.data.status}`);
      console.log(`   - Uptime: ${Math.round(result.data.uptime / 1000)}s`);
      console.log(`   - LDIMS API: ${result.data.services.ldims_api ? "✅" : "❌"}`);
      return true;
    } else {
      console.log("❌ Health Check: FAILED");
      console.log("   Error:", result.data);
      return false;
    }
  } catch (error) {
    console.error("❌ Health Check: ERROR", error.message);
    return false;
  }
}

/**
 * 测试工具列表
 */
async function testListTools() {
  console.log("\n🔍 Testing List Tools...");
  try {
    const result = await httpRequest("/api/tools");

    if (result.success) {
      console.log("✅ List Tools: PASSED");
      console.log(`   - Available tools: ${result.data.data.length}`);
      result.data.data.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
      return true;
    } else {
      console.log("❌ List Tools: FAILED");
      console.log("   Error:", result.data);
      return false;
    }
  } catch (error) {
    console.error("❌ List Tools: ERROR", error.message);
    return false;
  }
}

/**
 * 测试文档搜索
 */
async function testSearchDocuments() {
  console.log("\n🔍 Testing Search Documents...");
  try {
    const searchData = {
      query: "证书",
      maxResults: 3
    };

    const result = await httpRequest("/api/tools/searchDocuments", {
      method: "POST",
      body: JSON.stringify(searchData)
    });

    if (result.success) {
      console.log("✅ Search Documents: PASSED");
      console.log(`   - Found documents: ${result.data.data.documents?.length || 0}`);
      console.log(`   - Execution time: ${result.data.executionTime}ms`);

      if (result.data.data.documents?.length > 0) {
        console.log("   - Sample results:");
        result.data.data.documents.slice(0, 2).forEach((doc, index) => {
          console.log(`     ${index + 1}. ${doc.title} (ID: ${doc.id})`);
        });
      }
      return result.data.data.documents || [];
    } else {
      console.log("❌ Search Documents: FAILED");
      console.log("   Error:", result.data);
      return [];
    }
  } catch (error) {
    console.error("❌ Search Documents: ERROR", error.message);
    return [];
  }
}

/**
 * 测试文件内容获取
 */
async function testGetFileContent(fileId) {
  console.log(`\n🔍 Testing Get File Content (ID: ${fileId})...`);
  try {
    const result = await httpRequest("/api/tools/get_document_file_content", {
      method: "POST",
      body: JSON.stringify({ file_id: fileId })
    });

    if (result.success) {
      console.log("✅ Get File Content: PASSED");
      console.log(`   - Content length: ${result.data.data.content?.length || 0} characters`);
      console.log(`   - Execution time: ${result.data.executionTime}ms`);

      if (result.data.data.content) {
        const preview = result.data.data.content.substring(0, 100);
        console.log(`   - Content preview: ${preview}${result.data.data.content.length > 100 ? "..." : ""}`);
      }
      return true;
    } else {
      console.log("❌ Get File Content: FAILED");
      console.log("   Error:", result.data);
      return false;
    }
  } catch (error) {
    console.error("❌ Get File Content: ERROR", error.message);
    return false;
  }
}

/**
 * 测试批量调用
 */
async function testBatchCall() {
  console.log("\n🔍 Testing Batch Call...");
  try {
    const batchData = {
      calls: [
        {
          tool: "searchDocuments",
          arguments: { query: "项目", maxResults: 2 }
        },
        {
          tool: "searchDocuments",
          arguments: { query: "证书", maxResults: 1 }
        }
      ]
    };

    const result = await httpRequest("/api/tools", {
      method: "POST",
      body: JSON.stringify(batchData)
    });

    if (result.success) {
      console.log("✅ Batch Call: PASSED");
      console.log(`   - Batch results: ${result.data.data.length}`);
      console.log(`   - Execution time: ${result.data.executionTime}ms`);

      result.data.data.forEach((batchResult, index) => {
        if (batchResult.status === "fulfilled") {
          console.log(`   - Call ${index + 1}: SUCCESS`);
        } else {
          console.log(`   - Call ${index + 1}: FAILED - ${batchResult.reason}`);
        }
      });
      return true;
    } else {
      console.log("❌ Batch Call: FAILED");
      console.log("   Error:", result.data);
      return false;
    }
  } catch (error) {
    console.error("❌ Batch Call: ERROR", error.message);
    return false;
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log("🚀 LDIMS MCP HTTP API Testing");
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`🔑 Auth Token: ${AUTH_TOKEN ? "Configured" : "Not configured"}`);
  console.log("=".repeat(50));

  let passedTests = 0;
  let totalTests = 0;

  // 测试健康检查
  totalTests++;
  if (await testHealthCheck()) passedTests++;

  // 测试工具列表
  totalTests++;
  if (await testListTools()) passedTests++;

  // 测试文档搜索
  totalTests++;
  const searchResults = await testSearchDocuments();
  if (searchResults.length > 0) passedTests++;

  // 测试文件内容获取
  if (searchResults.length > 0 && searchResults[0].fileDetails?.length > 0) {
    totalTests++;
    const fileId = searchResults[0].fileDetails[0].fileId;
    if (await testGetFileContent(fileId)) passedTests++;
  }

  // 测试批量调用
  totalTests++;
  if (await testBatchCall()) passedTests++;

  // 测试结果汇总
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Results Summary:");
  console.log(`   - Total tests: ${totalTests}`);
  console.log(`   - Passed: ${passedTests}`);
  console.log(`   - Failed: ${totalTests - passedTests}`);
  console.log(`   - Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

  if (passedTests === totalTests) {
    console.log("🎉 All tests passed! HTTP API is working correctly.");
  } else {
    console.log("⚠️  Some tests failed. Please check the HTTP server configuration.");
  }

  process.exit(passedTests === totalTests ? 0 : 1);
}

// 运行测试
runTests().catch(error => {
  console.error("❌ Test execution failed:", error);
  process.exit(1);
});

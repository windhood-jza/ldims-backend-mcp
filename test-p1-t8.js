#!/usr/bin/env node

/**
 * P1-T8 MCP核心能力测试脚本
 *
 * 测试新增的功能：
 * 1. searchDocuments 工具 - 文档搜索
 * 2. extracted_content 资源 - 文档内容提取
 *
 * 这些功能实现了MCP服务规划中的核心能力，使LLM能够：
 * - 通过自然语言搜索LDIMS文档
 * - 获取文档的提取内容进行智能问答
 */

import { spawn } from "child_process";
import { promises as fs } from "fs";

const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️ ${msg}${colors.reset}`),
  test: (msg) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`),
};

/**
 * 发送JSON-RPC请求到MCP服务器
 */
function sendMcpRequest(child, method, params = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    };

    let responseData = "";
    let errorData = "";

    const timeout = setTimeout(() => {
      reject(new Error("请求超时"));
    }, 10000);

    const onData = (data) => {
      responseData += data.toString();
      try {
        const lines = responseData.split("\n").filter((line) => line.trim());
        for (const line of lines) {
          const response = JSON.parse(line);
          if (response.id === request.id) {
            clearTimeout(timeout);
            child.stdout.off("data", onData);
            child.stderr.off("data", onError);
            resolve(response);
            return;
          }
        }
      } catch (e) {
        // 继续等待完整响应
      }
    };

    const onError = (data) => {
      errorData += data.toString();
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onError);

    child.stdin.write(JSON.stringify(request) + "\n");
  });
}

/**
 * 启动MCP服务器
 */
function startMcpServer() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["dist/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let initData = "";
    const initTimeout = setTimeout(() => {
      reject(new Error("服务器启动超时"));
    }, 15000);

    child.stderr.on("data", (data) => {
      initData += data.toString();
      if (initData.includes("LDIMS MCP服务器已启动")) {
        clearTimeout(initTimeout);
        resolve(child);
      }
    });

    child.on("error", (error) => {
      clearTimeout(initTimeout);
      reject(new Error(`服务器启动失败: ${error.message}`));
    });

    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`服务器意外退出，退出码: ${code}`));
      }
    });
  });
}

/**
 * 测试工具列表是否包含新功能
 */
async function testToolList(child) {
  log.test("测试 1: 工具列表检查");

  try {
    const response = await sendMcpRequest(child, "tools/list");

    if (response.error) {
      throw new Error(`工具列表请求失败: ${response.error.message}`);
    }

    const tools = response.result?.tools || [];
    log.info(`找到 ${tools.length} 个工具`);

    // 检查是否包含新的searchDocuments工具
    const searchTool = tools.find((tool) => tool.name === "searchDocuments");
    if (!searchTool) {
      throw new Error("缺少 searchDocuments 工具");
    }

    // 验证searchDocuments工具schema
    if (!searchTool.inputSchema?.properties?.query) {
      throw new Error("searchDocuments 工具缺少 query 参数");
    }

    if (!searchTool.inputSchema?.properties?.maxResults) {
      throw new Error("searchDocuments 工具缺少 maxResults 参数");
    }

    if (!searchTool.inputSchema?.properties?.filters) {
      throw new Error("searchDocuments 工具缺少 filters 参数");
    }

    // 检查原有的get_document_file_content工具
    const getContentTool = tools.find(
      (tool) => tool.name === "get_document_file_content"
    );
    if (!getContentTool) {
      throw new Error("缺少 get_document_file_content 工具");
    }

    log.success("工具列表检查通过");
    log.info(`• get_document_file_content: ${getContentTool.description}`);
    log.info(`• searchDocuments: ${searchTool.description}`);

    return true;
  } catch (error) {
    log.error(`工具列表检查失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试资源列表是否包含新功能
 */
async function testResourceList(child) {
  log.test("测试 2: 资源列表检查");

  try {
    const response = await sendMcpRequest(child, "resources/list");

    if (response.error) {
      throw new Error(`资源列表请求失败: ${response.error.message}`);
    }

    const resources = response.result?.resources || [];
    log.info(`找到 ${resources.length} 个资源`);

    // 检查是否包含extracted_content资源
    const extractedContentResource = resources.find(
      (resource) =>
        resource.uri === "ldims://docs/{document_id}/extracted_content"
    );

    if (!extractedContentResource) {
      throw new Error("缺少 ldims://docs/{document_id}/extracted_content 资源");
    }

    if (extractedContentResource.mimeType !== "text/plain") {
      throw new Error("extracted_content 资源MIME类型不正确");
    }

    log.success("资源列表检查通过");
    log.info(
      `• ${extractedContentResource.name}: ${extractedContentResource.description}`
    );

    return true;
  } catch (error) {
    log.error(`资源列表检查失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试searchDocuments工具调用
 */
async function testSearchDocuments(child) {
  log.test("测试 3: searchDocuments 工具调用");

  const testCases = [
    {
      name: "基本搜索",
      params: { query: "技术文档" },
    },
    {
      name: "带过滤条件的搜索",
      params: {
        query: "操作手册",
        maxResults: 3,
        filters: {
          documentType: "PDF",
          searchMode: "semantic",
        },
      },
    },
    {
      name: "带日期过滤的搜索",
      params: {
        query: "项目管理",
        filters: {
          dateFrom: "2024-01-01T00:00:00Z",
          dateTo: "2024-12-31T23:59:59Z",
          submitter: "张三",
        },
      },
    },
  ];

  let successCount = 0;

  for (const testCase of testCases) {
    try {
      log.info(`  执行: ${testCase.name}`);

      const response = await sendMcpRequest(child, "tools/call", {
        name: "searchDocuments",
        arguments: testCase.params,
      });

      if (response.error) {
        throw new Error(`工具调用失败: ${response.error.message}`);
      }

      const content = response.result?.content?.[0];
      if (!content || content.type !== "text") {
        throw new Error("响应格式不正确");
      }

      const text = content.text;
      if (!text.includes("文档搜索结果")) {
        throw new Error("响应内容不符合预期");
      }

      if (
        !text.includes("查询:") ||
        !text.includes("搜索模式:") ||
        !text.includes("执行时间:")
      ) {
        throw new Error("搜索元数据缺失");
      }

      if (!text.includes("文档ID:") || !text.includes("相关度:")) {
        throw new Error("文档结果格式不正确");
      }

      log.success(`  ${testCase.name} - 通过`);
      successCount++;
    } catch (error) {
      log.error(`  ${testCase.name} - 失败: ${error.message}`);
    }
  }

  if (successCount === testCases.length) {
    log.success(
      `searchDocuments 工具测试通过 (${successCount}/${testCases.length})`
    );
    return true;
  } else {
    log.error(
      `searchDocuments 工具测试部分失败 (${successCount}/${testCases.length})`
    );
    return false;
  }
}

/**
 * 测试extracted_content资源读取
 */
async function testExtractedContent(child) {
  log.test("测试 4: extracted_content 资源读取");

  const testCases = ["mock-doc-1", "test-document-123", "sample-pdf-file"];

  let successCount = 0;

  for (const documentId of testCases) {
    try {
      log.info(`  读取文档: ${documentId}`);

      const response = await sendMcpRequest(child, "resources/read", {
        uri: `ldims://docs/${documentId}/extracted_content`,
      });

      if (response.error) {
        throw new Error(`资源读取失败: ${response.error.message}`);
      }

      const contents = response.result?.contents || [];
      if (contents.length === 0) {
        throw new Error("未返回内容");
      }

      const content = contents[0];
      if (!content.uri || !content.text) {
        throw new Error("内容格式不正确");
      }

      if (content.uri !== `ldims://docs/${documentId}/extracted_content`) {
        throw new Error("URI不匹配");
      }

      if (!content.text.includes("文档") || content.text.length < 100) {
        throw new Error("提取的文本内容不符合预期");
      }

      if (!content.metadata || !content.metadata.documentName) {
        throw new Error("缺少元数据");
      }

      log.success(`  ${documentId} - 通过 (${content.text.length} 字符)`);
      successCount++;
    } catch (error) {
      log.error(`  ${documentId} - 失败: ${error.message}`);
    }
  }

  if (successCount === testCases.length) {
    log.success(
      `extracted_content 资源测试通过 (${successCount}/${testCases.length})`
    );
    return true;
  } else {
    log.error(
      `extracted_content 资源测试部分失败 (${successCount}/${testCases.length})`
    );
    return false;
  }
}

/**
 * 测试参数验证
 */
async function testParameterValidation(child) {
  log.test("测试 5: 参数验证");

  const testCases = [
    {
      name: "searchDocuments 缺少查询参数",
      method: "tools/call",
      params: {
        name: "searchDocuments",
        arguments: { maxResults: 5 },
      },
      shouldFail: true,
    },
    {
      name: "searchDocuments 无效的搜索模式",
      method: "tools/call",
      params: {
        name: "searchDocuments",
        arguments: {
          query: "测试",
          filters: { searchMode: "invalid_mode" },
        },
      },
      shouldFail: true,
    },
    {
      name: "无效的资源URI",
      method: "resources/read",
      params: {
        uri: "invalid://uri/format",
      },
      shouldFail: true,
    },
  ];

  let successCount = 0;

  for (const testCase of testCases) {
    try {
      log.info(`  验证: ${testCase.name}`);

      const response = await sendMcpRequest(
        child,
        testCase.method,
        testCase.params
      );

      if (testCase.shouldFail) {
        if (response.error || response.result?.isError) {
          log.success(`  ${testCase.name} - 正确拒绝`);
          successCount++;
        } else {
          throw new Error("应该失败但成功了");
        }
      } else {
        if (!response.error && !response.result?.isError) {
          log.success(`  ${testCase.name} - 正确通过`);
          successCount++;
        } else {
          throw new Error("应该成功但失败了");
        }
      }
    } catch (error) {
      log.error(`  ${testCase.name} - 验证失败: ${error.message}`);
    }
  }

  if (successCount === testCases.length) {
    log.success(`参数验证测试通过 (${successCount}/${testCases.length})`);
    return true;
  } else {
    log.error(`参数验证测试部分失败 (${successCount}/${testCases.length})`);
    return false;
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log(`${colors.blue}
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                            LDIMS MCP P1-T8 功能测试                                  ║
║                                                                                      ║
║  测试目标：验证MCP核心能力实现                                                         ║
║  • searchDocuments 工具 - 智能文档搜索                                              ║
║  • extracted_content 资源 - 文档内容提取                                            ║
║  • 支持LLM进行自然语言文档查询和内容问答                                              ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  let child;
  const results = [];

  try {
    // 启动MCP服务器
    log.info("启动 LDIMS MCP 服务器...");
    child = await startMcpServer();
    log.success("MCP 服务器启动成功");

    // 等待服务器完全初始化
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 执行测试
    results.push({ name: "工具列表检查", success: await testToolList(child) });
    results.push({
      name: "资源列表检查",
      success: await testResourceList(child),
    });
    results.push({
      name: "searchDocuments 工具",
      success: await testSearchDocuments(child),
    });
    results.push({
      name: "extracted_content 资源",
      success: await testExtractedContent(child),
    });
    results.push({
      name: "参数验证",
      success: await testParameterValidation(child),
    });
  } catch (error) {
    log.error(`测试执行失败: ${error.message}`);
    results.push({ name: "测试执行", success: false, error: error.message });
  } finally {
    // 清理
    if (child) {
      child.kill();
      log.info("MCP 服务器已关闭");
    }
  }

  // 输出测试结果
  console.log(
    `\n${colors.blue}════════════════════ 测试结果汇总 ════════════════════${colors.reset}\n`
  );

  const successful = results.filter((r) => r.success).length;
  const total = results.length;

  results.forEach((result) => {
    const status = result.success
      ? `${colors.green}✅ 通过${colors.reset}`
      : `${colors.red}❌ 失败${colors.reset}${result.error ? ` - ${result.error}` : ""}`;
    console.log(`  ${result.name}: ${status}`);
  });

  console.log(
    `\n${colors.blue}总体结果: ${successful}/${total} 项测试通过${colors.reset}`
  );

  if (successful === total) {
    console.log(
      `\n${colors.green}🎉 P1-T8 MCP核心能力实现测试全部通过！${colors.reset}`
    );
    console.log(
      `${colors.green}   LLM现在可以通过MCP协议实现：${colors.reset}`
    );
    console.log(
      `${colors.green}   • 智能搜索LDIMS文档 (searchDocuments)${colors.reset}`
    );
    console.log(
      `${colors.green}   • 获取文档内容进行问答 (extracted_content)${colors.reset}`
    );
    console.log(`${colors.green}   • 自然语言交互式文档检索${colors.reset}`);
    process.exit(0);
  } else {
    console.log(
      `\n${colors.red}❌ 部分测试失败，需要修复后再次测试${colors.reset}`
    );
    process.exit(1);
  }
}

// 执行测试
runTests().catch((error) => {
  log.error(`测试执行异常: ${error.message}`);
  process.exit(1);
});

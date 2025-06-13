#!/usr/bin/env node

/**
 * P1-T8 最终测试脚本 - 验证MCP核心能力实现
 */

import { spawn } from "child_process";

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

class McpTester {
  constructor() {
    this.child = null;
    this.testId = 1;
    this.pendingRequests = new Map();
    this.serverReady = false;
  }

  async start() {
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

    await this.startServer();
    await this.runTests();
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      log.info("启动 LDIMS MCP 服务器...");

      this.child = spawn("node", ["dist/index.js"], {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd(),
      });

      let serverOutput = "";

      // 监听stderr（配置信息等）
      this.child.stderr.on("data", (data) => {
        serverOutput += data.toString();
      });

      // 监听stdout（主要输出和MCP响应）
      this.child.stdout.on("data", (data) => {
        const output = data.toString();
        serverOutput += output;

        // 检查服务器启动
        if (
          (output.includes("MCP服务器已启动") ||
            output.includes("等待客户端连接")) &&
          !this.serverReady
        ) {
          this.serverReady = true;
          log.success("MCP 服务器启动成功");
          resolve();
          return;
        }

        // 处理JSON-RPC响应
        try {
          const lines = output.split("\n").filter((line) => line.trim());
          for (const line of lines) {
            if (line.startsWith("{")) {
              const response = JSON.parse(line);
              if (response.id && this.pendingRequests.has(response.id)) {
                const { resolve: reqResolve } = this.pendingRequests.get(
                  response.id
                );
                this.pendingRequests.delete(response.id);
                reqResolve(response);
              }
            }
          }
        } catch (e) {
          // 忽略JSON解析错误
        }
      });

      this.child.on("error", (error) => {
        reject(new Error(`服务器启动失败: ${error.message}`));
      });

      this.child.on("exit", (code) => {
        if (!this.serverReady) {
          reject(new Error(`服务器意外退出，退出码: ${code}`));
        }
      });

      // 启动超时
      setTimeout(() => {
        if (!this.serverReady) {
          reject(new Error("服务器启动超时"));
        }
      }, 15000);
    });
  }

  async sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.testId++;
      const request = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.child.stdin.write(JSON.stringify(request) + "\n");

      // 请求超时
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("请求超时"));
        }
      }, 8000);
    });
  }

  async testToolsList() {
    log.test("测试 1: 工具列表检查");

    try {
      const response = await this.sendRequest("tools/list");

      if (response.error) {
        throw new Error(`请求失败: ${response.error.message}`);
      }

      const tools = response.result?.tools || [];

      // 检查工具数量
      if (tools.length !== 2) {
        throw new Error(`期望2个工具，实际找到${tools.length}个`);
      }

      // 检查searchDocuments工具
      const searchTool = tools.find((tool) => tool.name === "searchDocuments");
      if (!searchTool) {
        throw new Error("缺少 searchDocuments 工具");
      }

      // 检查get_document_file_content工具
      const getContentTool = tools.find(
        (tool) => tool.name === "get_document_file_content"
      );
      if (!getContentTool) {
        throw new Error("缺少 get_document_file_content 工具");
      }

      log.success("工具列表检查通过");
      log.info(`• ${getContentTool.name}`);
      log.info(`• ${searchTool.name}`);

      return true;
    } catch (error) {
      log.error(`工具列表检查失败: ${error.message}`);
      return false;
    }
  }

  async testResourcesList() {
    log.test("测试 2: 资源列表检查");

    try {
      const response = await this.sendRequest("resources/list");

      if (response.error) {
        throw new Error(`请求失败: ${response.error.message}`);
      }

      const resources = response.result?.resources || [];

      if (resources.length !== 1) {
        throw new Error(`期望1个资源，实际找到${resources.length}个`);
      }

      const extractedContentResource = resources[0];
      if (!extractedContentResource.uri.includes("extracted_content")) {
        throw new Error("extracted_content 资源URI不正确");
      }

      log.success("资源列表检查通过");
      log.info(`• ${extractedContentResource.name}`);

      return true;
    } catch (error) {
      log.error(`资源列表检查失败: ${error.message}`);
      return false;
    }
  }

  async testSearchDocuments() {
    log.test("测试 3: searchDocuments 工具调用");

    try {
      const response = await this.sendRequest("tools/call", {
        name: "searchDocuments",
        arguments: {
          query: "技术文档",
          maxResults: 3,
        },
      });

      if (response.error) {
        throw new Error(`工具调用失败: ${response.error.message}`);
      }

      const content = response.result?.content?.[0];
      if (!content || content.type !== "text") {
        throw new Error("响应格式不正确");
      }

      const text = content.text;
      if (
        !text.includes("文档搜索结果") ||
        !text.includes("查询:") ||
        !text.includes("文档ID:")
      ) {
        throw new Error("搜索结果格式不符合预期");
      }

      log.success("searchDocuments 工具调用通过");
      log.info("返回了预期的搜索结果格式");

      return true;
    } catch (error) {
      log.error(`searchDocuments 工具调用失败: ${error.message}`);
      return false;
    }
  }

  async testExtractedContent() {
    log.test("测试 4: extracted_content 资源读取");

    try {
      const response = await this.sendRequest("resources/read", {
        uri: "ldims://docs/test-doc-123/extracted_content",
      });

      if (response.error) {
        throw new Error(`资源读取失败: ${response.error.message}`);
      }

      const contents = response.result?.contents || [];
      if (contents.length === 0) {
        throw new Error("未返回内容");
      }

      const content = contents[0];
      if (!content.uri || !content.text || !content.metadata) {
        throw new Error("内容格式不正确");
      }

      if (!content.uri.includes("test-doc-123")) {
        throw new Error("URI不匹配");
      }

      if (content.text.length < 100) {
        throw new Error("提取的文本内容太短");
      }

      log.success("extracted_content 资源读取通过");
      log.info(`提取内容长度: ${content.text.length} 字符`);

      return true;
    } catch (error) {
      log.error(`extracted_content 资源读取失败: ${error.message}`);
      return false;
    }
  }

  async testParameterValidation() {
    log.test("测试 5: 参数验证");

    try {
      // 测试缺少必需参数
      const response = await this.sendRequest("tools/call", {
        name: "searchDocuments",
        arguments: { maxResults: 5 }, // 缺少query参数
      });

      if (!response.error && !response.result?.isError) {
        throw new Error("应该验证失败但成功了");
      }

      log.success("参数验证正确拒绝了无效请求");
      return true;
    } catch (error) {
      log.error(`参数验证测试失败: ${error.message}`);
      return false;
    }
  }

  async runTests() {
    const tests = [
      { name: "工具列表检查", fn: this.testToolsList.bind(this) },
      { name: "资源列表检查", fn: this.testResourcesList.bind(this) },
      { name: "searchDocuments 工具", fn: this.testSearchDocuments.bind(this) },
      {
        name: "extracted_content 资源",
        fn: this.testExtractedContent.bind(this),
      },
      { name: "参数验证", fn: this.testParameterValidation.bind(this) },
    ];

    const results = [];

    for (const test of tests) {
      try {
        const success = await test.fn();
        results.push({ name: test.name, success });
      } catch (error) {
        log.error(`测试 ${test.name} 异常: ${error.message}`);
        results.push({ name: test.name, success: false, error: error.message });
      }

      // 测试间隔
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    this.showResults(results);
  }

  showResults(results) {
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
    } else {
      console.log(
        `\n${colors.red}❌ 部分测试失败，需要修复后再次测试${colors.reset}`
      );
    }

    this.cleanup();
    process.exit(successful === total ? 0 : 1);
  }

  cleanup() {
    if (this.child) {
      this.child.kill();
      log.info("MCP 服务器已关闭");
    }
  }
}

// 运行测试
const tester = new McpTester();
tester.start().catch((error) => {
  log.error(`测试执行异常: ${error.message}`);
  tester.cleanup();
  process.exit(1);
});

#!/usr/bin/env node

/**
 * 快速测试脚本 - 检查MCP服务器基本功能
 */

import { spawn } from "child_process";

console.log("🧪 快速测试：LDIMS MCP服务器基本功能\n");

// 启动服务器
const child = spawn("node", ["dist/index.js"], {
  stdio: ["pipe", "pipe", "pipe"],
  cwd: process.cwd(),
});

let serverReady = false;

// 监听服务器输出
child.stderr.on("data", (data) => {
  const output = data.toString();
  console.log("📋 服务器输出:", output.trim());
});

child.stdout.on("data", (data) => {
  const output = data.toString();
  console.log("📥 服务器响应:", output.trim());

  // 检查服务器是否启动完成
  if (
    output.includes("LDIMS MCP服务器已启动") ||
    output.includes("等待客户端连接")
  ) {
    if (!serverReady) {
      console.log("✅ 服务器启动成功");
      serverReady = true;

      // 发送一个简单的工具列表请求
      setTimeout(() => {
        console.log("\n🔧 发送工具列表请求...");
        const request = {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        };

        child.stdin.write(JSON.stringify(request) + "\n");
      }, 1000);
    }
    return;
  }

  try {
    const response = JSON.parse(output);
    if (response.result && response.result.tools) {
      console.log(
        `✅ 工具列表响应成功: 找到 ${response.result.tools.length} 个工具`
      );
      response.result.tools.forEach((tool) => {
        console.log(`   • ${tool.name}: ${tool.description}`);
      });

      // 测试完成
      console.log("\n🎉 快速测试完成，服务器运行正常");
      child.kill();
      process.exit(0);
    }
  } catch (e) {
    // 忽略JSON解析错误，继续等待
  }
});

child.on("error", (error) => {
  console.error("❌ 服务器启动失败:", error.message);
  process.exit(1);
});

child.on("exit", (code) => {
  if (!serverReady) {
    console.error("❌ 服务器意外退出，退出码:", code);
    process.exit(1);
  }
});

// 超时处理
setTimeout(() => {
  if (!serverReady) {
    console.error("❌ 服务器启动超时");
    child.kill();
    process.exit(1);
  }
}, 10000);

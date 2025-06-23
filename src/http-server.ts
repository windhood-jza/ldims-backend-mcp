/**
 * HTTP服务器启动入口
 * 独立运行HTTP模式的MCP服务
 */

import { config } from "dotenv";
import { HttpMcpServer } from "./http/server.js";
import { type HttpServerConfig } from "./types/http.js";

// 加载.env文件
config();

async function startHttpServer(): Promise<void> {
  try {
    console.log("🚀 Starting LDIMS MCP HTTP Server...");
    console.log("📝 Using .env configuration for HTTP mode");

    // 验证必要的配置
    if (!process.env.LDIMS_AUTH_TOKEN) {
      throw new Error("LDIMS_AUTH_TOKEN is required in .env file for HTTP mode");
    }

    // 构建HTTP服务器配置
    const httpConfig: HttpServerConfig = {
      port: parseInt(process.env.HTTP_PORT || "3001", 10),
      host: process.env.HTTP_HOST || "0.0.0.0",
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        credentials: process.env.CORS_CREDENTIALS === "true"
      },
      auth: {
        enabled: process.env.HTTP_AUTH_ENABLED === "true",
        token: process.env.LDIMS_AUTH_TOKEN,
        header: process.env.HTTP_AUTH_HEADER || "Authorization"
      }
    };

    console.log("📋 HTTP Server Configuration:");
    console.log(`   - Host: ${httpConfig.host}`);
    console.log(`   - Port: ${httpConfig.port}`);
    console.log(`   - CORS Origin: ${httpConfig.cors.origin}`);
    console.log(`   - Auth Enabled: ${httpConfig.auth.enabled}`);
    console.log(`   - LDIMS Base URL: ${process.env.LDIMS_BASE_URL}`);
    console.log(`   - LDIMS Token: ${process.env.LDIMS_AUTH_TOKEN ? "已配置" : "未配置"}`);

    // 创建并启动HTTP服务器
    const server = new HttpMcpServer(httpConfig);
    await server.start();

    console.log("✅ LDIMS MCP HTTP Server started successfully!");
    console.log("");
    console.log("📊 Available endpoints:");
    console.log(`   - Health Check: http://${httpConfig.host}:${httpConfig.port}/health`);
    console.log(`   - List Tools: http://${httpConfig.host}:${httpConfig.port}/api/tools`);
    console.log(`   - Search Documents: POST http://${httpConfig.host}:${httpConfig.port}/api/tools/searchDocuments`);
    console.log(
      `   - Get File Content: POST http://${httpConfig.host}:${httpConfig.port}/api/tools/get_document_file_content`
    );
    console.log("");
    console.log("🔧 Test with curl:");
    console.log(`   curl http://${httpConfig.host}:${httpConfig.port}/health`);
    console.log("");

    // 优雅关闭处理
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        console.log("✅ HTTP Server stopped successfully");
        process.exit(0);
      } catch (error) {
        console.error("❌ Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (error) {
    console.error("❌ Failed to start HTTP server:", error);
    process.exit(1);
  }
}

// 启动服务器
startHttpServer().catch(error => {
  console.error("❌ Startup error:", error);
  process.exit(1);
});

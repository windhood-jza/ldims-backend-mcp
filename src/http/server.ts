/**
 * HTTP服务器实现
 * 提供RESTful API包装MCP功能
 */

import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { LdimsApiService } from "../services/ldims-api.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";

import { GetDocumentFileContentSchema, SearchDocumentsSchema } from "../types/mcp.js";
import { handleMcpError } from "../utils/error-handler.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { type HealthCheckResponse, type HttpMcpResponse, type HttpServerConfig } from "../types/http.js";

const MAX_REQUEST_BODY_SIZE = "10mb";

export class HttpMcpServer {
  private app: express.Application;
  private server: any;
  private config: HttpServerConfig;
  private ldimsService: LdimsApiService;
  private startTime: number;
  private mcpServer: Server;
  private transport: StreamableHTTPServerTransport;

  constructor(config: HttpServerConfig) {
    this.config = config;
    this.app = express();
    this.startTime = Date.now();
    this.ldimsService = new LdimsApiService({
      baseUrl: process.env.LDIMS_BASE_URL || "http://localhost:3000",
      authToken: process.env.LDIMS_AUTH_TOKEN || "",
      timeout: parseInt(process.env.LDIMS_TIMEOUT || "30000", 10),
      version: process.env.LDIMS_API_VERSION || "v1",
      retryCount: parseInt(process.env.LDIMS_RETRY_COUNT || "3", 10)
    });

    this.setupMiddleware();

    // 创建单一的 Server 和 Transport 实例
    this.mcpServer = new Server({ name: "ldims-http-mcp-server", version: "1.0.0" }, { capabilities: { tools: {} } });
    this.setupMcpServer(this.mcpServer);

    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID
    });

    // 将 server 和 transport 连接起来
    this.mcpServer.connect(this.transport);

    this.setupRoutes();

    this.app.use(this.errorHandler.bind(this));

    console.log("✅ HTTP MCP Server ready to accept connections.");
  }

  private setupMiddleware(): void {
    // CORS配置
    this.app.use(
      cors({
        origin: this.config.cors.origin,
        credentials: this.config.cors.credentials
      })
    );

    // JSON解析 - 确保UTF-8编码支持
    this.app.use(
      express.json({
        limit: MAX_REQUEST_BODY_SIZE,
        type: "application/json"
      })
    );
    this.app.use(
      express.urlencoded({
        extended: true,
        limit: MAX_REQUEST_BODY_SIZE
      })
    );

    // 设置响应头确保UTF-8编码
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      next();
    });

    // 请求日志
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);

      res.on("finish", () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });

      next();
    });

    // 认证中间件
    if (this.config.auth.enabled) {
      this.app.use("/api", this.authMiddleware.bind(this));
    }
  }

  private authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers[this.config.auth.header.toLowerCase()];
    const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!token) {
      this.sendError(res, "AUTH_REQUIRED", "Authentication token required", 401);
      return;
    }

    // 简单Token验证
    const expectedToken = this.config.auth.token;
    if (expectedToken && token !== `Bearer ${expectedToken}`) {
      this.sendError(res, "AUTH_INVALID", "Invalid authentication token", 403);
      return;
    }

    next();
  }

  private setupMcpServer(server: Server): void {
    // 列出工具
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "searchDocuments",
            description: "根据关键词在LDIMS系统中搜索相关文档",
            inputSchema: zodToJsonSchema(SearchDocumentsSchema)
          },
          {
            name: "get_document_file_content",
            description: "获取指定文档ID的原始文件内容",
            inputSchema: zodToJsonSchema(GetDocumentFileContentSchema)
          }
        ]
      };
    });

    // 调用工具
    server.setRequestHandler(CallToolRequestSchema, async request => {
      try {
        const { name: tool, arguments: args } = request.params;

        let result: any;
        switch (tool) {
          case "searchDocuments":
            result = await this.ldimsService.searchDocuments(args as any);
            break;
          case "get_document_file_content":
            result = await this.ldimsService.getDocumentFileContent((args as any).file_id);
            break;
          default:
            throw new Error(`Tool ${tool} not found`);
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const mcpError = handleMcpError(error);
        return {
          content: [
            {
              type: "text",
              text: mcpError.userMessage ?? mcpError.message
            }
          ],
          isError: true
        };
      }
    });
  }

  private setupRoutes(): void {
    // 统一的MCP端点
    this.app.all("/mcp", this.handleMcpRequest.bind(this));
    this.app.all("/mcp/:sessionId", this.handleMcpRequest.bind(this));

    // 健康检查
    this.app.get("/health", this.handleHealthCheck.bind(this));

    // 获取可用工具列表
    this.app.get("/api/tools", this.handleListTools.bind(this));

    // 根路径
    this.app.get("/", (_req: Request, res: Response) => {
      res.json({
        name: "LDIMS MCP HTTP Server",
        version: "1.0.0",
        status: "running",
        endpoints: {
          health: "/health",
          tools: "/api/tools",
          toolCall: "/api/tools/:toolName",
          batchCall: "/api/tools"
        }
      });
    });
  }

  private async handleHealthCheck(_req: Request, res: Response): Promise<void> {
    try {
      const uptime = Date.now() - this.startTime;

      // 检查LDIMS API连接
      let ldimsApiHealthy = false;
      try {
        await this.ldimsService.searchDocuments({ query: "test", maxResults: 1 });
        ldimsApiHealthy = true;
      } catch (error) {
        console.warn("LDIMS API health check failed:", error);
      }

      const response: HealthCheckResponse = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        uptime,
        services: {
          mcp: true,
          ldims_api: ldimsApiHealthy
        }
      };

      res.json(response);
    } catch (error) {
      this.sendError(res, "HEALTH_CHECK_FAILED", "Health check failed", 500, error);
    }
  }

  private async handleListTools(_req: Request, res: Response): Promise<void> {
    try {
      const tools = [
        {
          name: "searchDocuments",
          description: "搜索LDIMS文档",
          parameters: {
            query: { type: "string", required: true },
            maxResults: { type: "number", default: 5 },
            filters: { type: "object", required: false }
          }
        },
        {
          name: "get_document_file_content",
          description: "获取文档文件内容",
          parameters: {
            file_id: { type: "string", required: true }
          }
        }
      ];

      this.sendSuccess(res, tools);
    } catch (error) {
      this.sendError(res, "LIST_TOOLS_FAILED", "Failed to list tools", 500, error);
    }
  }

  private async handleMcpRequest(req: Request, res: Response): Promise<void> {
    try {
      // 所有MCP请求都由 transport 实例处理
      await this.transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error(`Error handling MCP request:`, error);
      if (!res.headersSent) {
        this.sendError(res, "REQUEST_HANDLING_FAILED", "Failed to handle MCP request", 500, error);
      }
    }
  }

  private sendSuccess(res: Response, data: any, executionTime?: number): void {
    const response: HttpMcpResponse = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      executionTime
    };
    res.json(response);
  }

  private sendError(
    res: Response,
    code: string,
    message: string,
    status: number = 500,
    error?: any,
    executionTime?: number
  ): void {
    const response: HttpMcpResponse = {
      success: false,
      error: {
        code,
        message,
        details: error?.message || error
      },
      timestamp: new Date().toISOString(),
      executionTime
    };
    res.status(status).json(response);
  }

  private errorHandler(error: any, _req: Request, res: Response, next: NextFunction): void {
    console.error("HTTP Server Error:", error);

    if (res.headersSent) {
      return next(error);
    }

    this.sendError(res, "INTERNAL_ERROR", "Internal server error", 500, error);
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          console.log(`🚀 LDIMS MCP HTTP Server running on http://${this.config.host}:${this.config.port}`);
          console.log(`📊 Health check: http://${this.config.host}:${this.config.port}/health`);
          console.log(`🔧 API endpoints: http://${this.config.host}:${this.config.port}/api/tools`);
          resolve();
        });

        this.server.on("error", (error: any) => {
          console.error("HTTP Server startup error:", error);
          reject(error);
        });
      } catch (error) {
        console.error(`❌ Failed to start server:`, error);
        process.exit(1);
      }
    });
  }

  public async stop(): Promise<void> {
    if (this.server) {
      console.log("\n gracefully shutting down the server...");

      this.server.close((err: any) => {
        if (err) {
          console.error("❌ Error during server shutdown:", err);
          process.exit(1);
        }
        console.log("✅ Server shut down successfully.");
        process.exit(0);
      });
    }
  }
}

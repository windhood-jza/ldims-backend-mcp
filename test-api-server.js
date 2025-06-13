/**
 * 简单的Mock LDIMS API服务器
 * 用于测试P3阶段的API集成功能
 */

import express from "express";
import cors from "cors";

const app = express();
const port = 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// 健康检查端点
app.get("/api/v1/health", (req, res) => {
  res.json({
    status: "ok",
    version: "v1",
    timestamp: new Date().toISOString(),
    service: "ldims-api-mock"
  });
});

// 文档搜索端点
app.get("/api/v1/documents/search", (req, res) => {
  const { query, limit = 5, search_mode = "semantic" } = req.query;

  console.log(`[API] 搜索请求: "${query}", 限制: ${limit}, 模式: ${search_mode}`);

  if (!query) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "搜索查询不能为空"
      }
    });
  }

  // 模拟搜索结果
  const mockResults = [
    {
      document_id: "real-doc-001",
      document_name: `真实API: 关于"${query}"的技术文档.pdf`,
      relevance_score: 0.92,
      matched_context: `这是通过真实LDIMS API搜索到的关于${query}的内容摘要。本文档包含详细的技术规范和实施指南...`,
      created_at: "2024-01-15T10:30:00Z",
      submitter: "真实API用户",
      document_type: "PDF",
      department_name: "技术部门"
    },
    {
      document_id: "real-doc-002",
      document_name: `真实API: ${query}操作手册.docx`,
      relevance_score: 0.85,
      matched_context: `通过真实API获取的${query}操作手册，包含完整的操作流程...`,
      created_at: "2024-01-12T14:20:00Z",
      submitter: "真实API管理员",
      document_type: "Word",
      department_name: "运维部门"
    }
  ];

  res.json({
    success: true,
    data: {
      results: mockResults.slice(0, parseInt(limit)),
      total: mockResults.length,
      count: Math.min(mockResults.length, parseInt(limit))
    }
  });
});

// 文档内容提取端点
app.get("/api/v1/documents/:documentId/extracted-content", (req, res) => {
  const { documentId } = req.params;

  console.log(`[API] 内容提取请求: ${documentId}`);

  // 模拟提取的内容
  const extractedContent = {
    success: true,
    data: {
      content: `这是通过真实LDIMS API提取的文档内容 (ID: ${documentId})。

【文档标题】真实API集成测试文档

【内容摘要】
本文档用于验证P3阶段的API集成功能，确保MCP服务能够正确调用真实的LDIMS API端点。

【技术细节】
1. API集成架构
   - 使用RESTful API设计
   - 支持JSON数据格式
   - 实现错误处理和重试机制

2. 资源访问模式
   - extracted_content资源通过URI: ldims://docs/${documentId}/extracted_content
   - 支持动态文档ID解析
   - 在API失败时自动fallback到Mock数据

3. 错误处理策略
   - 网络连接失败: 使用本地Mock数据
   - 认证错误: 记录错误并使用fallback
   - 超时处理: 配置合理的超时时间

【测试验证】
✅ API健康检查
✅ 文档搜索功能  
✅ 内容提取功能
✅ 错误处理机制
✅ Fallback机制

【结论】
真实API集成测试成功！MCP服务可以正确调用LDIMS API并在需要时使用Mock数据作为备选方案。`,
      document_name: `真实API文档-${documentId}`,
      extracted_at: new Date().toISOString(),
      format: "text/plain",
      file_size: 2048,
      status: "completed"
    }
  };

  res.json(extractedContent);
});

// 文件内容获取端点
app.get("/api/v1/files/:fileId/content", (req, res) => {
  const { fileId } = req.params;
  const { include_metadata = "false", format = "text" } = req.query;

  console.log(`[API] 文件内容请求: ${fileId}, metadata: ${include_metadata}, format: ${format}`);

  const fileContent = {
    success: true,
    data: {
      file_id: fileId,
      filename: `真实API文件-${fileId}.txt`,
      content: `这是通过真实LDIMS API获取的文件内容 (ID: ${fileId})。\n\n文件内容验证：API集成测试成功！`,
      size: 1024,
      mime_type: "text/plain",
      created_at: "2024-01-10T08:00:00Z",
      updated_at: new Date().toISOString()
    }
  };

  if (include_metadata === "false") {
    delete fileContent.data.size;
    delete fileContent.data.mime_type;
    delete fileContent.data.created_at;
    delete fileContent.data.updated_at;
  }

  res.json(fileContent);
});

// 404处理
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `端点不存在: ${req.method} ${req.originalUrl}`
    }
  });
});

// 启动服务器
app.listen(port, () => {
  console.log(`🚀 Mock LDIMS API服务器已启动`);
  console.log(`📍 地址: http://localhost:${port}`);
  console.log(`🔍 健康检查: http://localhost:${port}/api/v1/health`);
  console.log(`📝 用于P3阶段API集成测试`);
  console.log(`---`);
});

// 优雅关闭
process.on("SIGINT", () => {
  console.log("\n🔄 正在关闭Mock API服务器...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🔄 正在关闭Mock API服务器...");
  process.exit(0);
});

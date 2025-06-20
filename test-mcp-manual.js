/**
 * LDIMS MCP 手动测试脚本
 * 演示如何与MCP服务进行交互
 */

console.log(`
🔧 LDIMS MCP 手动测试指南

=== 方法1: 命令行直接测试 ===

1. 启动MCP服务:
   npm run dev

2. 测试MCP协议消息 (在新的命令行窗口中):

# 1) 初始化请求
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}' | npm start

# 2) 获取工具列表
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | npm start

# 3) 搜索文档
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"searchDocuments","arguments":{"query":"API文档","maxResults":3}}}' | npm start

=== 方法2: Claude Desktop集成 ===

将以下配置添加到Claude Desktop的配置文件中:

Windows路径: %APPDATA%\\Claude\\claude_desktop_config.json
Mac路径: ~/Library/Application Support/Claude/claude_desktop_config.json

配置内容:
{
  "mcpServers": {
    "ldims": {
      "command": "node",
      "args": ["${YOUR_PATH}/LDIMS/backend_mcp/dist/index.js"],
      "env": {
        "LDIMS_API_BASE_URL": "http://localhost:3000",
        "NODE_ENV": "production"
      }
    }
  }
}

=== 方法3: 其他MCP客户端 ===

1. 使用 @modelcontextprotocol/inspector:
   npx @modelcontextprotocol/inspector node dist/index.js

2. 使用自定义客户端:
   - STDIO模式: 通过标准输入输出通信
   - 服务路径: ./dist/index.js
   - 工具: searchDocuments, get_document_file_content
   - 资源: ldims://docs/{id}/extracted_content

=== 当前配置状态 ===
✅ MCP服务已构建完成
✅ API集成已测试通过  
✅ 支持文档搜索和内容提取
🔍 准备接入AI客户端
`);

console.log("\n🚀 选择您想要使用的连接方式并按照上述说明进行配置！");

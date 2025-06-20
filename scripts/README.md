# LDIMS MCP 脚本工具

本目录包含LDIMS MCP服务的实用脚本工具。

## 🚀 快速开始

### 完整部署流程

1. **生成长期Token**

   ```bash
   node scripts/get-long-term-token.js
   ```

2. **编译项目**

   ```bash
   npm run build
   ```

3. **测试API连接**

   ```bash
   node scripts/test-api-connection.js
   ```

4. **配置AI工具** - 参考下方"MCP服务注册配置"部分

5. **重启AI工具** - 重启Cursor或Claude Desktop以加载新配置

## 📋 脚本说明

### 🔑 Token管理脚本

#### `get-fresh-token.js`

生成新的认证Token（24小时有效期）

```bash
node scripts/get-fresh-token.js
```

#### `get-long-term-token.js`

生成长期有效的认证Token（约7.5年有效期）

```bash
node scripts/get-long-term-token.js
```

#### `update-env-token.js`

更新环境文件中的Token配置

```bash
node scripts/update-env-token.js <new_token>
```

### 🧪 测试脚本

#### `test-api-connection.js`

全面测试LDIMS API连接和功能

```bash
node scripts/test-api-connection.js
```

**测试内容：**

- ✅ 健康检查
- ✅ 文档搜索功能
- ✅ 文档内容获取功能
- ✅ API响应时间和数据质量

## 🚀 使用场景

### 初次部署

1. 运行 `get-long-term-token.js` 生成长期Token
2. 运行 `test-api-connection.js` 验证API连接
3. 在AI工具中注册MCP服务（见下方配置说明）

### Token过期处理

1. 运行 `get-fresh-token.js` 或 `get-long-term-token.js` 生成新Token
2. 运行 `update-env-token.js` 更新配置文件
3. 重启MCP服务

### 功能测试

1. 运行 `test-api-connection.js` 进行全面测试
2. 检查测试结果确保所有功能正常

## 🔧 MCP服务注册配置

### 在Cursor中配置

在Cursor的MCP配置文件中添加以下配置：

**配置文件位置**:

- Windows: `%APPDATA%\Cursor\User\globalStorage\cursor.mcp\config.json`
- macOS: `~/Library/Application Support/Cursor/User/globalStorage/cursor.mcp/config.json`
- Linux: `~/.config/Cursor/User/globalStorage/cursor.mcp/config.json`

```json
{
  "ldims": {
    "command": "node",
    "args": ["D:/DEV/LDIMS/backend_mcp/dist/index.js"],
    "env": {
      "LDIMS_API_BASE_URL": "http://localhost:3000",
      "LDIMS_API_VERSION": "v1",
      "LDIMS_AUTH_TOKEN": "your_long_term_token_here",
      "NODE_ENV": "production"
    }
  }
}
```

### 在Claude Desktop中配置

**配置文件位置**:

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

在Claude Desktop的配置文件中添加：

```json
{
  "mcpServers": {
    "ldims": {
      "command": "node",
      "args": ["D:/DEV/LDIMS/backend_mcp/dist/index.js"],
      "env": {
        "LDIMS_API_BASE_URL": "http://localhost:3000",
        "LDIMS_API_VERSION": "v1",
        "LDIMS_AUTH_TOKEN": "your_long_term_token_here",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 配置说明

- **command**: 使用 `node` 命令运行编译后的JavaScript文件
- **args**: 指向编译后的 `dist/index.js` 文件的绝对路径
- **LDIMS_API_BASE_URL**: 使用HTTP地址，不是文件路径（如：`http://localhost:3000`）
- **LDIMS_AUTH_TOKEN**: 使用 `get-long-term-token.js` 生成的长期Token
- **NODE_ENV**: 设置为 `production` 以获得最佳性能

⚠️ **重要提醒**：

1. 路径必须使用绝对路径，根据您的实际安装位置调整
2. 确保先运行 `npm run build` 编译项目
3. 确保LDIMS后端服务在 `http://localhost:3000` 运行

## ⚠️ 注意事项

- 确保LDIMS后端服务正在运行
- Token生成需要有效的数据库连接
- 测试脚本需要编译后的代码（先运行 `npm run build`）
- 所有脚本都会读取项目根目录的 `.env` 文件

## 📞 故障排除

如果脚本运行失败：

1. 检查LDIMS后端服务状态
2. 验证数据库连接
3. 确认环境变量配置
4. 查看控制台错误信息

## 🔧 开发说明

这些脚本是项目的核心工具，请不要随意修改。如需添加新功能，请：

1. 遵循现有的代码风格
2. 添加适当的错误处理
3. 更新此README文档

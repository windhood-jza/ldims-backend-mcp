# LDIMS MCP 服务故障排除指南

> **常见问题诊断和解决方案**

## 📋 目录

- [快速诊断](#快速诊断)
- [启动问题](#启动问题)
- [配置问题](#配置问题)
- [API 连接问题](#api-连接问题)
- [性能问题](#性能问题)
- [错误代码参考](#错误代码参考)
- [日志分析](#日志分析)
- [调试工具](#调试工具)

## 🔍 快速诊断

### 健康检查清单

在深入排查问题之前，请先完成以下基础检查：

- [ ] Node.js 版本 >= 18.0.0
- [ ] npm 依赖已正确安装
- [ ] `.env` 文件存在且配置正确
- [ ] LDIMS 后端服务正在运行
- [ ] 网络连接正常
- [ ] 磁盘空间充足

### 快速诊断命令

```bash
# 检查 Node.js 版本
node --version

# 检查项目依赖
npm list --depth=0

# 检查配置
npm run config:check

# 检查构建状态
npm run build

# 运行健康检查
npm run health:check
```

## 🚀 启动问题

### 问题 1: Cannot find module 错误

**错误信息**:
```
Error: Cannot find module './dist/index.js'
```

**原因分析**:
- 项目未构建或构建失败
- dist 目录不存在或为空

**解决方案**:
```bash
# 清理并重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 重新构建项目
npm run build

# 检查构建输出
ls -la dist/
```

### 问题 2: 端口占用错误

**错误信息**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案**:
```bash
# 查找占用端口的进程
netstat -tulpn | grep :3000

# 杀死占用进程
kill -9 <PID>

# 或者使用不同端口
export PORT=3001
npm start
```

### 问题 3: 权限错误

**错误信息**:
```
Error: EACCES: permission denied
```

**解决方案**:
```bash
# 检查文件权限
ls -la

# 修复权限（Linux/macOS）
chmod +x scripts/*
sudo chown -R $USER:$USER .

# Windows 下以管理员身份运行
```

## ⚙️ 配置问题

### 问题 1: 环境变量验证失败

**错误信息**:
```
ConfigError: 环境变量验证失败:
  • LDIMS_API_BASE_URL: Required
```

**解决方案**:
1. **检查 .env 文件**:
   ```bash
   # 确认文件存在
   ls -la .env
   
   # 检查文件内容
   cat .env
   ```

2. **复制模板文件**:
   ```bash
   cp .env.example .env
   ```

3. **编辑配置**:
   ```env
   # 必需配置
   LDIMS_API_BASE_URL=http://localhost:3000/api
   
   # 可选配置
   LDIMS_API_TIMEOUT=30000
   LOG_LEVEL=info
   ```

### 问题 2: 配置格式错误

**错误信息**:
```
ConfigError: 无效的LDIMS API URL: invalid-url
```

**解决方案**:
```env
# ❌ 错误格式
LDIMS_API_BASE_URL=invalid-url

# ✅ 正确格式
LDIMS_API_BASE_URL=http://localhost:3000/api
LDIMS_API_BASE_URL=https://api.ldims.com/v1
```

### 问题 3: 数字类型配置错误

**错误信息**:
```
ConfigError: Expected number, received string
```

**解决方案**:
```env
# ❌ 错误：包含非数字字符
LDIMS_API_TIMEOUT=30000ms

# ✅ 正确：纯数字
LDIMS_API_TIMEOUT=30000
LDIMS_API_RETRY_COUNT=3
```

## 🔗 API 连接问题

### 问题 1: LDIMS API 连接失败

**错误信息**:
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**诊断步骤**:
1. **检查 LDIMS 后端状态**:
   ```bash
   # 检查服务是否运行
   curl http://localhost:3000/api/health
   
   # 检查端口监听
   netstat -tulpn | grep :3000
   ```

2. **检查网络连接**:
   ```bash
   # 测试网络连通性
   ping localhost
   telnet localhost 3000
   ```

3. **检查防火墙设置**:
   ```bash
   # Linux 检查防火墙
   sudo ufw status
   
   # Windows 检查防火墙
   netsh advfirewall show allprofiles
   ```

**解决方案**:
- 启动 LDIMS 后端服务
- 检查 API 基础 URL 配置
- 确认网络连接正常
- 调整防火墙规则

### 问题 2: API 认证失败

**错误信息**:
```
Error: 401 Unauthorized
```

**解决方案**:
```env
# 检查认证令牌配置
LDIMS_AUTH_TOKEN=your-valid-token-here

# 或者联系管理员获取有效令牌
```

### 问题 3: API 超时

**错误信息**:
```
Error: timeout of 30000ms exceeded
```

**解决方案**:
```env
# 增加超时时间
LDIMS_API_TIMEOUT=60000

# 或者检查网络延迟
ping api.ldims.com
```

## ⚡ 性能问题

### 问题 1: 响应时间过长

**诊断方法**:
```bash
# 启用性能监控
export LOG_LEVEL=debug
npm run dev

# 查看响应时间日志
tail -f logs/mcp-service.log | grep "execution_time"
```

**优化方案**:
1. **增加并发处理**:
   ```env
   # 调整并发限制
   MAX_CONCURRENT_REQUESTS=10
   ```

2. **启用缓存**:
   ```env
   # 启用结果缓存
   ENABLE_CACHE=true
   CACHE_TTL=300
   ```

3. **优化查询参数**:
   ```json
   {
     "query": "具体的搜索词",
     "maxResults": 5
   }
   ```

### 问题 2: 内存使用过高

**监控命令**:
```bash
# 监控内存使用
top -p $(pgrep -f "node.*index.js")

# 或使用 htop
htop -p $(pgrep -f "node.*index.js")
```

**解决方案**:
1. **重启服务**:
   ```bash
   npm run restart
   ```

2. **调整内存限制**:
   ```bash
   # 增加 Node.js 内存限制
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm start
   ```

3. **检查内存泄漏**:
   ```bash
   # 生成内存快照
   npm run memory:profile
   ```

## 🚨 错误代码参考

### MCP 错误代码

| 错误代码 | 描述 | 常见原因 | 解决方案 |
|----------|------|----------|----------|
| `INVALID_PARAMS` | 参数验证失败 | 参数类型错误、缺少必需参数 | 检查参数格式和类型 |
| `TOOL_NOT_FOUND` | 工具不存在 | 调用了不存在的工具名称 | 检查工具名称拼写 |
| `RESOURCE_NOT_FOUND` | 资源不存在 | 请求了不存在的资源 | 检查资源 URI 格式 |
| `API_ERROR` | API 调用失败 | LDIMS 后端 API 不可用 | 检查后端服务状态 |
| `TIMEOUT` | 请求超时 | 网络延迟或服务器响应慢 | 增加超时时间或检查网络 |
| `INTERNAL_ERROR` | 内部错误 | 服务器内部异常 | 查看详细日志，联系技术支持 |

### HTTP 状态码

| 状态码 | 描述 | 处理方式 |
|--------|------|----------|
| 400 | 请求参数错误 | 检查请求参数格式 |
| 401 | 认证失败 | 检查认证令牌 |
| 403 | 权限不足 | 联系管理员分配权限 |
| 404 | 资源不存在 | 检查资源路径 |
| 500 | 服务器内部错误 | 查看服务器日志 |
| 502 | 网关错误 | 检查上游服务状态 |
| 503 | 服务不可用 | 等待服务恢复或联系管理员 |

## 📊 日志分析

### 日志级别

- **ERROR**: 错误信息，需要立即处理
- **WARN**: 警告信息，可能影响功能
- **INFO**: 一般信息，正常运行状态
- **DEBUG**: 调试信息，详细执行过程

### 日志格式

```json
{
  "timestamp": "2024-12-19T10:30:00.000Z",
  "level": "INFO",
  "message": "MCP tool called",
  "tool": "searchDocuments",
  "params": {
    "query": "技术文档",
    "maxResults": 5
  },
  "execution_time": "245ms",
  "request_id": "req-12345"
}
```

### 常用日志查询

```bash
# 查看错误日志
grep "ERROR" logs/mcp-service.log

# 查看特定工具的调用
grep "searchDocuments" logs/mcp-service.log

# 查看响应时间超过 1 秒的请求
grep -E "execution_time.*[0-9]{4,}ms" logs/mcp-service.log

# 实时监控日志
tail -f logs/mcp-service.log | grep -E "(ERROR|WARN)"
```

## 🛠️ 调试工具

### 内置调试命令

```bash
# 配置检查
npm run config:check

# 连接测试
npm run test:connection

# 性能分析
npm run analyze

# 内存分析
npm run memory:profile
```

### 外部工具

1. **网络调试**:
   ```bash
   # 使用 curl 测试 API
   curl -X GET "http://localhost:3000/api/health"
   
   # 使用 wget 下载响应
   wget -O - "http://localhost:3000/api/health"
   ```

2. **进程监控**:
   ```bash
   # 监控进程状态
   ps aux | grep node
   
   # 监控资源使用
   top -p $(pgrep -f node)
   ```

3. **网络监控**:
   ```bash
   # 监控网络连接
   netstat -tulpn | grep node
   
   # 监控网络流量
   iftop -i eth0
   ```

### VS Code 调试配置

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug MCP Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/index.ts",
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      },
      "runtimeArgs": ["-r", "tsx/cjs"],
      "console": "integratedTerminal"
    }
  ]
}
```

## 🆘 获取帮助

### 自助资源

1. **查看文档**:
   - [README.md](../README.md)
   - [API 参考](API_REFERENCE.md)
   - [开发者指南](DEVELOPER_GUIDE.md)

2. **搜索已知问题**:
   - 项目 Issues
   - 常见问题 FAQ

3. **社区支持**:
   - GitHub Discussions
   - 技术论坛

### 联系技术支持

如果问题仍未解决，请提供以下信息：

1. **环境信息**:
   ```bash
   # 收集环境信息
   npm run env:info
   ```

2. **错误日志**:
   ```bash
   # 导出最近的错误日志
   tail -n 100 logs/mcp-service.log > error-report.log
   ```

3. **配置信息**:
   ```bash
   # 导出配置（隐藏敏感信息）
   npm run config:export
   ```

4. **重现步骤**:
   - 详细描述问题发生的步骤
   - 提供最小重现示例
   - 说明预期行为和实际行为

---

**维护团队**: LDIMS 技术支持  
**最后更新**: 2024年12月  
**文档版本**: 1.0.0
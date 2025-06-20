import { writeFileSync, readFileSync } from 'fs';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MDMyODU5OSwiZXhwIjoxNzUwNDE0OTk5fQ.CfgcvLAocv5_vYdbHZ_mliUaubVWbHf4fDPwX-bllrE';

const envContent = `# LDIMS MCP 服务配置
LDIMS_API_BASE_URL=http://localhost:3000
LDIMS_API_VERSION=v1
LDIMS_AUTH_TOKEN=${token}
NODE_ENV=development
LOG_LEVEL=info
`;

writeFileSync('.env', envContent, 'utf8');
console.log('✅ .env文件已更新，包含最新的认证token');
console.log('📝 配置内容:');
console.log(envContent); 
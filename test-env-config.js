import dotenv from 'dotenv';

// 手动加载.env文件
dotenv.config();

console.log('🔧 环境变量配置检查:');
console.log('================================');
console.log('LDIMS_API_BASE_URL:', process.env.LDIMS_API_BASE_URL);
console.log('LDIMS_API_VERSION:', process.env.LDIMS_API_VERSION);
console.log('LDIMS_AUTH_TOKEN:', process.env.LDIMS_AUTH_TOKEN ? '✅ 已设置' : '❌ 未设置');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('LOG_LEVEL:', process.env.LOG_LEVEL);

if (process.env.LDIMS_AUTH_TOKEN) {
  console.log('\n🔑 Token详情:');
  console.log('长度:', process.env.LDIMS_AUTH_TOKEN.length);
  console.log('前缀:', process.env.LDIMS_AUTH_TOKEN.substring(0, 20) + '...');
} else {
  console.log('\n❌ Token未正确配置!');
} 
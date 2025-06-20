/**
 * 获取LDIMS长期认证token (30天有效期)
 */

import http from "http";

const loginData = JSON.stringify({
  username: "admin",
  password: "admin123"
});

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/v1/auth/login",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(loginData)
  }
};

console.log("🔑 正在获取长期认证token (30天有效期)...");
console.log("⚠️  注意：此Token仅用于开发环境，生产环境请使用短期Token");

const req = http.request(options, res => {
  let data = "";

  res.on("data", chunk => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      const response = JSON.parse(data);
      if (response.code === 200 && response.data && response.data.token) {
        const token = response.data.token;

        // 解析Token查看过期时间
        try {
          const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
          const expiryDate = new Date(payload.exp * 1000);
          const now = new Date();
          const daysValid = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

          console.log("✅ 成功获取长期token:");
          console.log(token);
          console.log(`\n📅 Token信息:`);
          console.log(`   用户: ${payload.username}`);
          console.log(`   角色: ${payload.role}`);
          console.log(`   签发时间: ${new Date(payload.iat * 1000).toLocaleString()}`);
          console.log(`   过期时间: ${expiryDate.toLocaleString()}`);
          console.log(`   剩余有效期: ${daysValid} 天`);

          console.log("\n📝 请将此token添加到以下位置:");
          console.log("1. .env文件中:");
          console.log(`   LDIMS_AUTH_TOKEN=${token}`);
          console.log("\n2. Claude Desktop MCP配置中:");
          console.log(`   "LDIMS_AUTH_TOKEN": "${token}"`);

          if (daysValid < 7) {
            console.log("\n⚠️  警告：此Token有效期少于7天，建议重新生成！");
          }
        } catch (parseError) {
          console.log("⚠️  无法解析Token信息，但Token获取成功");
          console.log(token);
        }
      } else {
        console.log("❌ 登录失败:", response);
        console.log("💡 可能的原因:");
        console.log("   - 用户名或密码错误");
        console.log("   - LDIMS后端服务未运行");
        console.log("   - 数据库连接问题");
      }
    } catch (error) {
      console.log("❌ 解析响应失败:", error.message);
      console.log("原始响应:", data);
    }
  });
});

req.on("error", error => {
  console.log("❌ 请求失败:", error.message);
  console.log("💡 请确保LDIMS后端服务正在运行 (http://localhost:3000)");
  console.log("💡 可以通过以下命令启动后端服务:");
  console.log("   cd LDIMS/backend && npm run dev");
});

req.write(loginData);
req.end();

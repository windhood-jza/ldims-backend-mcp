/**
 * 获取LDIMS新的认证token
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

console.log("🔑 正在获取新的认证token...");

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
        console.log("✅ 成功获取token:");
        console.log(token);
        console.log("\n📝 请将此token添加到.env文件中:");
        console.log(`LDIMS_AUTH_TOKEN=${token}`);
      } else {
        console.log("❌ 登录失败:", response);
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
});

req.write(loginData);
req.end();

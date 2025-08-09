#!/usr/bin/env node

/**
 * generate-token.js
 * ------------------
 * 根据提供的 JWT_SECRET 生成一枚长期有效的 JWT，默认 3 年（1095 天）。
 *
 * 用法示例：
 *   node scripts/generate-token.js --secret "<JWT_SECRET>" [--user admin] [--role admin] [--days 1095]
 */

import jwt from "jsonwebtoken";
import { argv, exit } from "process";

/**
 * 将命令行参数解析为对象
 */
function parseArgs() {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[key] = value;
    }
  }
  return out;
}

const args = parseArgs();

if (!args.secret) {
  console.error("❌  必须提供 --secret <JWT_SECRET>");
  console.error('示例: node scripts/generate-token.js --secret "<JWT_SECRET>"');
  exit(1);
}

const username = args.user || "admin";
const role = args.role || "admin";
const days = parseInt(args.days || "1095", 10);

if (isNaN(days) || days <= 0) {
  console.error("❌  --days 必须是正整数");
  exit(1);
}

// 这里假设管理员的用户 ID 为 1；如有需要可改为其它值
const payload = {
  id: 1,
  username,
  role
};

const token = jwt.sign(payload, args.secret, { expiresIn: `${days}d` });

console.log("✅  成功生成 JWT Token:\n");
console.log(token);
console.log(`\n📅  有效期: ${days} 天`);
console.log("\n📝  请将下列内容写入 backend_mcp/.env:\n");
console.log(`LDIMS_AUTH_TOKEN=${token}\n`);

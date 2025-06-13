#!/usr/bin/env node

/**
 * ESLint问题批量修复脚本
 *
 * 专门处理常见的ESLint错误
 */

const fs = require("fs");
const path = require("path");

/**
 * 修复文件中的ESLint问题
 */
function fixEslintIssues(filePath) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    const originalContent = content;
    let modified = false;

    console.log(`🔧 修复文件: ${path.basename(filePath)}`);

    // 1. 修复 nullish coalescing 问题 (|| -> ??)
    // 匹配 variable || defaultValue 模式，但排除逻辑运算
    content = content.replace(
      /(\w+(?:\.\w+)*)\s*\|\|\s*([^|&\n;,)]+)/g,
      (match, left, right) => {
        // 跳过已经是 ?? 的情况
        if (match.includes("??")) return match;
        // 跳过逻辑运算符
        if (match.includes("||=") || match.includes("&&")) return match;
        // 跳过字符串中的内容
        if (match.includes('"') || match.includes("'")) return match;

        console.log(
          `   🔄 ${left} || ${right.trim()} -> ${left} ?? ${right.trim()}`
        );
        modified = true;
        return `${left} ?? ${right}`;
      }
    );

    // 2. 修复 ||= 为 ??=
    content = content.replace(/(\w+(?:\.\w+)*)\s*\|\|=/g, (match, variable) => {
      console.log(`   🔄 ${variable} ||= -> ${variable} ??=`);
      modified = true;
      return `${variable} ??=`;
    });

    // 3. 修复未使用的错误变量
    const errorMatches = content.match(/catch\s*\(\s*error\s*\)/g);
    if (errorMatches) {
      content = content.replace(/catch\s*\(\s*error\s*\)/g, "catch (_error)");
      console.log(`   🔄 修复 ${errorMatches.length} 个未使用的错误变量`);
      modified = true;
    }

    // 4. 修复重复导入 - 移除重复的import语句
    const lines = content.split("\\n");
    const importLines = [];
    const nonImportLines = [];
    const seenImports = new Set();
    let removedImports = 0;

    for (const line of lines) {
      if (line.trim().startsWith("import ")) {
        const importKey = line.trim();
        if (!seenImports.has(importKey)) {
          seenImports.add(importKey);
          importLines.push(line);
        } else {
          console.log(`   ❌ 移除重复导入: ${importKey}`);
          removedImports++;
          modified = true;
        }
      } else {
        nonImportLines.push(line);
      }
    }

    if (removedImports > 0) {
      content = [...importLines, ...nonImportLines].join("\\n");
    }

    // 5. 修复不必要的转义字符
    const escapeMatches = content.match(/\\\\\//g);
    if (escapeMatches) {
      content = content.replace(/\\\\\//g, "/");
      console.log(`   🔄 修复 ${escapeMatches.length} 个不必要的转义字符`);
      modified = true;
    }

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`   ✅ 已修复`);
      return true;
    } else {
      console.log(`   ℹ️  无需修复`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ 修复失败: ${error.message}`);
    return false;
  }
}

/**
 * 获取需要修复的文件
 */
function getFilesToFix() {
  const srcDir = path.join(__dirname, "..", "src");
  const files = [];

  function scanDir(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (item.endsWith(".ts") && !item.endsWith(".d.ts")) {
        files.push(fullPath);
      }
    }
  }

  scanDir(srcDir);
  return files;
}

/**
 * 主函数
 */
function main() {
  console.log("🚀 开始批量修复ESLint问题...\\n");

  const files = getFilesToFix();
  let fixedCount = 0;

  for (const file of files) {
    if (fixEslintIssues(file)) {
      fixedCount++;
    }
  }

  console.log(`\\n📊 修复完成: ${fixedCount}/${files.length} 个文件被修复`);

  if (fixedCount > 0) {
    console.log("\\n🎨 运行代码格式化...");
    const { execSync } = require("child_process");
    try {
      execSync("npm run format", {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit",
      });
      console.log("✅ 代码格式化完成");
    } catch (error) {
      console.warn("⚠️  代码格式化失败:", error.message);
    }
  }

  console.log("\\n🔍 检查剩余问题...");
}

// 运行主函数
main();

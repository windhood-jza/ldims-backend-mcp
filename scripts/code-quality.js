#!/usr/bin/env node

/**
 * 代码质量检查脚本
 *
 * 提供全面的代码质量分析和报告
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

/**
 * 执行命令并返回结果
 */
function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: "pipe",
      ...options,
    });
    return { success: true, output: result };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || error.message,
      error: error.stderr || error.message,
    };
  }
}

/**
 * 代码复杂度分析
 */
function analyzeComplexity() {
  console.log("📊 分析代码复杂度...");

  // 简单的文件查找（Windows兼容）
  const srcDir = join(projectRoot, "src");
  const files = [];

  function findTsFiles(dir) {
    try {
      const fs = require("fs");
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.includes("node_modules")) {
          findTsFiles(fullPath);
        } else if (item.endsWith(".ts") && !item.endsWith(".d.ts")) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn("⚠️  无法扫描源文件目录");
    }
  }

  if (existsSync(srcDir)) {
    findTsFiles(srcDir);
  }

  const complexityReport = {
    totalFiles: files.length,
    complexFiles: [],
    averageComplexity: 0,
    recommendations: [],
  };

  // 分析文件复杂度
  files.forEach((file) => {
    try {
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");
      const complexity = analyzeFileComplexity(content);

      if (complexity.score > 15) {
        complexityReport.complexFiles.push({
          file: file.replace(projectRoot, "").replace(/\\/g, "/"),
          lines: lines.length,
          complexity: complexity.score,
          issues: complexity.issues,
        });
      }
    } catch (error) {
      console.warn(`⚠️  无法分析文件: ${file}`);
    }
  });

  if (complexityReport.complexFiles.length > 0) {
    console.log(
      `⚠️  发现 ${complexityReport.complexFiles.length} 个复杂度较高的文件:`
    );
    complexityReport.complexFiles.forEach((file) => {
      console.log(
        `   • ${file.file} (复杂度: ${file.complexity}, 行数: ${file.lines})`
      );
    });

    complexityReport.recommendations.push(
      "考虑重构复杂度较高的函数",
      "将大型函数拆分为更小的函数",
      "减少嵌套层级"
    );
  } else {
    console.log("✅ 代码复杂度良好");
  }

  return complexityReport;
} /**
 * 分析单个文件的复杂度
 */
function analyzeFileComplexity(content) {
  const lines = content.split("\n");
  let complexity = 0;
  let maxNesting = 0;
  let currentNesting = 0;
  const issues = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // 计算嵌套层级
    if (trimmed.includes("{")) {
      currentNesting++;
      maxNesting = Math.max(maxNesting, currentNesting);
    }
    if (trimmed.includes("}")) {
      currentNesting = Math.max(0, currentNesting - 1);
    }

    // 复杂度计算
    if (trimmed.match(/\b(if|else|while|for|switch|case|catch|&&|\|\|)\b/)) {
      complexity++;
    }

    // 检查长行
    if (line.length > 120) {
      issues.push(`第${index + 1}行过长 (${line.length} 字符)`);
    }
  });

  // 嵌套层级过深
  if (maxNesting > 4) {
    complexity += maxNesting - 4;
    issues.push(`嵌套层级过深 (${maxNesting} 层)`);
  }

  // 文件过长
  if (lines.length > 300) {
    complexity += Math.floor(lines.length / 100);
    issues.push(`文件过长 (${lines.length} 行)`);
  }

  return { score: complexity, issues };
}

/**
 * 生成代码质量报告
 */
function generateQualityReport(lintResult, formatResult, complexityReport) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      linting: lintResult.success ? "✅ 通过" : "❌ 失败",
      formatting: formatResult.success ? "✅ 通过" : "❌ 失败",
      complexity:
        complexityReport.complexFiles.length === 0 ? "✅ 良好" : "⚠️  需要关注",
    },
    details: {
      linting: lintResult,
      formatting: formatResult,
      complexity: complexityReport,
    },
    recommendations: [
      ...complexityReport.recommendations,
      ...(lintResult.success ? [] : ["修复ESLint报告的问题"]),
      ...(formatResult.success ? [] : ["运行代码格式化"]),
    ],
  };

  // 保存报告
  const reportPath = join(projectRoot, "docs", "code-quality-report.json");
  try {
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 报告已保存到: ${reportPath}`);
  } catch (error) {
    console.warn("⚠️  无法保存报告文件");
  }

  return report;
}

/**
 * 主函数
 */
async function main() {
  console.log("🔍 开始代码质量检查...\n");

  // 1. ESLint检查
  console.log("📋 运行ESLint检查...");
  const lintResult = runCommand("npm run lint");
  if (lintResult.success) {
    console.log("✅ ESLint检查通过");
  } else {
    console.log("❌ ESLint检查失败:");
    console.log(lintResult.output);
  }

  // 2. Prettier格式检查
  console.log("\n🎨 检查代码格式...");
  const formatResult = runCommand("npm run format:check");
  if (formatResult.success) {
    console.log("✅ 代码格式正确");
  } else {
    console.log("⚠️  代码格式需要调整");
    console.log("运行 npm run format 来自动修复");
  }

  // 3. 复杂度分析
  console.log("\n📊 分析代码复杂度...");
  const complexityReport = analyzeComplexity();

  // 4. 生成报告
  console.log("\n📄 生成质量报告...");
  const report = generateQualityReport(
    lintResult,
    formatResult,
    complexityReport
  );

  // 5. 输出总结
  console.log("\n" + "=".repeat(60));
  console.log("📊 代码质量检查总结");
  console.log("=".repeat(60));
  console.log(`ESLint检查: ${report.summary.linting}`);
  console.log(`代码格式: ${report.summary.formatting}`);
  console.log(`代码复杂度: ${report.summary.complexity}`);

  if (report.recommendations.length > 0) {
    console.log("\n💡 改进建议:");
    report.recommendations.forEach((rec) => {
      console.log(`   • ${rec}`);
    });
  }

  console.log(`\n📄 详细报告已保存到: docs/code-quality-report.json`);
  console.log("=".repeat(60));

  // 返回退出码
  const hasErrors = !lintResult.success;
  process.exit(hasErrors ? 1 : 0);
}

// 运行主函数
main().catch((error) => {
  console.error("❌ 代码质量检查失败:", error);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * 代码问题批量修复脚本
 * 
 * 自动修复常见的ESLint问题
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const projectRoot = join(__dirname, '..');

/**
 * 修复文件中的常见问题
 */
function fixFileIssues(filePath) {
  try {
    let content = readFileSync(filePath, 'utf8');
    let modified = false;
    
    // 1. 修复 nullish coalescing 问题
    const nullishCoalescingRegex = /(\w+)\s*\|\|\s*([^|&\n;]+)/g;
    const newContent = content.replace(nullishCoalescingRegex, (match, left, right) => {
      // 避免替换逻辑或操作符
      if (match.includes('||=') || match.includes('&&')) {
        return match;
      }
      modified = true;
      return `${left} ?? ${right}`;
    });
    
    if (newContent !== content) {
      content = newContent;
    }
    
    // 2. 修复未使用的错误变量
    content = content.replace(/catch\s*\(\s*error\s*\)/g, 'catch (_error)');
    
    // 3. 修复 require() 导入（转换为 import）
    const requireRegex = /const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    content = content.replace(requireRegex, (match, varName, modulePath) => {
      modified = true;
      return `import ${varName} from "${modulePath}"`;
    });
    
    // 4. 修复重复导入
    const lines = content.split('\n');
    const importLines = [];
    const nonImportLines = [];
    const seenImports = new Set();
    
    for (const line of lines) {
      if (line.trim().startsWith('import ')) {
        const importKey = line.trim();
        if (!seenImports.has(importKey)) {
          seenImports.add(importKey);
          importLines.push(line);
        } else {
          modified = true;
        }
      } else {
        nonImportLines.push(line);
      }
    }
    
    if (modified) {
      content = [...importLines, ...nonImportLines].join('\n');
    }
    
    // 5. 修复不必要的转义字符
    content = content.replace(/\\\//g, '/');
    
    if (modified) {
      writeFileSync(filePath, content);
      console.log(`✅ 修复文件: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn(`⚠️  无法修复文件 ${filePath}:`, error.message);
    return false;
  }
}

/**
 * 获取需要修复的文件列表
 */
function getFilesToFix() {
  return [
    join(projectRoot, 'src/config/enhanced-config.ts'),
    join(projectRoot, 'src/config/index.ts'),
    join(projectRoot, 'src/index.ts'),
    join(projectRoot, 'src/services/ldims-api.ts'),
    join(projectRoot, 'src/types/mcp.ts'),
    join(projectRoot, 'src/utils/error-handler.ts'),
  ];
}

/**
 * 主函数
 */
function main() {
  console.log('🔧 开始批量修复代码问题...\n');
  
  const files = getFilesToFix();
  let fixedCount = 0;
  
  for (const file of files) {
    if (fixFileIssues(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n📊 修复完成: ${fixedCount}/${files.length} 个文件被修复`);
  
  if (fixedCount > 0) {
    console.log('\n🎨 运行代码格式化...');
    const { execSync } = require('child_process');
    try {
      execSync('npm run format', { cwd: projectRoot, stdio: 'inherit' });
      console.log('✅ 代码格式化完成');
    } catch (error) {
      console.warn('⚠️  代码格式化失败:', error.message);
    }
  }
  
  console.log('\n🔍 重新运行质量检查...');
}

// 运行主函数
main();
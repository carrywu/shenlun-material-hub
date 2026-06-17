// scripts/harness/check-diff.mjs
//
// Harness diff 范围检查（只读）：检查当前 git 改动是否越出指定 batch 的 scope。
// 从 batch 文件的 Scope 代码块提取允许文件，对比 git diff --name-only，
// 报告 out-of-scope 的改动文件。
//
// 用法：
//   node scripts/harness/check-diff.mjs tasks/harness/batch-a-sync-security.md
//   HARNESS_BATCH=tasks/harness/batch-a-sync-security.md node scripts/harness/check-diff.mjs
//
// 注意：这是轻量启发式检查，不替代人工二审。batch 文件 Scope 之外的合理改动
// （如更新 handoff / todolist）应在报告中说明理由。

import fs from "node:fs";
import { execSync } from "node:child_process";

const batchFile =
  process.argv[2] ??
  process.env.HARNESS_BATCH;

if (!batchFile) {
  console.error(
    "Usage: node scripts/harness/check-diff.mjs <batch-file-path>\n" +
      "   or: HARNESS_BATCH=<path> node scripts/harness/check-diff.mjs"
  );
  process.exit(2);
}

if (!fs.existsSync(batchFile)) {
  console.error(`Batch file not found: ${batchFile}`);
  process.exit(2);
}

// 1. 提取当前改动文件（已暂存 + 未暂存，相对 HEAD）
let changedFiles = [];
try {
  const out = execSync("git diff --name-only HEAD", { encoding: "utf8" });
  changedFiles = out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
} catch {
  // 新文件未跟踪时 git diff --name-only HEAD 可能不含它们，补充 untracked
  try {
    const untracked = execSync("git ls-files --others --exclude-standard", {
      encoding: "utf8",
    });
    changedFiles = [
      ...changedFiles,
      ...untracked
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    ];
  } catch (err) {
    console.error(`Failed to run git diff: ${err.message}`);
    process.exit(2);
  }
}

if (changedFiles.length === 0) {
  console.log("No changes detected against HEAD.");
  process.exit(0);
}

// 2. 从 batch 文件提取 scope 允许的文件路径
//    规则：取 Scope 段落下所有代码块内的相对路径行（去掉前导 - / 空格）
const batchText = fs.readFileSync(batchFile, "utf8");

// 先尝试截取 ## Scope ... 下一个 ## 之间的内容；找不到就用全文
const scopeMatch = batchText.match(
  /##\s*Scope[\s\S]*?(?=\n##\s|\n#)/i
);
const scopeText = scopeMatch ? scopeMatch[0] : batchText;

// 匹配代码块内的路径：形如 src/app/api/... 或 tests/... 或 e2e/...
// 排除明显不是路径的行（含空格分隔多词、纯文字描述）
const pathRe = /(?:^|\n)\s*[-*]?\s*([a-zA-Z0-9_@./[\]-]+(?:\/[a-zA-Z0-9_@./[\]-]+)+)/g;
const scopePaths = new Set();
let m;
while ((m = pathRe.exec(scopeText)) !== null) {
  const p = m[1].trim();
  // 跳过 docs/ 开头（说明性引用而非可改代码）与明显命令
  scopePaths.add(p);
}

// 3. 同时把 batch 文件涉及的文档更新视为允许（handoff / todolist / testing）
const allowedDocPrefixes = [
  "docs/audit/development-handoff.md",
  "docs/audit/development-todolist.md",
  "docs/testing.md",
];

function isAllowed(file) {
  if (scopePaths.has(file)) return true;
  // 前缀匹配支持通配（如 e2e/articles.spec.ts 命中 e2e/ 目录）
  for (const sp of scopePaths) {
    if (file.startsWith(sp) || sp.startsWith(file)) return true;
  }
  return allowedDocPrefixes.includes(file);
}

// harness 自身文件永远允许（落地 harness 任务）
const harnessPrefixes = [
  "scripts/harness/",
  "tasks/harness/",
  "docs/harness/",
  ".claude/commands/",
];

const outOfScope = changedFiles.filter((f) => {
  if (harnessPrefixes.some((p) => f.startsWith(p))) return false;
  return !isAllowed(f);
});

console.log(`Batch: ${batchFile}`);
console.log(`Changed files: ${changedFiles.length}`);
console.log(`Scope paths declared: ${scopePaths.size}\n`);

if (scopePaths.size > 0) {
  console.log("Declared scope paths:");
  for (const p of [...scopePaths].sort()) console.log(`  ${p}`);
  console.log();
}

if (outOfScope.length === 0) {
  console.log("All changes are within batch scope (or allowed docs/harness files).");
  process.exit(0);
}

console.warn(`Out-of-scope changes (${outOfScope.length}):`);
for (const f of outOfScope) console.warn(`  ${f}`);
console.warn(
  "\nReview these changes. If intentional, document the reason in the batch report."
);
process.exit(1);

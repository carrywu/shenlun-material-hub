// scripts/harness/preflight.mjs
//
// Harness 预检脚本（只读）：在开始任何 batch 任务前运行。
// 检查必读文件存在、必需 package.json 脚本存在、打印 git status。
// 不运行 lint / test / build。退出码 0 = 可开工，非 0 = 阻塞。
//
// 用法：pnpm harness:preflight

import fs from "node:fs";
import { execSync } from "node:child_process";

const requiredFiles = [
  "package.json",
  "docs/audit/requirements-confirmation.md",
  "docs/audit/project-assessment.md",
  "docs/audit/development-plan.md",
  "docs/audit/development-todolist.md",
  "docs/audit/development-handoff.md",
  "docs/testing.md",
  "prisma/schema.prisma",
];

const requiredScripts = [
  "lint",
  "test",
  "build",
  "test:e2e",
  "db:generate",
  "db:setup:dry",
];

let failed = false;

// 1. 必读文件存在性检查
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required file: ${file}`);
    failed = true;
  }
}
if (!failed) {
  console.log(`Required files: all ${requiredFiles.length} present.`);
}

// 2. 必需 package.json 脚本检查
let pkg;
try {
  pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
} catch (err) {
  console.error(`Failed to parse package.json: ${err.message}`);
  process.exit(1);
}

const missingScripts = [];
for (const script of requiredScripts) {
  if (!pkg.scripts?.[script]) {
    console.error(`Missing package script: ${script}`);
    missingScripts.push(script);
    failed = true;
  }
}
if (missingScripts.length === 0) {
  console.log(`Required scripts: all ${requiredScripts.length} present.`);
}

// 3. harness 自身脚本检查（提醒性，非阻塞）
const harnessScripts = [
  "harness:preflight",
  "harness:validate",
  "harness:validate:e2e",
  "harness:validate:db",
];
const missingHarness = harnessScripts.filter((s) => !pkg.scripts?.[s]);
if (missingHarness.length > 0) {
  console.warn(
    `Note: harness scripts not yet defined: ${missingHarness.join(", ")}`
  );
}

// 4. git status（信息性）
try {
  const status = execSync("git status --short", { encoding: "utf8" });
  console.log("\nGit status:");
  console.log(status.trim() || "(clean)");
} catch {
  console.error("Failed to run git status");
  failed = true;
}

if (failed) {
  console.error("\nHarness preflight FAILED. Fix the above before starting a batch.");
  process.exit(1);
}

console.log("\nHarness preflight passed.");

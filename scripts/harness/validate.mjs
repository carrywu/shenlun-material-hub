// scripts/harness/validate.mjs
//
// Harness 验证脚本：按模式串联运行 lint / test / build / e2e / db 命令。
// 任一命令失败即停止，退出码反映结果。不允许跳过失败却声称通过。
//
// 用法：
//   pnpm harness:validate         # standard: lint + test + build
//   pnpm harness:validate:e2e     # e2e: standard + playwright 全量
//   pnpm harness:validate:db      # db: db:generate + db:setup:dry + standard

import { spawnSync } from "node:child_process";

const mode = process.argv[2] ?? "standard";

const commandSets = {
  standard: [
    ["pnpm", ["lint"]],
    ["pnpm", ["test"]],
    ["pnpm", ["build"]],
  ],
  e2e: [
    ["pnpm", ["lint"]],
    ["pnpm", ["test"]],
    ["pnpm", ["build"]],
    ["pnpm", ["exec", "playwright", "test"]],
  ],
  db: [
    ["pnpm", ["db:generate"]],
    ["pnpm", ["db:setup:dry"]],
    ["pnpm", ["lint"]],
    ["pnpm", ["test"]],
    ["pnpm", ["build"]],
  ],
};

const commands = commandSets[mode];

if (!commands) {
  console.error(`Unknown validation mode: ${mode}`);
  console.error(`Available modes: ${Object.keys(commandSets).join(", ")}`);
  process.exit(1);
}

console.log(`Validation mode: ${mode}`);
console.log(`Commands: ${commands.map(([c, a]) => `${c} ${a.join(" ")}`).join("  ->  ")}\n`);

let failed = false;
let failedCommand = null;

for (const [cmd, args] of commands) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);

  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    failed = true;
    failedCommand = `${cmd} ${args.join(" ")}`;
    console.error(`Command failed: ${failedCommand} (exit ${result.status})`);
    break;
  }
}

if (failed) {
  console.error(`\nValidation FAILED at: ${failedCommand}`);
  process.exit(1);
}

console.log(`\nValidation passed (${mode}). All ${commands.length} commands exited 0.`);

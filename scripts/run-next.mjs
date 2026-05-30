import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadConfig() {
  const defaultPath = resolve(root, "config", "server.config.json");
  const localPath = resolve(root, "config", "server.config.local.json");

  let config = { port: 3001, hostname: "0.0.0.0" };

  if (existsSync(defaultPath)) {
    try {
      const raw = readFileSync(defaultPath, "utf-8");
      config = { ...config, ...JSON.parse(raw) };
    } catch (e) {
      console.warn(`[run-next] Failed to read ${defaultPath}:`, e.message);
    }
  }

  if (existsSync(localPath)) {
    try {
      const raw = readFileSync(localPath, "utf-8");
      config = { ...config, ...JSON.parse(raw) };
      console.log(`[run-next] Loaded local override from ${localPath}`);
    } catch (e) {
      console.warn(`[run-next] Failed to read ${localPath}:`, e.message);
    }
  }

  return config;
}

const command = process.argv[2];
if (!command || !["dev", "start"].includes(command)) {
  console.error("Usage: node scripts/run-next.mjs <dev|start>");
  process.exit(1);
}

const config = loadConfig();
const port = String(config.port);
const hostname = config.hostname || "0.0.0.0";

console.log(`[run-next] Starting next ${command} on ${hostname}:${port}`);

const args = [command, "--port", port, "--hostname", hostname];

const isWindows = process.platform === "win32";
const child = spawn("npx", ["next", ...args], {
  cwd: root,
  stdio: "inherit",
  shell: isWindows,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

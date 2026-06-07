/**
 * Production environment variable validation.
 * Called at startup to ensure critical configuration is present.
 */

interface EnvCheck {
  key: string;
  required: boolean;
  description: string;
  validate?: (value: string) => boolean;
}

const ENV_CHECKS: EnvCheck[] = [
  {
    key: "DATABASE_URL",
    required: true,
    description: "PostgreSQL 数据库连接字符串",
    validate: (v) => v.startsWith("postgresql://") || v.startsWith("postgres://"),
  },
  {
    key: "JWT_SECRET",
    required: false,
    description: "JWT 密钥（旧版兼容）",
  },
  {
    key: "AI_CONFIG_ENCRYPTION_KEY",
    required: false,
    description: "AI 配置加密密钥（使用 AI 页面配置时需要）",
  },
];

/**
 * Validate required environment variables.
 * Returns a list of issues found (empty if all OK).
 */
export function validateEnv(): Array<{ key: string; issue: string }> {
  const issues: Array<{ key: string; issue: string }> = [];

  for (const check of ENV_CHECKS) {
    const value = process.env[check.key];

    if (check.required && !value) {
      issues.push({
        key: check.key,
        issue: `${check.key} 未设置 — ${check.description}`,
      });
    }

    if (value && check.validate && !check.validate(value)) {
      issues.push({
        key: check.key,
        issue: `${check.key} 格式不正确 — ${check.description}`,
      });
    }
  }

  // Production-specific checks
  if (process.env.NODE_ENV === "production") {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (adminPassword === "admin123") {
      issues.push({
        key: "ADMIN_PASSWORD",
        issue: "生产环境不能使用默认密码 admin123",
      });
    }

    if (!adminPasswordHash && !adminPassword) {
      issues.push({
        key: "ADMIN_PASSWORD_HASH",
        issue: "生产环境必须设置 ADMIN_PASSWORD_HASH（bcrypt）或 ADMIN_PASSWORD（明文，将自动哈希）",
      });
    }

    if (adminPasswordHash && !adminPasswordHash.startsWith("$2a$") && !adminPasswordHash.startsWith("$2b$")) {
      issues.push({
        key: "ADMIN_PASSWORD_HASH",
        issue: "ADMIN_PASSWORD_HASH 必须是 bcrypt 格式（$2a$ 或 $2b$ 开头）",
      });
    }
  }

  return issues;
}

/**
 * Validate and log environment issues.
 * Returns true if environment is valid.
 */
export function checkAndLogEnv(): boolean {
  const issues = validateEnv();

  if (issues.length > 0) {
    console.error("\n⚠️ 环境变量检查失败:");
    for (const issue of issues) {
      console.error(`  - ${issue.issue}`);
    }
    console.error("");
    return false;
  }

  return true;
}

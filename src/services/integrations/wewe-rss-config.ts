import { normalizeBaseUrl } from "./wewe-rss-api";

export const WEWERSS_CONFIG_MISSING = "WEWERSS_CONFIG_MISSING";

type MissingConfig = {
  configured: false;
  code: typeof WEWERSS_CONFIG_MISSING;
  message: "未配置 WeWeRSS 服务地址";
};

type ServerConfig = { configured: true; baseUrl: string } | MissingConfig;
type PublicConfig = { configured: true; publicUrl: string } | MissingConfig;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function getWeweRssServerConfig(): ServerConfig {
  const configuredBaseUrl = process.env.WEWERSS_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return { configured: true, baseUrl: normalizeBaseUrl(configuredBaseUrl) };
  }

  if (!isProduction()) {
    return { configured: true, baseUrl: "http://localhost:4000" };
  }

  return {
    configured: false,
    code: WEWERSS_CONFIG_MISSING,
    message: "未配置 WeWeRSS 服务地址",
  };
}

export function getWeweRssPublicConfig(): PublicConfig {
  const configuredPublicUrl = process.env.NEXT_PUBLIC_WEWERSS_PUBLIC_URL?.trim();
  if (configuredPublicUrl) {
    return { configured: true, publicUrl: normalizeBaseUrl(configuredPublicUrl) };
  }

  if (!isProduction()) {
    return { configured: true, publicUrl: "http://localhost:4000" };
  }

  return {
    configured: false,
    code: WEWERSS_CONFIG_MISSING,
    message: "未配置 WeWeRSS 服务地址",
  };
}

export function weweRssMissingConfigResponse() {
  return Response.json(
    {
      success: false,
      code: WEWERSS_CONFIG_MISSING,
      message: "未配置 WeWeRSS 服务地址",
    },
    { status: 503 },
  );
}

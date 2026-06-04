import { NextRequest, NextResponse } from "next/server";

/**
 * 微信图片代理接口
 *
 * 安全措施：
 * 1. 白名单限制域名（仅允许微信 CDN）
 * 2. 拒绝私有 IP 地址（防 SSRF）
 * 3. 强制 HTTPS 协议
 * 4. 携带 Referer 头绕过防盗链
 */

const ALLOWED_DOMAINS = [
  "mmbiz.qpic.cn",
  "wx.qpic.cn",
  "mmbiz.qlogo.cn",
];

const PRIVATE_IP_REGEX =
  /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|::1|localhost)/;

function validateImageUrl(url: string): { valid: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: "无效的 URL" };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, reason: "仅支持 HTTPS 协议" };
  }

  if (PRIVATE_IP_REGEX.test(parsed.hostname)) {
    return { valid: false, reason: "不允许访问私有地址" };
  }

  const isAllowed = ALLOWED_DOMAINS.some(
    (d) => parsed.hostname === d || parsed.hostname.endsWith("." + d)
  );

  if (!isAllowed) {
    return { valid: false, reason: `域名不在白名单中: ${parsed.hostname}` };
  }

  return { valid: true };
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "缺少 url 参数" }, { status: 400 });
  }

  const validation = validateImageUrl(url);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.reason },
      { status: 403 }
    );
  }

  try {
    const response = await fetch(url, {
      headers: {
        Referer: "https://mp.weixin.qq.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `上游返回 ${response.status}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // Cache 24 hours
        "X-Proxy-Source": "wechat-cdn",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "代理请求失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

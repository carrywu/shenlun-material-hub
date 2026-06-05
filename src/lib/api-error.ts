/**
 * Unified API error response helpers.
 * All route handlers should use these for consistent error responses.
 */

/** Structured error payload from AI and other API responses */
export interface ApiErrorPayload {
  error?: string;
  message?: string;
  status?: number;
  code?: string;
  source?: string;
  baseURL?: string;
  model?: string;
  keySuffix?: string;
  requestId?: string;
  providerMessage?: string;
  detail?: string;
}

/** 400 Bad Request */
export function badRequestResponse(message = "请求参数不正确") {
  return Response.json({ error: message }, { status: 400 });
}

/** 401 Unauthorized */
export function unauthorizedResponse(message = "未登录或会话已过期") {
  return Response.json({ error: message }, { status: 401 });
}

/** 403 Forbidden */
export function forbiddenResponse(message = "权限不足") {
  return Response.json({ error: message }, { status: 403 });
}

/** 404 Not Found */
export function notFoundResponse(message = "资源不存在") {
  return Response.json({ error: message }, { status: 404 });
}

/** 409 Conflict */
export function conflictResponse(message = "资源已存在") {
  return Response.json({ error: message }, { status: 409 });
}

/** 413 Payload Too Large */
export function payloadTooLargeResponse(message = "请求体过大") {
  return Response.json({ error: message }, { status: 413 });
}

/** 500 Internal Server Error */
export function internalErrorResponse(message = "服务器内部错误") {
  return Response.json({ error: message }, { status: 500 });
}

/**
 * Unified auth check for route handlers.
 * Returns user if authenticated, or an appropriate error response.
 *
 * Usage:
 *   const auth = await requireAuthFromRequest(request);
 *   if (auth.error) return auth.error;
 *   const user = auth.user;
 */
export async function requireAuthFromRequest(
  request: Request,
  getUser: (req: Request) => Promise<import("./auth").AuthUser | null>
) {
  const user = await getUser(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    if (!cookieHeader.includes("auth_token")) {
      return { user: null, error: unauthorizedResponse() };
    }
    return { user: null, error: forbiddenResponse() };
  }
  return { user, error: null };
}

/**
 * Format a structured AI error into a human-readable message for diagnostics.
 * Used for logging and user-facing error summaries.
 */
export function formatApiErrorMessage(err: {
  error?: string;
  message?: string;
  status?: number;
  source?: string;
  baseURL?: string;
  model?: string;
  keySuffix?: string;
  requestId?: string;
}): string {
  const parts: string[] = [];
  const msg = err.message ?? err.error ?? "未知错误";
  if (err.status) parts.push(`status=${err.status}`);
  if (err.source) parts.push(`source=${err.source}`);
  if (err.baseURL) parts.push(`baseURL=${err.baseURL}`);
  if (err.model) parts.push(`model=${err.model}`);
  if (err.keySuffix) parts.push(`key=${err.keySuffix}`);

  const detail = parts.length > 0 ? `：${parts.join("，")}` : "";
  const suffix = err.requestId ? `。请查看服务端日志 requestId=${err.requestId}` : "";
  return `${msg}${detail}${suffix}`;
}

export interface ApiErrorPayload {
  error?: string;
  code?: string;
  message?: string;
  status?: number;
  source?: string;
  baseURL?: string;
  model?: string;
  keySuffix?: string;
  requestId?: string;
}

export function formatApiErrorMessage(data: ApiErrorPayload): string {
  const message = data.message ?? data.error ?? "生成失败";

  if (data.error === "AI_API_CALL_FAILED" || data.code === "AI_API_CALL_FAILED") {
    const details = [
      data.status ? `status=${data.status}` : null,
      data.source ? `source=${data.source}` : null,
      data.baseURL ? `baseURL=${data.baseURL}` : null,
      data.model ? `model=${data.model}` : null,
      data.keySuffix ? `key=${data.keySuffix}` : null,
    ].filter(Boolean);
    const requestHint = data.requestId ? `。请查看服务端日志 requestId=${data.requestId}` : "";
    return details.length > 0 ? `${message}：${details.join("，")}${requestHint}` : `${message}${requestHint}`;
  }

  return data.requestId ? `${message}（requestId=${data.requestId}）` : message;
}

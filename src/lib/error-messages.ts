/**
 * 将 IMA 同步错误消息翻译为中文。
 * 后端 ima-sync.ts 抛出的英文错误经 API route 透传到前端，
 * 使用此函数在前端展示时统一翻译。
 */
export function translateSyncError(error: string | null | undefined): string {
  if (!error) return "";

  // 已经是中文的错误消息，直接返回
  if (/素材卡尚未确认/.test(error)) return error;
  if (/素材卡不存在/.test(error)) return error;
  if (/同步失败/.test(error)) return error;
  if (/同步记录不存在/.test(error)) return error;
  if (/请先确认/.test(error)) return error;

  // IMA API 认证 / 权限错误
  if (/ima API error \(40[13]\)/.test(error) || /unauthorized|forbidden/i.test(error)) {
    return "IMA 认证失败，请检查 API Key 和 Client ID 配置";
  }

  // IMA 知识库不存在
  if (
    /ima API error \(404\)/.test(error) ||
    /knowledge.?base.*not.?found/i.test(error) ||
    /not.?found/i.test(error)
  ) {
    return "IMA 知识库不存在，请检查知识库 ID 配置";
  }

  // 网络连接错误
  if (/ECONNREFUSED|ENOTFOUND|fetch failed|网络/i.test(error)) {
    return "无法连接 IMA 服务，请检查 API 地址配置";
  }

  // 加密配置错误
  if (/ENCRYPTION_KEY|decryption failed/i.test(error)) {
    return "服务端加密配置异常，请联系管理员";
  }

  // 限流
  if (/ima API error \(429\)|rate.?limit/i.test(error)) {
    return "IMA 服务请求过于频繁，请稍后重试";
  }

  // 其他未匹配的错误：添加前缀
  return `IMA 同步失败：${error}`;
}

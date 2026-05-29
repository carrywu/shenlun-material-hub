import axios from "axios";

export interface WeRssSource {
  id: string;
  name: string;
  accountId: string;
  avatar?: string;
  description?: string;
  articleCount?: number;
}

export interface WeRssArticle {
  id: string;
  title: string;
  url: string;
  content?: string;
  summary?: string;
  author?: string;
  publishTime?: string;
  accountId?: string;
  accountName?: string;
  cover?: string;
}

export class WeRssClient {
  private baseUrl: string;
  private accessKey: string;
  private secretKey: string;

  constructor() {
    this.baseUrl = process.env.WERSS_BASE_URL ?? "";
    this.accessKey = process.env.WERSS_ACCESS_KEY ?? "";
    this.secretKey = process.env.WERSS_SECRET_KEY ?? "";

    if (!this.baseUrl) {
      throw new Error("WERSS_BASE_URL 环境变量未配置");
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...(this.accessKey ? { "X-Access-Key": this.accessKey } : {}),
      ...(this.secretKey ? { "X-Secret-Key": this.secretKey } : {}),
    };
  }

  /** 测试 WeRSS 连接 */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const url = `${this.baseUrl}/api/health`;
      await axios.get(url, {
        headers: this.getHeaders(),
        timeout: 10000,
      });
      return { success: true, message: "连接成功" };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `连接失败: ${msg}` };
    }
  }

  /** 列出所有可用的微信公众号来源 */
  async getSources(): Promise<WeRssSource[]> {
    const url = `${this.baseUrl}/api/sources`;
    const response = await axios.get<{ data: WeRssSource[] }>(url, {
      headers: this.getHeaders(),
      timeout: 15000,
    });
    return response.data.data ?? [];
  }

  /** 获取指定来源的文章列表 */
  async getArticles(
    sourceId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<{ articles: WeRssArticle[]; total: number }> {
    const params = new URLSearchParams();
    params.set("sourceId", sourceId);
    if (options?.page) params.set("page", String(options.page));
    if (options?.pageSize) params.set("pageSize", String(options.pageSize));

    const url = `${this.baseUrl}/api/articles?${params}`;
    const response = await axios.get<{
      data: WeRssArticle[];
      total: number;
    }>(url, {
      headers: this.getHeaders(),
      timeout: 15000,
    });
    return {
      articles: response.data.data ?? [],
      total: response.data.total ?? 0,
    };
  }

  /** 同步指定来源的最新文章（触发 WeRSS 拉取） */
  async syncArticles(
    sourceId: string
  ): Promise<{ synced: number; articles: WeRssArticle[] }> {
    const url = `${this.baseUrl}/api/sync`;
    const response = await axios.post<{
      data: { synced: number; articles: WeRssArticle[] };
    }>(
      url,
      { sourceId },
      { headers: this.getHeaders(), timeout: 30000 }
    );
    return response.data.data ?? { synced: 0, articles: [] };
  }
}

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ArticleDetailPage from "../page";

const router = { push: vi.fn() };
const authState = vi.hoisted(() => ({
  isAdmin: false,
  isVerifiedUser: true,
  user: { id: "user-1", username: "reader", role: "VERIFIED_USER" },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "article-1" }),
  useRouter: () => router,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => authState,
}));

vi.mock("@/components/articles/ArticleExportMenu", () => ({
  ArticleExportMenu: () => <button type="button">导出</button>,
}));

const article = {
  id: "article-1",
  title: "以系统思维推进基层治理现代化，让治理效能更好转化为群众获得感",
  originalUrl: "https://example.com/article",
  platform: "wechat",
  fullText:
    "基层治理是国家治理的基石。提升治理效能，关键在于把制度优势、技术能力与群众参与转化为可感知的公共服务。",
  rawHtml: null,
  excerpt:
    "基层治理是国家治理的基石。提升治理效能，关键在于把制度优势、技术能力与群众参与转化为可感知的公共服务。",
  contentType: "policy",
  topicTags: JSON.stringify(["基层治理", "系统思维"]),
  publishedAt: "2026-06-20T00:00:00.000Z",
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z",
  processingStatus: "done",
  qualityStatus: "accepted",
  aiScore: 8.4,
  aiDecision: "accept",
  aiReason: "结构清晰，适合作为基层治理主题素材。",
  aiCategories: JSON.stringify(["基层治理", "系统思维"]),
  aiUsableFor: JSON.stringify(["群众工作"]),
  aiSummary: "文章从系统观念、协同机制和基层执行三个层面阐释治理现代化。",
  aiQuotes: JSON.stringify(["治理效能要转化为群众获得感。"]),
  contentGenre: "commentary",
  aiAssessedAt: "2026-06-20T01:00:00.000Z",
  aiAssessmentSource: "ai-runtime",
  aiAssessmentModel: "test-model",
  aiPromptVersion: "v1",
  aiContentHash: "hash",
  aiLastError: null,
  aiLastFailedAt: null,
  aiAssessmentError: null,
  aiScoreDetail: JSON.stringify({
    relevance: 8,
    quality: 8,
    freshness: 7,
    uniqueness: 8,
    usability: 9,
  }),
  aiScoredAt: null,
  contentHash: "hash",
  adminReviewStatus: "approved",
  effectiveTextLength: 128,
  bookmarked: false,
  read: false,
  ignored: false,
  userRead: false,
  userIgnored: false,
  userBookmarked: true,
  source: { id: "source-1", name: "人民日报", platform: "wechat" },
  materialCards: [
    {
      id: "card-1",
      title: "基层治理案例素材",
      cardType: "case_material",
      aiSummary: "素材卡摘要",
      confirmed: false,
      createdAt: "2026-06-20T02:00:00.000Z",
    },
  ],
  annotations: [
    {
      id: "ann-1",
      contentItemId: "article-1",
      cardType: null,
      selectedText: "强化协同",
      comment: "可作为对策段分论点。",
      color: "#facc15",
      startOffset: null,
      endOffset: null,
      paragraph: null,
      createdAt: "2026-06-20T03:00:00.000Z",
    },
  ],
};

function mockArticleFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => article,
    })
  );
}

describe("ArticleDetailPage Figma reader layout", () => {
  beforeEach(() => {
    router.push.mockReset();
    authState.isAdmin = false;
    authState.isVerifiedUser = true;
    authState.user = { id: "user-1", username: "reader", role: "VERIFIED_USER" };
    mockArticleFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the Figma reader shell with fixed reading and learning regions", async () => {
    render(<ArticleDetailPage />);

    expect(await screen.findByTestId("article-detail-page-header")).toBeVisible();
    expect(screen.getByTestId("article-reader-shell")).toHaveAttribute("data-layout", "reader");
    expect(screen.getByTestId("article-reading-column")).toHaveAttribute("data-target-width", "760");
    expect(screen.getByTestId("article-learning-sidebar")).toHaveAttribute("data-target-width", "320");
    expect(screen.getByTestId("article-mobile-action-bar")).toBeInTheDocument();
    expect(screen.getByText("生成私有素材卡")).toBeVisible();
    expect(screen.getByText("同步到个人 IMA")).toBeVisible();
  });

  it("preserves USER reader permissions without material card generation", async () => {
    authState.isVerifiedUser = false;
    authState.user = { id: "user-1", username: "reader", role: "USER" };

    render(<ArticleDetailPage />);

    expect(await screen.findByTestId("article-detail-page-header")).toBeVisible();
    expect(screen.queryByRole("button", { name: "生成素材卡" })).not.toBeInTheDocument();
    expect(screen.getByText("升级为认证用户后可使用个人 AI 配置生成素材卡。")).toBeVisible();
  });

  it("preserves ADMIN public reader controls and hides private card generation", async () => {
    authState.isAdmin = true;
    authState.isVerifiedUser = true;
    authState.user = { id: "admin-1", username: "admin", role: "ADMIN" };

    render(<ArticleDetailPage />);

    expect(await screen.findByTestId("article-detail-page-header")).toBeVisible();
    expect(screen.getByText("当前页面为公开阅读视图。")).toBeVisible();
    expect(screen.getByRole("link", { name: "前往后台文章管理" })).toHaveAttribute(
      "href",
      "/admin/articles"
    );
    expect(screen.queryByRole("button", { name: "生成素材卡" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("文章批注")).toBeVisible());
  });
});

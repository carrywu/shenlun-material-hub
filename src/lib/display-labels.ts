// 申论素材展示层 统一映射与辅助函数

export const MATERIAL_TYPE_LABELS: Record<string, string> = {
  golden_sentence: "申论金句",
  standard_expression: "规范词",
  standard_word: "规范词",
  case_material: "案例素材",
  countermeasure: "对策表达",
  problem_statement: "问题表述",
  reason_analysis: "原因分析",
  policy_expression: "政策表述",
  data_fact: "案例素材",
  person_story: "人物事迹",
  article_structure: "文章框架",
  // Legacy/Fallback mapping
  fact_summary: "案例素材",
  argument_analysis: "原因分析",
  data_highlight: "案例素材",
  policy_compare: "政策表述",
  case_study: "案例素材",
};

export const PLATFORM_LABELS: Record<string, string> = {
  website: "网站",
  wechat: "微信",
  bilibili: "B站",
  xiaohongshu: "小红书",
};

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  policy_analysis: "政策解读",
  social_issue: "社会问题",
  economic_trend: "经济趋势",
  cultural_heritage: "文化传承",
  ecological_protection: "生态保护",
  legal_regulation: "法治法规",
  tech_innovation: "科技创新",
  education_reform: "教育改革",
  livelihood_welfare: "民生福祉",
  international_affairs: "国际事务",
  // 种子数据扩展类型
  local_official: "地方政务",
  official_primary: "核心官媒",
  official_case: "官方案例",
  government_policy: "政府政策",
  wechat_official: "微信公众号",
  creator_content: "创作者内容",
};

export const PRIORITY_LABELS: Record<string, string> = {
  P0: "最高优先",
  P1: "普通优先",
  P2: "低优先",
};

export const TRUST_LEVEL_LABELS: Record<string, string> = {
  official_primary: "官方一手",
  official_repost: "官方转载",
  verified_media: "认证媒体",
  expert_opinion: "专家观点",
  unverified: "未验证",
};

export const VERIFICATION_LABELS: Record<string, string> = {
  unverified: "未核验",
  verified: "已核验",
  disputed: "有争议",
  outdated: "已过时",
  retracted: "已撤回",
};

export const STATUS_LABELS: Record<string, string> = {
  all: "全部",
  pending: "待处理",
  processing: "处理中",
  success: "成功",
  failed: "失败",
  skipped: "已跳过",
  not_started: "未开始",
  completed: "已完成",
  generated: "已生成",
  ungenerated: "未生成",
  evaluating: "评估中",
  generating: "生成中",
  accept: "已接受",
  reject: "已拒绝",
  candidate: "待评估",
  accepted: "已接受",
  filtered: "已过滤",
  card_generated: "已生成素材卡",
};

export const AI_FIELD_LABELS: Record<string, string> = {
  expression: "表达原文",
  oral: "通俗解释",
  examType: "适用题型",
  scene: "使用场景",
  reason: "推荐理由",
  theme: "适用主题",
  usage: "使用方式",
  source: "来源依据",
  sourceSnapshot: "来源快照",
  originalFacts: "原始事实",
  rawFacts: "原始事实",
  transferSuggestions: "迁移建议",
  migrationSuggestions: "迁移建议",
  highlightSuggestions: "亮点建议",
  standardExpressions: "规范表达",
  countermeasures: "对策表达",
  applicableThemes: "适用主题",
  applicableQuestionTypes: "适用题型",
  aiSummary: "AI 摘要",
  mainPoint: "核心要点",
  structure: "文章结构",
  background: "背景背景",
  problem: "问题",
  cause: "原因",
  solution: "对策",
  sublimation: "升华",
  cases: "相关案例",
  writingExercise: "写作演练",
  provinceRelevance: "省份关联",
  guangdong: "广东",
  hunan: "湖南",
  applicableTypes: "适用类型",
};

export const MATERIAL_TYPE_OPTIONS = [
  { value: "golden_sentence", label: "申论金句" },
  { value: "standard_expression", label: "规范词" },
  { value: "case_material", label: "案例素材" },
  { value: "countermeasure", label: "对策表达" },
  { value: "problem_statement", label: "问题表述" },
  { value: "reason_analysis", label: "原因分析" },
  { value: "policy_expression", label: "政策表述" },
  { value: "person_story", label: "人物事迹" },
  { value: "article_structure", label: "文章框架" },
];

export const MATERIAL_TYPE_VALUES = MATERIAL_TYPE_OPTIONS.map((option) => option.value);

export function getSafeDisplayLabel(
  value: string | null | undefined,
  map: Record<string, string>,
  fallback = "未分类"
): string {
  if (!value) return fallback;
  return map[value] ?? fallback;
}

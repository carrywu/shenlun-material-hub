/**
 * 全量 AI 评估线上未评估文章 — 自包含版（无 @/ 业务依赖）
 *
 * 纯 pg + openai + node:crypto，1:1 复刻 src/services/ai.ts 的评估逻辑，
 * 可直接 cp 进生产 app 容器跑（容器有 openai/pg，无业务源码）。
 *
 * 写库语义对齐 assess/route.ts 的 assessSingleItem，差异：
 *   accept → 直接上架（adminReviewStatus=approved + publicVisibleAt=now）
 *   reject → 标 filtered/rejected（从公开列表隐藏）
 *
 * 用法（app 容器内，DATABASE_URL/AI_CONFIG_ENCRYPTION_KEY 已就绪）：
 *   node assess-pending-standalone.mjs               # dry-run（不调 AI）
 *   node assess-pending-standalone.mjs --execute      # 执行
 *   node assess-pending-standalone.mjs --execute --concurrency 5 --limit 10
 *
 * 只读连库配置：从 AiConfig(global default) 读 encryptedKey，用 AI_CONFIG_ENCRYPTION_KEY 解密。
 */
import pg from "pg";
import OpenAI from "openai";
import { createDecipheriv } from "crypto";

const args = process.argv.slice(2);
const isExecute = args.includes("--execute");
const concurrencyArg = Number(args[args.indexOf("--concurrency") + 1] ?? "3");
const limitArg = Number(args[args.indexOf("--limit") + 1] ?? "0");
const CONCURRENCY = Math.min(10, Math.max(1, Number.isFinite(concurrencyArg) ? concurrencyArg : 3));
const LIMIT = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 0;

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  max: 4,
});
const q = (sql, params = []) => pool.query(sql, params);

// ─── crypto: decrypt (复刻 src/lib/crypto.ts) ────────────────────────────────
function decrypt(ciphertext) {
  const key = Buffer.from(process.env.AI_CONFIG_ENCRYPTION_KEY, "utf-8").subarray(0, 32);
  const [ivHex, encHex] = ciphertext.split(":");
  if (!ivHex || !encHex) throw new Error("加密格式无效");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf-8");
}

// ─── AI runtime (复刻 resolveAiRuntimeConfig + getAiRuntime) ──────────────────
let _runtime = null;
async function getAiRuntime() {
  if (_runtime) return _runtime;
  const { rows } = await q(
    `SELECT "encryptedKey", "baseUrl", model FROM "AiConfig"
     WHERE name='default' AND "isEnabled"=true AND "userId" IS NULL LIMIT 1`
  );
  if (!rows.length) throw new Error("未找到全局 AI 配置（AiConfig default）");
  const apiKey = decrypt(rows[0].encryptedKey).trim();
  if (!apiKey) throw new Error("全局 AI 配置 apiKey 为空");
  _runtime = {
    client: new OpenAI({ apiKey, baseURL: rows[0].baseUrl || undefined }),
    model: rows[0].model || "deepseek-v4-flash",
  };
  return _runtime;
}

// ─── prompt (复刻 ai.ts 常量，线上 AiPromptTemplate 为空 → 用默认) ──────────
const ARTICLE_EVALUATION_INPUT_TEMPLATE = `## 待评估文章

标题：{{title}}
来源：{{sourceName}}
内容类型：{{contentType}}
正文：
{{content}}`;

const RELEVANCE_SYSTEM_PROMPT = `你是一位拥有 10 年以上省考/国考申论阅卷与教学经验的申论辅导专家。你的任务是判断一篇文章是否值得纳入申论备考素材库。

## 核心评估维度

请从以下四个维度综合判断：

1. **素材密度**：文章中是否包含可直接引用的金句、案例、数据、对策表达？（最重要）
2. **观点深度**：文章是否有独立分析和论证，而非简单的信息罗列或事件报道？
3. **话题相关性**：文章主题是否属于申论常考领域（治理、民生、经济、文化、生态、科技、法治等）？
4. **时效与权威性**：来源是否可信？内容是否具有较长的参考价值？

## 体裁分类规则（contentGenre）

- commentary（评论）：人民时评、光明网评、社论、署名评论文章
- policy_interpretation（政策解读）：对政策文件、会议精神、政府工作报告的深度解读
- case_practice（案例实践）：地方治理案例、基层创新实践、典型经验做法的报道
- ordinary_news（普通新闻）：仅报道事件经过，无实质性分析或观点
- meeting_news（会议新闻）：领导活动报道、会议纪要、座谈会等程序性报道
- notice（通知公告）：政府通知、公告、规章条例原文
- other：不属于以上任何类型

## 判定标准

**接受（accept）**——满足以下任一条件：
- 文章含有 3 条以上可直接引用的申论素材（金句、案例、数据、对策）
- 文章有清晰的论证结构，观点鲜明，逻辑完整
- 文章包含权威政策解读或实践案例，有明确的治理启示

**拒绝（reject）**——满足以下任一条件：
- 纯粹的事件报道，无分析、无观点、无可引用素材
- 会议程序性报道（某某领导出席、强调、指出……）
- 通知公告原文，缺乏解读
- 内容空泛、套话连篇，无实质信息
- 商业软文、广告、营销内容

## 不要做的事

- 不要因为文章"主题相关"就自动接受——主题相关但素材密度为零的文章应当拒绝
- 不要对所有评论文章一律接受——套话评论同样应拒绝
- 不要在 summary 中重复标题内容

${ARTICLE_EVALUATION_INPUT_TEMPLATE}

## 输出要求

返回严格的 JSON（不要加 markdown 代码块标记）：
{
  "decision": "accept 或 reject",
  "contentGenre": "上述 7 种体裁之一",
  "reason": "80 字以内的判定理由，需具体说明文章的素材价值或拒绝原因",
  "categories": ["主题标签1", "主题标签2"],
  "usableFor": ["适用的申论写作场景"],
  "summary": "150 字以内的内容摘要，提炼文章核心观点和关键信息（仅 accept 时填写，reject 时留空字符串）",
  "quotes": ["从原文中摘录的 2-5 条最有价值的金句或关键表述"]
}`;

const SCORING_SYSTEM_PROMPT = `你是一位资深的申论辅导专家，擅长评估官方文章对申论备考的价值。
请对文章进行以下 5 个维度的评分（每项 1-10 分）：

1. relevance（与申论考试的相关度）：文章主题是否属于申论常考话题（政策、社会、经济、文化、生态等）
2. quality（内容质量）：数据是否准确、论证是否严密、是否有权威来源
3. freshness（时效性）：是否为近期热点、是否具有当下讨论价值
4. uniqueness（独特性/稀缺性）：是否有独到见解、是否为少见的优质素材
5. usability（可迁移使用程度）：是否可以在多个申论题目中迁移使用

返回 JSON：
{
  "relevance": 8,
  "quality": 7,
  "freshness": 9,
  "uniqueness": 6,
  "usability": 8,
  "reason": "简短说明评分理由（50字以内）"
}`;

function renderPromptTemplate(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key) => {
    const v = variables[key];
    return Array.isArray(v) ? v.join("、") : v ?? "";
  });
}
function buildAiContent(content, maxLength = 4000) {
  if (content.length <= maxLength) return content;
  const omission = "\n\n……中间内容已省略……\n\n";
  const avail = Math.max(0, maxLength - omission.length);
  const head = Math.floor(avail * 0.7);
  return [content.slice(0, head), omission, content.slice(-(avail - head))].join("");
}
function buildArticleEvaluationPrompt(vars) {
  return renderPromptTemplate(RELEVANCE_SYSTEM_PROMPT, vars);
}
function parseAiJson(rawJson, context) {
  try {
    return JSON.parse(rawJson);
  } catch {
    const m = rawJson.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) {
      try { return JSON.parse(m[1].trim()); }
      catch { throw new Error(`AI 返回的${context}中 JSON 格式无效`); }
    }
    throw new Error(`AI 返回的${context}JSON 格式无效`);
  }
}
function validateContentGenre(g) {
  const valid = ["commentary","policy_interpretation","case_practice","ordinary_news","meeting_news","notice","other"];
  return valid.includes(g) ? g : "other";
}

// ─── assessRelevance / score (复刻) ───────────────────────────────────────────
async function createChatCompletion(params) {
  const rt = await getAiRuntime();
  return rt.client.chat.completions.create({ ...params, stream: false });
}

async function assessRelevance(title, sourceName, content, contentType) {
  const rt = await getAiRuntime();
  const systemPrompt = buildArticleEvaluationPrompt({
    title, sourceName, contentType, content: buildAiContent(content),
  });
  const completion = await createChatCompletion({
    model: rt.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "请根据以上要求评估这篇文章。" },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });
  const rawJson = completion.choices[0]?.message?.content;
  if (!rawJson) throw new Error("AI 未返回有效内容");
  const data = parseAiJson(rawJson, "评估结果");
  return {
    decision: data.decision === "accept" ? "accept" : "reject",
    contentGenre: validateContentGenre(String(data.contentGenre ?? "")),
    reason: String(data.reason || "").slice(0, 200),
    categories: Array.isArray(data.categories) ? data.categories.slice(0, 5) : [],
    usableFor: Array.isArray(data.usableFor) ? data.usableFor.slice(0, 5) : [],
    summary: String(data.summary || "").slice(0, 500),
    quotes: Array.isArray(data.quotes) ? data.quotes.slice(0, 5) : [],
  };
}

async function assessRelevanceWithRetry(title, sourceName, content, contentType) {
  const maxRetries = 2, timeoutMs = 30000, backoff = [1000, 3000];
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await Promise.race([
        assessRelevance(title, sourceName, content, contentType),
        new Promise((_, rej) => setTimeout(() => rej(new Error("AI 评估超时")), timeoutMs)),
      ]);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();
      const isPermanent = msg.includes("api key") || msg.includes("invalid")
        || msg.includes("未配置") || msg.includes("未返回有效内容");
      if (isPermanent || attempt === maxRetries) break;
      await new Promise((r) => setTimeout(r, backoff[attempt] ?? 3000));
    }
  }
  throw lastError ?? new Error("AI 评估失败");
}

async function scoreContentItem(title, sourceName, content, contentType) {
  const rt = await getAiRuntime();
  const userPrompt = `请对以下文章进行评分：\n\n【标题】${title}\n【来源】${sourceName}\n【内容类型】${contentType}\n【正文】\n${buildAiContent(content)}`;
  const completion = await createChatCompletion({
    model: rt.model,
    messages: [
      { role: "system", content: SCORING_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });
  const rawJson = completion.choices[0]?.message?.content;
  if (!rawJson) throw new Error("AI 未返回有效内容");
  const data = parseAiJson(rawJson, "评分结果");
  const dims = ["relevance","quality","freshness","uniqueness","usability"];
  const detail = {};
  for (const d of dims) {
    const s = Number(data[d]);
    detail[d] = isNaN(s) || s < 1 || s > 10 ? 5 : Math.round(s);
  }
  const w = { relevance:0.25, quality:0.25, freshness:0.15, uniqueness:0.15, usability:0.2 };
  let overall = 0;
  for (const d of dims) overall += detail[d] * w[d];
  return { overall: Math.round(overall * 10) / 10, detail };
}

// ─── 单篇评估 + 写库 ──────────────────────────────────────────────────────────
async function assessOne(item) {
  const content = item.fullText ?? item.excerpt ?? "";
  if (!content || content.replace(/\s+/g, "").length < 300) return "skipped";
  try {
    const result = await assessRelevanceWithRetry(item.title, item.source_name ?? "未知来源", content, item.contentType);
    let scoreOverall = null, scoreDetail = null, scoredAt = null;
    if (result.decision === "accept") {
      try {
        const s = await scoreContentItem(item.title, item.source_name ?? "未知来源", content, item.contentType);
        scoreOverall = s.overall; scoreDetail = JSON.stringify(s.detail); scoredAt = new Date();
      } catch (e) { console.error(`  [score-fail] ${item.title.slice(0,24)}: ${e.message}`); }
    }
    const now = new Date();
    await q(`UPDATE "ContentItem" SET
      "aiDecision"=$1, "aiReason"=$2, "contentGenre"=$3, "aiCategories"=$4, "aiUsableFor"=$5,
      "aiSummary"=$6, "aiQuotes"=$7, "aiAssessedAt"=$8, "aiAssessmentError"=NULL,
      "aiAssessmentSource"='ai-runtime', "aiAssessmentModel"=$9, "aiPromptVersion"='article_evaluation:v1',
      "aiContentHash"=$10, "aiLastError"=NULL, "aiLastFailedAt"=NULL,
      "qualityStatus"=$11, "adminReviewStatus"=$12, "publicVisibleAt"=COALESCE("publicVisibleAt",$13),
      "aiScore"=$14, "aiScoreDetail"=$15, "aiScoredAt"=$16,
      "processingStatus"=$17, "filterReason"=$18
      WHERE id=$19`, [
      result.decision, result.reason, result.contentGenre, JSON.stringify(result.categories),
      JSON.stringify(result.usableFor), result.summary || null, JSON.stringify(result.quotes), now,
      process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? null,
      item.contentHash ?? null,
      result.decision === "accept" ? "accepted" : "filtered",
      result.decision === "accept" ? "approved" : "rejected",
      result.decision === "accept" ? now : null,
      scoreOverall, scoreDetail, scoredAt,
      result.decision === "accept" ? "pending" : "filtered",
      result.decision === "reject" ? `AI 拒绝: ${result.reason}` : null,
      item.id,
    ]);
    return result.decision === "accept" ? "accepted" : "rejected";
  } catch (error) {
    const msg = error instanceof Error ? error.message : "评估失败";
    try {
      await q(`UPDATE "ContentItem" SET "aiAssessmentError"=$1, "aiLastError"=$2, "aiLastFailedAt"=$3, "adminReviewStatus"='pending_ai' WHERE id=$4`,
        [msg, msg, new Date(), item.id]);
    } catch (e) { console.error(`  [write-err-fail] ${item.id}: ${e.message}`); }
    return "error";
  }
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== AI 评估未评估文章（自包含版）===");
  console.log(`模式: ${isExecute ? "执行（调 AI + 写库）" : "DRY-RUN（仅查询）"}`);
  console.log(`并发: ${CONCURRENCY}${LIMIT ? `  限量: ${LIMIT}` : ""}\n`);

  const { rows: totalRows } = await q(`SELECT COUNT(*)::int n FROM "ContentItem" WHERE "aiDecision" IS NULL`);
  console.log(`未评估总数: ${totalRows[0].n}`);
  if (totalRows[0].n === 0) { console.log("\n✅ 无需评估"); return; }

  const { rows: items } = await q(
    `SELECT c.id, c.title, c."contentType", c."fullText", c.excerpt, c."contentHash", s.name AS source_name
     FROM "ContentItem" c LEFT JOIN "Source" s ON s.id=c."sourceId"
     WHERE c."aiDecision" IS NULL ORDER BY c."createdAt" ASC${LIMIT ? ` LIMIT ${LIMIT}` : ""}`
  );

  if (!isExecute) {
    console.log(`\nDRY-RUN 抽样前 20:`);
    for (const it of items.slice(0, 20)) {
      const len = (it.fullText ?? it.excerpt ?? "").replace(/\s+/g, "").length;
      console.log(`  - [${it.id.slice(-8)}] "${(it.title||"").slice(0,30)}" src=${it.source_name ?? "?"} len=${len}`);
    }
    const tooShort = items.filter(i => (i.fullText ?? i.excerpt ?? "").replace(/\s+/g,"").length < 300).length;
    console.log(`\n🔍 将评估 ${items.length} 篇（${tooShort} 篇 <300 会跳过）。用 --execute 执行。`);
    return;
  }

  // 验证 AI 配置可解密（提前失败）
  try { await getAiRuntime(); console.log("✅ AI 配置可解密，模型就绪"); }
  catch (e) { console.error("❌ AI 配置错误:", e.message); process.exit(1); }

  console.log(`\n🔄 开始评估 ${items.length} 篇...\n`);
  const counts = { accepted: 0, rejected: 0, skipped: 0, error: 0 };
  let done = 0;
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(assessOne));
    for (const r of results) counts[r] += 1;
    done += batch.length;
    console.log(`  进度 ${done}/${items.length} (${Math.round(done/items.length*100)}%) | accept=${counts.accepted} reject=${counts.rejected} skip=${counts.skipped} err=${counts.error}`);
  }
  console.log("\n=== 汇总 ===");
  console.log(`评估 ${items.length} | accept=${counts.accepted} reject=${counts.rejected} skip=${counts.skipped} error=${counts.error}`);
  const { rows: rem } = await q(`SELECT COUNT(*)::int n FROM "ContentItem" WHERE "aiDecision" IS NULL`);
  console.log(`剩余未评估: ${rem[0].n}`);
  if (counts.error > 0) console.log(`⚠️ ${counts.error} 篇失败（已写 aiAssessmentError），可重跑。`);
}

main().catch((e) => { console.error("❌ 失败:", e); process.exit(1); }).finally(() => pool.end());

# 高价值采集栏目调研报告

调研日期：2026-05-30

## 原则

- 只采集评论、政策解读、案例实践类栏目
- 不采集普通新闻、会议新闻、通知公告
- 每个来源配置具体栏目列表页 URL，不再采集首页

---

## 1. 先锋文汇 (tougao.12371.cn)

| 栏目 | URL | 价值 | 说明 |
|------|-----|------|------|
| 精华文章 | https://tougao.12371.cn/wenhui.php | 高 | 用户投稿的党建/治理类文章，Discuz 论坛系统 |

- 平台：website
- 内容类型：policy_analysis / case_practice
- 信任等级：official_primary
- 优先级：P1

---

## 2. 人民日报 (paper.people.com.cn)

| 栏目 | URL | 价值 | 说明 |
|------|-----|------|------|
| 人民日报数字报 | http://paper.people.com.cn/rmrb/html/YYYY-MM/DD/ | 高 | 按日期组织，评论版(第5版等)最有价值 |

- 平台：website
- 内容类型：commentary / policy_interpretation
- 信任等级：official_primary
- 优先级：P0
- 注意：当前采集器只抓当天/前一天，可以改为抓多天

---

## 3. 人民网观点 (opinion.people.com.cn)

| 栏目 | URL | 价值 | 说明 |
|------|-----|------|------|
| 人民网观点频道 | http://opinion.people.com.cn/GB/8213/49160/index.html | 高 | 专门的评论/观点栏目 |
| 人民网评 | http://opinion.people.com.cn/n1/2026/0530/c1003-*.html | 高 | 人民网评论文章 |

- 平台：website
- 内容类型：commentary / policy_interpretation
- 信任等级：official_primary
- 优先级：P0

---

## 4. 广东省政府网 (www.gd.gov.cn)

| 栏目 | URL | 价值 | 说明 |
|------|-----|------|------|
| **政策解读** | https://www.gd.gov.cn/zwgk/zcjd/index.html | 高 | 政策解读文章，含文件解读和媒体解读 |
| **政务专题** | https://www.gd.gov.cn/gdywdt/zwzt/index.html | 高 | 主题性治理内容集合 |
| 要闻 | https://www.gd.gov.cn/gdywdt/gdyw/index.html | 中 | 治理相关新闻，需 AI 过滤普通新闻 |

- 平台：website
- 内容类型：policy_analysis / policy_interpretation
- 信任等级：official_primary
- 优先级：P1
- **关键发现**：首页链接 `a[href*='gd.gov.cn']` 过于宽泛，会匹配导航链接。必须用具体栏目 URL。

---

## 5. 湖南省政府网 (www.hunan.gov.cn)

| 栏目 | URL | 价值 | 说明 |
|------|-----|------|------|
| **三湘解读** | http://www.hunan.gov.cn/hnszf/xxgk/jd/index.html | 高 | 政策解读文章 |
| **聊点政事** | http://www.hunan.gov.cn/topic/ldzs/ldzs.html | 高 | 治理评论/政务解读 |
| 回应关切 | http://www.hunan.gov.cn/hnszf/xxgk/hygq/xxgk_tygl.html | 中 | 官方回应公众关切 |
| 在线访谈 | http://www.hunan.gov.cn/hdjl/zxft/jbft/gl_zxft.html | 中 | 政务访谈内容 |

- 平台：website
- 内容类型：policy_analysis / commentary
- 信任等级：official_primary
- 优先级：P1
- **关键发现**：首页链接模式 `/hnszf/` 配合 `t\d{8}_\d+\.html` 可以匹配文章，但必须从具体栏目列表页开始。

---

## 6. WeRSS 公众号 (需 sidecar)

| 来源 | 价值 | 说明 |
|------|------|------|
| 人民日报评论 | 高 | 官方评论公众号 |
| 半月谈 | 高 | 政治理论刊物 |
| 新华每日电讯 | 高 | 新华社评论 |

- 平台：wechat
- 优先级：P0
- 需要 WeRSS sidecar 运行

---

## 7. B站专栏 (需 MediaCrawler)

| UP主 | UID | 价值 | 说明 |
|------|-----|------|------|
| 公考隔壁班王老师 | 497178825 | 高 | 申论教学 |
| 笔杆子养成 | 1017375487 | 高 | 公文写作教学 |

- 平台：bilibili
- 优先级：P1
- 需要 MediaCrawler sidecar 运行

---

## 8. 小红书 (需 MediaCrawler)

| 账号 | 价值 | 说明 |
|------|------|------|
| 公考陈鲁 | 高 | 申论教学 |
| 申论日记本 | 高 | 申论素材分享 |

- 平台：xiaohongshu
- 优先级：P1
- 需要 MediaCrawler sidecar 运行

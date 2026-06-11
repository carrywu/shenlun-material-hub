# Staging 部署方案 — 待确认问题 Q&A

> 这份文档把「搭 staging 测试环境」过程中需要你拍板的决策点，用大白话列出来。
> 每个问题我先给出**推荐答案 + 理由**，你看完直接回答「同意 / 改成 X」就行。
>
> 已经在前面问过、你已经确认的（✅ 已定），这里只列出做备忘，不用再答。
> 标 ❓ 的是还需要你回答的。

---

## 一、已经确认的决策（备忘，不用再答）

### ✅ Q1：staging 镜像怎么到 Linux 测试机？
**你的选择**：Linux 机本地 `git pull` + `docker build`。
**理由**：Linux 机本身就是 x86_64，原生构建最快，不用走腾讯云镜像仓库（TCR），Mac 也不用参与构建。

### ✅ Q2：staging 端口怎么处理？
**你的选择**：staging 占 3001 端口；Playwright 测试直接打已部署的 staging，而不是自己再起一个开发服务器。
**理由**：你的任务里就是这么写的（`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001`）。

### ✅ Q3：Linux 机要不要装 Node + pnpm？
**你的选择**：装。Linux 机能跑原生 `pnpm lint / test / build / seed`，不只靠 docker。
**理由**：standalone 生产镜像里没有开发依赖（没 tsx、没测试框架），跑不了 lint/test/seed。装一套 Node 环境最干净。

### ✅ Q4：Playwright E2E 在哪跑？
**你的选择**：在 Mac 上跑，打 `http://100.117.96.1:3001`（已部署的 staging）。
**理由**：你任务里就是这么写的。

### ✅ Q5：wewe-rss 微信采集要不要启动？
**你的选择**：启动一个独立的 wewe-rss。
**理由**：要测采集功能就得有 wewe-rss。staging 是全新独立实例，不复用生产微信数据。

---

## 二、还需要你拍板的问题（❓ 待回答）

### ❓ Q6：Linux 机现在 ssh 连不上（免密不通），怎么解决？

**背景**：我刚才试了 `ssh root@100.117.96.1`，返回 `Permission denied (publickey,password)`——也就是说我（从 Mac）现在没法直接 ssh 进 Linux 机自动部署。

**我的推荐**：**方案 B —— 不强求 ssh 自动化，部署脚本设计成「在 Linux 机上手动跑」**。

**理由**：
- 家里测试机不追求「Mac 一键部署」那种自动化体验。
- 配 ssh 公钥是额外步骤，容易卡（要登 Linux 机、找 authorized_keys）。
- 手动模式更直观：你 ssh 进 Linux 机（或直接坐在机子前），`bash scripts/deploy-staging.sh` 一条命令搞定全流程。
- 脚本我会写成**两种模式都支持**：默认本地跑，传 `LINUX_HOST=100.117.96.1` 也能从 Mac 远程触发（前提是配好公钥）。

**你的选项**：
- **A**：我去配 ssh 公钥（你给我 Linux 机密码或帮我加公钥），实现 Mac 一键部署。
- **B（推荐）**：手动模式为主，你在 Linux 机上跑脚本。Mac 只负责开发 + E2E 测试。

A,linux密码为<LINUX_HOST_PASSWORD>
---

### ❓ Q7：wewe-rss 配置端口用 4001，可以吗？

**背景**：wewe-rss 第一次启动是空壳，必须用浏览器打开它的管理页面（默认 4000 端口），**微信扫码登录**后才能采到公众号文章。如果 staging 的 wewe-rss 也用 4000，会和生产撞（虽然你这台 Linux 机可能没跑生产，但保险起见换一个）。

**我的推荐**：**wewe-rss 映射 `4001:4000`**（宿主机 4001 → 容器内 4000）。

**理由**：
- 从 Mac 浏览器访问 `http://100.117.96.1:4001` 扫码配置。
- 避开生产的 4000，互不干扰。
- 只走 Tailscale，不开公网。

**你的选项**：
- **A（推荐）**：用 4001。
- **B**：用别的端口（你指定）。用400，前面的ip不一致，localhost会和你说的冲突吗
- **C**：干脆不映射到宿主机，只让 app 通过 docker 内部网络访问——但这样你就没法扫码配置，wewe-rss 永远空着。

---

### ❓ Q8：`.env.staging`（含密码、密钥）放在哪台机器？

**背景**：`.env.staging` 里有数据库密码、AI 加密密钥、管理员密码这些敏感东西。它不能进 git（已经在 .gitignore）。问题是它该存在哪。

**我的推荐**：**只放在 Linux 测试机上，Mac 上不留**。

**理由**：
- 密钥不应该在两台机器间传来传去（scp 传输有泄露风险）。
- staging 的密钥就在 staging 机上生成（`openssl rand`）和保存最干净。
- Mac 上本来就没有生产 .env，习惯一致。

**具体做法**：你在 Linux 机上 `cp .env.staging.example .env.staging`，然后用编辑器填值；密码和密钥直接在 Linux 机上 `openssl rand -base64 32` 现场生成。

**你的选项**：
- **A（推荐）**：只在 Linux 机上创建和维护。
- **B**：Mac 上也存一份（方便 Mac 直接连 staging 数据库调试），每次部署 scp 同步。

---

### ❓ Q9：staging 数据库的库名，用 `shenlun_staging` 还是用和生产一样的 `shenlun_material_hub`？

**背景**：staging 是独立的 postgres 容器（独立数据卷），和生产数据库物理隔离。但**库名**要不要也改？

**我的推荐**：**用 `shenlun_staging`，和生产的 `shenlun_material_hub` 区分开**。

**理由**：
- 多一层隔离：万一哪天误连，看到库名不同立刻知道连错环境。
- 没有额外成本（postgres 初始化时建哪个库都一样）。

**你的选项**：
- **A（推荐）**：`shenlun_staging`。
- **B**：和 production 一样叫 `shenlun_material_hub`（减少认知负担，反正容器是隔离的）。B，测试环境和生产环境得一致，不然部署会更加麻烦

---

### ❓ Q10：Linux 机上 git clone 用哪个仓库地址？

**背景**：Linux 机要 `git clone` 项目代码。你的项目在哪儿？是 GitHub/Gitee 远程仓库，还是只有本地？

**我的推荐**：**你告诉我远程仓库地址**（比如 `git@github.com:xxx/shenlun-material-hub.git` 或 https 地址）。https://github.com/carrywu/shenlun-material-hub

**如果只有本地没有远程**：那就从 Mac 把代码 rsync/scp 到 Linux 机（但这样每次更新都要手动同步，不推荐）。

**你的选项**：
- **A**：我提供 git 远程仓库地址（推荐，最干净）。https://github.com/carrywu/shenlun-material-hub
- **B**：只有本地，用 rsync 同步（每次更新手动推）。

---

### ❓ Q11：staging 的管理员账号，你想用什么用户名和密码？

**背景**：staging 后台要登录，需要管理员账号。生产模式启动会**强制要求密码非空且不是默认值 `admin123`**（否则应用直接退出）。

**我的推荐**：**用户名 `admin`，密码用一个明显是测试的弱密码，比如 `staging12345`**。

**理由**：
- staging 只走 Tailscale，不暴露公网，密码不用太强。
- 但 handoff 文档会**醒目提醒**：上线生产前必须改成强密码（其实 staging 和生产账号本来就完全隔离，staging 密码泄露也碰不到生产）。

**你的选项**：
- **A（推荐）**：用户名 `admin`，密码 `staging12345`（或你指定的测试密码）。
- **B**：你给我一个具体的用户名密码。admin <LINUX_HOST_PASSWORD>
- **C**：让脚本在 Linux 机上 `openssl rand` 随机生成，部署完告诉你（最安全但要记）。

---

### ❓ Q12：staging 要不要也启动 caddy 反向代理？

**背景**：生产环境（ECS）用了 caddy 做反向代理（处理 HTTPS/域名）。staging 要不要也来一套？

**我的推荐**：**不要。staging 直接走 Tailscale + 端口，不挂任何反向代理**。

**理由**：
- Tailscale 本身已经是加密隧道，不需要 HTTPS。
- staging 没有域名，caddy 没用武之地。
- 少一个组件，少一份配置，少一个出问题的地方。

**你的选项**：
- **A（推荐）**：不要 caddy，直连 3001。
- **B**：要 caddy（如果你以后想给 staging 加域名/HTTPS）。b,生产环境和测试环境得保持一致，颗粒度对启

---

## 三、我的下一步

你回答完 Q6–Q12 这 7 个问题后（或者直接说「全部按推荐」），我就：
1. 把答案固化进方案；
2. 退出 plan mode，开始实际建文件、改代码、跑验证；
3. 部署完生成 validation-report，再提醒你**上一个任务的遗留清理脚本**（生产库那 10 条验证页）。

---

## 附：一句话总览当前方案

> 在家里 Linux 机（100.117.96.1）上用 docker compose 跑一套独立的 staging：app 监听 3001、postgres 用独立数据库 `shenlun_staging`、wewe-rss 独立实例监听 4001。Mac 通过 Tailscale 访问 `http://100.117.96.1:3001`，并在 Mac 上跑 Playwright 打 staging 做验收。代码、数据库、上传文件、密钥全部和生产隔离。

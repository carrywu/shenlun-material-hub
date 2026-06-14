# PRD: carry 生卡入口与 AI Key 保存反馈

## 背景

`carry` 账号反馈点击生成素材卡提示权限不足，设置 AI Key 后输入框仍为空像是未保存。排查发现：

- `carry` 是 `VERIFIED_USER`，有生成私有素材卡的 API 权限。
- `carry` 的个人 AI 配置已保存且密钥可解密。
- 前台文章详情页把 ADMIN-only 的 AI 评估入口暴露给非管理员，导致认证用户点击后得到 403。
- AI Key 保存后输入框清空是安全设计，但缺少明确保存成功反馈。

## 目标

- VERIFIED_USER 在前台文章详情页可直接生成自己的私有素材卡。
- 非管理员不再看到会触发 ADMIN-only 接口的 AI 评估入口。
- AI Key 保存后保持清空输入框，但给出明确保存成功和已配置反馈。

## 角色行为

- USER：不能生成素材卡，看到升级认证引导。
- VERIFIED_USER：在已审核通过且有全文的文章详情页生成自己的素材卡；不能 AI 评估公共文章。
- ADMIN：保留后台管理/审核入口；不改变管理员审核流。

## 验收标准

- VERIFIED_USER 在 `/articles/[id]` 不看到“AI 评估”按钮。
- VERIFIED_USER 在可生成文章详情页看到“生成素材卡”入口。
- VERIFIED_USER 生成素材卡不返回 403；已存在、未审核、无全文等业务错误有明确提示。
- USER 在文章详情页看到升级引导，不显示生成按钮。
- `/settings/ai` 保存成功后显示成功提示和 masked key，输入框仍清空。

## 非目标

- 不开放 AI 评估权限给 VERIFIED_USER。
- 不修改数据库 schema。
- 不新增依赖。
- 不回填完整 API Key。

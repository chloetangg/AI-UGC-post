# AI 小红书 / Rednote UGC 生成器｜当前版本说明

**版本：** Consumer Demo v0.11  
**日期：** 2026-09-09  
**状态：** 消费者端前端 + OpenAI 真实生成（标题 / 正文 / 话题标签 / 封面 mainTitle + subTitle / 封面选图）+ 内部 Content Strategy Layer + Cover Composer + MongoDB 保存 YOU 资料与 FEEL 餐费 + GitHub / Vercel 部署

这不是完整产品 spec。本文记录**现在已经上线到 Demo 里的行为**。

---

## 1. 这是什么

面向品牌 Campaign 的消费者端 UGC 文案生成 Demo。当前 Campaign：**Baan Ying**。

英文界面称平台为 **Rednote**；中文界面称 **小红书**。生成的帖子一律是简体中文。

代码仓库：[https://github.com/chloetangg/AI-UGC-post](https://github.com/chloetangg/AI-UGC-post)  
部署：Vercel（Hobby）。

消费者进入后：

1. YOU：年龄、性别、来自哪个国家
2. FEEL：游客/本地、是否第一次、本餐开销、喜欢的点、推荐菜、推荐理由、用餐补充说明
3. PHOTOS：上传 1–5 张照片
4. Generating：一次 OpenAI 请求写出标题 + 正文 + 5 个标签 + 封面 mainTitle / subTitle + 封面照片选择；系统追加 Location & Time，再调用 Cover Composer 自动生成封面
5. POST：看封面、换封面模板（Template 1–10）、选正文标题、改正文、改动态标签
6. SHARE：分块复制文案，可保存已生成的封面，自己去小红书发布

生成目标口吻：

> 一个真实的人刚吃完 Baan Ying，觉得不错，所以自然地发了一篇小红书。

不是品牌广告、不是正式餐厅评测、也不是把问卷关键词拼成文章。

**没有：** 注册、登录、品牌 Dashboard、Cloudinary、小红书自动发布、AI 生图。  
**已有：** MongoDB Atlas 保存 YOU 页客户资料 + FEEL 页餐费（同一条 `submissions` 记录）。

---

## 2. 如何运行

```bash
cd "/Users/wenhueyyy/Downloads/AI UGC Content"
npm install
npm run dev
```

打开：**http://localhost:3000**（若被占用则看终端实际端口，常见 3001）。

`/` 会跳到 `/c/baan-ying/customer`。

`.env.local`（不提交 Git）：

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
MONGODB_URI=
MONGODB_DB_NAME=baan-ying
```

生成帖子必须有 `OPENAI_API_KEY`。MongoDB 只用于保存 YOU / 餐费；缺了不会挡住翻页，但数据不会入库。

Vercel 需配置同样的环境变量（Production / Preview / Development），改完后 Redeploy。生成走 OpenAI，不走 MongoDB。

如果浏览器报 `ERR_CONNECTION_REFUSED`，说明 `npm run dev` 没在跑。

---

## 3. 技术栈

| 项 | 当前使用 |
| --- | --- |
| 框架 | Next.js 16 App Router |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| UI | shadcn/ui + 自定义下拉 `MenuSelect` |
| 流程状态 | React 内存（同一次填写可前后翻页）；Continue 不等待 MongoDB |
| 客户资料 | YOU 的年龄 / 性别 / 国家，以及 FEEL 餐费，写入 MongoDB `baan-ying.submissions`；刷新后表单仍清空 |
| UI 语言 | `localStorage` key：`xhs-ugc-ui-language` |
| AI | OpenAI Chat Completions，**一次请求**写出标题 + 正文 + 标签 + 封面 mainTitle / subTitle + 封面选图 |
| 照片 | 浏览器 `File API`；发给 `/api/generate` 前会在客户端压缩，避免 Vercel 4.5MB 限制 |
| 封面 | Cover Composer：`POST /api/compose-cover`；字体从 `public/fonts` 读取（Vercel 需 file tracing） |
| 数据库 | MongoDB Atlas；接口 `POST /api/submissions` |

主色：Baan Ying 森林绿。手机宽布局，`max-w-[430px]`。页面标题：`Rednote UGC Generator`。

---

## 4. 消费者流程

```text
打开网站（空表单）
        ↓
YOU（年龄 / 性别 / 来自哪个国家）
        ↓
FEEL（游客或本地 / 是否第一次 / 本餐开销 / 喜欢的点 / 菜 / 理由 / 补充说明）
        ↓
PHOTOS（上传 1–5 张）
        ↓
Generating（1 次 OpenAI → 系统追加 Location & Time → 1 次 Cover Composer）
        ↓
POST（看封面 / 换 Template 1–10 / 选正文标题 / 改正文 / 改标签）
        ↓
SHARE（分别复制标题、正文、标签；可保存封面）
```

进度条中英文都是：**YOU → FEEL → PHOTOS → POST → SHARE**

流程守卫：没填完 YOU、FEEL（含餐费、第 7 题至少 10 个计数单位）、Photos，不能进后面的步骤。

刷新或重新打开页面，表单清空，从 YOU 重新开始。同一次访问里按返回，已填内容还在。

---

## 5. 页面与路由

| 路由 | 页面 |
| --- | --- |
| `/` | 跳转到 `/c/baan-ying/customer` |
| `/c/[campaignId]` | 跳转到 `customer` |
| `/c/[campaignId]/customer` | YOU：年龄、性别、来自哪个国家 |
| `/c/[campaignId]/experience` | FEEL：游客/本地、是否第一次、餐费、喜欢的点、菜、理由、补充说明 |
| `/c/[campaignId]/preferences` | 重定向到 experience |
| `/c/[campaignId]/upload` | PHOTOS：上传 1–5 张照片 |
| `/c/[campaignId]/generating` | 生成中 |
| `/c/[campaignId]/result` | POST：封面 / 模板 / 标题 / 正文 / Hashtags |
| `/c/[campaignId]/publish` | SHARE：分块复制 + 保存封面 |
| `/c/[campaignId]/privacy` | 隐私政策全文 |

当前 Campaign ID：`baan-ying`

消费者主生成接口：`POST /api/generate`  
封面合成接口：`POST /api/compose-cover`（非 OpenAI）  
顾客资料接口：`POST /api/submissions`（YOU + 餐费 upsert）  
另有 `POST /api/generate-content`（JSON 入参的备用生成接口）。

---

## 6. Campaign：Baan Ying

| 字段 | 值 |
| --- | --- |
| Brand | Baan Ying |
| Campaign | Baan Ying centralwOrld |
| Category | Thai Restaurant / Food & Dining |
| Logo | `/baan-ying-logo.png` |
| Content Type（品牌侧，消费者不选） | `restaurant-recommendation` |
| 品牌背景 | `lib/brand/baan-ying-context.ts` → `campaign.brandContext` |

品牌信息是**背景知识层**，不默认写进每一篇。顾客体验优先于品牌信息。

可用、但必须自然嵌入的事实包括：1999 年在泰国创立、泰国家常 / 舒适菜、曼谷多家分店、适合轻松用餐和分享、家庭配方、DIY Pad Kra Pao。

不要篇篇都写 1999、Auntie Ying、Siam Square 创业史，或「目前在曼谷拥有多个分店」。

品牌个性应通过写法体现：温暖、亲切、家常、现代泰式、轻松、适合家人朋友。不要写成奢华、企业、广告或过度精致。

10 篇小红书参考帖只提供**写法特征**（语气、节奏、发现故事、食物反应），禁止照抄句子、标题、结构、emoji 组合或独特表达。

---

## 7. YOU（客户资料）

**不再收集** Name / Nickname、Email、Phone Number。表单上已删除这三项；继续不依赖它们。

**当前表单没有同意勾选。** `ConsentCheckbox` 组件和 i18n 同意句仍在代码里，但 YOU 页不渲染。隐私政策页仍可从路由进入。

必填三项：

| 字段 | 规则 |
| --- | --- |
| Age Range | `18-24` / `25-34` / `35-44` / `45+` |
| Gender | `female` / `male` / `non-binary` / `prefer-not-to-say`（**必填**） |
| Origins | **只选国家**，不是城市。占位和搜索框：EN `Where are you from?` / 中文 `你来自哪里？` |

Origins 下拉置顶：Thailand、Singapore、Malaysia、China、Hong Kong、Taiwan。值写入英文国名（如 `Thailand`），并带上 `countryIso2` / `countryCode`。会作为 diner origin 传给生成。

没有自定义问答题。生成文案**不会使用真实姓名**（页面也不再收集姓名）。

Age Range 和 Gender 使用自定义下拉：圆角按钮、右侧箭头、点开后是选项列表，不再用系统 `select`。

点 Continue 时 `void saveYouPage()`：**不等待** MongoDB 返回就翻到 FEEL。刷新后表单仍清空；同一 `submissionId` 在本次访问内可 upsert。

内部 `CustomerInfo` 仍保留空的 `name` / `email` / `phone*` / `consent` 字段，不展示、不校验。旧版完整代码在 `snapshots/you-page-2026-09-06/`。

MongoDB `baan-ying.submissions` 保存：

```text
customer.ageRange
customer.gender
customer.location
customer.countryIso2
customer.countryCode
```

不保存照片、不保存用餐补充说明。

---

## 8. 隐私政策页

路由：`/c/[campaignId]/privacy`  
文案在 `lib/i18n.ts` 的 `privacy`。英文 / 中文随 UI 语言切换。

标题 + 副标题：

- EN：Privacy Policy / How this campaign uses your information
- 中文：隐私政策 / 本次活动如何使用你的信息

正文结构：

1. What we collect / 我们收集什么
2. Why we collect it / 我们为什么收集（含「不用于营销」）
3. How your information is processed / 你的信息如何被处理
4. Where your data goes / 你的数据会传输到哪里（泰国境外处理 + PDPA）
5. Your rights / 你的权利
6. Eligibility / 参与资格（18 岁及以上）
7. Updates / 更新说明

照片相关措辞是「会上传」，不是「可以上传」：

- EN：You will also upload photos from your visit.
- 中文：你也将上传用餐照片。

收集范围**不含**姓名、邮箱、电话。隐私页英文/中文仍写「性别选填、到访门店」等旧表述；**实际表单已变**：性别必填、不选分店、增加本餐开销（THB）。政策文案尚未完全跟上表单。

联系邮箱：**admin@trendplay.com.sg**（可点 `mailto`）。

政策正文写明：回答会在活动结束后保存最多 12 个月。**当前实现：** MongoDB 只存 YOU（年龄 / 性别 / 国家）和 FEEL 餐费；照片、用餐补充说明、问卷多选项**不入库**。刷新后浏览器表单仍清空。

---

## 9. FEEL（体验问卷）

**没有分店选择题。** 用餐地点一律由系统定为 `Baan Ying (centralwOrld, 3rd Floor)`（`DEFAULT_BAAN_YING_BRANCH` / `resolveDiningBranch()`）。Location & Time 始终用 centralwOrld 官方地点和营业时间。`centralwOrld` 可作为封面两个关键词之一。

| # | 问题 | 必填 | 选项 |
| --- | --- | --- | --- |
| 1 | Are you a tourist or a local? | 单选必填 | Tourist / Local |
| 2 | Is this your first time at Baan Ying? | 单选必填 | 内部值 `1st time` / `Not first time`。UI：EN Yes / No；中文 是 / 不是 |
| 3 | How much is the total expenses for this meal? | 必填 | THB 金额；写入 Mongo `mealExpenseThb` |
| 4 | What did you enjoy most? | 多选可选 | The food / flavors / presentation / variety / atmosphere / service / overall experience |
| 5 | What dish would you recommend the most? | 多选可选 | Yellow Curry Crab Meat / Tom Yum Goong / Thai Sweet & Sour Steamed Fish / Stir-Fried Shrimp with Garlic / Mango Sticky Rice / Others（可填其他） |
| 6 | Why do you recommend it? | 多选可选 | Delicious / Flavorful / Authentic / Fresh / Tender / Crispy / Fragrant / Rich / Creamy / Satisfying / Well-balanced（**没有 Others**） |
| 7 | Tell us more about your dining experience | 必填 | 多行文本框；**不写入 Mongo** |

点 Continue 时 `void saveFeelExpense()`：不等待 Mongo 就翻到 PHOTOS。

第 7 题标题下**不再**显示「中文按字计算…」这类说明。输入框下方仍显示 `{count} / 10`。至少 **10 个计数单位** 才能继续：

- 英文按**单词**计：`you` = 1，不是 3
- 中文按**字**计
- 标点、空白不算
- 中英混写把字和词加在一起
- 计数函数：`countDiningExperienceUnits()`（`types/content.ts`）

字段名：`diningExperienceNote`。会传给生成，当作顾客自己的用餐细节，不要当成第 6 题的 Others。

选项内部值保持英文（给 AI 用）。中文 UI 只翻译显示文案。

`1st time`（Yes / 是）按第一次到访写，不要写成回头客。`Not first time`（No / 不是）表示来过，不要写成第一次发现；除非用餐说明里写明常来，否则不要发明「每次来 / 又来了」。

这些答案要转化成**个人经历**，不要逐条复述。系统大约取 2–4 个强内容点来写故事。第 7 题是主要的亲口细节来源。

---

## 10. PHOTOS

- 1–5 张，至少 1 张才能生成
- JPG / JPEG / PNG / WEBP
- 本地预览，可删除
- 不上传 Cloudinary / MongoDB
- 发给 `/api/generate` 前，浏览器用 `lib/compress-photo.ts` 压缩（最长边 1024、JPEG 0.72），避免 Vercel 约 4.5MB body 限制
- AI 封面选择基于用户实际上传的全部照片，不是只看前 4 张
- 刷新后预览丢失

照片是证据，不是让模型编造细节。只有能看清、且顾客数据也支持的内容才能写进正文。

---

## 11. 语言规则

右上角：**EN | 中文**

| 项 | 规则 |
| --- | --- |
| 默认 UI | English |
| 切换 | 不刷新页面 |
| 存储 | `localStorage`：`xhs-ugc-ui-language` |
| 翻译 | `lib/i18n.ts` |
| 英文产品名 | Rednote |
| 中文产品名 | 小红书 |

**UI 语言和 AI 内容语言完全分开。**

无论 UI 是 English 还是中文，生成的小红书帖子必须是 **简体中文**。

```ts
CONTENT_LANGUAGE = "zh-CN"
```

---

## 12. AI 生成

接口：`POST /api/generate`

同一品牌，不同消费者应像不同的人在写。不要固定成一种「Baan Ying 小红书官腔」。

### 12.1 一次 OpenAI 请求

```text
用户点 Generate
        ↓
POST /api/generate
        ↓
正好 1 次 openai.chat.completions.create
（structured JSON：titles[3] + caption + hashtags[5] + mainTitle + subTitle + selectedPhotoIndex + photoSelectionReason）
        ↓
本地补全标题关键词 / 格式、故事 emoji、封面叠字、从正文剥 hashtag
        ↓
系统按锁定模板追加 Location & Time
        ↓
返回 { titles, caption, hashtags, coverTitle, coverSubtitle, selectedPhotoIndex, photoSelectionReason, locationFormat, cost }
        ↓
浏览器把选中的照片转成 data URL
        ↓
POST /api/compose-cover（不是 OpenAI）
        ↓
进入 Result，封面已经生成好
```

一次用户生成 = **正好 1 次** OpenAI 文本请求 + **1 次** Cover Composer。不要再分开调用策略选择、标题、正文、标签、封面标题或选图。

封面合成失败时点 Retry Cover：**不再调用 OpenAI**，只再打 `/api/compose-cover`。

开发环境下 Generating 页的 `useEffect` 可能被 React Strict Mode 跑两遍。`generatePost()` 有进行中去重：第二次会复用同一条请求，不会打两次 `/api/generate`。点「重新生成」时锁已释放，可以再生成一次。

`lib/generate-hashtags/` 仍给备用接口 `POST /api/generate-content` 用。消费者主路径 **不会**走它。

展示时永远分开：

```text
Caption
  [正文]
  [Location & Time]

Hashtags
  #baanying曼谷 #曼谷必吃 #centralworld泰餐推荐 #随机1 #随机2
```

保存 / 发布前会从正文里清掉误带的 `#`，标签单独放在 Hashtags 区。

费用日志（服务端终端 + 浏览器 console）每次都会打印 `Calls:`，包括 `Calls: 1`：

```text
Generation Cost:
Model: gpt-4o-2024-08-06
Calls: 1
Input Tokens: ...
```

### 12.2 Prompt（合并为一次请求）

规则写在**同一份** system / user prompt 里，一次请求完成。不要为分析、选 KSP、选 Storyline、选角度、写标题、写正文、放 emoji、写标签再各打一次 API。

合并时去掉重复的品牌说明、标题规则和 Location & Time 模板原文（模板由系统追加，不让模型写）。

| 层 | 内容 |
| --- | --- |
| 1. 品牌知识 | Baan Ying 故事、个性、可用事实；只当背景 |
| 2. 顾客体验 | 系统分店（centralwOrld）、游客/本地、是否第一次、餐费、喜欢的点、推荐菜、第 7 题亲口描述、照片 |
| 3. 写法风格 | 参考帖压缩成特征 + 自然小红书语气 |
| 4. 生成规则 | 内部策略层（KSP / Storyline / Content Angle / Search Keyword）+ 标题、正文、emoji、hashtag JSON 字段、封面 mainTitle / subTitle、封面选图、负面中性化、安全、多样性；Location & Time 由系统追加 |
| 5. 输出格式 | JSON：3 个正文标题 + 1 篇正文 + 5 个 hashtags + mainTitle + subTitle + selectedPhotoIndex + 内部策略 id |
| 6. 校验规则 | 中文、正文无 hashtag、不编造、必须有 emoji、正文不含 Location & Time 区块 |

JSON 形状：

```json
{
  "titles": ["标题1", "标题2", "标题3"],
  "caption": "故事正文。不要写 Location & Time，不要写 hashtag。",
  "hashtags": ["#baanying曼谷", "#曼谷必吃", "#centralworld泰餐推荐", "#曼谷美食", "#泰国菜"],
  "mainTitle": "封面主标题",
  "subTitle": "封面副标题",
  "selectedPhotoIndex": 0,
  "photoSelectionReason": "食物主体清晰、构图完整，适合叠加标题。",
  "selectedKspId": "KSP-01",
  "selectedStorylineId": "ST-01",
  "selectedContentAngleId": "CA-01",
  "selectedSearchKeyword": "曼谷美食"
}
```

`selectedKspId` / `selectedStorylineId` / `selectedContentAngleId` / `selectedSearchKeyword` 只存在生成状态里，**不展示给消费者**。

### 12.3 内容策略层（内部）

一次 OpenAI 请求里先做策略选择，再写文案。消费者不选手动 KSP / Storyline / Angle / Keyword。

```text
顾客证据
  → KSP
  → Storyline（叙事意图，不是固定开头模板）
  → Content Angle
  → Search Keyword
  → 标题 / 正文 / 封面 / 选图
  → 从批准池随机抽 2 个话题标签
```

可复用结构：`lib/content-strategy/`。Baan Ying 的 10 个 KSP、10 条 Storyline、12 个 Content Angle、主/次搜索词和兼容矩阵在 `lib/brand/baan-ying-strategy.ts`。

Storyline **只定义叙事意图**，禁止写成「ST-01 必须用某某开头」。

本地会按顾客证据给一个 suggested 组合；模型可在证据支持时另选。重新生成会避开上一轮的 KSP / Storyline / Angle（还有别的合法选项时），并换标题关键词、开头、结构和随机话题标签。顾客事实不变，不为了变化而编造经历。

KSP-03 Family Recipes & Heritage 是低频策略，不默认写 1999 / Auntie Ying / Siam Square。

随机话题标签只能从批准池抽 2 个，不按 Storyline 写死。固定三个是 `#baanying曼谷` `#曼谷必吃` `#centralworld泰餐推荐`。

### 12.4 标题

每次正好 3 个简体中文标题。切入角度必须明显不同，不能只换形容词。

**每个标题必须自然包含至少 1 个曼谷美食搜索关键词**，例如：曼谷美食、曼谷泰餐、曼谷吃什么、曼谷美食推荐、曼谷泰菜、曼谷餐厅、曼谷吃饭、曼谷美食攻略、曼谷探店。次关键词（如 曼谷旅行美食、泰国菜推荐）也可以。不要用「必吃」当标题卖点。

同一次的 3 个标题优先用 3 个不同关键词。关键词要贴合内容，成为标题的一部分，不要堆砌，标题里不能有 hashtag。

重新生成时会传入 `previousTitleKeywords`。本次至少应有 2 个标题换用不同关键词；条件允许则 3 个都换。

**标题格式必须有变化**，不要 3 句同一套壳。🇹🇭、冒号、emoji 都是可选项：

1. 🇹🇭 开头（可有可无冒号）
2. 冒号结构（不要每句都有）
3. 无冒号、无国旗的完整句子
4. 偶尔 1 个自然 emoji

同一次 3 个标题：**不要全部冒号、全部 🇹🇭、全部带 emoji、全部不带 emoji**。禁止把「🇹🇭 + 关键词 + 冒号 + 内容」当成固定模板。

系统会校验关键词和格式；不合格时**不再第二次调用 OpenAI**，只做最小本地补全。

### 12.5 正文

写成连贯的个人经历，不要问卷清单。

菜是内容池，不是必须全写：

| 顾客选了 | 正文通常写 |
| --- | --- |
| 1 道 | 这道 |
| 2 道 | 1–2 道 |
| 3 道 | 通常 1–2 道 |
| 4–5 道 | 通常 2–3 道 |

只采用约 2–4 个顾客已提供的内容点。食物描述必须来自顾客选择、已批准品牌信息，或照片里能看清的内容。

不编造：配料、口味、价格、奖项、米其林、明星、营业时间、促销、排名、「曼谷第一」。

生成链路会先按小红书合规规则写标题 / 正文 / 标签 / 封面 / 内容角度；返回前再扫描绝对化、医疗功效、迷信、引流、跨平台、硬广「必吃/封神/顶级」等表述。命中则改写成中性个人体验后再检查一次。

**负面反馈中性化（Negative → Neutral）：** 顾客原话里的负面意思要保留，但不得原样出现在标题、正文、标签或封面。不要删掉、也不要改成假好评。映射写在 `lib/compliance/negative-feedback.ts`，例如：

| 输入 | 输出 |
| --- | --- |
| 难吃 | 泰餐口味比较看个人喜好 |
| 性价比低 | 价格和个人预期有所不同 |
| 很普通 / 没什么特别 | 整体风味比较经典 |
| 服务不好 | 用餐高峰期服务可能会比较慢 |
| 态度不好 | 和店员沟通可能需要多一些耐心 |
| 不会回购 | 是否再次选择可以根据个人喜好决定 |
| 贵 / 太贵 | 价格偏高 / 价格相对较高 |
| 踩雷 | 可以根据个人口味选择 |
| 抽奖送东西 | 有互动活动和礼品 |

封面字数不够时用更短同义：口味看个人喜好 / 整体风味比较经典 / 价格看个人预期。禁止把难吃改成超级好吃。

品牌固定标签 `#baanying曼谷` `#曼谷必吃` `#centralworld泰餐推荐` 仍保留；正文和标题里不再把「必吃」当卖点。封面允许用池子里的「必吃」作为两个关键词之一。用户只看到终稿，看不到内部合规分析。

写法应口语、自然、略带情绪；避免「作为一家…」「值得一提的是…」「整体来说…」「如果你正在寻找…」这类评测 / 广告句式。

结构不要固定成同一模板。重新生成时应换开头和叙事顺序。

### 12.6 Emoji

正文**故事部分必须有 emoji**，通常 2–6 个。

- Location & Time 里的 📍 / ⏰ **不算**
- 不要每句都加，也不要每次同一组 emoji
- 位置、数量、种类要有变化
- 如果故事区 emoji = 0：**不**再打 OpenAI，直接在故事里补 1–2 个相关 emoji

### 12.7 重新生成

点击重新生成时，不能只是改写上一篇。应改掉其中多项：

- KSP / Storyline / Content Angle（在还有别的合法选项时）
- 标题角度 / 标题关键词 / 开头
- 叙事结构
- 主推菜强调方式
- 句子节奏 / 情绪
- emoji 用法
- Location & Time 版式
- 动态 hashtags

顾客事实必须保持一致。不要为了「看起来不一样」而发明新经历。

---

## 12.8 自动封面（Cover Composer）

封面不是单独的 OpenAI 功能，也不走 Canva / MCP / AI 生图。

Generating 页文案：先 `Generating your post...`，再 `Creating your cover...`，完成后进入 Result。用户不必再点 Generate Cover，也不必另选 Cover Title。

封面叠字来自独立的 JSON `mainTitle` + `subTitle`（解析后存在 `coverTitle` / `coverSubtitle`），**不是**正文 3 个标题的缩写，也不是 SEO 搜索短标题。禁止先写长句再截断、禁止用填充字凑字数。

| 字段 | 字数（汉字等价单位） |
| --- | --- |
| mainTitle | **正好 4–7**。禁止 3，禁止 8+ |
| subTitle | **正好 4–9**。禁止 1–3，禁止 10+ |

**mainTitle + subTitle 合起来必须正好 2 个池子关键词**（不重复、不能 1 个也不能 3 个）：

`曼谷` / `centralwOrld` / `泰餐` / `美食` / `必吃`

有效组合例如：曼谷+泰餐、曼谷+美食、曼谷+必吃、centralwOrld+美食、泰餐+必吃。关键词不能当整句；副标题要带 KSP，不要重复主标题公式。`必吃` **只允许出现在封面**（以及固定话题 `#曼谷必吃`）。封面禁止：第一 / 唯一 / 顶级 / 最强 / 最好吃 / 封神。不要编造「泰国人爱吃 / 明星爱吃」。菜名可选，且必须是顾客选过或写过的。

不合格时整条换成完整短标题，不截原句。封面标题与正文标题分开校验。`layoutCoverOverlay` 的叠字架构不变。

### 封面标题换行（10 个模板共用）

优先级：

1. 可读性
2. **一行放得下就一行**（按设计字号）
3. 一行会太小 → 两行
4. 语义拆分：先主语 / 地点 / 对象，再谓语 / 情绪
5. 再套各模板的对齐

短而完整的标题不要强行拆成两行，也不丢字。

### 显示名与内部 ID

UI 一律显示 **Template 1 … Template 10**（中英文相同）。内部 `templateId` **不变**。

| UI | templateId |
| --- | --- |
| Style 1 | `top-stroke` |
| Style 2 | `badge-stack` |
| Style 3 | `dual-line` |
| Style 4 | `top-banner` |
| Style 5 | `left-spine` |
| Style 6 | `polaroid` |
| Style 7 | `center-lower` |
| Style 8 | `bottom-bar` |
| Style 9 | `split-band` |
| Style 10 | `bottom-card` |

POST 页可点选模板；换模板只重打 `/api/compose-cover`，**不再调用 OpenAI**。

`top-stroke` / `badge-stack` / `dual-line`（Style 1 / 2 / 3）在 **4 张及以上照片** 时做 2×2 拼贴；标题 / 副标题 / 背景装饰叠在四宫格几何中心。1–3 张以及另外 7 个模板都是单图封面。输出 1080×1350。Vercel 上中文字体从 `public/fonts` 读取（`lib/cover/asset-path.ts` + `outputFileTracingIncludes`）。

### Template 4（`top-banner`）

红色长方形横幅从左到右水平铺满；**标题和国旗保持水平正字**。

泰国国旗加在**整句封面标题前面**，并走同一套一行 / 两行规则：

- 一行放得下（算上国旗宽度）→ 国旗 + 整句
- 需要两行 → 国旗只留在第一行开头，第二行是后半句

国旗是绘制的旗帜图（`public/cover/thai-flag.png`），不是字体 emoji，避免合成时缺字。

### 其他版式要点

- Style 10 / 4：标题在安全框内左对齐
- Style 2 / 9：更大字号，优先换行而不是缩小
- Style 3：白 blob + 橙胶囊，不要把标题拆成两个白 blob
- Style 6：标题在拍立得白边里，统一字号

Cover Composer 失败时：「Cover generation failed」+ Retry Cover（只重打 `/api/compose-cover`，不再调用 OpenAI）。

封面状态：`coverTitle`、`coverSubtitle`、`selectedPhotoIndex`、`selectedCoverTemplateId`、`generatedCoverImageUrl`。刷新仍会清空。不写 MongoDB / Cloudinary。

---

## 13. 地点与营业时间（固定事实 + 6 种锁定模板）

Location & Time 必须出现在正文**最后**，后面不能再有 CTA、推荐语、emoji、hashtag 或其他文字。

**官方事实固定。6 种呈现方式固定。模型不得自己写这一块，也不得创造第 7 种格式。**

系统从 `lib/locations.ts` 取官方地点和营业时间，再套上 Version 1–6 其中一种。只能换模板，不能改商场名、楼层、大小写或营业时间。

### 13.1 官方数据

消费者**不选分店**。生成和 Location & Time 一律用 `Baan Ying (centralwOrld, 3rd Floor)`。下表仍保留其他分店的官方写法，供数据层使用，但当前 Demo 不会选用。

| 分店 | 官方地点行 | 营业时间 |
| --- | --- | --- |
| centralwOrld | 尚泰世界购物中心（centralwOrld）3楼 | 10:00–22:00 |
| Siam Center | 暹罗中心（Siam Center）2楼 | 10:30–21:00 |
| Terminal 21 | Terminal 21 5楼 | 10:00–22:00 |
| One Bangkok | One Bangkok 3楼 | 周一至周六 10:30–21:30｜周日 10:30–21:00 |
| Baan Ying（无商场） | 不发明商场或楼层；地点写 `Baan Ying` | 不发明营业时间 |

名称 HARD RULE：

- `centralwOrld` 必须保持这个大小写
- `Terminal 21`、`One Bangkok` 必须保持英文
- 中文商场名只允许 **尚泰世界购物中心**、**暹罗中心**
- One Bangkok 营业时间必须完整保留：`周一至周六 10:30–21:30｜周日 10:30–21:00`

禁止：`CentralWorld` / `Central World` / `终端21` / `One Bangkok 曼谷` / 自造中文商场名 / 自加楼层。

### 13.2 六种锁定模板

内部代号 A–F 对应 Version 1–6。模板句子不得改写。

**Version 1 / A**

```text
📍 尚泰世界购物中心（centralwOrld）3楼
⏰ 10:00–22:00
```

**Version 2 / B**

```text
就在 📍 尚泰世界购物中心（centralwOrld）3楼，营业时间是 ⏰ 10:00–22:00
```

**Version 3 / C** — 即使有营业时间也不写时间

```text
这家分店就在📍 尚泰世界购物中心（centralwOrld）3楼
```

**Version 4 / D** — 即使有营业时间也不写时间

```text
喜欢泰餐的快来📍 尚泰世界购物中心（centralwOrld）3楼 试试吧！
```

**Version 5 / E**

```text
赶紧码住📍 尚泰世界购物中心（centralwOrld）3楼， ⏰ 10:00–22:00， 下次来曼谷直接冲！
```

**Version 6 / F**

```text
Baan Ying
📍 尚泰世界购物中心（centralwOrld）3楼
⏰ 10:00–22:00
```

Version 1 和 Version 6 使用单换行，行与行之间没有空行。

### 13.3 有没有营业时间

地点始终输出。营业时间只有 `lib/locations.ts` 有官方数据时才能出现。

| Version | 有官方营业时间 | 没有官方营业时间 |
| --- | --- | --- |
| 1 / A | 地点 + 时间 | 只输出 `📍 地点` |
| 2 / B | 地点 + 时间 | **不能使用** |
| 3 / C | 只输出地点 | 可以使用 |
| 4 / D | 只输出地点 | 可以使用 |
| 5 / E | 地点 + 时间 | **不能使用** |
| 6 / F | `Baan Ying` + 地点 + 时间 | `Baan Ying` + `📍 地点` |

不得编造不存在的营业时间。

### 13.4 选择规则

- 每次必须从 Version 1–6 选一种
- 连续两次不能用同一个 Version
- 若有 `previousLocationFormat`，本次必须排除上一版
- 没有上一版时，从 Version 1–6 中选择（无官方营业时间时排除 Version 2 / 5）
- 优先选择近期没用过的 Version，让 6 种模板都能轮到，而不是固定成 `📍地点 + ⏰时间` 两行
- 历史记录以服务端实际套上的 Version 为准
- 重新生成只换呈现方式，不改官方事实
- 返回前自检；不合格则用官方数据重套模板

差的变化：把 `尚泰世界购物中心（centralwOrld）3楼` 改成 `CentralWorld 3F`，或把 `10:00–22:00` 改成 `10am–10pm`。

### 13.5 返回前自检

1. Location & Time 是否在正文最后？
2. 是否只使用 Version 1–6？
3. 是否与上一版使用了不同 Version？
4. 地点是否与所选分店完全匹配？
5. `centralwOrld` 是否保持正确大小写？
6. Terminal 21 是否保持英文？
7. One Bangkok 是否保持英文？
8. One Bangkok 是否完整包含周一至周六和周日营业时间？
9. 是否出现自造地点、楼层或营业时间？
10. 没有官方营业时间时，是否错误生成了营业时间？
11. Hashtag 是否完全没有出现在正文？
12. Location & Time 后面是否还有其他文字？

---

## 14. Hashtag 规则

每一次生成必须 **正好 5 个**。Hashtag 和标题、正文在**同一次** OpenAI 请求里生成，但页面上仍分开展示。正文里不能出现 `#`。系统会把结果强制整理成下面的结构。

固定 3 个（永远原样，不可改、不可译、不可删，且必须按此顺序）：

1. `#baanying曼谷`
2. `#曼谷必吃`
3. `#centralworld泰餐推荐`

随机 2 个：只能从批准池里选，且彼此不同。不能自造、缩短、合并、翻译或改写池子里的标签。每次生成应换一对，不要总用同一组。

批准池：

- `#centralworld`
- `#曼谷centralworld`
- `#centralworld美食`
- `#泰国`
- `#泰国旅游`
- `#泰国旅游攻略`
- `#泰国美食`
- `#曼谷泰餐推荐`
- `#centralworld泰餐`
- `#曼谷`
- `#曼谷美食`
- `#泰国菜`
- `#曼谷打卡`
- `#曼谷探店推荐`
- `#曼谷正宗泰餐`
- `#曼谷泰式家常菜`

最终顺序永远是：3 个固定 + 2 个随机。固定标签不能当随机位。结果页固定标签不能删除；随机标签最多 2 个，且只能是池子里的。

---

## 15. POST / SHARE

**POST**

- 顶部先显示已生成的 4:5 封面；其余照片可左右翻看
- 可换封面模板：**Template 1–10**（换模板只重合成封面，不重跑 OpenAI）
- 3 个正文标题里选 1 个
- 可改正文、可改动态标签
- 可重新生成（会再走 1 次 OpenAI + 1 次 Cover Composer）
- 保存时：正文去 hashtag，标签补齐固定 3 + 随机 2（仅批准池）

**SHARE**

- 标题、正文、标签分三块复制
- 可保存已生成的封面 PNG
- 「打开小红书 / Open Rednote」目前是 Demo 提示，不会真正打开 App

---

## 16. 关键文件

| 文件 | 作用 |
| --- | --- |
| `lib/i18n.ts` | UI 文案、隐私政策、Rednote / 小红书用词；Origins 占位 `Where are you from?` |
| `types/customer.ts` | 客户资料类型（年龄 / 性别 / 国家；name / email / phone / consent 仍空置保留） |
| `components/ui/menu-select.tsx` | 自定义下拉（年龄、性别共用样式） |
| `components/customer/OriginCityField.tsx` | Origins 国家下拉（置顶 TH / SG / MY / CN / HK / TW） |
| `components/customer/ConsentCheckbox.tsx` | 同意勾选组件（当前 YOU 页未使用） |
| `components/customer/CustomerForm.tsx` | YOU 表单（年龄、性别、国家；无姓名 / 邮箱 / 电话 / 同意勾选） |
| `snapshots/you-page-2026-09-06/` | 含姓名 / 邮箱 / 电话的旧版 YOU 快照 |
| `app/c/[campaignId]/privacy/page.tsx` | 隐私政策页 |
| `lib/mongodb.ts` | MongoDB Atlas 连接 |
| `lib/submissions.ts` | `submissions` upsert（YOU + 餐费） |
| `lib/save-submission-client.ts` | 浏览器调用 `POST /api/submissions`（fire-and-forget） |
| `app/api/submissions/route.ts` | 顾客资料 API |
| `lib/compress-photo.ts` | 生成前压缩照片 |
| `lib/compliance/negative-feedback.ts` | 负面用语 → 中性表述 |
| `lib/cover/asset-path.ts` | 服务端读取 `public/fonts`、`public/cover` |
| `lib/cover/collage.ts` | Template 1 四图 2×2 与中心点 |
| `components/providers/language-provider.tsx` | UI 语言 |
| `components/providers/campaign-flow-provider.tsx` | 流程状态、照片、封面、保存 YOU / 餐费、调用生成 |
| `lib/compose-cover-client.ts` | 浏览器把 File 转 data URL，调用 `/api/compose-cover` |
| `lib/cover/` | Cover Composer：模板、字体、合成 |
| `lib/cover/templates.ts` | 10 个模板定义；`name` 为 Template 1–10 |
| `lib/cover/post-layout.ts` | 模板选项文案、成片幻灯顺序 |
| `lib/cover/overlay-layout.ts` | 封面标题一行 / 两行规则 |
| `lib/cover/cover-title.ts` | 封面 mainTitle / subTitle 清洗、字数、关键词对、不合格整条替换 |
| `lib/cover/cover-rules.ts` | 封面池子关键词与 KSP 规则 |
| `lib/cover/cover-hooks.ts` | 封面 Hook 风格库 + 按策略建议家族 |
| `public/cover/thai-flag.png` | Template 4 标题前的泰国国旗 |
| `app/api/compose-cover/route.ts` | 封面合成 API（非 OpenAI） |
| `components/result/CoverEditor.tsx` | Result 最终封面图；失败时可 Retry Cover |
| `components/result/TemplatePicker.tsx` | POST 页 Template 1–10 选择 |
| `lib/mock/campaign.ts` | Baan Ying Campaign，挂上 `brandContext` |
| `lib/content-strategy/` | 可复用 Content Strategy Layer：类型、证据打分、prompt 格式化 |
| `lib/brand/baan-ying-strategy.ts` | Baan Ying 的 KSP / Storyline / Angle / 搜索词 / 兼容矩阵 |
| `lib/content-angles.ts` | 兼容层，转调新的 CA-01…CA-12 |
| `lib/brand/baan-ying-context.ts` | 品牌故事、个性、可用事实、参考帖特征 |
| `lib/title-keywords.ts` | 标题曼谷搜索关键词、去重、校验与兜底 |
| `lib/title-formats.ts` | 标题句式多样性（国旗 / 冒号 / 纯句 / emoji）校验与兜底 |
| `lib/caption-emoji.ts` | 正文故事区 emoji 计数与兜底补全 |
| `types/content.ts` | 体验问卷类型；默认分店、到访 Yes/No、第 7 题计数 |
| `lib/generate-prompt.ts` | 合并后的标题 / 正文 / 标签 / 封面 / 选图 prompt + JSON schema |
| `lib/generate-hashtags/prompt.ts` | 备用接口的标签 prompt |
| `lib/generate-hashtags/generate.ts` | 备用接口的标签生成 + 重试（主路径不用） |
| `lib/hashtags.ts` | 标签校验、从正文剥离 `#` |
| `lib/locations.ts` | 分店官方数据、默认 centralwOrld、6 种锁定 Location & Time 模板 |
| `lib/openai-pricing.ts` | OpenAI 模型单价（每百万 token），改价只改这里 |
| `lib/openai-usage.ts` | 从 API `usage` 取 token，汇总费用并打日志；`Calls:` 每次都打印 |
| `lib/parse-generated.ts` | 解析标题 + 正文 + hashtags + mainTitle / subTitle + 封面选图 |
| `app/api/generate/route.ts` | 消费者主生成：1 次 OpenAI → 本地补全 → 追加地点；最多 5 张图 |
| `app/api/generate-content/route.ts` | 备用 JSON 生成接口 |
| `app/c/[campaignId]/experience/page.tsx` | FEEL 问卷（无分店题；含餐费与第 7 题） |
| `app/c/[campaignId]/*` | 消费者页面 |
| `vercel.json` | `maxDuration`（Hobby 实际仍可能被平台上限截断） |
| `next.config.ts` | `outputFileTracingIncludes`（字体 / 国旗） |

---

## 17. 明确没做的事

- 登录 / 注册 / 品牌 Dashboard
- Cloudinary / 图片存储（照片不进 Mongo）
- 用餐补充说明、问卷多选项写入 Mongo（目前只存 YOU + 餐费）
- 小红书 / Rednote 自动发布
- AI 生图 / 修图 / 用模型绘制中文封面（封面是 Cover Composer 叠字，不是生图）
- QR Code 生成服务
- 多品牌多 Campaign 后台配置
- Token / 费用写入 MongoDB（目前只打服务端控制台和浏览器 console 日志）
- YOU 页同意勾选（组件还在，表单未展示）
- 隐私政策正文与现表单完全对齐（仍写性别选填、到访门店等）

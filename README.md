# AI 小红书 / Rednote UGC 生成器

**版本：** Consumer Demo v0.25  
**日期：** 2026-10-12  
**状态：** 同一套生成代码、两个互相隔离的分店部署（centralwOrld 与 Siam Center）。消费者端前端 + 两步星级入口 + ModelArk（默认）或 OpenAI 真实生成（标题 / 正文 / 话题标签 / 封面 mainTitle + subTitle / 封面选图）+ 内部 Content Strategy Layer + Human Style（正文和标题同一套写法）+ Cover Composer + 各分店自己的 MongoDB + GitHub / Vercel 部署

本文记录当前代码里的行为。标题和正文的表情写法另见 `title-rules.md`、`emoji-rules.md`。不是完整产品 spec。线上两个地址跑的不一定是这份代码。

---

## 1. 这是什么

面向品牌 Campaign 的消费者端 UGC 文案生成 Demo。品牌是 **Baan Ying**。正在运行的是两个独立部署，不是在一个网站里切换分店。

英文界面称平台为 **Rednote**；中文界面称 **小红书**；泰文界面称 **เสี่ยวหงชู**。生成的帖子一律是简体中文。

代码仓库：[https://github.com/chloetangg/AI-UGC-post](https://github.com/chloetangg/AI-UGC-post)

| 分店 | 生产地址 | 打开后进入 |
| --- | --- | --- |
| centralwOrld | [https://seedai-baanying.vercel.app](https://seedai-baanying.vercel.app) | `/c/baan-ying-centralworld/rating` |
| Siam Center | [https://baan-ying-siam-center.vercel.app](https://baan-ying-siam-center.vercel.app) | `/c/baan-ying-siam-center/rating` |

[https://aiugcpost.vercel.app](https://aiugcpost.vercel.app) 会跳到 centralwOrld 那个地址。部署：Vercel（Hobby，团队 `chloe-20b3`），两个项目各一份环境变量：centralwOrld 是 `ai_ugc_post`，Siam Center 是 `baan-ying-siam-center`。Git 分支：centralwOrld 从 `main` 发布；Siam Center 的代码在 `siam-center` 分支。

消费者进入后：

1. 星级第一步：标题「为这次用餐体验评分」，下方「Baan Ying · 分店名」。选 1–5 星后点「继续评价」
2. 1–2 星：进入反馈页「欢迎告知我们有待优化的地方」，意见必填，提交后到感谢页「感谢你的反馈！/ 感谢你的评价，请向店员出示此页面」，只有一个「重新评分」按钮。不进入后面的填写，也不生成帖子
3. 3–5 星：点「继续评价」时记下评分，直接进入体验页「这次 Baan Ying 用餐体验怎么样？」：是否第一次、游客/本地、喜欢的点、推荐菜、推荐理由、用餐补充说明、本餐开销、来自哪里、上传 1–5 张照片
4. Generating：一次文本请求写出标题 + 正文 + 5 个标签 + 封面 mainTitle / subTitle + 封面照片选择；地点按本轮模式写入或由系统追加，再调用 Cover Composer 自动生成封面
5. POST：看封面、换封面风格（Style 1–6）、选正文标题、改正文、改标签
6. SHARE：点「去发布」后选择小红书（系统分享发图）或大众点评（复制文案后手动发布）

生成目标口吻：

> 一个真实的人刚吃完 Baan Ying，然后顺手把自己的体验写下来。

不是品牌广告、不是正式餐厅评测、也不是把问卷关键词拼成文章。先看顾客自己写了什么，再按一次用餐的顺序重组。正文至少 3 句；普通输入大约 3–6 句；信息多时可以更长，但不要把问卷逐条写完。

**没有：** 注册、登录、品牌 Dashboard、Cloudinary、小红书自动发布、AI 生图。  
**已有：** 每个部署把自己的生成写进自己的 Mongo 数据库：`generations`（YOU / RATE + 标题 / 正文 / hashtag / 封面标题 / 封面副标题 / token 费用）和 `analytics_events` 转化漏斗。看板可以按分店切换数据库查看，顾客页面不能切换分店。

---

## 2. 如何运行

```bash
npm install
npm run dev
```

打开：**http://localhost:3000**（若被占用则看终端实际端口，常见 3001）。没设部署变量时，`/` 会跳到 `/c/baan-ying-centralworld/rating?new=1`。旧路径 `/c/baan-ying` 在 centralwOrld 部署上仍然打开 centralwOrld。

复制 `.env.example` 为 `.env.local`（不提交 Git）：

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
AI_PROVIDER=modelark
MODELARK_API_KEY=
MODELARK_MODEL=dola-seed-2-1-turbo-260628
MONGODB_URI=
MONGODB_DB_NAME=baan-ying-centralworld
DEPLOYMENT_ID=baan-ying-centralworld
NEXT_PUBLIC_DEPLOYMENT_ID=baan-ying-centralworld
```

生成帖子默认走 ModelArk Responses API：`AI_PROVIDER` 不设或设成 `modelark` 都一样，必须有 `MODELARK_API_KEY`。缺了这个 key，`/api/generate` 直接返回 500「ModelArk is not configured: MODELARK_API_KEY is missing on the server.」，不会偷偷改走 OpenAI。只有明确写 `AI_PROVIDER=openai` 才走 OpenAI，这时才需要 `OPENAI_API_KEY`；OpenAI 拒绝请求（如 429 额度不足）时，错误写成「OpenAI error (AI_PROVIDER=openai): …」，消息里像密钥的内容会被隐去。两种 provider 的 prompt 和后处理相同；ModelArk 失败不会自动改回 OpenAI。API key 只放在服务器环境或 `.env.local`，不进浏览器，也不打进日志。`npx tsx scripts/validate-ai-provider.ts` 检查 provider 选择和这两种错误提示，不打真实接口。`npm run test:modelark` 只测连通性，不生成整篇帖子。`npm run test:modelark-response` 用固定样例检查响应解析。`npm run test:modelark-titles` 用模拟响应检查标题数量和重试次数，不打真实接口。MongoDB 用于保存每次成功生成的 `generations`（含 YOU / RATE 快照 + 文案）；缺了不会挡住翻页或出帖，但数据不会入库。

本地默认就是 centralwOrld，数据库名是 `baan-ying-centralworld`。要在本机看 Siam Center，两个部署变量都设成 `baan-ying-siam-center`，并且 `MONGODB_DB_NAME` 必须是 `baan-ying-siam-center`，不能用 `baan-ying-centralworld`。

Vercel 上是两个项目，环境变量都要配 Production / Preview / Development，改完后各自 Redeploy：

| 变量 | centralwOrld | Siam Center |
| --- | --- | --- |
| `DEPLOYMENT_ID` | `baan-ying-centralworld` | `baan-ying-siam-center` |
| `NEXT_PUBLIC_DEPLOYMENT_ID` | 与上面相同 | 与上面相同 |
| `MONGODB_DB_NAME` | `baan-ying-centralworld` | `baan-ying-siam-center` |
| `MONGODB_URI` | 各自的连接串 | 各自的连接串 |
| `AI_PROVIDER` | 不设或 `modelark`。要改用 OpenAI 时才写 `openai` | 同左 |
| `MODELARK_API_KEY` / `MODELARK_MODEL` | 默认必配。模型默认 `dola-seed-2-1-turbo-260628` | 同左 |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | 只在 `AI_PROVIDER=openai` 时需要 | 同左 |

`NEXT_PUBLIC_DEPLOYMENT_ID` 给浏览器里的分店锁定用，只写服务端的 `DEPLOYMENT_ID` 不够。一个进程只加载一个部署。生成默认走 ModelArk；设了 `AI_PROVIDER=openai` 才走 OpenAI。成功后把文案写入**当前部署**的 Mongo `generations`，失败不挡住出帖。封面中文字体依赖 `public/fonts` 被打进 serverless bundle。

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
| 客户资料 | YOU / RATE 只存在浏览器内存；生成成功后一并写入 `generations`。刷新后表单仍清空 |
| UI 语言 | EN / 中文 / ไทย；`localStorage` key：`xhs-ugc-ui-language` |
| AI | 默认 ModelArk Responses API。`AI_PROVIDER=openai` 时改走 OpenAI Chat Completions。同一次请求写出标题 + 正文 + 标签 + 封面 mainTitle / subTitle + 封面选图 |
| 照片 | 浏览器 `File API`；发给 `/api/generate` 前会在客户端压缩，避免 Vercel 4.5MB 限制 |
| 封面 | Cover Composer：`POST /api/compose-cover`；字体从 `public/fonts` 读取（Vercel 需 file tracing） |
| 数据库 | MongoDB Atlas。centralwOrld 用数据库 `baan-ying-centralworld`；Siam Center 用数据库 `baan-ying-siam-center`。各自有 `generations` 和 `analytics_events` |

主色：Baan Ying 深绿 `#1c3b20`。手机宽布局，`max-w-[430px]`。页脚有 Seedi logo。页面标题：`Rednote UGC Generator`。

---

## 4. 消费者流程

```text
打开网站
        ↓
星级第一步（为这次用餐体验评分 / Baan Ying · 分店 / 1–5 星 / 继续评价）
        ↓
1–2 星 → 反馈页（意见必填 / 提交评价 / 返回）→ 感谢页（请向店员出示此页面 / 重新评分），不生成
3–5 星 → 点「继续评价」时记评分
        ↓
体验页（这次 Baan Ying 用餐体验怎么样？/ 是否第一次 / 游客或本地 / 喜欢的点 / 菜 / 理由 / 补充说明 / 本餐开销 / 来自哪里 / 上传 1–5 张）
        ↓
Generating（1 次模型请求 → 地点按本轮模式处理 → 1 次 Cover Composer）
        ↓
POST（看封面 / 换 Style 1–6 / 选正文标题 / 改正文 / 改标签）
        ↓
SHARE（点「去发布」打开系统分享；可复制文案、保存图片）
```

星级页不进进度条。进入填写之后，进度条是：**REVIEW → POST → SHARE**。

1–2 星不会进入体验页，也不会打 `/api/generate`。3–5 星点「继续评价」后才放开后面的步骤。没填完体验页（含餐费、补充说明至少 10 个计数单位、至少 1 张照片），不能进生成。

### 4.1 星级两步的细节

| 情况 | 行为 |
| --- | --- |
| 第一步刷新 | 星星清空，「继续评价」变回不可点 |
| 第二步（反馈页）点「返回」 | 回到第一步，刚选的星级保留；先刷新第二步再点「返回」也保留 |
| 第二步刷新 | 星级（地址里的 `?stars=N`）和门店名保留 |
| 1–2 星反馈 | 必填：去掉首尾空格后为空时「提交评价」不可点。只发给 1–2 星；3–5 星不显示反馈框 |
| 直接打开 `rating/review?stars=3/4/5` | 送回第一步 |
| 感谢页刷新 | 本轮已提交低分时仍是感谢页；没有提交记录就回第一步 |
| 感谢页「重新评分」 | 开始新一轮：清掉上一轮的星级、评价 ID 和已提交标记，显示未选星的第一步 |
| 扫码进入（`/qr/...`、`/`、`/c/[campaignId]`、别家 Campaign 路径） | 带 `?new=1` 开始新一轮，同样只清这三项，然后把 `new` 从地址里去掉 |

第一步选的星级只存在页面内存里：站内返回还在，浏览器刷新就没了。本轮的评价 ID 和已提交标记存在 `sessionStorage`（`ugc-entry-review:{campaignId}`、`ugc-entry-review-submitted:{campaignId}`），星级另存 `ugc-entry-rating:{campaignId}`。新一轮只删这三个键，不清空整个 `sessionStorage`。

刷新体验页会清空表单，并回到星级。同一次访问里按返回，已填内容还在。感谢页不再有抽奖按钮。

---

## 5. 页面与路由

| 路由 | 页面 |
| --- | --- |
| `/` | 跳到当前部署的星级页并开始新一轮。默认是 `/c/baan-ying-centralworld/rating?new=1` |
| `/c/[campaignId]` | 跳转到 `rating?new=1` |
| `/qr/[qrCodeId]` | 记下来源码 cookie，跳转到 `rating?new=1` |
| `/c/[campaignId]/rating` | 星级第一步。3–5 星点「继续评价」后直接进入 experience；`?draw=1` 是 1–2 星的感谢页 |
| `/c/[campaignId]/rating/review?stars=1\|2` | 1–2 星反馈页。3–5 星或无效星级送回第一步 |
| `/c/[campaignId]/customer` | 只做跳转：评分已通过就转到 experience |
| `/c/[campaignId]/experience` | 体验页：是否第一次、游客/本地、喜欢的点、菜、理由、补充说明、餐费、来自哪里、上传 1–5 张照片 |
| `/c/[campaignId]/preferences` | 重定向到 experience |
| `/c/[campaignId]/upload` | 重定向到 experience（照片已并入 RATE） |
| `/c/[campaignId]/generating` | 生成中 |
| `/c/[campaignId]/result` | POST：封面 / Style 1–6 / 标题 / 正文 / Hashtags |
| `/c/[campaignId]/publish` | SHARE：点「去发布」打开系统分享；可复制文案、保存图片 |
| `/c/[campaignId]/privacy` | 隐私政策全文 |

当前部署的 Campaign ID：centralwOrld 是 `baan-ying-centralworld`（旧 id `baan-ying` 仍打开这一家）；Siam Center 是 `baan-ying-siam-center`。别的 Campaign 路径会被送回当前部署，不会在这个网站里打开另一家店。

消费者主生成接口：`POST /api/generate`  
封面合成接口：`POST /api/compose-cover`（不调用文本模型，在服务端用 satori / resvg / sharp 合成图片）  
生成结果接口：成功的 `/api/generate` 写入 `generations`（YOU / RATE、标题、正文、hashtag、封面标题、封面副标题、token 费用）
另有 `POST /api/generate-content`（JSON 入参的备用生成接口）。

---

## 6. Campaign：Baan Ying

| 字段 | 值 |
| --- | --- |
| Brand | Baan Ying |
| 正在运行的分店 | centralwOrld，或 Siam Center。由部署决定，顾客不选 |
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

> **当前页面：** `/customer` 不再显示表单，只跳到体验页。游客/本地、是否第一次、来自哪里都在体验页。年龄和性别目前没有页面收集（`CustomerForm` 组件还在代码里）。本节下面是旧 YOU 表单的规则，留作参考。

**不再收集** Name / Nickname、Email、Phone Number。表单上已删除这三项；继续不依赖它们。

**当前表单没有同意勾选。** `ConsentCheckbox` 组件和 i18n 同意句仍在代码里，但 YOU 页不渲染。隐私政策页仍可从路由进入。

必填五项：

| 字段 | 规则 |
| --- | --- |
| Age Range | `18-24` / `25-34` / `35-44` / `45+` |
| Gender | `female` / `male` / `non-binary` / `prefer-not-to-say`（**必填**） |
| Origins | **只选国家**，不是城市。占位和搜索框：EN `Where are you from?` / 中文 `你来自哪里？` / 泰文 `คุณมาจากประเทศไหน?` |
| Are you a tourist or a local? | 单选必填：Tourist / Local；生成成功后写入 `generations.customerType` |
| Is this your first time at Baan Ying? | 单选必填。内部值 `1st time` / `Not first time`。UI：EN Yes / No；中文 是 / 不是；泰文 ใช่ / ไม่ใช่；生成成功后写入 `generations.visitFrequency` |

Origins 下拉置顶：Thailand、Singapore、Malaysia、China、Hong Kong、Taiwan。值仍写入英文国名（如 `Thailand`），并带上 `countryIso2` / `countryCode`。界面显示：EN 英文国名、中文 `nameZh`、泰文 `Intl.DisplayNames(["th"])`（如 ไทย / สิงคโปร์ / จีน）。会作为 diner origin 传给生成。

没有自定义问答题。生成文案**不会使用真实姓名**（页面也不再收集姓名）。

Age Range 和 Gender 使用自定义下拉：圆角按钮、右侧箭头、点开后是选项列表，不再用系统 `select`。

YOU 页标题：

- 中文：感谢您参与分享！
- EN：Thank you for sharing!
- 泰文：ขอบคุณที่ร่วมแชร์!

游客/本地、是否第一次也在 YOU 页（不再在 RATE）。点 Continue 翻到 RATE。YOU / RATE **不再写入** `submissions`。这些字段只在生成成功时进入 `generations`。刷新后表单仍清空。

---

## 8. 隐私政策页

路由：`/c/[campaignId]/privacy`  
文案在 `lib/i18n.ts` 的 `privacy`。英文 / 中文 / 泰文随 UI 语言切换。

标题 + 副标题：

- EN：Privacy Policy / How this campaign uses your information
- 中文：隐私政策 / 本次活动如何使用你的信息
- 泰文：นโยบายความเป็นส่วนตัว / แคมเปญนี้ใช้ข้อมูลของคุณอย่างไร

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
- 泰文：รวมถึงรูปที่คุณอัปโหลดจากมื้อนั้น

收集范围**不含**姓名、邮箱、电话。隐私页三种语言仍写「性别选填、到访门店」等旧表述；**实际表单已变**：性别必填、不选分店、增加本餐开销（THB）。政策文案尚未完全跟上表单。

联系邮箱：**admin@trendplay.com.sg**（可点 `mailto`）。

政策正文写明：回答会在活动结束后保存最多 12 个月。**当前实现：** 只有生成成功才写入 Mongo `generations`（YOU / RATE 快照 + 用餐补充说明 + 3 个标题、正文、5 个 hashtag、封面标题、封面副标题、token 费用）。不再写入 `submissions`。照片、封面 JPEG、策略不入库。刷新后浏览器表单仍清空。1–2 星不生成，因此不写 `generations`。

---

## 9. RATE（体验问卷 + 照片）

**没有分店选择题。** 用餐地点由当前部署决定：centralwOrld 是 `Baan Ying (centralwOrld, 3rd Floor)`，Siam Center 是 `Baan Ying (Siam Center, 2nd Floor)`。`resolveDiningBranch()` 不会接受另一家店。Location & Time 和话题标签都只用这一家。标题或封面如果写到商场，也只能用这一家，不能换成另一家的楼层或营业时间。

| # | 问题 | 必填 | 选项 |
| --- | --- | --- | --- |
| 1 | How much is the total expenses for this meal? | 必填 | THB 金额；生成成功后写入 `generations.mealExpenseThb` |
| 2 | What did you enjoy most? | 多选可选 | The food / flavors / presentation / variety / atmosphere / service / overall experience |
| 3 | What dish would you recommend the most? | 多选可选 | River Prawn Tom Yum / Crab Meat Curry / Stir-Fried Morning Glory / Pineapple Fried Rice / Mango Sticky Rice / Scrambled Egg Rice / Lemon Sea Bass / Garlic Shrimp / Sweet and Sour River Prawns / Green Curry Beef / Others（可填其他） |
| 4 | Why do you recommend it? | 多选可选 | 按所选菜品显示对应理由；可多选；另有 Other 自定义理由 |
| 5 | Tell us more about your dining experience | 必填 | 多行文本框；只用于生成，不写入 Mongo |
| 6 | Photos | 至少 1 张 | 1–5 张 JPG / JPEG / PNG / WEBP |

中文菜名（问卷显示 / 标题与正文全称）：河虾冬阴功汤、咖喱蟹肉、炒空心菜、菠萝炒饭、芒果糯米饭、滑蛋饭、青柠蒸鲈鱼、蒜炒虾仁、酸甜酱炒河虾、青咖喱牛肉、其他。封面叠字用短称：冬阴功、咖喱蟹肉、炒空心菜、菠萝炒饭、芒果糯米饭、滑蛋饭、青柠蒸鲈鱼、蒜炒虾仁、酸甜酱炒河虾、青咖喱牛肉。英文青柠蒸鲈鱼为 Steamed Sea Bass with Lime，泰文为 ปลากะพงนึ่งมะนาว。

点 Continue 进入 Generating。RATE 答案不单独入库，生成成功后才写入 `generations`。

补充说明标题下**不再**显示「中文按字计算…」这类说明。输入框下方仍显示 `{count} / 10`。至少 **10 个计数单位** 才能继续：

- 英文按**单词**计：`you` = 1，不是 3
- 中文按**字**计
- 泰文和英文一样按**空格分词**计（界面提示 `{count} / 10 คำ`）；连续泰文不算每个字
- 标点、空白不算
- 中英混写把字和词加在一起
- 计数函数：`countDiningExperienceUnits()`（`types/content.ts`）

字段名：`diningExperienceNote`。会传给生成，当作用餐体验素材，不要当成推荐理由的 Others。生成成功后会写入 `generations`，但正文和标题都不能原样贴这句。

选项内部值保持英文（给 AI 用）。中文 / 泰文 UI 只翻译显示文案。

`1st time`（Yes / 是 / ใช่）只表示第一次来 Baan Ying，不是第一次吃泰餐，也不是默认卖点。顾客已经写了菜、味道、老板或服务时，优先用那个点。只有用餐说明自己写了「第一次吃泰餐」一类的话，才可以出现「第一次吃泰餐」。`Not first time`（No / 不是 / ไม่ใช่）表示来过，不要写成第一次发现；除非用餐说明里写明常来，否则不要发明「每次来 / 又来了」。

这些答案要转化成**个人经历**，不要逐条复述。只写这次用餐真正支持的内容点。补充说明是信息来源，不是成品标题；先抽出吸引点再改写，规则见 12.4 和 12.5。顾客自己写的食物即使不在菜单里也要保留，例如「粉红奶很好喝」。

### 照片

- 1–5 张，至少 1 张才能生成
- JPG / JPEG / PNG / WEBP
- 本地预览，可删除
- 不上传 Cloudinary / MongoDB
- 发给 `/api/generate` 前，浏览器用 `lib/compress-photo.ts` 压缩（最长边 1024、JPEG 0.72），避免 Vercel 约 4.5MB body 限制
- AI 封面选择基于用户实际上传的全部照片，不是只看前 4 张
- 刷新后预览丢失

照片是证据，不是让模型编造细节。只有能看清、且顾客数据也支持的内容才能写进正文。

---

## 10. 语言规则

右上角：**EN | 中文 | ไทย**（`components/campaign/LanguageSwitch.tsx`）

| 项 | 规则 |
| --- | --- |
| 默认 UI | English |
| 可选 UI | `en` / `zh` / `th` |
| 切换 | 不刷新页面 |
| 存储 | `localStorage`：`xhs-ugc-ui-language` |
| 翻译 | `lib/i18n.ts`（`en` / `zh` / `th` 三套字典） |
| `<html lang>` | `en` / `zh-CN` / `th` |
| 英文产品名 | Rednote |
| 中文产品名 | 小红书 |
| 泰文产品名 | เสี่ยวหงชู |
| Origins 国名 | EN 用英文国名；中文用 `nameZh`；泰文用 `Intl.DisplayNames(["th"])` |
| 封面风格名 | EN `Style 1`–`Style 6`；中文 `风格 1`–`风格 6`；泰文 `สไตล์ 1`–`สไตล์ 6` |
| `/analytics` | 内部看板，英文，无语言切换 |

**UI 语言和 AI 内容语言完全分开。**

无论 UI 是 English、中文还是ไทย，生成的小红书帖子必须是 **简体中文**。

```ts
CONTENT_LANGUAGE = "zh-CN"
```

---

## 12. AI 生成

接口：`POST /api/generate`

同一品牌，不同消费者应像不同的人在写。不要固定成一种「Baan Ying 小红书官腔」。

**两家店用同一套规则。** Prompt、Human Style、标题、封面、正文整理、Emoji、地点、话题标签、JSON 解析都相同，只有商场名换成本店的。规则里要用到商场名的地方，都从 `lib/branches/mall-text.ts` 取：centralwOrld 是 `centralwOrld` / 尚泰世界购物中心，Siam Center 是 `Siam Center` / 暹罗中心。所以「商场只提一次」「逛街场景合并」「结尾句识别」这些整理，两家店的行为一样。

一个已知的小问题，两家店相同：判断「顾客是否写到商场」时区分大小写。顾客写 `centralwOrld`（大写 O）或 `Siam Center` 时不算写到；写 `centralworld`、`siam center`、尚泰世界、暹罗中心时算。要改就两家一起改。

`npx tsx scripts/validate-branch-parity.ts` 用同一份问卷和同一份模拟模型回复，分别以两家店的部署跑真实的 `/api/generate`。要求两边发给 ModelArk 的 prompt 除了本店资料外完全相同，返回的标题、正文、封面、话题标签、Location 结构相同；不能出现另一家的商场、楼层或营业时间，不能留下编造的菜，不能调用 OpenAI。它只模拟 ModelArk，不连数据库。

### 12.1 一次文本模型请求（ModelArk / OpenAI）

`resolveAiProvider()`（`lib/ai-provider.ts`）选 provider：没设 `AI_PROVIDER` 或设为 `modelark` 时走 ModelArk，设为 `openai` 时走 OpenAI。两条路径的 prompt 精简程度（见 12.2）、模型调用和重试不同（ModelArk 的重试见下文）；模型返回之后走同一套本地整理。

```text
用户点 Generate
        ↓
POST /api/generate
        ↓
ModelArk：createModelArkResponse 1 次
（structured JSON：titles[3] + captionParagraphs + hashtags[5] + mainTitle + subTitle + 选图字段）
OpenAI：openai.chat.completions.create 1 次
（structured JSON：titles[3] + caption + hashtags[5] + mainTitle + subTitle + 选图字段 + 内部策略 id）
        ↓
本地整理：顾客证据、标题不照搬原句、同一事实只留一次、尽量保留模型分好的段落（被句子级整理压平时按原段首句还原换行，没有段落或某段超过 3 句时才按来由 / 菜 / 收尾重组，见 12.5）、按本轮 Human Style 整理 emoji（标题全没有时补 1 个；正文只动表情）、本轮品牌名写法、封面叠字、从正文剥 hashtag
        ↓
地点：standalone 追加锁定模板；inline 把商场名和店名嵌进已有的那一句，不另起「来这家店吃了一顿饭」
        ↓
返回 { titles, caption, hashtags, coverTitle, coverSubtitle, selectedPhotoIndex, photoSelectionReason, locationFormat, cost }
        ↓
浏览器把选中的照片转成 data URL
        ↓
POST /api/compose-cover（不是 OpenAI）
        ↓
进入 Result，封面已经生成好
```

一次用户生成在常规路径上是 **正好 1 次**文本请求 + **1 次** Cover Composer。策略、hook、标题、正文、标签、封面标题、封面副标题、选图都在这一次 JSON 里完成。标题提炼、分段和 emoji 清理用本地逻辑，不再为这些各打一次模型。本地合规替换后仍命中禁用词时，才会多一次改写；这不是常规路径。1–2 星不进入这条链路。

ModelArk 的正文用 `captionParagraphs` 返回，每段一条字符串、段内不换行。服务端用空行拼成原来的 `caption`。OpenAI 仍返回一条 `caption`。两种 provider 之后走同一套本地整理。

**ModelArk 标题数量。** Schema 要求正好 3 个标题，每个至少 1 个字符。本地去掉空字符串和纯空白之后，仍必须剩下 3 个非空标题。重复标题在这一步不删。只有「正文还在，而且有效标题少于 3 个」才再请求一次，并明确要求补满 3 个非空标题。第二次仍不合格就失败返回，不补造标题，也不改走 OpenAI。正文为空、JSON 不合法、读超时不走这次标题重试。JSON 不合法仍有它自己的一次重试；如果那次恢复出来的标题仍不够，标题重试会再发一次，这时最多 3 次模型请求，不会有第 4 次。`json=ok` 只表示 JSON 解析过了。`final=ok` 要等 3 个非空标题和正文都通过之后才记。第二次仍失败时接口返回错误，生成页停在失败状态，不进入结果页，也不写入不完整文案。日志只记标题数量、空白数量和阶段，不记正文，也不记 API Key。

文本生成的成本目标大约 **USD $0.05 / 篇**，最好更低。prompt 里不重复同一条禁令，不发送 README，参考帖只发送写法特征。2026-10-06 用 gpt-4o、无照片测过短 / 中 / 长三条：都是 `Calls: 1`，费用大约 $0.026–$0.041，平均约 $0.032。第一次没有缓存会高一些；同一段系统 prompt 被缓存后输入更便宜。单价在 `lib/openai-pricing.ts`。

封面合成失败时点 Retry Cover：**不再调用文本模型**（ModelArk 和 OpenAI 都不调用），只再打 `/api/compose-cover`。

开发环境下 Generating 页的 `useEffect` 可能被 React Strict Mode 跑两遍。`generatePost()` 有进行中去重：第二次会复用同一条请求，不会打两次 `/api/generate`。点「重新生成」时锁已释放，可以再生成一次。

`lib/generate-hashtags/` 仍给备用接口 `POST /api/generate-content` 用。消费者主路径 **不会**走它。

展示时永远分开：

```text
Caption
  [正文段落，段与段之间空一行]
  [仅 standalone：Location & Time]

Hashtags
  品牌标签 + 4 个池子标签（5 个打乱顺序，品牌标签不一定排第一；大小写跟本轮店名和商场名）
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

ModelArk 路径发精简版 prompt（`lean`）：同一份 prompt 里别处已经写过的规则不再重复，例如本轮地点计划已经说明的地点写法；封面菜名短称表只发这一单选到、或用餐说明里写到的菜，不发整张表。精简只去掉重复，不删除约束本身。OpenAI 路径仍发完整版。负面反馈中性化规则每次都发，不按顾客这次有没有写负面内容开关。

冲突时按这个顺序：安全事实 → 顾客自己的经历和来意 → 内容策略（这篇还讲什么）→ 这一轮 Human Style（这个人怎么说）→ 用得上的品牌和分店信息 → 和上一篇不一样。品牌、商场、泰餐、楼层、KSP 和菜品名单不是因为系统知道，就自动变成题目。

用户提示里，用餐备注在品牌介绍前面。

| 层 | 内容 |
| --- | --- |
| 1. 安全事实 | 不编造体验、同伴、价格、功效、排名；负面原意保留但中性化 |
| 2. 顾客经历 | 用餐备注、为什么来、谁推荐、谁一起吃、喜欢的点、选了哪些菜、照片 |
| 3. 内容策略 | KSP / Storyline / Content Angle / Search Keyword。只决定还写哪些真实点，不能换成商场或菜系介绍 |
| 4. 写法风格 | 这一轮 Human Style。管语气、节奏、表情，不改事实。标题和正文是同一个人 |
| 5. 品牌和分店 | 故事需要时才用。地点模式由系统指定 |
| 6. 输出和检查 | JSON：3 个正文标题 + 1 篇正文 + 5 个 hashtags + mainTitle + subTitle + 选图；OpenAI 另返回 4 个内部策略 ID，ModelArk 不返回，用本地 suggested 组合。同一次请求里做 Anti-AI 检查 |

JSON 形状（**OpenAI 返回格式示例**，只列主要字段；ModelArk 的格式不同，见下方说明）：

```json
{
  "titles": ["标题1", "标题2", "标题3"],
  "caption": "故事正文。不要写 Location & Time，不要写 hashtag。",
  "hashtags": ["#曼谷美食", "#baanying曼谷", "#泰国菜", "#曼谷探店推荐", "#centralworld"],
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

这四个内部策略 ID 只有 OpenAI 会返回。ModelArk 的 schema 不接收这四个字段，正文也改用 `captionParagraphs` 按段返回（见 12.1）；它的策略 ID 用本地的 suggested 组合（见 12.3）。

### 12.3 内容策略层（内部）

策略选择不单独请求模型，和写文案在同一次文本请求里。消费者不选手动 KSP / Storyline / Angle / Keyword。两种 provider 的差别在策略 ID 由谁给出：OpenAI 在 JSON 里返回 `selectedKspId` / `selectedStorylineId` / `selectedContentAngleId` / `selectedSearchKeyword` 四个内部策略 ID；ModelArk 的 schema 不收这四个字段，策略 ID 由本地选择（见下文 suggested 组合）。

```text
顾客自己写的体验（最高）
  → 顾客选的菜 / 喜欢的点
  → KSP
  → Storyline（叙事意图，不是固定开头模板）
  → Content Angle
  → Search Keyword（只帮结构，不能改事实，也不能盖过顾客体验）
  → 标题 / 正文 / 封面 / 选图
  → 固定 1 个品牌标签 + 从批准池抽 4 个，再打乱 5 个顺序
```

顾客写了具体食物或饮品，即使不在官方菜单里也保留原名。粉红奶不能改成「饮品」。不能补顾客没写的味道、口感、食材或服务特点。顾客没写老板、服务或某道菜时，不要编出来。

**本地整理也按这个顺序取材。** 生成之后本地改标题、封面和正文时，依据的先后是：顾客自己写的用餐说明 → 顾客选的菜和推荐理由 → 问卷里勾选的一般性标签（`lib/evidence-priority.ts`，`evidenceFactsForCopy`）。标签和用餐说明冲突时不用这个标签，例如说明写「服务有点慢」，就不用「店员服务热情周到」。只选了一道菜、没写它怎么样，不算对这道菜的评价。

可复用结构：`lib/content-strategy/`。Baan Ying 的 10 个 KSP、10 条 Storyline、12 个 Content Angle、主/次搜索词和兼容矩阵在 `lib/brand/baan-ying-strategy.ts`。

Storyline **只定义叙事意图**，禁止写成「ST-01 必须用某某开头」。

本地会按顾客证据给一个 suggested 组合（浏览器端 `pickSuggestedStrategy`，`lib/content-strategy/select.ts`），两种 provider 的 prompt 都带上它，并允许模型在建议和顾客证据冲突时换一个组合来写。记录和返回的策略 ID：OpenAI 用模型返回的值，某项为空时才用 suggested；ModelArk 始终是本地 suggested 组合，模型实际按哪个组合写，接口里看不出来。重新生成会避开上一轮的 KSP / Storyline / Angle（还有别的合法选项时），并换标题关键词、开头、结构和随机话题标签。顾客事实不变，不为了变化而编造经历。

KSP-03 Family Recipes & Heritage 是低频策略，不默认写 1999 / Auntie Ying / Siam Square。

随机话题标签只能从批准池抽 4 个，不按 Storyline 写死。固定标签是品牌标签，大小写跟本轮餐厅名走：`#BaanYing曼谷` 或 `#baanying曼谷`。`#曼谷必吃` 和商场泰餐标签在池子里，有时会被抽到。

### 12.4 标题

每次正好 3 个简体中文标题，和正文在同一次请求里写。标题负责自然带出内容，正文负责展开体验。标题不总结全部卖点，也不是把正文第一句缩短。

**和正文是同一个人。** 本轮 Human Style 同时管标题：语气、开头、长短、情绪、标点、表情。不同顾客不套同一种标题。菜多只说明这篇在讲吃的，不代表这个人就是 Foodie。Foodie 只在顾客真的写了口感、甜度、质地时更容易被选到，而且只是 9 种人格里的一个。同一种人格可以连着几次，但开头、节奏和表情方式要变；大约每 3 次重新生成才换一种人格，不是 9 种轮流点名。centralwOrld 和 Siam Center 用同一套，店名、楼层、营业时间仍各用各的。

**顾客原句不是标题。** 用餐说明只是信息来源。先理解，再抽出一个真实的点。不要整句照搬，不要只改几个字，也不要只加一个 emoji。标题不能承诺正文没有的体验、功效或结果，也不能比顾客原文更夸张。

例如顾客写「这次我最喜欢芒果糯米饭，甜度刚刚好，吃完还想再点。」标题可以是「芒果糯米饭甜度刚刚好」，不能是原句，也不能是「最喜欢芒果糯米饭，甜度刚刚好」。封面 mainTitle / subTitle 同样先提炼。本地 `lib/title-insight.ts` 会在同一次生成之后改掉仍在照搬的标题，不再打一次模型。

本地只在这几种情况下换标题，其余合格的标题一个字不动：照搬顾客原句（包括和顾客某个 6 字以上的短句一字不差）；和已保留的标题同一个点，或只差表情、标点；只剩「终于 / 不得不说 / POV / Must-have」这类开头（开头本身会先被去掉，剩下的句子合格就保留）；冷模板（「曼谷泰餐X很满足」「曼谷泰餐的X值得点」「X是这顿记得住的」）。替换句只从顾客原文里的菜、特点、人和场景换个说法（如「咖喱蟹肉是真的下饭」「老婆说好吃的那家」「店员一直很热情」），不能和别的标题同一个点；找不到时保留原标题，冷模板最后才用「A和B都点了」这种只陈述点了什么的句子。三个标题都是「菜名 + 好吃 / 好喝」时，第 3 个换成不写菜的角度。

有顾客自己写的具体体验时：标题 1 从这件事提炼，不要改成商场或泰餐。标题 2 和标题 3 用这顿饭里还没写过的点。顾客自己的点不够时，才用一道菜或别的餐厅事实。不要为了凑标题而写商场。封面主标题跟这个人的理由走，副标题必须是另一件事实，不能把主标题换个说法。不要三句和封面都写同一道菜，也不要都写「第一次」。

每个标题只讲一个点。不要用逗号、`｜` 或冒号把两个卖点拼在一起。不要三个都是「菜名 + 好吃 / 滑嫩 / 刚刚好 / 必吃」。可以换成发现、当时的情境、还想再吃，或别人的推荐，但必须是顾客原文里有的。不要三个都以店名、「终于」「不得不说」或问句开头。不要默认写成广告句（POV、Must-have、终于找到、你需要这个）。这些话只有顾客原文真的是这个意思时才可以用。

曼谷搜索词是辅助，不是题目本身。可以自然放进已经完整的那一句。不要每句都塞同一个词，也不要用「必吃」当正文标题卖点。提示词不要求标题和封面必须出现商场名。顾客没写逛街时，不要写成「商场里吃泰餐」或「逛街顺便吃泰餐」。本地 `ensureGroundedHeadlineCopy` 只在标题、封面都没有商场名、顾客自己写了商场、而且某条标题本来就在说「逛 / 商场」时，把本店商场名嵌进那条标题；不会为了加商场名改写合格的标题，也不会写成另一家店。本地也不再为了凑曼谷搜索词改写标题：合格的标题里没有搜索词，就原样保留。

**格式必须有变化。** 至少一句是纯文字。每一批 3 个标题里至少 1 个带表情，通常是 1–2 个标题各带 1 个。放在句首或句尾，不粘在菜名后面，也不跟正文用同一种摆法，三个标题也不能共用同一种表情位置。表情的选择和语气跟这一轮 Human Style 走。不为了凑数在每个标题里堆表情。顾客写了「不要表情 / 不要 emoji / 无表情」时，这个要求优先，不为了凑满 1 个而加。本地会把菜名上的表情挪到句首或句尾；三个都没有、而且顾客没有禁止时，补 1 个和这句内容相配的（食物对食物，否则按感受：舒服 😌、好吃 😋、想再点 🤤、喜欢 🥰、没想到 👀、逛 🛍️、拍照 ✨、家人朋友 ☺️）。三个都带时去掉一个，保证至少一个纯文字。同一个表情不在两条标题里重复。配错的食物表情会换成对的，对不上就去掉。最后一次表情整理在所有标题改写之后，之后的封面去重只改封面，不再动标题。🇹🇭 大约每 5 个标题出现一次，只能放在句首，一批三个标题里最多一个。禁止「🇹🇭 + 关键词 + 冒号或 ｜」。

重新生成时，同一风格里 3 个标题各自偏向的开头会轮换。不合格时**不再第二次调用 OpenAI**，只做本地整理。同一次请求里会检查标题是否像广告、是否没有具体信息、是否和 Human Style 不一致。不要为了躲这些检查，把三个标题都改成同样短、同样冷的一句。

### 12.4.1 Human Style

风格库在 `lib/human-style/`。运行时只放写作习惯，不把原始帖子塞进 prompt。也不另做一套标题风格库。

选择分两步。先看这篇**有什么**（菜、环境、旅行、本地、情绪、是不是很短）。再看这个人**怎么说**。菜名只算内容，不加 Foodie 分。只有原文里出现口感、甜度、质地，Foodie 才会略高，而且仍然只是 9 种里的一个。内容角度可以轻轻偏向 Casual、Story、Travel，不会把「这篇在讲吃的」变成 Foodie。

同一种人格可以连着几次。大约每 3 次重新生成才换一种，不是 9 种轮流点名。换不换人格，这一轮的开头、节奏、详略和情绪都会变。表情跟这个人的习惯走，不再按 none / light / natural / playful 规定个数。上一轮人格记在这次请求已有的 generation memory 里，并参与下一轮是否留在同一种人格。

9 种：Foodie、Chatty、Casual、Story、Short、Playful、Travel、Local、Emotional。每种同时有正文习惯和标题习惯（语气、节奏、开头、情绪、具体程度、标点、表情、收尾、要避开的套路）。开头是倾向，不是填空模板。

优先级从高到低：安全事实、顾客自己的经历、内容策略、Human Style、品牌和分店信息、这一轮怎么说得不一样。风格只管怎么说，不管这篇讲什么，也不能添上顾客没有的经历。润色不能把风格磨回同一种官腔，也不能把顾客的来由磨成商场介绍。不要为了像真人而加错字或语法错误。

### 12.5 正文

写成连贯的个人经历，不要问卷清单。

**篇幅：** 至少 3 句，不要每次都刚好 3 句。普通输入大约 3–6 句；信息多时最多大约 8 句。只写最有用的 2–4 个点，不要为了写全问卷而加长，也不要编造句子来凑数。本地长度带的上限是 240 个汉字左右。

正文偏短时，本地会从顾客证据里补一两句。正文里已经出现某件事的关键词时，不再追加同一件事。顾客原话里带商场名或店名的那一句，模型常换说法，所以另有一道检查：例如顾客写「就在{商场}上班」，正文已经写了「上班就在附近」，就不再在文末追加「就在{商场}上班」。这道检查是保守的，去掉商场名和店名后剩下的词要在正文同一个逗号分句里全部出现才算已经写过，剩下不到 3 个字的不算。

**来由要留着。** 顾客写了为什么来，就从那里起笔，而且这是整篇的骨架，不是中间带过的一句。朋友推荐和「终于约上 / 总算约上」写在同一处，放在菜的前面，不先写菜再回头说来由，也不把这两句拆开各说一遍。笔记里没有来由时，不编「朋友推荐过来的」或「逛完商场刚好来吃」。例如「跟着同事的推荐过来的太好吃啦」，保留「同事推荐 → 来试试 → 发现好吃」。「老婆上次来就说很好吃，这次带着一家人来了」是老婆来过、觉得好吃、这次带家人回来，不是「在商场吃正宗泰餐」或「逛完商场来吃」。不要把原句解释成「这次是因为……所以……」。同事推荐不是「和同事一起来」，除非原文就是这么写的。顾客没写逛街、商场或店名时，不要为了完整而在开头介绍餐厅，也不要把「来了这家店」粘到一道菜后面。顾客没写逛街时，本地会去掉凭空出现的「逛完」。模型把来由丢掉时，本地用顾客原文补回，不另写一句套话。

**不要把问卷拼成一篇。** 只留这一轮最有用的 2–4 个点。多道菜是一次用餐，不是菜单。一道菜的味道说完，再写下一道。不要粘成「芒果糯米饭……加上青柠蒸鲈鱼……滑蛋饭……」。也不要每道菜各写一句相同的「X 是我这次还会想再点的一道 / X 很好吃 / X 吃起来」。本地发现相邻句子是同一句式时，会收成一句，不删掉菜名。

**段落：** 先从来由写，再按顾客写到菜的顺序写菜，不按信息量把一道菜提前，最后才是服务或有依据的收尾。段数随内容变，不固定四段。一段最多 3 句，通常 2 或 3 句。模型已经分成段落、而且每段不超过 3 句时，本地保持原来的段落和句序，只在段内去掉没有依据的空话和重复味道，不再整篇重排成同一种「到店、菜、收尾」。没有段落、或某段超过 3 句时，才按这个顺序重组（`arrangeDiningStory`，由 `enforceCustomerEvidence` 调用）。4 句拆成 2+2，5 句拆成 3+2，不会为了凑规则拆成一句一段。一段只有 1 句只用于真正需要强调的时候。段和段之间是空行（caption 字符串里的 `\n\n`）。地点清理不再把空行收成空格。inline 会把地点句和紧跟着的「总算约上」并进同一段，合起来仍不超过 3 句。standalone 去掉商场名和店名，但留下「朋友之前提过」这类来由。返回给前端之前这段结构还在。

**段落还原：** `ensureGenerationVariation` 和 `ensureContentLock` 按句处理，可能把模型写的段落压平。两处处理完都用 `keepParagraphBreaks`（`lib/caption-story.ts`）对照处理前的正文还原换行：原来每段的首句（去掉表情和标点后至少 4 个字）在原文里只出现一次、在处理后的正文里正好找到一处、而且和其他段的先后顺序一致，才在那句前面补回空行。它只插入空行，不新增、删除、改写或移动句子；某段首句对不上时，这段不还原，保持处理后的样子。`ensureGenerationVariation` 判定要重写整篇正文时，用重写后的结构，不做还原。

`/api/generate` 里的顺序（`app/api/generate/route.ts`）：合规检查 → `ensureGenerationVariation` → `ensureContentLock` → `enforceCustomerEvidence`。合规检查触发第二次模型请求时，改写后的正文直接替换原正文，不对照改写前的正文还原段落；后面两道还原以改写后的正文为准。ModelArk 的改写要求按段返回 `captionParagraphs`，服务端用空行拼接；OpenAI 的改写只返回一条 `caption`，没有分段要求。待核实：改写模型实际是否保留原来的段落，取决于模型输出，代码不能保证，也还没有用真实请求验证。

备用接口 `/api/generate-content` 只走 OpenAI，不经过 `ensureGenerationVariation`、`ensureContentLock`、`enforceCustomerEvidence`，也不调用 `keepParagraphBreaks`。它的段落取决于模型输出，以及之后的合规替换、表情和地点整理。

同一道菜已经说过的味道不再在下一句重复，例如虾的「新鲜」只留一次。笔记把「开胃」给了鲈鱼，就不会再安到汤上；模型把这句味道丢掉时，用笔记里的原词补回。笔记没写的空收尾会拿掉，例如「这顿味道很正宗」「吃着很满足」「印象最深」「吃起来就是很熟悉的泰式风味」。笔记里真的写了，就留着。不编排队、价格、环境或额外的服务细节。

同一类信息放在一起。逛商场和来店只写一次，而且只有顾客自己写了逛街才这么写。家庭式氛围和坐着舒服写在同一处，不插进两道菜中间。一道菜和它的味道必须是完整句子，不能和后面的服务或环境黏在一起。先写到的菜保持原顺序；写得具体的留下细节，其他菜带过。饮品如果顾客已经写了好喝，就保留这句，不要改成固定的「再配上一杯，这顿饭也就更完整了」，也不能补顾客没写的甜、解辣或清爽。结尾不必每次都是「下次还会再来 / 赶紧码住 / 直接冲」。正文已经用商场名写了场景时，不要再写「这家店就在几楼」；楼层留给文末 Location。本地整理在 `lib/caption-story.ts`。

**口吻：** 真实消费者刚吃完顺手发帖。第一人称、有依据的个人判断；喜欢、一般、不喜欢保持原来的程度。「老板很帅」可以写成「老板真的很帅」，不要写成「令人印象深刻」。「很喜欢」可以写成「很喜欢这家餐厅」，不能写成「最好吃 / 全曼谷最喜欢 / 强烈推荐」。小孩子很喜欢某道菜，写的是这个人的反应，不要改成「适合儿童」。规则在 `lib/caption-voice.ts`。

**用餐补充说明：** `diningExperienceNote` 是素材，不是要逐字解释的句子。留下意思，按这一轮的说法说出来。不要整句照搬，也不要写成「这次是因为……所以……」。

- 不要整段原样粘贴，也不要只加标点。无标点、多个意思连写时，先做语义拆分；没有标点不代表要保留原句格式。
- 食物、服务、环境或人物拆到不同句子，不要写成「食物很好吃、店员服务很好、老板娘很漂亮、下次还想来」这种问卷罗列。
- 可以补主语和连接词、调整语序、合并重复意思。不得改变原意，不得把「一般」写成「很好」，不得编造顾客没写的味道、环境或服务细节。
- 「很喜欢」可以写成「很喜欢这家餐厅」，不能写成「最好吃 / 全曼谷最喜欢 / 强烈推荐」。
- 例：`很好吃很喜欢想再回来吃店员服务很好老板娘长得很漂亮` → `很喜欢这家餐厅，味道很合口味，已经开始想下次再来了。店员服务也很好，老板娘也很漂亮，整个用餐过程都很舒服。`
- 刺耳差评仍走下面的负面中性化，不能借改写变成夸奖。生成后不再把顾客原句硬塞回正文。

菜是内容池，不是必须全写：

| 顾客选了 | 正文通常写 |
| --- | --- |
| 1 道 | 这道 |
| 2–5 道 | 挑适合这篇故事的 1–3 道，不为了覆盖菜单全写 |

只写这次用餐真正支持的内容点。食物描述必须来自顾客选择、已批准品牌信息，或照片里能看清的内容。标题和正文用菜的全称；封面叠字用短称。

不编造：配料、口味、价格、奖项、米其林、明星、营业时间、促销、排名、「曼谷第一」。

生成链路会先按小红书合规规则写标题 / 正文 / 标签 / 封面 / 内容角度；返回前再扫描绝对化、医疗功效、迷信、引流、跨平台、硬广等表述。命中则先本地改写。仍命中时才再打一次模型改写。「绝绝子 / 封神 / 天花板」可以作为顾客已经很夸时的口语反应，不是配额，也不用在「环境很舒服」这种温和句子上。仍然禁止「这家店直接封神 / 天花板级别 / 全曼谷天花板 / 最好吃」。

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

本地整理时，用餐说明里的负面短句（如「有点咸」「服务有点慢」）不拿来当标题、封面或正文的卖点，也不因为某个勾选标签是好评，就把顾客说过的负面意思写成好评。这是本地检查覆盖的范围，不保证模型输出完全没有偏差。

品牌固定标签是 `#BaanYing曼谷` 或 `#baanying曼谷`；正文和标题里不再把「必吃」当卖点。封面可以在顾客这句话里带上池子里的「必吃」，不是每篇都要有。`#曼谷必吃` 只作为话题池选项，不是固定标签。用户只看到终稿，看不到内部合规分析。

写法应口语、自然、略带情绪。除非顾客自己写出了这个意思，否则不要写：正宗泰餐、味道很正宗、正宗的泰式风味、很有泰国味、很有记忆点、为用餐体验加分、增添了不少温暖、让人吃得安心、一次愉快的用餐体验、整体来说非常满意、非常值得推荐、强烈推荐大家、值得一提的是、总体来说、不得不说。把「非常正宗」改成「很正宗」或「比较正宗」仍算同一类。也不要写「作为一家…」「如果你正在寻找…」「这次来到…」「给我的感觉是…」「是一家非常…」「对于喜欢……的人来说…」。开头不要默认「这次在商场…」「逛完商场…」「来到 Baan Ying…」「这家泰餐真的…」。结尾不必是「下次还会再来 / 赶紧码住 / 大家一定要去 / 直接冲 / 值得推荐」。

结构不要固定成同一模板。重新生成时应换开头和叙事顺序。上一篇已经用了「第一次来」，而这顿还有别的合法卖点时，换掉「第一次」。

### 12.6 Emoji

表情跟这一轮选中的 Human Style 走，不是先选数量档位再往文案里填。没有 none / light / natural / playful 这四档，也没有硬性上限。这不是鼓励堆叠。

| 人格 | 表情的自然写法 |
| --- | --- |
| Foodie | 跟口感、甜度、质地走，不堆成每道菜一个 |
| Chatty | 在碎碎念、语气词和感叹里，分布不规律 |
| Casual | 偏少，一般一两个，跟感受或句尾；顾客写得平淡也不默认整篇不放 |
| Story | 在情绪节点或叙事转折，不打断故事 |
| Short | 短句里只在点睛的位置 |
| Playful | 可以偶尔叠一两个，跟轻松语气走 |
| Travel | 跟有依据的地点或场景 |
| Local | 偏少，一两个放在自然的位置，第二个只在合适时才放；不当导览贴纸，也不默认整篇不放或只放一个 |
| Emotional | 跟顾客真实情绪的浓淡走 |

这些是习惯，不是固定模板。不能每次 Foodie 都贴在菜名后，也不能每次 Casual 都放句尾。

Local 和 Short 可以很少，但不能因为写得短、简单或安静，就默认整篇都不放。正文里已经有自然的表情时，不再补一遍。没有对得上的句子时不硬塞。顾客写了「不要表情 / 不要 emoji / 无表情」时不新增，模型已经写的也全部去掉（标题、正文都一样）。不要每句一个，也不要每道菜一个，也不要把表情粘在每个菜名后面。

**常见分布，不是配额。** 只数故事正文，不数 📍 / ⏰ 和话题标签。1–2 句通常 1 个；3–6 句通常 2–4 个，落在不同的句子上。Local / Short 在 3 句以内 1 个就够。Prompt 里不再写「全篇最多一个」。模型写少了，本地 `ensureCaptionEmojis` 只补到这个下限：找还没用过、和那一句内容对得上的表情（食物优先，其次是感受），放在那句句尾（替换句号）或偶尔放在段首；同一个表情不重复，不放在两个相邻的句子上。对不上的句子不补，所以可能仍然少于下限。已经够了的不加也不删。只讲服务的句子不补通用的 😊。

`ensureCaptionEmojis` 只改表情：句子、顺序、段落、Location & Time 都原样。它会修正配错的食物表情（没写这道菜的句子就去掉），把夹在两个汉字中间的表情挪开（后面还有话就补一个空格，粘在菜名后就挪到句首），并去掉表情后面的中文句号。

食物对应：芒果 🥭、柠檬 🍋、鲈鱼 🐟、蟹 🦀、虾 / 河虾冬阴功汤 / 酸甜酱炒河虾 🍤、炒饭 / 糯米饭 🍚、咖喱 🍛、面 / 河粉 / 米粉 🍜、辣 🌶️、奶茶 / 泰奶 / 粉红奶 / 奶绿 🧋。河虾冬阴功汤用 🍤，不用 🍜。「这顿饭」「午饭」里的「饭」不算米饭。感觉对应：好吃或好喝 😋（写食物的「不错」也算）、香 / 想再点 🤤、喜欢 / 满意 🥰、没想到 👀、帅 😍、舒服 😌、拍照 ✨。逛街 🛍️。🍋 只给柠檬，🥭 只给芒果。🐟 只贴在写鱼的那一句，不能因为前面提过鱼，就贴到后面的「安心」上。

位置要换：句首、句尾、跟在感受后面，或自然出现在句中。夹在两个汉字中间、或直接粘在菜名后的表情，会挪到同一句的句首或句尾，不会挪到另一句。Playful / Emotional 可以偶尔叠一次，其他风格不叠。

`青柠蒸鲈鱼吃起来很开胃🥭` 不行，鱼不能用芒果的表情。emoji 后面不能直接跟中文句号或感叹号。`好好吃😋` 可以；`好好吃😋。` 不行。

**标题另算。** 标题默认使用表情，但按本轮 Human Style 放。每批 3 个标题至少 1 个带表情，通常 1–2 个标题各带 1 个。放句首或句尾，不粘菜名后，不复制正文的摆法，也不三个标题用同一种位置。不因为正文很少表情，就让三个标题都没有。顾客明确不要表情时，这个要求优先于标题的最低数量。事实依据不变。

- Location & Time 里的 📍 / ⏰ **不算**故事 emoji
- 封面叠字不加 emoji

### 12.7 重新生成

点击重新生成时，不能只是改写上一篇。应改掉其中多项：

- KSP / Storyline / Content Angle（在还有别的合法选项时）
- 标题角度 / 标题关键词 / 开头（同一 Human Style 里轮换三个标题的开头倾向）
- 叙事结构
- 主推菜强调方式
- 句子节奏 / 情绪 / 篇幅（仍至少 3 句；信息少就停在短的一边，不要编一句来变长）
- Human Style 的强度和变化。证据很明确时主风格可以不变
- emoji 用法
- Location & Time 版式
- 4 个池子 hashtags（品牌标签仍必须出现，位置和大小写跟本轮走）

顾客事实必须保持一致。不要为了「看起来不一样」而发明新经历。

---

## 12.8 自动封面（Cover Composer）

封面不是单独的 OpenAI 功能，也不走 Canva / MCP / AI 生图。

Generating 页文案：先 `Generating your post...`，再 `Creating your cover...`，完成后进入 Result。用户不必再点 Generate Cover，也不必另选 Cover Title。

封面叠字来自独立的 JSON `mainTitle` + `subTitle`（解析后存在 `coverTitle` / `coverSubtitle`），**不是**正文 3 个标题的缩写。禁止先写长句再截断、禁止用填充字凑字数。

| 字段 | 字数（汉字等价单位） |
| --- | --- |
| mainTitle / coverTitle | **4–10**，10 是上限，不是目标 |
| subTitle | **6–15**。禁止空、禁止为了写满 15 而硬凑、禁止套模板 |

计数：汉字 = 1；`centralwOrld` = 1；`Terminal 21` / `Siam Center` / `One Bangkok` = 2；`Baan Ying` = 2；其余拉丁/数字 = 0.5 再向上取整。

**主标题先写这个人的理由或反应。** 池子词 `曼谷` / 本轮商场英文名 / `泰餐` / `美食` / `必吃` 最多 2 个，只嵌进这句，不是默认题目。一句已经说完的口语标题可以不带这些词。不要默认写成「商场里吃泰餐」「曼谷吃饭很舒服」「曼谷必吃泰餐」。副标题必须换一件事实。主标题「商场里吃泰餐」、副标题「商场里吃泰餐很方便」不合格，因为是同一件事。堆成「曼谷centralwOrld泰餐美食必吃推荐」，或短到只有 3 个单位的「centralwOrld必吃」，也不合格。

**副标题只表达一个评价。** 顾客原文经常没有标点。`lib/cover/subtitle-units.ts` 先把「食物很好吃粉红奶很好喝」拆成「食物很好吃」和「粉红奶很好喝」，再只留其中一句。字数合格不能当成两句评价可以粘在一起。不靠官方菜名表判断边界：粉红奶即使不在菜单里，也是一个独立评价。拆分只用于选副标题，不改数据库里的用餐说明原文。

不合格：食物很好吃粉红奶很好喝、冬阴功很好喝芒果糯米饭也很好吃、环境很舒服服务也很好、物很好吃粉红奶很好喝。  
合格：粉红奶很好喝、食物很好吃、逛完街来吃刚刚好、老板很帅的曼谷泰餐。菜单里的菜用批准短称。顾客自己写的、表里没有的食物保留全名。禁止永远用「招牌泰式料理」。只有「第一次来」这一条证据、别的什么都没写时，副标题才可以用「第一次来尝试Baan Ying」。

进入封面渲染之前会再验一次：一个评价核心、没有被截断、长度合格。放不进模板时缩小字号；仍然放不下就拒绝合成，不把第一个字或句尾裁掉。centralwOrld 和 Siam Center 用同一套副标题规则。

`必吃` **只允许作为封面池子关键词**（如 曼谷必吃 / 必吃泰式料理）。话题池里的 `#曼谷必吃` 有时会被抽到。封面禁止排名/绝对化：最 / 第一 / Top 1 / No.1 / 冠军 / 无敌 / 全曼谷 等。`最爱` 一律改成 `超爱`。不是排名的例外：第一次 / 第一道 / 最近 / 最后 / 最终。「绝绝子 / 封神 / 天花板」不是排名，只在顾客已经很夸时偶尔出现。不要编造「泰国人爱吃 / 明星爱吃」。清洗在 `lib/cover/cover-absolute.ts`，只作用于封面叠字；正文仍可写「最喜欢」。

主标题如果只剩商场或菜系词，在**同一次** JSON 里改回顾客的那件事，不再多打 OpenAI。校验失败才用证据向的短标题兜底，不截原句。`layoutCoverOverlay` 的叠字架构不变。

**封面只用正文有依据的点。** 返回前，`alignCoverWithCaption`（`lib/cover/cover-caption-fit.ts`）拿最终正文检查 mainTitle 和 subTitle：写到的菜必须在正文里出现过，而且不是顾客抱怨过的菜；用「好吃 / 下饭 / 必点」这类词夸一道菜时，这道菜必须在用餐说明或推荐理由里被评价过（推荐理由没点名具体菜时，选过的菜也算）。不合格的那一行，先换成正文里已经写到的点，找不到才用现有的安全兜底。只改封面，不为了配合封面改正文。

这条规则分两层，覆盖范围不同：

- **Prompt 约束**（`formatCoverTitleStaticRules`，`lib/cover/cover-rules.ts`，两种 provider 都发）：主标题留的悬念必须在正文里兑现；副标题写另一件有依据的事实，没有第二个点时不编；不编菜；搜索词只是可选。模型是否照做，代码不能保证。
- **本地代码检查**：`alignCoverWithCaption` 只对照最终正文检查菜名和对菜的夸奖。服务、环境、同伴、体验等其他点，不和最终正文对照。另外，封面排版 `layoutCoverOverlay`（`lib/cover/cover-title.ts`）通过 `inventsUnsupportedCoverClaim` 拦下少数固定说法，例如「服务真的很好」「帅老板」「像家里」「两个人」：顾客证据里没有对应的词时，这一行不用。这里的顾客证据包括用餐说明、选的菜、勾选标签、推荐理由和当时的标题、正文。它只覆盖这几类说法，而且对照的是顾客证据，不是最终正文。

### 封面标题换行（Style 1–6 共用）

优先级：

1. 可读性
2. **一行放得下就一行**（按设计字号）
3. 一行会太小 → 两行
4. 语义拆分：先主语 / 地点 / 对象，再谓语 / 情绪
5. 再套各风格的对齐

短而完整的标题不要强行拆成两行，也不丢字。

### 显示名与内部 ID

UI 显示 **Style 1 … Style 6**（中文「风格 1–6」，泰文「สไตล์ 1–6」）。POST 页可点选；换风格只重打 `/api/compose-cover`，**不再调用 OpenAI**，也不重新分析照片或重写文案。

| UI | templateId |
| --- | --- |
| Style 1 | `top-stroke` |
| Style 2 | `dual-line` |
| Style 3 | `top-banner` |
| Style 4 | `polaroid` |
| Style 5 | `center-lower` |
| Style 6 | `photo-only` |

自动选风格分两步（`autoMatchTemplate`）：先看模型给出的构图适合池 `suitableTemplateIds`；池空则用 Style 6。再在池内避开上一张和近期 9 张，随机挑一个。手动点选不走这套。

Style 6 **仍生成** mainTitle / subTitle，但**不画在图上**。

`top-stroke` / `dual-line`（Style 1 / 2）在 **4 张及以上照片** 时做 2×2 拼贴；标题 / 副标题 / 背景装饰叠在四宫格几何中心。1–3 张以及 Style 3–6 都是单图封面。输出 1080×1350。Vercel 上中文字体从 `public/fonts` 读取（`lib/cover/asset-path.ts` + `outputFileTracingIncludes`）。

### 封面后的正文照片顺序

合成封面 JPG **永远不进**正文幻灯。剩余原图规则：

- **四宫格（Style 1 / 2 且 ≥4 张）：** 保留**全部**原图（含宫格里用过的），再重排顺序
- **非四宫格：** 排除封面那张原图，正文不再出现同一张
- SHARE 发给小红书时：合成封面仍是 files 的第一张，后面才是上述原图

### Style 3（`top-banner`）

红色长方形横幅从左到右水平铺满；**标题和国旗保持水平正字**。

泰国国旗加在**整句封面标题前面**，并走同一套一行 / 两行规则：

- 一行放得下（算上国旗宽度）→ 国旗 + 整句
- 需要两行 → 国旗只留在第一行开头，第二行是后半句

国旗是绘制的旗帜图（`public/cover/thai-flag.png`），不是字体 emoji，避免合成时缺字。

### 其他版式要点

- Style 3 / 4：标题按该模板安全框对齐
- Style 2：白 blob + 橙胶囊，不要把标题拆成两个白 blob
- Style 4：标题在拍立得白边里，统一字号
- Style 6：不叠字

Cover Composer 失败时：「Cover generation failed」+ Retry Cover（只重打 `/api/compose-cover`，不再调用 OpenAI）。

封面状态：`coverTitle`、`coverSubtitle`、`selectedPhotoIndex`、`selectedCoverTemplateId`、`generatedCoverImageUrl`。刷新仍会清空浏览器里的 blob 封面。封面 JPEG **不写入** Mongo。

### 12.9 生成结果入库（`generations`）

每一次 **成功的** `/api/generate` 写入当前部署自己的 Mongo `generations` **一条新文档**（重新生成也是新文档，不覆盖旧的）。centralwOrld 的库名是 `baan-ying-centralworld`。Mongo 失败只打日志，不挡住出帖。

| 字段 | 内容 |
| --- | --- |
| `generationId` | UUID |
| `createdAt` | 生成成功时间 |
| `customer` | YOU 快照：年龄 / 性别 / 国家 |
| `customerType` | Tourist / Local |
| `visitFrequency` | `1st time` / `Not first time` |
| `mealExpenseThb` | RATE 餐费 THB |
| `titles` | 终稿 3 个标题 |
| `caption` | 终稿正文（含 Location & Time） |
| `hashtags` | 终稿 5 个标签 |
| `coverTitle` / `coverSubtitle` | 封面主标题、副标题 |
| `aiUsage` | model / inputTokens / outputTokens / totalTokens / cost |

另存 `campaignId`、`submissionId`、`diningExperienceNote`。不存照片、封面 JPEG、KSP。1–2 星没有生成记录。

### 12.10 转化分析（`analytics_events`）

漏斗埋点写进**当前部署自己的** Mongo（`MONGODB_URI` / `MONGODB_DB_NAME`），不加 OpenAI 请求。分析失败只打日志，不挡住扫码、生成、发帖。centralwOrld 的事件在数据库 `baan-ying-centralworld`，Siam Center 的事件在数据库 `baan-ying-siam-center`。

| 事件 | 何时写入 | 去重 |
| --- | --- | --- |
| `qr_scan` | 服务端渲染星级页时 | 每次进入一条；`?draw=1`、带 `?stars=N` 的返回不再记。跳过 Link prefetch。`/qr/:qrCodeId` 只跳到星级页，不单独记 |
| `rating_submitted` | 1–2 星：反馈页点「提交评价」时。3–5 星：第一步点「继续评价」时，等写入请求结束再跳体验页 | 每一轮评分一条：`eventId` 为 `rating_submitted:{本轮评价 ID}`，同一轮重试会被唯一索引丢掉；本轮已提交过就不再发送。`rating` 为 1–5，`band` 为 `rating_low`（1–2）或 `rating_positive`（3–5）。1–2 星带 `feedback`（最多 1000 字），3–5 星不带。后端拒绝不是 1–5 整数的星级（400） |
| `form_submit` | 现有 `POST /api/generate` 真正发出时 | 每 session 一次 |
| `generation_complete` | 现有 `/api/generate` 成功返回前 | 每 session 一次 |
| `publish_click` | 小红书系统分享成功，或确认打开 `xhsdiscover://post` | 每 session + platform 一次。系统分享：`platform=unknown`，`method=web_share`。Deep Link：`platform=xiaohongshu`，`method=deep_link`。取消不记 |
| `publish_platform_selected` | SHARE 选择小红书或大众点评 | 每 session + platform 一次。大众点评只记选择，不记「已发布」 |
| `xhs_publish_click` | 旧版 SHARE 点 Publish to Rednote | 历史数据保留读取。新的系统分享成功**不**再记此事件。看板 XHS 数 = 旧事件 + `publish_click` 且 platform 为 rednote/xiaohongshu |

进入星级页记一次 `qr_scan`，来源是 `rating-page`。`/qr/:qrCodeId` 只跳到星级页（`?new=1`），避免扫码被记两次。首页 `/` 和 `/c/baan-ying` 会先到星级页再记。`?draw=1` 是 1–2 星的感谢页，刷新时不重复记扫码。新一轮评分会换一个新的评价 ID，所以同一个标签页再扫码或点「重新评分」可以正常再记一条 `rating_submitted`，不会被上一轮挡住。访客 cookie：`ugc_sid`（httpOnly session）、`ugc_qr`（来源码）。不存 IP、姓名、电话、邮箱。1–2 星只记 `rating_submitted`，不记 `form_submit` / `generation_complete`。

看板：`GET /api/analytics?range=today|yesterday|last_7_days|last_30_days|this_month|all`，可加 `startDate` / `endDate` / `qrCodeId` / `branch`。`branch` 只能是 `baan-ying-centralworld` 或 `baan-ying-siam-center`，对应上面两个数据库，不是在一个库里按字段过滤。页面 [https://seedai-baanying.vercel.app/analytics](https://seedai-baanying.vercel.app/analytics) 有 centralwOrld / Siam Center 两个按钮。日期按 Asia/Bangkok。

---

## 13. 地点与营业时间（固定事实 + 两种位置 + 6 种锁定模板）

地点有两种位置，由系统每轮选定，下一轮换另一种：

- **standalone：** 正文只写这顿饭。系统把 Version 1–6 其中一种追加在正文最后。这块后面不能再有 CTA、推荐语或 hashtag。模型不要自己写 📍 / ⏰。
- **inline：** 不追加文末地点块。商场名和 Baan Ying 只出现一次，嵌进顾客已经写下的那句来由。不另起「这次在商场的 Baan Ying 吃了一顿饭」，也不把没写过的逛街补成开场。后面不能再用「这家店就在商场里」「位置很好找」这类说法重复这个地点，也不写楼层、营业时间、📍、⏰。顾客没写地点时，本地会把店名和商场名接到已有的第一句后面，而不是在前面插入一段餐厅介绍。

**官方事实固定。** 不能改中文商场名、楼层或营业时间，也不能发明第 7 种模板。英文商场名和餐厅名的大小写按本轮随机结果写，见下面的名称写法。没有顾客自己写的路过、看招牌、朋友推荐，就不要编这些进店理由。

系统从 `lib/locations.ts` 取官方地点和营业时间。standalone 再套上 Version 1–6 其中一种。

### 13.1 官方数据

消费者**不选分店**。当前部署用自己的官方地点和营业时间。Terminal 21 和 One Bangkok 只留在数据里，没有单独部署，生成不会选用。

| 分店 | 官方地点行 | 营业时间 |
| --- | --- | --- |
| centralwOrld | 尚泰世界购物中心（centralwOrld）3楼 | 10:00–22:00 |
| Siam Center | 暹罗中心（Siam Center）2楼 | 10:30–21:00 |
| Terminal 21 | Terminal 21 5楼 | 10:00–22:00 |
| One Bangkok | One Bangkok 3楼 | 周一至周六 10:30–21:30｜周日 10:30–21:00 |
| Baan Ying（无商场） | 不发明商场或楼层；地点写 `Baan Ying` | 不发明营业时间 |

名称写法按当前分店抽，餐厅名和商场名各自独立：

| 名称 | centralwOrld | Siam Center |
| --- | --- | --- |
| 商场英文 | `Centralworld` 或 `centralworld` | 只写 `Siam Center` |
| 餐厅英文 | `Baan Ying` 或 `baan ying` | `Baan Ying` 或 `baan ying` |
| 大众点评店铺 | `k9fdoJpGAdqK1XGc` | `Ga6sQ4S2uv7WJC6i` |

同一次生成里，标题、正文、封面、Location 和话题标签用同一套写法。话题标签不能有空格。餐厅标签是 `#BaanYing曼谷` 或 `#baanying曼谷`。商场标签跟分店走：centralwOrld 用 `#centralworld` 这一组，Siam Center 用 `#SiamCenter` 这一组，两边不混用。禁止 `centralwOrld`、`Central World`、`CentralWorld`、`Baan ying`、`baan Ying`、`BAAN YING`。本地 `lib/brand-spelling.ts` 在返回前统一替换。

数据层用当前部署的 survey 值识别分店：`Baan Ying (centralwOrld, 3rd Floor)` 或 `Baan Ying (Siam Center, 2nd Floor)`。上表和下面的模板写出的是锁定结构和官方中文名；centralwOrld 帖子里的英文大小写换成这一轮抽中的写法。Siam Center 的商场英文不另造大小写。

其他 HARD RULE：

- `Terminal 21`、`One Bangkok` 必须保持英文
- 中文商场名只允许 **尚泰世界购物中心**、**暹罗中心**
- One Bangkok 营业时间必须完整保留：`周一至周六 10:30–21:30｜周日 10:30–21:00`

禁止：`终端21` / `One Bangkok 曼谷` / 自造中文商场名 / 自加楼层。

### 13.2 六种锁定模板

内部代号 A–F 对应 Version 1–6。只在 standalone 时追加到正文最后。句子结构不得改写，也不能自造第 7 种。Version 3 和 4 即使有营业时间也不写时间。Version 1 和 Version 6 使用单换行，行与行之间没有空行。

centralwOrld 的商场英文这一轮是 `Centralworld` 或 `centralworld`，整篇只用一种。下面写成 `Centralworld` 的地方，另一轮会整篇换成 `centralworld`。Siam Center 的商场英文不换大小写。Version 6 第一行跟着这一轮的餐厅名，是 `Baan Ying` 或 `baan ying`。

**centralwOrld**

Version 1 / A

```text
📍 尚泰世界购物中心（Centralworld）3楼
⏰ 10:00–22:00
```

Version 2 / B

```text
就在 📍 尚泰世界购物中心（Centralworld）3楼，营业时间是 ⏰ 10:00–22:00
```

Version 3 / C

```text
这家分店就在📍 尚泰世界购物中心（Centralworld）3楼
```

Version 4 / D

```text
喜欢泰餐的快来📍 尚泰世界购物中心（Centralworld）3楼 试试吧！
```

Version 5 / E

```text
赶紧码住📍 尚泰世界购物中心（Centralworld）3楼， ⏰ 10:00–22:00， 下次来曼谷直接冲！
```

Version 6 / F

```text
Baan Ying
📍 尚泰世界购物中心（Centralworld）3楼
⏰ 10:00–22:00
```

**Siam Center**

Version 1 / A

```text
📍 暹罗中心（Siam Center）2楼
⏰ 10:30–21:00
```

Version 2 / B

```text
就在 📍 暹罗中心（Siam Center）2楼，营业时间是 ⏰ 10:30–21:00
```

Version 3 / C

```text
这家分店就在📍 暹罗中心（Siam Center）2楼
```

Version 4 / D

```text
喜欢泰餐的快来📍 暹罗中心（Siam Center）2楼 试试吧！
```

Version 5 / E

```text
赶紧码住📍 暹罗中心（Siam Center）2楼， ⏰ 10:30–21:00， 下次来曼谷直接冲！
```

Version 6 / F

```text
Baan Ying
📍 暹罗中心（Siam Center）2楼
⏰ 10:30–21:00
```

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

- standalone 每次必须从 Version 1–6 选一种。inline 不输出文末地点块，只在故事里写一次官方地点
- 连续两次不能用同一个 Version
- 若有 `previousLocationFormat`，本次必须排除上一版
- 没有上一版时，从 Version 1–6 中选择（无官方营业时间时排除 Version 2 / 5）
- 优先选择近期没用过的 Version，让 6 种模板都能轮到，而不是固定成 `📍地点 + ⏰时间` 两行
- 历史记录以服务端实际套上的 Version 为准
- 重新生成只换呈现方式，不改官方事实
- 返回前自检；不合格则用官方数据重套模板

差的变化：把 `尚泰世界购物中心（centralwOrld）3楼` 改成 `CentralWorld 3F`，或把 `10:00–22:00` 改成 `10am–10pm`。

### 13.5 返回前自检

1. standalone 时 Location & Time 是否在正文最后？inline 时故事是否只写了一次商场名和 Baan Ying，且没有文末地点块？
2. 是否只使用 Version 1–6？
3. 是否与上一版使用了不同 Version？
4. 地点是否与所选分店完全匹配？
5. 商场英文和餐厅英文是否都是本轮抽中的那一种，并且全文一致？
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

固定 1 个（不可删、不可译；大小写跟本轮餐厅名走，位置不固定）：

1. `#BaanYing曼谷` 或 `#baanying曼谷`

随机 4 个：只能从批准池里选，且彼此不同。不能自造、缩短、合并、翻译或改写池子里的标签。每次生成应换一组，不要总用同一组。

生成时 5 个标签**打乱顺序**，品牌标签不一定排第一。centralwOrld 池子里带商场名的标签，大小写跟本轮商场名走。Siam Center 的商场标签固定是 `#SiamCenter` 这一组，标签里商场名不带空格。用户在 POST 页手动改标签时**保留当前顺序**。

没有指定分店时，解析、合规改写、结果页和标签编辑器都用**当前部署**的池子。浏览器里靠 `NEXT_PUBLIC_DEPLOYMENT_ID` 判断，所以这个变量必须配。

两家店共用这 13 个：

- `#泰国`
- `#泰国旅游`
- `#泰国旅游攻略`
- `#泰国美食`
- `#曼谷泰餐推荐`
- `#曼谷`
- `#曼谷美食`
- `#泰国菜`
- `#曼谷打卡`
- `#曼谷探店推荐`
- `#曼谷正宗泰餐`
- `#曼谷泰式家常菜`
- `#曼谷必吃`

centralwOrld 再加这 5 个，不能抽到 Siam Center 的标签：

- `#centralworld`
- `#曼谷centralworld`
- `#centralworld美食`
- `#centralworld泰餐`
- `#centralworld泰餐推荐`

Siam Center 再加这 5 个，不能抽到 centralwOrld 的标签：

- `#SiamCenter`
- `#曼谷SiamCenter`
- `#SiamCenter美食`
- `#SiamCenter泰餐`
- `#SiamCenter泰餐推荐`

每家店的批准池都是 18 个。

结果页：品牌标签不能删除；另外最多 4 个，且只能是池子里的。

---

## 15. POST / SHARE

**POST**

- 顶部先显示已生成的 4:5 封面；其余照片可左右翻看
- 可换封面风格：**Style 1–6**（换风格只重合成封面，不重跑 OpenAI、不重写文案）
- 3 个正文标题里选 1 个
- 可改正文、可改池子标签（品牌标签不能删）
- 可重新生成（会再走 1 次 OpenAI + 1 次 Cover Composer）
- 保存时：正文去 hashtag，标签补齐 1 个固定 + 4 个池子（仅批准池）；手动保存不重排顺序

**SHARE**

- 进入 SHARE 即选择 **小红书** 或 **大众点评**（不再经过「你的帖子已经准备好了」）
- 选择页提供「复制全部文案」；小红书说明为「复制文案一键分享」，大众点评为「复制文案，下载图片进行分享」
- **小红书：** 把已生成封面 + 用户照片转成 `File[]`（封面永远第一张），调用 `navigator.share({ files })`，由系统分享面板发图。文案需用户自己点「复制全部文案」
- **大众点评：** 不走 `navigator.share()`。店铺页只用当前部署的店铺：centralwOrld 是 `k9fdoJpGAdqK1XGc`，Siam Center 是 `Ga6sQ4S2uv7WJC6i`。进入手动发布说明页：复制文案 → 保存图片 → 按步骤在大众点评粘贴发布。不显示「发布成功」
- 系统分享不可用时，小红书 fallback 可点「打开小红书」走 `xhsdiscover://post`（URL 不带图、不加参数）
- `publish_platform_selected`：点选小红书或大众点评时写入，`platform` 为对应平台。不记 `dianping_published`
- `publish_click`：小红书系统分享成功记 `platform=unknown` + `method=web_share`。取消不记
- 发布不会调用 OpenAI / `/api/generate`，也不会上传图片

---

## 16. 关键文件

| 文件 | 作用 |
| --- | --- |
| `lib/i18n.ts` | UI 文案（EN / 中文 / ไทย）、隐私政策、Rednote / 小红书 / เสี่ยวหงชู 用词；Origins 占位 `Where are you from?` / `你来自哪里？` / `คุณมาจากประเทศไหน?` |
| `lib/publish/types.ts` | `SharePostResult` / `PublishMethod` |
| `lib/publish/share.ts` | `sharePost`、`downloadGeneratedImage`、`fallbackPublish` |
| `components/publish/PublishAssistant.tsx` | SHARE 页：去发布 → 选小红书或大众点评 |
| `components/publish/DianpingManualPublish.tsx` | 大众点评手动发布说明：复制文案、保存图片 |
| `lib/rednote-publish.ts` | `urlToFile`、`buildPublishFiles`、`buildPublishText`、`canShareFiles`、`xhsdiscover://post` fallback |
| `components/campaign/LanguageSwitch.tsx` | 右上角 EN \| 中文 \| ไทย |
| `types/customer.ts` | 客户资料类型（年龄 / 性别 / 国家；name / email / phone / consent 仍空置保留） |
| `components/ui/menu-select.tsx` | 自定义下拉（年龄、性别共用样式） |
| `components/customer/OriginCityField.tsx` | Origins 国家下拉（置顶 TH / SG / MY / CN / HK / TW） |
| `components/customer/ConsentCheckbox.tsx` | 同意勾选组件（当前 YOU 页未使用） |
| `components/customer/CustomerForm.tsx` | 旧 YOU 表单（年龄、性别、国家）。当前没有页面渲染它 |
| `snapshots/you-page-2026-09-06/` | 含姓名 / 邮箱 / 电话的旧版 YOU 快照 |
| `app/c/[campaignId]/privacy/page.tsx` | 隐私政策页 |
| `lib/mongodb.ts` | MongoDB Atlas 连接。写入只用当前部署的库名 |
| `lib/deployment/config.ts` | 当前部署：品牌、分店、Campaign。一个进程只加载一个 |
| `lib/deployment/databases.ts` | 看板允许读取的分店数据库名单 |
| `lib/deployment/isolation.ts` | 成稿里不能出现另一家店的商场、楼层或营业时间 |
| `lib/branches/` | 两家店的店名、标签池、大众点评店铺。生成规则不在这里分叉 |
| `lib/branches/mall-text.ts` | 当前分店的商场英文名、中文名和匹配写法。生成规则里要用商场名的地方都从这里取 |
| `scripts/validate-branch-parity.ts` | 两家店用同一份输入跑 `/api/generate`，要求 prompt 和后处理结果只差本店资料；只模拟 ModelArk |
| `scripts/validate-final-title-emoji.ts` | 15 个固定样本 × ModelArk / OpenAI（都是模拟）× 两家店，跑真实 `/api/generate`，检查最终返回的标题、标题表情、正文表情、封面和店铺隔离；另直接测 `ensureCaptionEmojis`。`FINAL_COPY_TRACE=1` 打印每一步的改动，`FINAL_COPY_DUMP=路径` 存下结果做前后对比 |
| `scripts/validate-customer-clause-placement.ts` | 顾客原话里带商场名的那句（如「就在{商场}上班」），模型已经换个说法写过时，不被重复追加；仍需补的情况照常补。直接测 `ensureGenerationVariation`，再在进程内调用 `/api/generate` 的路由代码；两家店各跑一遍。ModelArk 回复是脚本写好的模拟数据，不发真实模型请求，MongoDB 用内存替身 |
| `scripts/validate-paragraph-breaks.ts` | 模型写的段落经过 generation variation 和 content lock 后仍保留，`enforceCustomerEvidence` 不再重排已经分好段的正文。直接测 `keepParagraphBreaks` 和调用它的两处，再在进程内调用 `/api/generate` 的路由代码；两家店各跑一遍。ModelArk 回复是脚本写好的模拟数据，不发真实模型请求，MongoDB 用内存替身 |
| `scripts/validate-evidence-priority.ts` | 用餐说明 > 选的菜和推荐理由 > 问卷标签。本地整理不能加只有标签支持的体验、反转顾客的评价或编造味道。直接测相关函数，再在进程内调用 `/api/generate` 的路由代码（首次生成和重新生成）；两家店各跑一遍。ModelArk 回复是脚本写好的模拟数据，不发真实模型请求，MongoDB 用内存替身 |
| `scripts/validate-prompt-evidence-priority.ts` | 只组装 prompt：OpenAI 和 ModelArk 按同样顺序排证据，标签不压过用餐说明，抱怨不当主角，只选了菜不算评价。两家店各跑一遍；纯函数组装，不调用路由和模型，不连数据库。`PRINT_PROMPT_HASHES=1` 打印负面反馈样例的 ModelArk prompt 哈希 |
| `scripts/validate-cover-caption-fit.ts` | 最终封面要和最终正文对得上，只选了菜不算评价。先直接测 `alignCoverWithCaption`、封面候选（`evidenceLedCoverPairs`）和 `ensureContentLock`，再在进程内调用 `/api/generate` 的路由代码（首次生成和重新生成）；两家店各跑一遍。ModelArk 回复是脚本写好的模拟数据，不发真实模型请求，MongoDB 用内存替身 |
| `scripts/validate-title-keyword-postprocess.ts` | 本地整理不为了凑搜索词改写合格的标题。直接测 `enforceCustomerEvidence`，再在进程内调用 `/api/generate` 的路由代码；两家店各跑一遍。ModelArk 回复是脚本写好的模拟数据，不发真实模型请求，MongoDB 用内存替身 |
| `scripts/validate-negative-feedback-prompt.ts` | ModelArk prompt 每次都带一次负面反馈中性化规则，不管顾客写了什么；OpenAI 和备用 `/api/generate-content` 的 prompt 用哈希固定。两家店各跑一遍；纯函数组装，不调用路由和模型，不连数据库。有意改 prompt 后用 `PRINT_PROMPT_HASHES=1` 打印新哈希 |
| `lib/analytics/` | 转化事件写入、日期窗口、看板查询 |
| `middleware.ts` | 匿名 `ugc_sid` session cookie |
| `app/qr/[qrCodeId]/route.ts` | 扫码后跳到星级页 `?new=1`（开始新一轮）；`qr_scan` 在星级页服务端记 |
| `app/api/analytics/route.ts` | 看板汇总 / 转化率 / 按日 / 按 QR |
| `app/api/analytics/events/route.ts` | 客户端事件（评分、XHS 等）。`rating_submitted` 的星级不是 1–5 整数时返回 400 |
| `app/analytics/page.tsx` | 内部转化看板。可切换 centralwOrld / Siam Center，各自读自己的数据库 |
| `lib/submissions.ts` | 旧 `submissions` 类型（现流程不再写入该集合） |
| `lib/generations.ts` | `generations` 写入（YOU / RATE 快照 + 标题、正文、hashtag、封面标题、token 费用） |
| `lib/save-submission-client.ts` | 旧 submissions 客户端（现流程不再调用） |
| `app/api/submissions/route.ts` | 旧顾客资料 API（现流程不再调用） |
| `lib/compress-photo.ts` | 生成前压缩照片 |
| `lib/compliance/negative-feedback.ts` | 负面用语 → 中性表述 |
| `lib/cover/asset-path.ts` | 服务端读取 `public/fonts`、`public/cover` |
| `lib/cover/collage.ts` | Style 1 / 2 四图 2×2 与中心点 |
| `components/providers/language-provider.tsx` | UI 语言（`en` / `zh` / `th`） |
| `components/providers/campaign-flow-provider.tsx` | 流程状态、照片、封面、调用生成 |
| `lib/compose-cover-client.ts` | 浏览器把 File 转 data URL，调用 `/api/compose-cover` |
| `lib/cover/` | Cover Composer：模板、字体、合成 |
| `lib/cover/templates.ts` | 封面模板定义；消费者可选 Style 1–6 |
| `lib/cover/post-layout.ts` | Style 1–6 选项、构图匹配、正文原图顺序 |
| `lib/cover/overlay-layout.ts` | 封面标题一行 / 两行规则 |
| `lib/cover/cover-title.ts` | 封面 mainTitle / subTitle 清洗、字数、关键词对、不合格整条替换 |
| `lib/cover/subtitle-units.ts` | 把无标点评价拆成独立评价，副标题只留一条；不截断、不改顾客原文 |
| `lib/cover/cover-absolute.ts` | 封面禁止排名/绝对化；最爱 → 超爱 |
| `lib/cover/cover-rules.ts` | 封面长度和池子词。主标题先写顾客的理由，池子词不是默认题目；副标题换一件事实 |
| `lib/cover/cover-hooks.ts` | 封面 Hook 风格库 + 按策略建议家族 |
| `lib/cover/dish-names.ts` | 10 道菜全称 / 封面短称 / 别名 |
| `public/cover/thai-flag.png` | Style 3 标题前的泰国国旗 |
| `app/api/compose-cover/route.ts` | 封面合成 API（非 OpenAI） |
| `components/result/CoverEditor.tsx` | Result 最终封面图；失败时可 Retry Cover |
| `components/result/TemplatePicker.tsx` | POST 页 Style 1–6 选择 |
| `components/Footer.tsx` | 页脚 Seedi logo |
| `lib/mock/campaign.ts` | Baan Ying Campaign，挂上 `brandContext` |
| `lib/content-strategy/` | 可复用 Content Strategy Layer：类型、证据打分、prompt 格式化 |
| `lib/brand/baan-ying-strategy.ts` | Baan Ying 的 KSP / Storyline / Angle / 搜索词 / 兼容矩阵 |
| `lib/content-angles.ts` | 兼容层，转调新的 CA-01…CA-12 |
| `lib/brand/baan-ying-context.ts` | 品牌故事、个性、可用事实、参考帖特征 |
| `lib/title-keywords.ts` | 标题曼谷搜索关键词的 prompt 规则。文件里的本地补词函数 `ensureTitleKeywords` 目前没有被 `/api/generate` 调用 |
| `lib/human-style/` | 9 种写法。选择器按顾客证据和 `variantIndex` 选风格；标题习惯和正文习惯在同一个库里 |
| `lib/title-formats.ts` | 三个标题句式不同。正常情况下至少 1 个、通常 1–2 个标题各带 1 个表情，放句首或句尾，至少 1 个纯文字，同一表情不重复，食物表情对得上那句。顾客禁止表情时不补。🇹🇭 大约每 5 个标题一次，只在句首 |
| `lib/title-insight.ts` | 照搬原句、重复同一个点、冷模板、只剩「终于 / 不得不说」开头的标题，用顾客原文里的点换个说法；合格标题不动。封面主标题照搬原句时同样处理 |
| `lib/caption-emoji.ts` | 正文表情按本轮 Human Style 的习惯放。只改表情，不动句子和段落。太少时补到常见下限（3 句以上通常 2 个），只补对得上那句的表情。顾客禁止时全部去掉 |
| `lib/caption-story.ts` | 已经分段、而且每段不超过 3 句的正文保持原有段落和句序，只做事实清理；没有段落或某段超过 3 句才按来由、菜、收尾整理。`keepParagraphBreaks` 按原段首句还原被句子级整理压平的段落。笔记没写的空收尾和重复味道会拿掉 |
| `lib/caption-voice.ts` | 正文口吻、篇幅和段落。用餐说明留下意思再改写，不逐字解释。未写出的「正宗 / 很有记忆点」整类禁用 |
| `lib/customer-evidence.ts` | 顾客自己写的食物、饮品、人和体验先进入标题和封面。商场不是默认的第二条标题 |
| `lib/brand-spelling.ts` | 餐厅名 `Baan Ying` / `baan ying`。centralwOrld 商场名在 `Centralworld` / `centralworld` 里抽；Siam Center 固定 `Siam Center`。话题标签里的商场名和餐厅名都去掉空格 |
| `lib/title-insight.ts` | 标题照搬顾客原句时，本地提炼成 hook |
| `lib/first-visit-wording.ts` | 第一次来 Baan Ying；没有写明就去掉「第一次吃泰餐」 |
| `lib/entry-rating.ts` | 3–5 星通过后才允许进入体验页；`newRatingPath()` 生成开始新一轮的 `rating?new=1` |
| `lib/lucky-draw.ts` | 抽奖链接；当前为空。感谢页已不显示抽奖按钮，留作以后恢复 |
| `app/c/[campaignId]/rating/` | 星级两步：`page.tsx` 第一步 / 感谢页，`review/page.tsx` 1–2 星反馈页，`rating-page-client.tsx` 选星、提交、返回、重新评分 |
| `scripts/validate-rating-flow.ts` | 检查星级范围、反馈规则、提交去重、新一轮入口、感谢页文案；不写数据库 |
| `scripts/validate-ai-provider.ts` | 检查默认 ModelArk、缺 key 和 OpenAI 拒绝时的错误提示；不打真实接口 |
| `types/content.ts` | 体验问卷类型；10 道菜 + 其他；默认分店、到访 Yes/No、补充说明计数 |
| `lib/generate-prompt.ts` | 同一次请求的 system / user prompt。顾客经历在品牌前面；JSON 形状不变 |
| `lib/generate-hashtags/prompt.ts` | 备用接口的标签 prompt |
| `lib/generate-hashtags/generate.ts` | 备用接口的标签生成 + 重试（主路径不用） |
| `lib/hashtags.ts` | 1 固定 + 4 池子、打乱、从正文剥离 `#`。没指定分店时用当前部署的池子 |
| `components/result/HashtagEditor.tsx` | POST 页标签编辑：固定标签不能删，池子标签最多 4 个 |
| `lib/locations.ts` | 分店官方地点和营业时间、6 种 Location & Time 模板。清理外店事实时保留空行。inline 把地点和「总算约上」并成一段，不把「来了这家店」粘到菜上 |
| `lib/openai-pricing.ts` | OpenAI 模型单价（每百万 token），改价只改这里 |
| `lib/openai-usage.ts` | 从 API `usage` 取 token，汇总费用并打日志；`Calls:` 每次都打印 |
| `lib/parse-generated.ts` | 解析标题 + 正文 + hashtags + mainTitle / subTitle + 封面选图。ModelArk 的 `captionParagraphs` 用空行拼成 `caption`。空标题滤掉后仍要 3 个非空标题 |
| `lib/modelark/post-schema.ts` | ModelArk 的 JSON Schema。标题正好 3 个，每条至少 1 个字符 |
| `lib/modelark/title-check.ts` | 只在正文还在且有效标题少于 3 个时再请求一次。失败不补标题，也不改走 OpenAI |
| `lib/ai-provider.ts` | `AI_PROVIDER` 为空或 `modelark` 用 ModelArk；`openai` 用 OpenAI；其他值直接报错 |
| `app/api/generate/route.ts` | 消费者主生成：1 次文本请求 → 本地补全 → 追加地点；最多 5 张图。ModelArk 的 JSON 重试和标题重试见 12.1 |
| `app/api/generate-content/route.ts` | 备用 JSON 生成接口 |
| `app/c/[campaignId]/rating/page.tsx` | 星级第一步；非 `draw=1`、不带 `stars` 时记 `qr_scan`；`?new=1` 开始新一轮 |
| `app/c/[campaignId]/customer/page.tsx` | 只做跳转：评分已通过就转到 experience |
| `app/c/[campaignId]/experience/page.tsx` | 体验页：是否第一次、游客/本地、餐费、菜、理由、补充说明、来自哪里、上传照片 |
| `app/c/[campaignId]/*` | 消费者页面 |
| `vercel.json` | `maxDuration`（Hobby 实际仍可能被平台上限截断） |
| `next.config.ts` | `outputFileTracingIncludes`（字体 / 国旗） |

---

## 17. 明确没做的事

- 登录 / 注册 / 品牌后台配置
- Cloudinary / 图片存储（照片和封面 JPEG 都不进 Mongo）
- KSP 写入 Mongo（用餐补充说明会在生成成功时写入 `generations`）
- 1–2 星生成帖子或进入体验页
- 感谢页抽奖按钮（已移除；`lib/lucky-draw.ts` 留着）
- 后端强制 1–2 星必须带反馈（只在页面上必填，API 契约未改）
- 小红书 / 大众点评自动填文案或自动发布（SHARE 只把 files/text/title 交给系统分享；网站不知道用户选了哪个 App）
- AI 生图 / 修图 / 用模型绘制中文封面（封面是 Cover Composer 叠字，不是生图）
- QR 图片生成服务（只追踪已有 `/qr/:qrCodeId` 扫码）
- 多品牌多 Campaign 后台配置
- YOU 页同意勾选（组件还在，表单未展示）
- 隐私政策正文与现表单完全对齐（仍写性别选填、到访门店等）

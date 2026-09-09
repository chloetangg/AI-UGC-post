# AI UGC Post（Baan Ying / 小红书）

消费者端 Demo：根据用餐问卷和照片，生成一篇简体中文小红书文案，并用 Cover Composer 叠出 4:5 封面。

- 仓库：[https://github.com/chloetangg/AI-UGC-post](https://github.com/chloetangg/AI-UGC-post)
- **当前行为说明：** 见 [`CURRENT_VERSION.md`](./CURRENT_VERSION.md)（Consumer Demo v0.11，2026-09-09）

## 流程

`YOU` → `FEEL` → `PHOTOS` → `POST` → `SHARE`

本地默认打开 [http://localhost:3000](http://localhost:3000)，会跳到 `/c/baan-ying/customer`。

## 本地运行

```bash
npm install
npm run dev
```

复制 `.env.example` 为 `.env.local`：

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
MONGODB_URI=
MONGODB_DB_NAME=baan-ying
```

生成帖子必须有 `OPENAI_API_KEY`。MongoDB 只保存 YOU（年龄 / 性别 / 国家）和 FEEL 餐费；没有 URI 时仍可翻页，只是不入库。不要把 `.env.local` 提交到 Git。

## 部署

Vercel 需配置同样的环境变量（Production / Preview / Development）。改环境变量后要 Redeploy。封面中文字体依赖 `public/fonts` 被打进 serverless bundle。

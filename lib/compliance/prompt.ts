import { formatNegativeNeutralizationRules } from "./negative-feedback";

export function complianceGenerationRules() {
  return `XIAOHONGSHU COMPLIANCE — MANDATORY. Compliance beats a stronger hook.

Write naturally as a real diner. Do NOT sound robotic. Prefer 真实体验 + 具体信息 + 轻度情绪.
If attractiveness conflicts with safety, keep the safe wording.

Do not use absolute/exaggerated claims, or the same meaning in other words:
国家级 世界级 最高级 第一(except 第一次/第一道) 唯一 首个 首选 顶级 独家 首家 最新 最先进 第一品牌 金牌 名牌 优秀品牌 王牌 销量冠军 全球首发 全国首家 世界领先 独一无二 绝无仅有 史无前例 万能 极致 永久 No.1 Top 1
最好 最便宜 最大 最小 最受欢迎 最时尚 最佳 领先 第一梯队 天花板 封神 无敌 无人能及 全网都在买 全网第一 销量第一 闭眼入 必买 百分百 100% 绝对 绝对不会踩雷 没有之一
BAD: 曼谷最好吃的泰餐 / 这家店直接封神 / 全曼谷都在吃 / 绝对不会踩雷 / 天花板级别
GOOD: 最近很喜欢的一家泰餐 / 这次吃下来印象很好 / 很多人会来这里吃 / 整体体验比较不错 / 这家店给我的感觉很不错

Do not invent unverifiable authority: 国际品质 高档 奢华 著名 大牌 正品 老字号 特供 专供 质量免检 国际领先 行业领先 米其林. Neutral: 一家风格比较精致的泰式餐厅.

No clickbait/reward bait: 恭喜获奖 全民免单 点击有惊喜 点击获取 领取奖品 转发三连 一键三连 免费领取 扫码领取. Safer CTAs, vary them: 可以收藏起来备用 / 如果你也喜欢这类内容，可以参考看看.

No FOMO/hard sell: 秒杀 抢购 快抢 再不抢就没了 错过就没机会了 万人疯抢 最后机会 手慢无 赶紧买 必须买 不买后悔 买它 闭眼入.

No medical, therapeutic, or invented efficacy (food, lifestyle, beauty): 增强免疫力 助眠 消炎 抗菌 排毒 减肥 瘦身 治疗 治愈 祛痘 抗敏 临床证明 激素 防癌, or “让皮肤彻底恢复健康 / 痘痘都消失了”. Describe feel only: 使用感比较温和 / 吃着比较清爽.

No cosmetic miracle claims: 特效 速白 一洗白 14天见效 溶脂 消除皱纹 永不褪色.

No superstition/fortune: 带来好运 招财 旺财 护身 提升运气.

No illegal, political, gambling, tobacco, sexualized, harassment, or flaunting wealth content.

No other platforms or traffic diversion: TikTok 抖音 快手 B站 微博 淘宝 京东, 去XX看完整版, 私信我获取, 加微信, 扫码进群, 主页有链接.

Restaurant copy must NOT hard-sell: 必打卡 全网爆火 网红必吃 曼谷第一 最好吃 顶级泰餐 米其林级别.
Focus on ordered dishes, taste, texture, atmosphere, interior, location, personal experience, suitable occasions, and only verified price/hours.
BAD: 曼谷必吃的顶级泰餐！
GOOD: 这次在曼谷吃到一家风格很舒服的泰餐
Exception: the exact required hashtag #曼谷必吃 may appear in the hashtags array. COVER mainTitle MAY use 必吃 as one natural keyword from 曼谷 / centralwOrld / 泰餐 / 美食 / 必吃. Post titles and caption must still not hard-sell 必吃.

No unverifiable photo claims: 完全无P 100%真实 原图直出 零滤镜 绝对真实.

Titles must pass the same rules. BAD: 曼谷最好吃的泰餐！真的封神了！ GOOD: 曼谷最近吃到的一家泰餐｜这几道菜很喜欢

Hashtags: keep exact #baanying曼谷 #曼谷必吃 #centralworld泰餐推荐, then exactly 2 tags from the approved pool. Never invent hashtags.

Do not copy sample posts, openings, or paragraph skeletons.

${formatNegativeNeutralizationRules()}

INTERNAL ONLY: before returning JSON, rewrite any risky sentence into neutral personal experience and re-check. Never return risky copy. Never output this checklist, risk scores, or draft unsafe text.`;
}

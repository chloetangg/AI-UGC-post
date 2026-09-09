import { isKnownOriginCountry } from "./country-calling-codes";

export type WorldCity = {
  name: string;
  nameZh: string;
  country: string;
  countryZh: string;
  aliases?: string[];
  priority?: boolean;
};

function city(
  name: string,
  nameZh: string,
  country: string,
  countryZh: string,
  priority = false,
  aliases: string[] = [],
): WorldCity {
  return { name, nameZh, country, countryZh, priority, aliases };
}

/** Cities from these countries appear first in Origins, in this country order. */
export const PRIORITY_ORIGIN_COUNTRIES = [
  "Thailand",
  "Singapore",
  "Malaysia",
  "China",
  "Taiwan",
  "Hong Kong",
] as const;

/** World cities. Priority-country cities first, then remaining cities A–Z. */
export const WORLD_CITIES: WorldCity[] = [
  city("Bangkok", "曼谷", "Thailand", "泰国", true, ["Krung Thep", "BKK"]),
  city("Shanghai", "上海", "China", "中国", true, ["沪"]),
  city("Singapore", "新加坡", "Singapore", "新加坡", true, ["SG"]),
  city("Beijing", "北京", "China", "中国", true, ["Peking"]),
  city("Hong Kong", "香港", "Hong Kong", "香港", true, ["HK", "Xianggang"]),
  city("Taipei", "台北", "Taiwan", "台湾", true, ["臺北"]),
  city("Guangzhou", "广州", "China", "中国", true, ["广州", "Canton"]),
  city("Shenzhen", "深圳", "China", "中国", true),
  city("Chengdu", "成都", "China", "中国", true),
  city("Hangzhou", "杭州", "China", "中国", true),
  city("Tokyo", "东京", "Japan", "日本", true, ["東京"]),
  city("Seoul", "首尔", "South Korea", "韩国", true, ["서울", "汉城"]),
  city("Kuala Lumpur", "吉隆坡", "Malaysia", "马来西亚", true, ["KL"]),
  city("Jakarta", "雅加达", "Indonesia", "印度尼西亚", true),
  city("Ho Chi Minh City", "胡志明市", "Vietnam", "越南", true, ["Saigon", "西贡"]),
  city("Manila", "马尼拉", "Philippines", "菲律宾", true),
  city("New York", "纽约", "United States", "美国", true, ["NYC", "New York City"]),
  city("London", "伦敦", "United Kingdom", "英国", true),
  city("Sydney", "悉尼", "Australia", "澳大利亚", true, ["雪梨"]),
  city("Dubai", "迪拜", "United Arab Emirates", "阿联酋", true),
  city("Paris", "巴黎", "France", "法国", true),
  city("Los Angeles", "洛杉矶", "United States", "美国", true, ["LA"]),
  city("Chiang Mai", "清迈", "Thailand", "泰国", true),
  city("Phuket", "普吉", "Thailand", "泰国", true, ["普吉岛"]),

  city("Abu Dhabi", "阿布扎比", "United Arab Emirates", "阿联酋"),
  city("Accra", "阿克拉", "Ghana", "加纳"),
  city("Addis Ababa", "亚的斯亚贝巴", "Ethiopia", "埃塞俄比亚"),
  city("Adelaide", "阿德莱德", "Australia", "澳大利亚"),
  city("Ahmedabad", "艾哈迈达巴德", "India", "印度"),
  city("Alexandria", "亚历山大", "Egypt", "埃及"),
  city("Algiers", "阿尔及尔", "Algeria", "阿尔及利亚"),
  city("Almaty", "阿拉木图", "Kazakhstan", "哈萨克斯坦"),
  city("Amman", "安曼", "Jordan", "约旦"),
  city("Amsterdam", "阿姆斯特丹", "Netherlands", "荷兰"),
  city("Ankara", "安卡拉", "Turkey", "土耳其"),
  city("Antwerp", "安特卫普", "Belgium", "比利时"),
  city("Athens", "雅典", "Greece", "希腊"),
  city("Atlanta", "亚特兰大", "United States", "美国"),
  city("Auckland", "奥克兰", "New Zealand", "新西兰"),
  city("Austin", "奥斯汀", "United States", "美国"),
  city("Baghdad", "巴格达", "Iraq", "伊拉克"),
  city("Baku", "巴库", "Azerbaijan", "阿塞拜疆"),
  city("Bali", "巴厘岛", "Indonesia", "印度尼西亚", false, ["Denpasar", "登巴萨"]),
  city("Baltimore", "巴尔的摩", "United States", "美国"),
  city("Bandung", "万隆", "Indonesia", "印度尼西亚"),
  city("Bangalore", "班加罗尔", "India", "印度", false, ["Bengaluru"]),
  city("Barcelona", "巴塞罗那", "Spain", "西班牙"),
  city("Basel", "巴塞尔", "Switzerland", "瑞士"),
  city("Beijing", "北京", "China", "中国", false, ["Peking"]),
  city("Beirut", "贝鲁特", "Lebanon", "黎巴嫩"),
  city("Belgrade", "贝尔格莱德", "Serbia", "塞尔维亚"),
  city("Berlin", "柏林", "Germany", "德国"),
  city("Bern", "伯尔尼", "Switzerland", "瑞士"),
  city("Birmingham", "伯明翰", "United Kingdom", "英国"),
  city("Bogota", "波哥大", "Colombia", "哥伦比亚"),
  city("Bologna", "博洛尼亚", "Italy", "意大利"),
  city("Boston", "波士顿", "United States", "美国"),
  city("Brasilia", "巴西利亚", "Brazil", "巴西"),
  city("Bratislava", "布拉迪斯拉发", "Slovakia", "斯洛伐克"),
  city("Brisbane", "布里斯班", "Australia", "澳大利亚"),
  city("Brussels", "布鲁塞尔", "Belgium", "比利时"),
  city("Bucharest", "布加勒斯特", "Romania", "罗马尼亚"),
  city("Budapest", "布达佩斯", "Hungary", "匈牙利"),
  city("Buenos Aires", "布宜诺斯艾利斯", "Argentina", "阿根廷"),
  city("Busan", "釜山", "South Korea", "韩国"),
  city("Cairo", "开罗", "Egypt", "埃及"),
  city("Calgary", "卡尔加里", "Canada", "加拿大"),
  city("Cannes", "戛纳", "France", "法国"),
  city("Cape Town", "开普敦", "South Africa", "南非"),
  city("Caracas", "加拉加斯", "Venezuela", "委内瑞拉"),
  city("Casablanca", "卡萨布兰卡", "Morocco", "摩洛哥"),
  city("Cebu", "宿务", "Philippines", "菲律宾"),
  city("Changchun", "长春", "China", "中国"),
  city("Changsha", "长沙", "China", "中国"),
  city("Chengdu", "成都", "China", "中国"),
  city("Chennai", "金奈", "India", "印度", false, ["Madras"]),
  city("Chiang Rai", "清莱", "Thailand", "泰国"),
  city("Chicago", "芝加哥", "United States", "美国"),
  city("Chongqing", "重庆", "China", "中国"),
  city("Christchurch", "基督城", "New Zealand", "新西兰"),
  city("Cologne", "科隆", "Germany", "德国"),
  city("Colombo", "科伦坡", "Sri Lanka", "斯里兰卡"),
  city("Copenhagen", "哥本哈根", "Denmark", "丹麦"),
  city("Da Nang", "岘港", "Vietnam", "越南"),
  city("Dalian", "大连", "China", "中国"),
  city("Dallas", "达拉斯", "United States", "美国"),
  city("Delhi", "德里", "India", "印度", false, ["New Delhi", "新德里"]),
  city("Denver", "丹佛", "United States", "美国"),
  city("Detroit", "底特律", "United States", "美国"),
  city("Dhaka", "达卡", "Bangladesh", "孟加拉国"),
  city("Doha", "多哈", "Qatar", "卡塔尔"),
  city("Dongguan", "东莞", "China", "中国"),
  city("Dublin", "都柏林", "Ireland", "爱尔兰"),
  city("Dusseldorf", "杜塞尔多夫", "Germany", "德国"),
  city("Edinburgh", "爱丁堡", "United Kingdom", "英国"),
  city("Florence", "佛罗伦萨", "Italy", "意大利"),
  city("Frankfurt", "法兰克福", "Germany", "德国"),
  city("Fukuoka", "福冈", "Japan", "日本"),
  city("Fuzhou", "福州", "China", "中国"),
  city("Geneva", "日内瓦", "Switzerland", "瑞士"),
  city("Genoa", "热那亚", "Italy", "意大利"),
  city("Glasgow", "格拉斯哥", "United Kingdom", "英国"),
  city("Guayaquil", "瓜亚基尔", "Ecuador", "厄瓜多尔"),
  city("Guangzhou", "广州", "China", "中国", false, ["广州", "Canton"]),
  city("Guiyang", "贵阳", "China", "中国"),
  city("Hague", "海牙", "Netherlands", "荷兰", false, ["The Hague"]),
  city("Haikou", "海口", "China", "中国"),
  city("Hamburg", "汉堡", "Germany", "德国"),
  city("Hanoi", "河内", "Vietnam", "越南"),
  city("Harbin", "哈尔滨", "China", "中国"),
  city("Hefei", "合肥", "China", "中国"),
  city("Helsinki", "赫尔辛基", "Finland", "芬兰"),
  city("Hohhot", "呼和浩特", "China", "中国"),
  city("Houston", "休斯顿", "United States", "美国"),
  city("Hua Hin", "华欣", "Thailand", "泰国"),
  city("Hyderabad", "海得拉巴", "India", "印度"),
  city("Incheon", "仁川", "South Korea", "韩国"),
  city("Islamabad", "伊斯兰堡", "Pakistan", "巴基斯坦"),
  city("Istanbul", "伊斯坦布尔", "Turkey", "土耳其"),
  city("Izmir", "伊兹密尔", "Turkey", "土耳其"),
  city("Jaipur", "斋浦尔", "India", "印度"),
  city("Jeddah", "吉达", "Saudi Arabia", "沙特阿拉伯"),
  city("Jeju", "济州", "South Korea", "韩国"),
  city("Jerusalem", "耶路撒冷", "Israel", "以色列"),
  city("Johannesburg", "约翰内斯堡", "South Africa", "南非"),
  city("Johor Bahru", "新山", "Malaysia", "马来西亚"),
  city("Jinan", "济南", "China", "中国"),
  city("Kaohsiung", "高雄", "Taiwan", "台湾"),
  city("Karachi", "卡拉奇", "Pakistan", "巴基斯坦"),
  city("Kathmandu", "加德满都", "Nepal", "尼泊尔"),
  city("Kiev", "基辅", "Ukraine", "乌克兰", false, ["Kyiv"]),
  city("Koh Samui", "苏梅岛", "Thailand", "泰国", false, ["Samui"]),
  city("Kolkata", "加尔各答", "India", "印度", false, ["Calcutta"]),
  city("Krabi", "甲米", "Thailand", "泰国"),
  city("Krakow", "克拉科夫", "Poland", "波兰"),
  city("Kuching", "古晋", "Malaysia", "马来西亚"),
  city("Kunming", "昆明", "China", "中国"),
  city("Kuwait City", "科威特城", "Kuwait", "科威特"),
  city("Kyoto", "京都", "Japan", "日本"),
  city("Lagos", "拉各斯", "Nigeria", "尼日利亚"),
  city("Lahore", "拉合尔", "Pakistan", "巴基斯坦"),
  city("Lanzhou", "兰州", "China", "中国"),
  city("Las Vegas", "拉斯维加斯", "United States", "美国"),
  city("Lima", "利马", "Peru", "秘鲁"),
  city("Lisbon", "里斯本", "Portugal", "葡萄牙"),
  city("Liverpool", "利物浦", "United Kingdom", "英国"),
  city("Ljubljana", "卢布尔雅那", "Slovenia", "斯洛文尼亚"),
  city("Luxembourg", "卢森堡", "Luxembourg", "卢森堡"),
  city("Lyon", "里昂", "France", "法国"),
  city("Macau", "澳门", "Macau", "澳门", false, ["Macao", "澳門"]),
  city("Madrid", "马德里", "Spain", "西班牙"),
  city("Malacca", "马六甲", "Malaysia", "马来西亚", false, ["Melaka"]),
  city("Malmo", "马尔默", "Sweden", "瑞典"),
  city("Manchester", "曼彻斯特", "United Kingdom", "英国"),
  city("Manama", "麦纳麦", "Bahrain", "巴林"),
  city("Marseille", "马赛", "France", "法国"),
  city("Medan", "棉兰", "Indonesia", "印度尼西亚"),
  city("Melbourne", "墨尔本", "Australia", "澳大利亚"),
  city("Mexico City", "墨西哥城", "Mexico", "墨西哥"),
  city("Miami", "迈阿密", "United States", "美国"),
  city("Milan", "米兰", "Italy", "意大利"),
  city("Minneapolis", "明尼阿波利斯", "United States", "美国"),
  city("Minsk", "明斯克", "Belarus", "白俄罗斯"),
  city("Monaco", "摩纳哥", "Monaco", "摩纳哥"),
  city("Montreal", "蒙特利尔", "Canada", "加拿大"),
  city("Moscow", "莫斯科", "Russia", "俄罗斯"),
  city("Mumbai", "孟买", "India", "印度", false, ["Bombay"]),
  city("Munich", "慕尼黑", "Germany", "德国"),
  city("Muscat", "马斯喀特", "Oman", "阿曼"),
  city("Nagoya", "名古屋", "Japan", "日本"),
  city("Nairobi", "内罗毕", "Kenya", "肯尼亚"),
  city("Nanchang", "南昌", "China", "中国"),
  city("Nanjing", "南京", "China", "中国"),
  city("Nanning", "南宁", "China", "中国"),
  city("Naples", "那不勒斯", "Italy", "意大利"),
  city("Nice", "尼斯", "France", "法国"),
  city("Ningbo", "宁波", "China", "中国"),
  city("Nicosia", "尼科西亚", "Cyprus", "塞浦路斯"),
  city("Osaka", "大阪", "Japan", "日本"),
  city("Oslo", "奥斯陆", "Norway", "挪威"),
  city("Ottawa", "渥太华", "Canada", "加拿大"),
  city("Pattaya", "芭提雅", "Thailand", "泰国", false, ["芭东", "帕塔亚"]),
  city("Penang", "槟城", "Malaysia", "马来西亚", false, ["George Town", "槟岛"]),
  city("Perth", "珀斯", "Australia", "澳大利亚"),
  city("Philadelphia", "费城", "United States", "美国"),
  city("Phnom Penh", "金边", "Cambodia", "柬埔寨"),
  city("Phoenix", "凤凰城", "United States", "美国"),
  city("Portland", "波特兰", "United States", "美国"),
  city("Porto", "波尔图", "Portugal", "葡萄牙"),
  city("Prague", "布拉格", "Czechia", "捷克"),
  city("Pune", "浦那", "India", "印度"),
  city("Qingdao", "青岛", "China", "中国"),
  city("Quito", "基多", "Ecuador", "厄瓜多尔"),
  city("Riga", "里加", "Latvia", "拉脱维亚"),
  city("Rio de Janeiro", "里约热内卢", "Brazil", "巴西"),
  city("Riyadh", "利雅得", "Saudi Arabia", "沙特阿拉伯"),
  city("Rome", "罗马", "Italy", "意大利"),
  city("Rotterdam", "鹿特丹", "Netherlands", "荷兰"),
  city("Saint Petersburg", "圣彼得堡", "Russia", "俄罗斯"),
  city("San Diego", "圣地亚哥", "United States", "美国"),
  city("San Francisco", "旧金山", "United States", "美国", false, ["SF", "三藩市"]),
  city("San Jose", "圣何塞", "United States", "美国"),
  city("Santiago", "圣地亚哥", "Chile", "智利"),
  city("Sanya", "三亚", "China", "中国"),
  city("Sao Paulo", "圣保罗", "Brazil", "巴西"),
  city("Sapporo", "札幌", "Japan", "日本"),
  city("Seattle", "西雅图", "United States", "美国"),
  city("Seville", "塞维利亚", "Spain", "西班牙"),
  city("Shanghai", "上海", "China", "中国", false, ["沪"]),
  city("Shenyang", "沈阳", "China", "中国"),
  city("Shijiazhuang", "石家庄", "China", "中国"),
  city("Siem Reap", "暹粒", "Cambodia", "柬埔寨"),
  city("Sofia", "索非亚", "Bulgaria", "保加利亚"),
  city("Stockholm", "斯德哥尔摩", "Sweden", "瑞典"),
  city("Stuttgart", "斯图加特", "Germany", "德国"),
  city("Surabaya", "泗水", "Indonesia", "印度尼西亚"),
  city("Suzhou", "苏州", "China", "中国"),
  city("Taichung", "台中", "Taiwan", "台湾"),
  city("Tainan", "台南", "Taiwan", "台湾"),
  city("Taipei", "台北", "Taiwan", "台湾", false, ["臺北"]),
  city("Taiyuan", "太原", "China", "中国"),
  city("Tallinn", "塔林", "Estonia", "爱沙尼亚"),
  city("Tashkent", "塔什干", "Uzbekistan", "乌兹别克斯坦"),
  city("Tbilisi", "第比利斯", "Georgia", "格鲁吉亚"),
  city("Tehran", "德黑兰", "Iran", "伊朗"),
  city("Tel Aviv", "特拉维夫", "Israel", "以色列"),
  city("Tianjin", "天津", "China", "中国"),
  city("Toronto", "多伦多", "Canada", "加拿大"),
  city("Toulouse", "图卢兹", "France", "法国"),
  city("Tunis", "突尼斯", "Tunisia", "突尼斯"),
  city("Urumqi", "乌鲁木齐", "China", "中国"),
  city("Valencia", "瓦伦西亚", "Spain", "西班牙"),
  city("Vancouver", "温哥华", "Canada", "加拿大"),
  city("Venice", "威尼斯", "Italy", "意大利"),
  city("Vienna", "维也纳", "Austria", "奥地利"),
  city("Vientiane", "万象", "Laos", "老挝"),
  city("Vilnius", "维尔纽斯", "Lithuania", "立陶宛"),
  city("Warsaw", "华沙", "Poland", "波兰"),
  city("Washington", "华盛顿", "United States", "美国", false, ["Washington DC", "DC"]),
  city("Wellington", "惠灵顿", "New Zealand", "新西兰"),
  city("Wenzhou", "温州", "China", "中国"),
  city("Wuhan", "武汉", "China", "中国"),
  city("Wuxi", "无锡", "China", "中国"),
  city("Xiamen", "厦门", "China", "中国"),
  city("Xi'an", "西安", "China", "中国", false, ["Xian", "西安"]),
  city("Yangon", "仰光", "Myanmar", "缅甸", false, ["Rangoon"]),
  city("Yerevan", "埃里温", "Armenia", "亚美尼亚"),
  city("Yinchuan", "银川", "China", "中国"),
  city("Yokohama", "横滨", "Japan", "日本"),
  city("Zagreb", "萨格勒布", "Croatia", "克罗地亚"),
  city("Zhengzhou", "郑州", "China", "中国"),
  city("Zhuhai", "珠海", "China", "中国"),
  city("Zurich", "苏黎世", "Switzerland", "瑞士"),
];

function originCountryRank(country: string) {
  const index = (PRIORITY_ORIGIN_COUNTRIES as readonly string[]).indexOf(country);
  return index === -1 ? PRIORITY_ORIGIN_COUNTRIES.length : index;
}

function compareOriginCities(a: WorldCity, b: WorldCity) {
  const rank = originCountryRank(a.country) - originCountryRank(b.country);
  if (rank !== 0) return rank;
  return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
}

const UNIQUE_CITIES = (() => {
  const seen = new Set<string>();
  return WORLD_CITIES.filter((item) => {
    const key = cityValue(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort(compareOriginCities);
})();

export function cityValue(item: WorldCity) {
  return `${item.name}, ${item.country}`;
}

export function cityDisplayName(item: WorldCity, language: "en" | "zh") {
  return language === "zh" ? item.nameZh : item.name;
}

export function findCityByValue(value: string) {
  const raw = value.trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  return UNIQUE_CITIES.find((item) => {
    return (
      cityValue(item).toLowerCase() === lower ||
      item.name.toLowerCase() === lower ||
      item.nameZh === raw
    );
  });
}

export function isKnownOriginCity(value: string) {
  return isKnownOriginCountry(value) || Boolean(findCityByValue(value));
}

export function filterCities(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return UNIQUE_CITIES;
  return UNIQUE_CITIES.filter((item) => {
    const haystack = [
      item.name,
      item.nameZh,
      item.country,
      item.countryZh,
      cityValue(item),
      ...(item.aliases ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  }).sort(compareOriginCities);
}

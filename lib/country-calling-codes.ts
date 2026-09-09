export type CountryCallingCode = {
  iso2: string;
  name: string;
  nameZh: string;
  dial: string;
  aliases?: string[];
  priority?: boolean;
};

function country(
  iso2: string,
  name: string,
  nameZh: string,
  dial: string,
  priority = false,
  aliases: string[] = [],
): CountryCallingCode {
  return { iso2, name, nameZh, dial, priority, aliases };
}

export const DEFAULT_COUNTRY_CODE = "+66";

/** Priority countries first, then the remaining ISO list A–Z. */
export const COUNTRY_CALLING_CODES: CountryCallingCode[] = [
  country("TH", "Thailand", "泰国", "+66", true, ["泰國"]),
  country("SG", "Singapore", "新加坡", "+65", true),
  country("MY", "Malaysia", "马来西亚", "+60", true, ["馬來西亞"]),
  country("CN", "China", "中国", "+86", true, ["中國", "中国大陆", "大陆"]),
  country("HK", "Hong Kong", "香港", "+852", true),
  country("TW", "Taiwan", "台湾", "+886", true, ["台灣", "臺灣"]),
  country("JP", "Japan", "日本", "+81", true),
  country("KR", "South Korea", "韩国", "+82", true, ["韓國", "南韩"]),
  country("US", "United States", "美国", "+1", true, ["美國"]),
  country("GB", "United Kingdom", "英国", "+44", true, ["英國", "UK"]),
  country("AU", "Australia", "澳大利亚", "+61", true, ["澳洲"]),
  country("ID", "Indonesia", "印度尼西亚", "+62", true, ["印尼"]),
  country("VN", "Vietnam", "越南", "+84", true),
  country("PH", "Philippines", "菲律宾", "+63", true, ["菲律賓"]),
  country("AF", "Afghanistan", "阿富汗", "+93"),
  country("AL", "Albania", "阿尔巴尼亚", "+355", false, ["阿爾巴尼亞"]),
  country("DZ", "Algeria", "阿尔及利亚", "+213", false, ["阿爾及利亞"]),
  country("AD", "Andorra", "安道尔", "+376", false, ["安道爾"]),
  country("AO", "Angola", "安哥拉", "+244"),
  country("AR", "Argentina", "阿根廷", "+54"),
  country("AM", "Armenia", "亚美尼亚", "+374", false, ["亞美尼亞"]),
  country("AT", "Austria", "奥地利", "+43", false, ["奧地利"]),
  country("AZ", "Azerbaijan", "阿塞拜疆", "+994"),
  country("BH", "Bahrain", "巴林", "+973"),
  country("BD", "Bangladesh", "孟加拉国", "+880", false, ["孟加拉"]),
  country("BY", "Belarus", "白俄罗斯", "+375", false, ["白俄羅斯"]),
  country("BE", "Belgium", "比利时", "+32", false, ["比利時"]),
  country("BZ", "Belize", "伯利兹", "+501", false, ["伯利茲"]),
  country("BJ", "Benin", "贝宁", "+229", false, ["貝寧"]),
  country("BT", "Bhutan", "不丹", "+975"),
  country("BO", "Bolivia", "玻利维亚", "+591", false, ["玻利維亞"]),
  country("BA", "Bosnia and Herzegovina", "波黑", "+387", false, ["波斯尼亚", "波斯尼亞"]),
  country("BW", "Botswana", "博茨瓦纳", "+267", false, ["博茨瓦納"]),
  country("BR", "Brazil", "巴西", "+55"),
  country("BN", "Brunei", "文莱", "+673", false, ["汶萊", "文萊"]),
  country("BG", "Bulgaria", "保加利亚", "+359", false, ["保加利亞"]),
  country("KH", "Cambodia", "柬埔寨", "+855"),
  country("CM", "Cameroon", "喀麦隆", "+237", false, ["喀麥隆"]),
  country("CA", "Canada", "加拿大", "+1"),
  country("CL", "Chile", "智利", "+56"),
  country("CO", "Colombia", "哥伦比亚", "+57", false, ["哥倫比亞"]),
  country("CR", "Costa Rica", "哥斯达黎加", "+506", false, ["哥斯達黎加"]),
  country("HR", "Croatia", "克罗地亚", "+385", false, ["克羅地亞", "克羅埃西亞"]),
  country("CU", "Cuba", "古巴", "+53"),
  country("CY", "Cyprus", "塞浦路斯", "+357"),
  country("CZ", "Czechia", "捷克", "+420"),
  country("DK", "Denmark", "丹麦", "+45", false, ["丹麥"]),
  country("DO", "Dominican Republic", "多米尼加", "+1"),
  country("EC", "Ecuador", "厄瓜多尔", "+593", false, ["厄瓜多爾"]),
  country("EG", "Egypt", "埃及", "+20"),
  country("SV", "El Salvador", "萨尔瓦多", "+503", false, ["薩爾瓦多"]),
  country("EE", "Estonia", "爱沙尼亚", "+372", false, ["愛沙尼亞"]),
  country("ET", "Ethiopia", "埃塞俄比亚", "+251", false, ["埃塞俄比亞"]),
  country("FI", "Finland", "芬兰", "+358", false, ["芬蘭"]),
  country("FR", "France", "法国", "+33", false, ["法國"]),
  country("GE", "Georgia", "格鲁吉亚", "+995", false, ["格魯吉亞"]),
  country("DE", "Germany", "德国", "+49", false, ["德國"]),
  country("GH", "Ghana", "加纳", "+233", false, ["迦納"]),
  country("GR", "Greece", "希腊", "+30", false, ["希臘"]),
  country("GT", "Guatemala", "危地马拉", "+502", false, ["危地馬拉"]),
  country("HN", "Honduras", "洪都拉斯", "+504"),
  country("HU", "Hungary", "匈牙利", "+36"),
  country("IS", "Iceland", "冰岛", "+354", false, ["冰島"]),
  country("IN", "India", "印度", "+91"),
  country("IR", "Iran", "伊朗", "+98"),
  country("IQ", "Iraq", "伊拉克", "+964"),
  country("IE", "Ireland", "爱尔兰", "+353", false, ["愛爾蘭"]),
  country("IL", "Israel", "以色列", "+972"),
  country("IT", "Italy", "意大利", "+39", false, ["義大利"]),
  country("JM", "Jamaica", "牙买加", "+1", false, ["牙買加"]),
  country("JO", "Jordan", "约旦", "+962", false, ["約旦"]),
  country("KZ", "Kazakhstan", "哈萨克斯坦", "+7", false, ["哈薩克"]),
  country("KE", "Kenya", "肯尼亚", "+254", false, ["肯亞"]),
  country("KW", "Kuwait", "科威特", "+965"),
  country("KG", "Kyrgyzstan", "吉尔吉斯斯坦", "+996", false, ["吉爾吉斯"]),
  country("LA", "Laos", "老挝", "+856", false, ["寮國"]),
  country("LV", "Latvia", "拉脱维亚", "+371", false, ["拉脫維亞"]),
  country("LB", "Lebanon", "黎巴嫩", "+961"),
  country("LY", "Libya", "利比亚", "+218", false, ["利比亞"]),
  country("LT", "Lithuania", "立陶宛", "+370"),
  country("LU", "Luxembourg", "卢森堡", "+352", false, ["盧森堡"]),
  country("MO", "Macao", "澳门", "+853", false, ["澳門"]),
  country("MG", "Madagascar", "马达加斯加", "+261", false, ["馬達加斯加"]),
  country("MW", "Malawi", "马拉维", "+265", false, ["馬拉維"]),
  country("MV", "Maldives", "马尔代夫", "+960", false, ["馬爾代夫"]),
  country("MT", "Malta", "马耳他", "+356", false, ["馬耳他"]),
  country("MX", "Mexico", "墨西哥", "+52"),
  country("MD", "Moldova", "摩尔多瓦", "+373", false, ["摩爾多瓦"]),
  country("MC", "Monaco", "摩纳哥", "+377", false, ["摩納哥"]),
  country("MN", "Mongolia", "蒙古", "+976"),
  country("ME", "Montenegro", "黑山", "+382"),
  country("MA", "Morocco", "摩洛哥", "+212"),
  country("MM", "Myanmar", "缅甸", "+95", false, ["緬甸"]),
  country("NP", "Nepal", "尼泊尔", "+977", false, ["尼泊爾"]),
  country("NL", "Netherlands", "荷兰", "+31", false, ["荷蘭"]),
  country("NZ", "New Zealand", "新西兰", "+64", false, ["紐西蘭"]),
  country("NG", "Nigeria", "尼日利亚", "+234", false, ["奈及利亞"]),
  country("MK", "North Macedonia", "北马其顿", "+389", false, ["北馬其頓"]),
  country("NO", "Norway", "挪威", "+47"),
  country("OM", "Oman", "阿曼", "+968"),
  country("PK", "Pakistan", "巴基斯坦", "+92"),
  country("PA", "Panama", "巴拿马", "+507", false, ["巴拿馬"]),
  country("PY", "Paraguay", "巴拉圭", "+595"),
  country("PE", "Peru", "秘鲁", "+51", false, ["秘魯"]),
  country("PL", "Poland", "波兰", "+48", false, ["波蘭"]),
  country("PT", "Portugal", "葡萄牙", "+351"),
  country("PR", "Puerto Rico", "波多黎各", "+1"),
  country("QA", "Qatar", "卡塔尔", "+974", false, ["卡達"]),
  country("RO", "Romania", "罗马尼亚", "+40", false, ["羅馬尼亞"]),
  country("RU", "Russia", "俄罗斯", "+7", false, ["俄羅斯"]),
  country("SA", "Saudi Arabia", "沙特阿拉伯", "+966", false, ["沙特"]),
  country("RS", "Serbia", "塞尔维亚", "+381", false, ["塞爾維亞"]),
  country("SC", "Seychelles", "塞舌尔", "+248", false, ["塞席爾"]),
  country("SL", "Sierra Leone", "塞拉利昂", "+232"),
  country("SK", "Slovakia", "斯洛伐克", "+421"),
  country("SI", "Slovenia", "斯洛文尼亚", "+386", false, ["斯洛維尼亞"]),
  country("ZA", "South Africa", "南非", "+27"),
  country("ES", "Spain", "西班牙", "+34"),
  country("LK", "Sri Lanka", "斯里兰卡", "+94"),
  country("SE", "Sweden", "瑞典", "+46"),
  country("CH", "Switzerland", "瑞士", "+41"),
  country("SY", "Syria", "叙利亚", "+963", false, ["敘利亞"]),
  country("TJ", "Tajikistan", "塔吉克斯坦", "+992", false, ["塔吉克"]),
  country("TZ", "Tanzania", "坦桑尼亚", "+255", false, ["坦尚尼亞"]),
  country("TL", "Timor-Leste", "东帝汶", "+670", false, ["東帝汶"]),
  country("TG", "Togo", "多哥", "+228"),
  country("TO", "Tonga", "汤加", "+676", false, ["東加"]),
  country("TT", "Trinidad and Tobago", "特立尼达和多巴哥", "+1", false, ["千里達"]),
  country("TN", "Tunisia", "突尼斯", "+216"),
  country("TR", "Turkey", "土耳其", "+90"),
  country("TM", "Turkmenistan", "土库曼斯坦", "+993", false, ["土庫曼"]),
  country("AE", "United Arab Emirates", "阿联酋", "+971", false, ["阿聯酋", "迪拜", "杜拜"]),
  country("UA", "Ukraine", "乌克兰", "+380", false, ["烏克蘭"]),
  country("UY", "Uruguay", "乌拉圭", "+598", false, ["烏拉圭"]),
  country("UZ", "Uzbekistan", "乌兹别克斯坦", "+998", false, ["烏茲別克"]),
  country("VE", "Venezuela", "委内瑞拉", "+58", false, ["委內瑞拉"]),
  country("YE", "Yemen", "也门", "+967", false, ["葉門"]),
  country("ZM", "Zambia", "赞比亚", "+260", false, ["尚比亞"]),
  country("ZW", "Zimbabwe", "津巴布韦", "+263", false, ["辛巴威"]),
];

export function countryDisplayName(country: CountryCallingCode, language: "en" | "zh") {
  return language === "zh" ? country.nameZh : country.name;
}

export function findCountryByIso2(iso2: string, dial?: string) {
  if (dial) {
    const exact = COUNTRY_CALLING_CODES.find((item) => item.iso2 === iso2 && item.dial === dial);
    if (exact) return exact;
  }
  return COUNTRY_CALLING_CODES.find((item) => item.iso2 === iso2) ?? COUNTRY_CALLING_CODES[0];
}

export function isKnownCountryCode(dial: string) {
  return COUNTRY_CALLING_CODES.some((item) => item.dial === dial);
}

export function combineInternationalPhone(countryCode: string, phoneNumber: string) {
  const local = phoneNumber.replace(/\D/g, "");
  if (!countryCode || !local) return "";
  return `${countryCode}${local}`;
}

/** Keep digits only. If the user pastes +66… while +66 is selected, drop the duplicated code. */
export function sanitizeLocalPhoneNumber(raw: string, countryCode: string) {
  const codeDigits = countryCode.replace(/\D/g, "");
  const hasPlus = raw.includes("+");
  let digits = raw.replace(/\D/g, "");
  if (hasPlus && codeDigits && digits.startsWith(codeDigits)) {
    digits = digits.slice(codeDigits.length);
  }
  return digits;
}

export function filterCountries(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRY_CALLING_CODES;
  const compact = q.replace(/^00/, "+").replace(/^\+/, "");
  return COUNTRY_CALLING_CODES.filter((item) => {
    const haystack = [item.name, item.nameZh, item.iso2, ...(item.aliases ?? [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q) || item.dial.includes(q) || item.dial.replace("+", "").includes(compact);
  });
}

/** Shown first in the Origins dropdown, in this order. */
export const PRIORITY_ORIGIN_COUNTRIES = [
  "Thailand",
  "Singapore",
  "Malaysia",
  "China",
  "Hong Kong",
  "Taiwan",
] as const;

export function originCountryValue(item: CountryCallingCode) {
  return item.name;
}

function originCountryHaystack(item: CountryCallingCode) {
  return [item.name, item.nameZh, item.iso2, ...(item.aliases ?? [])].join(" ").toLowerCase();
}

export function findOriginCountry(value: string) {
  const raw = value.trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  const countryPart = raw.includes(",") ? raw.slice(raw.lastIndexOf(",") + 1).trim() : raw;
  const countryLower = countryPart.toLowerCase();
  return COUNTRY_CALLING_CODES.find((item) => {
    return (
      item.name.toLowerCase() === lower ||
      item.name.toLowerCase() === countryLower ||
      item.nameZh === raw ||
      item.nameZh === countryPart ||
      item.iso2.toLowerCase() === lower ||
      (item.aliases ?? []).some((alias) => alias.toLowerCase() === lower || alias === countryPart)
    );
  });
}

export function isKnownOriginCountry(value: string) {
  return Boolean(findOriginCountry(value));
}

export function filterOriginCountries(query: string) {
  const q = query.trim().toLowerCase();
  const pinned = PRIORITY_ORIGIN_COUNTRIES.map((name) =>
    COUNTRY_CALLING_CODES.find((item) => item.name === name),
  ).filter((item): item is CountryCallingCode => Boolean(item));
  const rest = COUNTRY_CALLING_CODES.filter(
    (item) => !(PRIORITY_ORIGIN_COUNTRIES as readonly string[]).includes(item.name),
  ).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  if (!q) {
    return { pinned, rest, showDivider: pinned.length > 0 && rest.length > 0 };
  }

  const pinnedMatch = pinned.filter((item) => originCountryHaystack(item).includes(q));
  const restMatch = rest.filter((item) => originCountryHaystack(item).includes(q));
  return {
    pinned: pinnedMatch,
    rest: restMatch,
    showDivider: pinnedMatch.length > 0 && restMatch.length > 0,
  };
}

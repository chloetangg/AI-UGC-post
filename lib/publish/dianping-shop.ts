import { isMobileDevice } from "@/lib/rednote-publish";

/** Baan Ying (centralwOrld) only. Never a homepage, search page, or another branch. */
export const DIANPING_SHOP_UUID = "k9fdoJpGAdqK1XGc";

export const DIANPING_SHOP_WEB_URL =
  "https://m.dianping.com/shopinfo/k9fdoJpGAdqK1XGc?msource=Appshare2021&utm_source=shop_share&issilencelogin=0";

const DIANPING_SHOP_APP_SCHEME = `dianping://shopinfo?shopUuid=${DIANPING_SHOP_UUID}`;

export type OpenDianpingShopResult = "desktop" | "app" | "fallback";

function isAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "");
}

function openWebShop(target: "_self" | "_blank") {
  if (target === "_blank") {
    const opened = window.open(DIANPING_SHOP_WEB_URL, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(DIANPING_SHOP_WEB_URL);
    return;
  }
  window.location.assign(DIANPING_SHOP_WEB_URL);
}

function tryOpenAppScheme() {
  if (isAndroid()) {
    const intent = [
      `intent://shopinfo?shopUuid=${DIANPING_SHOP_UUID}`,
      "#Intent;",
      "scheme=dianping;",
      "package=com.dianping.v1;",
      `S.browser_fallback_url=${encodeURIComponent(DIANPING_SHOP_WEB_URL)};`,
      "end",
    ].join("");
    window.location.href = intent;
    return;
  }
  window.location.href = DIANPING_SHOP_APP_SCHEME;
}

/**
 * Open the Baan Ying (centralwOrld) Dianping shop page.
 * Desktop: official m.dianping.com shop URL.
 * Mobile: try the shop-specific app scheme, then the same official shop URL.
 */
export function openDianpingShop(): Promise<OpenDianpingShopResult> {
  if (typeof window === "undefined") return Promise.resolve("fallback");

  if (!isMobileDevice()) {
    openWebShop("_blank");
    return Promise.resolve("desktop");
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: OpenDianpingShopResult) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onHidden);
      resolve(result);
    };

    const onHidden = () => {
      if (document.hidden || document.visibilityState === "hidden") finish("app");
    };

    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onHidden);

    window.setTimeout(() => {
      if (document.hidden || document.visibilityState === "hidden") {
        finish("app");
        return;
      }
      openWebShop("_self");
      finish("fallback");
    }, 1200);

    try {
      tryOpenAppScheme();
    } catch {
      openWebShop("_self");
      finish("fallback");
    }
  });
}

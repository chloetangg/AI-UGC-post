import { getBranch } from "@/lib/branches/registry";
import { DeploymentMismatchError, getDeploymentConfig, isCurrentDeploymentRef } from "@/lib/deployment/config";
import { isMobileDevice } from "@/lib/rednote-publish";

/** centralwOrld shop. Other branches resolve their own shop id. */
export const DIANPING_SHOP_UUID = "k9fdoJpGAdqK1XGc";

const SHARE_QUERY = "msource=Appshare2021&utm_source=shop_share&issilencelogin=0";

export function dianpingShopWebUrl(shopId: string) {
  return `https://m.dianping.com/shopinfo/${shopId}?${SHARE_QUERY}`;
}

export function dianpingShopForCampaign(campaignOrBranchId?: string) {
  const deployment = getDeploymentConfig();
  if (campaignOrBranchId?.trim() && !isCurrentDeploymentRef(campaignOrBranchId)) {
    throw new DeploymentMismatchError(
      `Deployment ${deployment.deploymentId} cannot open another branch's Dianping shop`,
    );
  }
  const branch = getBranch(deployment.branchId);
  if (!branch?.dianpingShopId) {
    throw new DeploymentMismatchError(`Deployment ${deployment.deploymentId} has no Dianping shop`);
  }
  return { shopId: branch.dianpingShopId, webUrl: dianpingShopWebUrl(branch.dianpingShopId) };
}

export const DIANPING_SHOP_WEB_URL = dianpingShopWebUrl(DIANPING_SHOP_UUID);

export type OpenDianpingShopResult = "desktop" | "app" | "fallback";

function isAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "");
}

function openWebShop(webUrl: string, target: "_self" | "_blank") {
  if (target === "_blank") {
    const opened = window.open(webUrl, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(webUrl);
    return;
  }
  window.location.assign(webUrl);
}

function tryOpenAppScheme(shopId: string, webUrl: string) {
  if (isAndroid()) {
    const intent = [
      `intent://shopinfo?shopUuid=${shopId}`,
      "#Intent;",
      "scheme=dianping;",
      "package=com.dianping.v1;",
      `S.browser_fallback_url=${encodeURIComponent(webUrl)};`,
      "end",
    ].join("");
    window.location.href = intent;
    return;
  }
  window.location.href = `dianping://shopinfo?shopUuid=${shopId}`;
}

/**
 * Open this campaign's Dianping shop page.
 * Desktop: official m.dianping.com shop URL.
 * Mobile: try the shop-specific app scheme, then the same official shop URL.
 */
export function openDianpingShop(campaignOrBranchId?: string): Promise<OpenDianpingShopResult> {
  if (typeof window === "undefined") return Promise.resolve("fallback");
  const shop = dianpingShopForCampaign(campaignOrBranchId);

  if (!isMobileDevice()) {
    openWebShop(shop.webUrl, "_blank");
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
      openWebShop(shop.webUrl, "_self");
      finish("fallback");
    }, 1200);

    try {
      tryOpenAppScheme(shop.shopId, shop.webUrl);
    } catch {
      openWebShop(shop.webUrl, "_self");
      finish("fallback");
    }
  });
}

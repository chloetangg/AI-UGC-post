import { DeploymentMismatchError, getDeploymentConfig } from "@/lib/deployment/config";
import { OFFICIAL_LOCATIONS } from "@/lib/locations";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Final text may contain only this deployment's mall, floor, and hours. */
export function assertDeploymentOutput(text: string) {
  const deployment = getDeploymentConfig();
  const own = OFFICIAL_LOCATIONS[deployment.locationId];
  for (const location of Object.values(OFFICIAL_LOCATIONS)) {
    if (location.id === own.id) continue;
    const english =
      location.id === "centralworld" ? /central\s*world/i : new RegExp(escapeRegExp(location.englishName), "i");
    if (english.test(text)) {
      throw new DeploymentMismatchError(
        `Deployment ${deployment.deploymentId} output includes ${location.englishName}`,
      );
    }
    if (location.chineseName && text.includes(location.chineseName)) {
      throw new DeploymentMismatchError(
        `Deployment ${deployment.deploymentId} output includes ${location.chineseName}`,
      );
    }
    if (location.hoursDisplay !== own.hoursDisplay && text.includes(location.hoursDisplay)) {
      throw new DeploymentMismatchError(
        `Deployment ${deployment.deploymentId} output includes another branch's hours`,
      );
    }
    if (location.floorZh !== own.floorZh && text.includes(location.floorZh)) {
      throw new DeploymentMismatchError(
        `Deployment ${deployment.deploymentId} output includes another branch's floor`,
      );
    }
  }
}

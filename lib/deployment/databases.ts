/**
 * Dashboard-only map from a branch to its own MongoDB database.
 * Consumer writes never use this map. They use the current deployment env.
 */
export const CENTRALWORLD_DB_NAME = "baan-ying-centralworld";
/** Previous centralwOrld database. Reads and writes now use CENTRALWORLD_DB_NAME. */
export const LEGACY_CENTRALWORLD_DB_NAME = "baan-ying";

export const DASHBOARD_BRANCHES = [
  {
    id: "baan-ying-centralworld",
    name: "centralwOrld",
    dbName: CENTRALWORLD_DB_NAME,
  },
  {
    id: "baan-ying-siam-center",
    name: "Siam Center",
    dbName: "baan-ying-siam-center",
  },
] as const;

export type DashboardBranchId = (typeof DASHBOARD_BRANCHES)[number]["id"];

export function dashboardBranchById(id: string) {
  return DASHBOARD_BRANCHES.find((branch) => branch.id === id) ?? null;
}

export function isDashboardDatabaseName(dbName: string) {
  return DASHBOARD_BRANCHES.some((branch) => branch.dbName === dbName);
}

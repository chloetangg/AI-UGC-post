import { setDefaultResultOrder } from "node:dns";
import { MongoClient, type Db } from "mongodb";
import { getDeploymentConfig } from "@/lib/deployment/config";
import {
  CENTRALWORLD_DB_NAME,
  LEGACY_CENTRALWORLD_DB_NAME,
  isDashboardDatabaseName,
} from "@/lib/deployment/databases";

try {
  setDefaultResultOrder("ipv4first");
} catch {
  /* older Node */
}

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClient?: MongoClient;
  _mongoClientPromise?: Promise<MongoClient>;
};

function mongodbUri() {
  const uri = process.env.MONGODB_URI?.trim() || process.env.DATABASE_URL?.trim();
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }
  return uri;
}

/** Database name comes only from this deployment's environment, never from a branch id. */
export function resolveMongoDbName() {
  const deployment = getDeploymentConfig();
  const configured = process.env.MONGODB_DB_NAME?.trim() || "";
  if (deployment.deploymentId !== "baan-ying-centralworld") {
    if (
      !configured ||
      configured === LEGACY_CENTRALWORLD_DB_NAME ||
      configured === CENTRALWORLD_DB_NAME
    ) {
      throw new Error(
        `${deployment.deploymentId} requires its own MONGODB_DB_NAME and cannot use the centralwOrld database ${CENTRALWORLD_DB_NAME}`,
      );
    }
    return configured;
  }
  if (!configured || configured === LEGACY_CENTRALWORLD_DB_NAME) {
    return CENTRALWORLD_DB_NAME;
  }
  return configured;
}

function createClient() {
  return new MongoClient(mongodbUri(), {
    tls: true,
    serverSelectionTimeoutMS: 20_000,
    connectTimeoutMS: 20_000,
    socketTimeoutMS: 20_000,
    maxPoolSize: 5,
  });
}

async function getClient() {
  if (globalForMongo._mongoClient) return globalForMongo._mongoClient;
  if (!globalForMongo._mongoClientPromise) {
    globalForMongo._mongoClientPromise = createClient()
      .connect()
      .then((connected) => {
        globalForMongo._mongoClient = connected;
        return connected;
      })
      .catch((error) => {
        globalForMongo._mongoClientPromise = undefined;
        throw error;
      });
  }
  return globalForMongo._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(resolveMongoDbName());
}

/** Read a branch database by allowlisted name. Writes stay on getDb(). */
export async function getNamedDb(dbName: string): Promise<Db> {
  if (!isDashboardDatabaseName(dbName)) {
    throw new Error("Unknown branch database");
  }
  const client = await getClient();
  return client.db(dbName);
}

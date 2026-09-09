import { setDefaultResultOrder } from "node:dns";
import { MongoClient, type Db } from "mongodb";

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
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }
  return uri;
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
  return client.db(process.env.MONGODB_DB_NAME?.trim() || "baan-ying");
}

import { MongoClient, type Db } from "mongodb";

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

async function getClient() {
  if (globalForMongo._mongoClient) return globalForMongo._mongoClient;
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(mongodbUri());
    globalForMongo._mongoClientPromise = client.connect().then((connected) => {
      globalForMongo._mongoClient = connected;
      return connected;
    });
  }
  return globalForMongo._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB_NAME?.trim() || "baan-ying");
}

import { MongoClient } from 'mongodb';

let client = null;

const getClient = async () => {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
  }
  return client;
};

const connectDB = async () => {
  const c = await getClient();
  return c.db(process.env.DATABASE_NAME);
};

const closeDB = async () => {
  if (client) {
    await client.close();
    client = null;
  }
};

export { connectDB, closeDB };

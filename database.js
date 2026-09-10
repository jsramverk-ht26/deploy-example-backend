import { MongoClient } from 'mongodb';

const connectDB = async () => {
  try {
    let dbURI = process.env.MONGODB_URI;

    // if (process.env.NODE_ENV === "test") {
    //   dbURI = process.env.MONGODB_TEST_URI;
    // }

    const client = new MongoClient(dbURI);
    await client.connect();
    return client.db(process.env.DATABASE_NAME);
  } catch (error) {
    console.error('connection failed:', error);
    process.exit(1);
  }
};

export { connectDB};

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';

dotenv.config();

const courses = JSON.parse(readFileSync('./courses.json', 'utf-8'));

const client = new MongoClient(process.env.MONGODB_URI);

try {
    await client.connect();
    const db = client.db(process.env.DATABASE_NAME);
    const collection = db.collection('courses');

    await collection.deleteMany({});
    const result = await collection.insertMany(courses);

    console.log(`Seeded ${result.insertedCount} courses into '${process.env.DATABASE_NAME}'`);
} finally {
    await client.close();
}

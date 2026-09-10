import express from 'express';
import { ObjectId } from 'mongodb';
import { connectDB } from './database.js';

const router = express.Router();

// collection name
const COLL_NAME = "courses";

// GET
router.get('/courses', async (req, res) => {
  try {
    const db = await connectDB();
    const courses = await db.collection(COLL_NAME).find({}).toArray();
    console.log("GET ok");

    res.json(courses);
  }
  catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET :id
router.get('/courses/:id', async (req, res) => {
  try {
    const db = await connectDB();

    const course = await db.collection(COLL_NAME)
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!course) {
      return res.status(404).json({ error: 'oops, the course could not be found' });
    }
    console.info(`GET /api/courses/:id -> ${req.params.id} ok`);

    res.json(course);
  }
  catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST
router.post('/courses', async (req, res) => {
  try {
    const db = await connectDB();
    const result = await db.collection(COLL_NAME)
      .insertOne(req.body);

    res.status(201).json({
      _id: result.insertedId,
      ...req.body
    });
  }
  catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT
router.put('/courses/:id', async (req, res) => {
  try {
    const db = await connectDB();
    const result = await db.collection(COLL_NAME)
      .updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'course not found', id: req.params.id });
    }

    res.json({ message: 'PUT ok' });
  }
  catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH
router.patch('/courses/:id', async (req, res) => {
  try {
    const db = await connectDB();
    const result = await db.collection(COLL_NAME)
      .updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'course not found' });
    }

    res.json({ message: 'PATCH ok' });
  }
  catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE
router.delete('/courses/:id', async (req, res) => {
  try {
    const db = await connectDB();
    const result = await db.collection(COLL_NAME)
      .deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'course not found' });
    }

    res.json({ message: 'DELETE ok ' });
  }
  catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

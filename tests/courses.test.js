import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import app from '../app.js'
import { connectDB, closeDB } from '../database.js'

let mongod

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongod.getUri()
  process.env.DATABASE_NAME = 'jsramverk_test'

  // Seed med kursdata så att testerna har något att arbeta med
  const courses = JSON.parse(readFileSync('./courses.json', 'utf-8'))
  const db = await connectDB()
  await db.collection('courses').insertMany(courses)
})

afterAll(async () => {
  await closeDB()
  await mongod.stop()
})

describe('GET /api/courses', () => {
  it('svarar med 200 och en array med kurser', async () => {
    const res = await request(app).get('/api/courses').expect(200)
    expect(res.body).toBeInstanceOf(Array)
    expect(res.body.length).toBeGreaterThan(0)
  })
})

describe('POST /api/courses', () => {
  it('skapar en kurs och svarar med 201', async () => {
    const res = await request(app)
      .post('/api/courses')
      .send({ courseCode: 'TEST101', courseName: 'Testkurs', points: 7.5 })
      .expect(201)

    expect(res.body).toHaveProperty('_id')
    expect(res.body.courseName).toBe('Testkurs')
  })
})

describe('DELETE /api/courses/:id', () => {
  it('tar bort en kurs och svarar med 200', async () => {
    const created = await request(app)
      .post('/api/courses')
      .send({ courseCode: 'DEL101', courseName: 'Att ta bort' })
      .expect(201)

    await request(app)
      .delete(`/api/courses/${created.body._id}`)
      .expect(200)
  })
})

describe('CORS', () => {
  it('skickar Access-Control-Allow-Origin så att webbläsare släpps in', async () => {
    const res = await request(app)
      .get('/api/courses')
      .set('Origin', 'https://jsramverk-ht26.github.io')
      .expect(200)

    expect(res.headers['access-control-allow-origin']).toBe('*')
  })
})

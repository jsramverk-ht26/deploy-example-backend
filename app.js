import dotenv from 'dotenv';

dotenv.config();

import express from 'express';
import routes from './routes.js';

const app = express();

app.use(express.json());
app.use(express.static('public'));
app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ message: 'Simple mongodb api' });
});

export default app;

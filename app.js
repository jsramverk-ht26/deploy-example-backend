import dotenv from 'dotenv';

dotenv.config();

import express from 'express';
import routes from './routes.js';

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Simple mongodb api' });
});

// Start server
const startServer = async () => {
  const PORT = process.env.PORT || 3000;

  return app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

const server = await startServer();

export default server;

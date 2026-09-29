import dotenv from 'dotenv';

dotenv.config();

import express from 'express';
import cors from 'cors';
import routes from './routes.js';

const app = express();

// CORS — låter webbläsare på andra domäner anropa API:t.
//
// Utan detta blockerar webbläsaren svaret när frontenden ligger någon
// annanstans än API:t, t.ex. en SPA på GitHub Pages:
//
//   Frontend: https://jsramverk-ht26.github.io
//   Backend:  https://dv1677-picard.nplab.bth.se   <- annan origin
//
// Observera att det är WEBBLÄSAREN som blockerar, inte servern. Ett API utan
// CORS svarar alldeles utmärkt på curl och i Postman — felet syns först när
// en webbsida försöker hämta data.
//
// cors() utan argument tillåter alla origins. Det är enklast under kursen.
// Vill ni snäva in det till bara er egen frontend:
//
//   app.use(cors({ origin: 'https://jsramverk-ht26.github.io' }));
//
app.use(cors());

app.use(express.json());
app.use(express.static('public'));
app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ message: 'Simple mongodb api' });
});

export default app;

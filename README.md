# deploy-example-backend

Exempelrepo för driftsättning av en Express + MongoDB-backend med Docker och GitHub Actions.
Används som referens i kursen DV1677 HT26, vecka 3.

---

## Innehåll

- [Lokal utveckling](#lokal-utveckling)
- [Testning](#testning)
- [Driftsättning — steg för steg](#driftsättning--steg-för-steg)
  - [1. Dockerfile](#1-dockerfile)
  - [2. docker-compose.yml](#2-docker-composeyml)
  - [3. GitHub Actions — CI och Deploy](#3-github-actions--ci-och-deploy)
  - [4. GitHub Secrets](#4-github-secrets)
  - [5. VPS — Docker och Caddy](#5-vps--docker-och-caddy)
  - [6. ghcr.io — publik eller privat image](#6-ghcrio--publik-eller-privat-image)
- [Seed-data](#seed-data)
- [Databas — åtkomst och hantering](#databas--åtkomst-och-hantering)
- [Vanliga problem](#vanliga-problem)

---

## Lokal utveckling

```bash
git clone <repo-url>
cd deploy-example-backend
cp .env.example .env   # fyll i MONGODB_URI
npm install
```

**Alternativ A — lokal MongoDB via Docker:**
```bash
docker compose -f docker-compose.yml up -d mongodb
npm run dev
```

**Alternativ B — MongoDB Atlas:**
Sätt `MONGODB_URI` i `.env` till din Atlas-anslutningssträng.

Seed-data (valfritt):
```bash
npm run seed
```

---

## Testning

```bash
npm test
```

> Första körningen laddar ner en `mongod`-binär till `node_modules/.cache/`. Det tar
> en stund — men bara den första gången. Kör `npm test` en gång i lugn och ro innan
> du behöver det skarpt.

Tre bibliotek används:

| Bibliotek | Roll |
|-----------|------|
| **Vitest** | Testkörare — hittar och kör testerna, rapporterar resultat |
| **Supertest** | Skickar HTTP-anrop mot Express-appen utan att starta en riktig server |
| **mongodb-memory-server** | Startar en riktig MongoDB i minnet, som försvinner när testerna är klara |

Alla tre ligger i `devDependencies` och följer därför inte med till produktion —
Dockerfilen installerar med `npm ci --omit=dev`.

> **Har ni redan en backend från vecka 3?** Då räcker det inte att lägga till en
> testfil — fyra av era befintliga filer behöver ändras först. Hoppa till
> [Lägga till tester i ett befintligt projekt](#lägga-till-tester-i-ett-befintligt-projekt)
> för en checklista med vad och varför.

### Förutsättning: `app.js` och `server.js` är separerade

Supertest behöver *app-objektet*, inte en server som redan lyssnar på en port.
Därför är de två sakerna delade i två filer:

**`app.js`** bygger Express-appen och exporterar den:
```js
const app = express()
app.use(express.json())
app.use('/api', routes)

export default app
```

**`server.js`** är det enda stället som startar servern:
```js
import app from './app.js'

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
```

Testerna importerar `app.js` och rör aldrig `server.js`. Ligger allt i en fil startar
en server varje gång testerna körs, portar krockar, och testkörningen hänger sig i
stället för att avslutas.

### Testdatabasen

Testerna kör mot en MongoDB som startas i minnet — **aldrig mot er riktiga databas**.
Uppsättningen ligger i `tests/courses.test.js`:

```js
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
```

Två detaljer är värda att förstå, för det är här det brukar gå fel när man bygger
samma sak själv:

1. **`MONGODB_URI` sätts innan `connectDB()` anropas.** `database.js` läser
   miljövariabeln när funktionen *anropas*, inte när modulen importeras. Läste den
   vid import skulle överskrivningen i `beforeAll` komma för sent och testerna
   ansluta till fel databas.
2. **Databasen startar tom och seedas med `courses.json`** — samma fil som
   `npm run seed` använder. Utan seeden hade GET-testets
   `expect(res.body.length).toBeGreaterThan(0)` fallerat, eftersom det inte finns
   någon kursdata att hämta.

`afterAll` stänger MongoClient och river in-memory-servern. Glöms det bort avslutas
inte testkörningen — den blir hängande med en öppen anslutning.

### Vad som testas

| Test | Kontrollerar |
|------|--------------|
| `GET /api/courses` | Svarar 200 och returnerar en array med kurser |
| `POST /api/courses` | Skapar en kurs, svarar 201, svaret har `_id` och rätt `courseName` |
| `DELETE /api/courses/:id` | Skapar en kurs, tar bort den, svarar 200 |

DELETE-testet skapar sin egen kurs i stället för att ta en ur seed-datan. Det gör
testet oberoende av vilken ordning testerna körs i — ett test ska aldrig förutsätta
att ett annat test kört först.

### Testerna i CI

Testerna körs automatiskt på två ställen:

- **`ci.yml`** — vid varje push och pull request. Röda tester syns direkt i PR:en.
- **`deploy.yml`** — deploy-jobbet har `needs: test`, vilket gör testerna till en
  grindvakt. Faller ett test driftsätts ingenting.

Det är hela poängen med kedjan: trasig kod ska stoppas innan den når VPS:en, inte
upptäckas av en användare efteråt.

### Skriva egna tester

Lägg dem i `tests/` med filändelsen `.test.js` — Vitest hittar dem automatiskt,
ingen konfigurationsfil behövs. Läser testet befintlig data måste du seeda i
`beforeAll` först, annars testar du mot en tom databas.

---

### Lägga till tester i ett befintligt projekt

Har ni byggt er backend under vecka 3 behöver fyra befintliga filer ändras innan
den första testfilen kan köras. Det går inte att hoppa över något av stegen —
varje ändring löser ett konkret problem som annars stoppar testkörningen.

| Fil | Ändring | Varför |
|-----|---------|--------|
| `app.js` | Ta bort `app.listen()` och exportera appen i stället | Supertest behöver app-objektet. Startar filen en server vid import startas en ny server varje testkörning, portar krockar och körningen hänger |
| `server.js` | **Ny fil** — importerar appen och startar servern | Serverstarten måste bo någonstans. Nu finns exakt ett ställe som lyssnar på en port, och testerna rör det aldrig |
| `database.js` | Återanvänd en klient och lägg till `closeDB()` | Utan `closeDB()` avslutas aldrig testkörningen — anslutningen står öppen. Klienten får inte heller skapas vid import, eftersom testerna sätter `MONGODB_URI` först i `beforeAll` |
| `package.json` | Byt testverktyg och peka scripten mot `server.js` | Startrepot har kvar ett gammalt `test`-script. `start` och `dev` måste peka på `server.js`, annars startas ingen server i produktion |
| `.github/workflows/ci.yml` | Lägg till ett `test`-jobb | Annars körs testerna aldrig automatiskt och röda tester syns inte i pull requesten |
| `.github/workflows/deploy.yml` | Lägg till `test`-jobb + `needs: test` på deploy-jobbet | Utan grindvakten driftsätts trasig kod |

**1. `app.js` — före och efter**

```js
// FÖRE — appen startar sig själv vid import
const startServer = async () => {
  const PORT = process.env.PORT || 3000;
  return app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};
const server = await startServer();
export default server;
```

```js
// EFTER — appen exporteras, ingen server startas
export default app;
```

**2. `server.js` — ny fil**

```js
import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**3. `database.js` — spara klienten och gör den stängbar**

```js
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
```

Notera att `process.env.MONGODB_URI` läses inuti funktionen. Läses den på modulnivå
i stället plockas värdet upp vid import — alltså innan `beforeAll` hunnit peka om
den till testdatabasen — och testerna kör mot fel databas.

Ett annat mönster som fungerar dåligt i tester är `process.exit(1)` vid
anslutningsfel: det dödar hela testkörningen i stället för att låta testet
rapportera ett fel. Låt felet bubbla upp.

**4. `package.json` — byt testverktyg**

```bash
npm uninstall mocha chai chai-http nyc     # om ni har kvar dem från startrepot
npm install --save-dev vitest supertest mongodb-memory-server
```

```diff
- "main": "app.js",
+ "main": "server.js",
  "scripts": {
-   "start": "node app.js",
-   "dev": "nodemon app.js",
-   "test": "mocha --exit ...",
+   "start": "node server.js",
+   "dev": "nodemon server.js",
+   "test": "vitest run",
    "seed": "node seed.js"
  }
```

**Glöm inte Dockerfilen.** Det här är det lättaste misstaget att göra i hela
omställningen, och det märks inte förrän i produktion:

```diff
- CMD ["node", "app.js"]
+ CMD ["node", "server.js"]
```

Står `app.js` kvar bygger containern appen, hittar inget som lyssnar på en port,
och avslutar direkt med kod 0. Testerna blir gröna, CI blir grön, imagen byggs och
pushas utan problem — och sajten går ner vid nästa deploy. Kontrollera `Dockerfile`
och `docker-compose.yml` innan ni mergar, inte efteråt.

**5. Verifiera innan ni går vidare**

```bash
npm test          # ska ge gröna tester
npm run dev       # servern ska fortfarande starta som vanligt
```

Fungerar båda är omställningen klar, och ni kan lägga till era egna tester.

---

## Driftsättning — steg för steg

### 1. Dockerfile

Lägg till `Dockerfile` i roten av ert backend-repo:

```dockerfile
# Basimage — Node 22 på Alpine Linux (liten och säker)
FROM node:22-alpine

# Arbetsmapp inuti containern — alla filer hamnar här
WORKDIR /app

# Kopiera bara package-filer först (utnyttjar Docker-cache effektivt)
COPY package*.json ./

# Installera beroenden exakt enligt package-lock.json (reproducerbart bygge).
# --omit=dev utesluter devDependencies (t.ex. nodemon, testbibliotek) — de behövs
# inte i produktion och gör imagen onödigt stor.
# OBS: npm ci kräver att package-lock.json finns i repot — ta bort den från .gitignore om den ligger där.
RUN npm ci --omit=dev

# Kopiera resten av källkoden
COPY . .

# Dokumenterar vilken port appen lyssnar på (kopplas i docker-compose.yml)
EXPOSE 3000

# Kommandot som körs när containern startar — peka på filen som faktiskt
# startar servern. Efter att app.js och server.js separerats är det server.js;
# `node app.js` skulle bara bygga appen och sedan avsluta, utan att lyssna.
CMD ["node", "server.js"]
```

> **OBS:** `package-lock.json` får **inte** finnas i `.gitignore` — `npm ci` kräver den.

Lägg också till `.dockerignore`:
```
node_modules
.env
.git
.github
```

---

### 2. docker-compose.yml

Används på VPS:en för att köra appen och databasen som containers.

```yaml
services:
  app:
    image: ghcr.io/<ditt-github-namn>/<repo-namn>:latest
    container_name: <repo-namn>
    ports:
      - '3000:3000'
    environment:
      # Läses från .env-fil på VPS (sätts av deploy.yml via GitHub Secret)
      # Fallback: mongodb://mongodb:27017 om secret saknas
      - MONGODB_URI=${MONGODB_URI:-mongodb://mongodb:27017}
      - DATABASE_NAME=jsramverk
    depends_on:
      - mongodb
    restart: always

  mongodb:
    image: mongo:latest
    container_name: mongodb
    volumes:
      - mongodb_data:/data/db
    restart: always

volumes:
  mongodb_data:
```

> **OBS:** MongoDB-porten (27017) ska **inte** mappas mot hosten (`ports: 27017:27017`).
> Appen når databasen via det interna Docker-nätverket med tjänstnamnet `mongodb`.
> Om port 27017 redan används av en nativ MongoDB-installation på servern kraschar containern.

---

### 3. GitHub Actions — CI och Deploy

Skapa mappen `.github/workflows/` i ert repo och lägg till två filer:

**`.github/workflows/ci.yml`** — körs vid varje push och PR:

```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Bygg Docker-image
        run: docker build -t <repo-namn> .

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm test
```

> De två jobben körs parallellt och oberoende av varandra — imagen kan byggas även
> om ett test faller, och tvärtom. Båda syns som separata checkar i pull requesten.

**`.github/workflows/deploy.yml`** — körs vid push till `main`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm test

  deploy:
    runs-on: ubuntu-latest
    needs: test          # deployar bara om testjobbet blev grönt

    steps:
      - uses: actions/checkout@v4

      - name: Logga in på ghcr.io
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Bygg och pusha image till ghcr.io
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/<ditt-github-namn>/<repo-namn>:latest

      - name: Kopiera docker-compose.yml till VPS
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          source: docker-compose.yml
          target: ~/<repo-namn>/

      - name: Deploya till VPS via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd ~/<repo-namn>

            # Alternativ A: imagen är publik — ingen inloggning behövs
            # Alternativ B: imagen är privat — kommentera bort raden nedan
            # echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin

            docker compose pull
            docker compose down
            docker compose up -d
```

> Byt ut `<ditt-github-namn>` och `<repo-namn>` mot era egna värden.

---

### 4. GitHub Secrets

Gå till: **ert repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Värde |
|--------|-------|
| `VPS_HOST` | IP-adressen till er VPS |
| `VPS_USER` | `ubuntu` |
| `VPS_SSH_KEY` | Hela innehållet i er privata deploy-nyckel — se nedan |
| `MONGODB_URI` | Anslutningssträng till databasen — se alternativ nedan |

`GITHUB_TOKEN` skapas automatiskt — ni behöver inte lägga till den.

**MONGODB_URI — två alternativ:**

*Alternativ A — MongoDB Atlas (rekommenderas):*
```
mongodb+srv://<användare>:<lösenord>@cluster0.xxxxx.mongodb.net/<databasnamn>
```
Hämta strängen från Atlas: Database → Connect → Drivers. Byt ut `<password>` mot ditt lösenord.

*Alternativ B — MongoDB som Docker-container på VPS:*
```
mongodb://mongodb:27017
```
`mongodb` är tjänstnamnet i `docker-compose.yml` — appen når containern via det interna Docker-nätverket.

> `MONGODB_URI` injiceras automatiskt av deploy-workflowet via en `.env`-fil på VPS:en. Ni behöver inte (och ska inte) skriva den i `docker-compose.yml` i klartext.

**Deploy-nyckel — generera ett nyckelpar:**
```bash
ssh-keygen -t ed25519 -C "deploy-key" -f deploy_key
```
Tryck Enter på frågan om lösenfras — lämna den tom. En nyckel med lösenord kan inte
användas av Actions utan extra konfiguration.

Kommandot ger två filer, och de ska till varsitt ställe:

- `deploy_key.pub` (publik) → läggs till på VPS i `~/.ssh/authorized_keys`
- `deploy_key` (privat) → läggs in som GitHub Secret `VPS_SSH_KEY`

*Publika nyckeln* är en enda rad (`ssh-ed25519 AAAA... deploy-key`) och hela raden
ska med. Använd `>>` och inte `>` när ni lägger till den — annars skriver ni över
era egna inloggningsnycklar och låser ut er:
```bash
ssh-copy-id -i deploy_key.pub ubuntu@<er-vps-ip>
```

*Privata nyckeln* — **hela filens innehåll ska kopieras in i secreten**. Det vill
säga raden `-----BEGIN OPENSSH PRIVATE KEY-----`, alla rader däremellan, raden
`-----END OPENSSH PRIVATE KEY-----` och radbrytningen sist. Inga citattecken runt,
ingen rad borttagen, inga radbrytningar hopslagna:

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gt
...
-----END OPENSSH PRIVATE KEY-----
```

Kopiera via urklipp i stället för att markera i terminalen — musmarkering är den
vanligaste orsaken till att radbrytningar går sönder:
```bash
pbcopy < deploy_key                        # macOS
wl-copy < deploy_key                       # Linux (Wayland)
xclip -selection clipboard < deploy_key    # Linux (X11)
```

- Lägg till `deploy_key` i `.gitignore` — **committa aldrig den privata nyckeln**.
  Den publika (`deploy_key.pub`) är ofarlig och behöver inte ignoreras.

> Misslyckas deploy-steget med `ssh: no key found` eller `handshake failed` är det
> nästan alltid secreten: en saknad BEGIN- eller END-rad, en tappad radbrytning,
> eller att den publika nyckeln råkat hamna i secreten i stället för den privata.

---

### 5. VPS — Docker och Caddy

**Installera Docker** (körs en gång på servern):
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
```

**Installera Caddy:**
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

**Konfigurera Caddyfile** — öppna filen och ersätt innehållet:
```bash
sudo nano /etc/caddy/Caddyfile
```

Innehållet ska se ut så här (byt ut mot ert VPS-namn och er port):
```
ert-vps-namn.nplab.bth.se {
    reverse_proxy localhost:3000
}
```

**Starta Caddy** (nginx måste stoppas först — det kör på port 80 som standard):
```bash
sudo systemctl stop nginx
sudo systemctl start caddy
```

**Ladda om Caddyfile efter ändringar** (utan att starta om):
```bash
sudo systemctl reload caddy
```

**Verifiera att Caddy körs:**
```bash
sudo systemctl status caddy
```

**Se Caddy-loggar** (om något går fel):
```bash
sudo journalctl -u caddy -n 50
```

Caddy hämtar SSL-certifikat automatiskt via Let's Encrypt — HTTPS fungerar direkt utan manuell konfiguration.

---

### 6. ghcr.io — publik eller privat image

**Alternativ A — publik image (enklast):**
GitHub → er profil → Packages → välj paketet → Package settings → Change visibility → Public

VPS:en kan då pulla utan inloggning.

**Alternativ B — privat image:**
Lägg till docker-login i deploy.yml:s SSH-script:
```bash
echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
```

---

## Seed-data

Ladda in exempeldata i databasen (körs efter att containern är igång):

```bash
# Lokalt
npm run seed

# På VPS — kör inuti containern
docker exec <container-namn> node seed.js
```

---

## Databas — åtkomst och hantering

MongoDB-porten är inte exponerad mot hosten. För att nå databasen finns två sätt:

---

### Alternativ A — mongosh direkt inuti containern på VPS

Logga in på VPS:en och kör mongosh inuti MongoDB-containern:

```bash
ssh ubuntu@<vps-ip>
docker exec -it mongodb mongosh
```

Inuti mongosh — välj databas och lista collections:
```js
use jsramverk
db.getCollectionNames()
db.courses.find().limit(5)
```

Anslutningssträngen (om du vill ange den explicit):
```bash
docker exec -it mongodb mongosh "mongodb://localhost:27017/jsramverk"
```

---

### Alternativ B — MongoDB Compass via SSH-tunnel

Öppna en SSH-tunnel i en terminal (lämna den öppen):
```bash
ssh -L 27017:localhost:27017 ubuntu@<vps-ip>
```

Öppna sedan Compass och anslut med:
```
mongodb://localhost:27017
```

Eller med databas direkt:
```
mongodb://localhost:27017/jsramverk
```

Tunneln vidarebefordrar din lokala port 27017 till MongoDB-containerns port 27017 inne på servern — Compass ser det som en lokal databas.

---

## Vanliga problem

| Problem | Orsak | Lösning |
|---------|-------|---------|
| `npm ci` felar i Docker-bygget | `package-lock.json` i `.gitignore` | Ta bort raden och committa lock-filen |
| Port 27017 redan i bruk | Nativ MongoDB körs på servern | Ta inte med `ports: 27017:27017` i docker-compose.yml |
| `docker compose up` felar vid omdeploy | Gamla containers blockerar | Kör `docker compose down` innan `up` |
| VPS kan inte pulla imagen | Privat image, ej inloggad | Gör imagen publik eller lägg till docker login i deploy-scriptet |
| Actions får inte pusha till ghcr.io | Fel workflow-behörigheter | Settings → Actions → General → Workflow permissions → Read and write |
| Caddy startar inte | Port 80 används av nginx | Kör `sudo systemctl stop nginx` innan `sudo systemctl start caddy` |
| `npm test` tar väldigt lång tid första gången | `mongodb-memory-server` laddar ner en mongod-binär | Normalt — kör en gång innan du behöver det skarpt, sedan cachas den |
| Testkörningen avslutas aldrig | `closeDB()` eller `mongod.stop()` saknas i `afterAll` | Städa upp anslutningen när testerna är klara |
| GET-testet får en tom array | Databasen seedas inte i `beforeAll` | Läs in `courses.json` och `insertMany` innan testerna kör |
| Portkrock när testerna startar | `app.listen()` ligger i `app.js` | Flytta serverstarten till `server.js` — testerna ska bara importera appen |
| Containern startar och dör direkt efter deploy | `CMD` i Dockerfile pekar på `app.js`, som inte längre startar någon server | Ändra till `CMD ["node", "server.js"]` |

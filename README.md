# deploy-example-backend

Exempelrepo för driftsättning av en Express + MongoDB-backend med Docker och GitHub Actions.
Används som referens i kursen DV1677 HT26, vecka 3.

---

## Innehåll

- [Lokal utveckling](#lokal-utveckling)
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

# Installera bara produktionsberoenden (inga devDependencies)
RUN npm ci --omit=dev

# Kopiera resten av källkoden
COPY . .

# Dokumenterar vilken port appen lyssnar på (kopplas i docker-compose.yml)
EXPOSE 3000

# Kommandot som körs när containern startar
CMD ["node", "app.js"]
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
```

**`.github/workflows/deploy.yml`** — körs vid push till `main`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
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
| `VPS_SSH_KEY` | Hela innehållet i er privata deploy-nyckel |
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
- `deploy_key.pub` → lägg in på VPS i `~/.ssh/authorized_keys`
- `deploy_key` → lägg in som GitHub Secret `VPS_SSH_KEY`
- Lägg till `deploy_key` i `.gitignore` — **committa aldrig den privata nyckeln**

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

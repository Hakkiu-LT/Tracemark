# HAKKIU — Production Deployment (Hetzner)

Full runbook for deploying the whole monorepo to the Hetzner CCX13 server, behind
Caddy with automatic HTTPS, and wiring GitHub Actions for automatic deploys.

- **Server:** Hetzner CCX13 (2 vCPU / 8 GB / 80 GB), Ubuntu, IP `116.202.8.87`
- **Domain:** `hakkiu.com`
- **Database:** Supabase (external, hosted) — nothing DB-related runs on the server.

```
Internet ──443──▶ Caddy (auto TLS) ──▶ 4 containers on an internal docker network
                    hakkiu.com          frontend:8080  (customer app, workerd via wrangler)
                    admin.hakkiu.com    admin:8082      (admin SPA, nginx)
                    api.hakkiu.com      api:8000        (main API — scraping/AI)
                    admin-api.hakkiu.com admin-api:8001 (admin API)
```

> **Legend:** 🖥️ = run on the server · 💻 = run locally / in a browser · 🔒 = handles secrets.

---

## Environments

There are exactly **two** environments — decided purely by which `.env` is loaded,
never by a code change:

| Environment | Where | Notes |
|---|---|---|
| **Test / sandbox** | local machine (uvicorn + `vite dev`) | day-to-day development |
| **Production** | Hetzner server | real customers |

The business model is book-a-demo (no self-serve billing), so there are no payment
keys to manage — only Supabase, AI/scraping providers, and the shared internal secret.

---

## 0. Prerequisites (once)

- [ ] SSH access to the server as `root` (Hetzner emails the root password, or use an SSH key added at creation).
- [ ] Domain `hakkiu.com` with editable DNS.
- [ ] All production secrets ready (Supabase service-role key, Gemini, Firecrawl, Meta, etc.).
- [ ] (Optional) A Hetzner Storage Box for off-site backups.

---

## 1. 💻 DNS records

Point every hostname at the server IP. In your DNS provider add **A records**:

| Type | Name          | Value          | Notes                     |
|------|---------------|----------------|---------------------------|
| A    | `@`           | `116.202.8.87` | apex → customer app       |
| A    | `www`         | `116.202.8.87` | redirects to apex         |
| A    | `admin`       | `116.202.8.87` | admin frontend            |
| A    | `api`         | `116.202.8.87` | main API                  |
| A    | `admin-api`   | `116.202.8.87` | admin API                 |

> If the server has an IPv6 address too (it does — `2a01:4f8:...`), add matching **AAAA** records for the same names. Wait for DNS to propagate (`dig hakkiu.com +short` should return the IP) **before** the first deploy, or Let's Encrypt cert issuance will fail.

---

## 2. 🖥️ Server hardening (as `root`)

SSH in: `ssh root@116.202.8.87`, then:

### 2.1 Update the OS + enable automatic security updates
```bash
apt-get update && apt-get -y upgrade
apt-get install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades   # enables auto security patches
```

### 2.2 Create a non-root deploy user
Running everything as root is a needless risk. Create a `deploy` user with sudo + docker rights:
```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
```

### 2.3 SSH keys only (no passwords)
💻 On your **local** machine, generate a deploy key (if you don't have one):
```bash
ssh-keygen -t ed25519 -C "hakkiu-deploy" -f ~/.ssh/hakkiu_deploy
```
🖥️ Then install the **public** key for the `deploy` user:
```bash
mkdir -p /home/deploy/.ssh
# paste the CONTENTS of ~/.ssh/hakkiu_deploy.pub into this file:
nano /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```
Harden `sshd` — disable password + root login:
```bash
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
```
> ⚠️ Before closing your root session, open a NEW terminal and confirm `ssh deploy@116.202.8.87` works with the key. Otherwise you can lock yourself out.

### 2.4 Firewall (ufw) — only SSH + web
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```
> The app containers publish only to `127.0.0.1` (not the public interface), so only Caddy on 80/443 is internet-reachable.

### 2.5 Brute-force protection
```bash
apt-get install -y fail2ban
systemctl enable --now fail2ban
```

### 2.6 Install Docker + Compose plugin
```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy      # let deploy run docker without sudo
```
Log out and back in as `deploy` for the group to take effect. Verify:
```bash
docker --version && docker compose version
```

---

## 3. 🖥️🔒 Get the code + secrets (as `deploy`)

```bash
sudo mkdir -p /opt/hakkiu && sudo chown deploy:deploy /opt/hakkiu
git clone https://github.com/<your-org>/Tracemark.git /opt/hakkiu
cd /opt/hakkiu
```
Create the production `.env` from the template and fill in every secret:
```bash
cp .env.production.example .env
nano .env      # replace every CHANGE_ME; set Supabase keys + provider secrets
```
> The `.env` file stays only on the server — it is git-ignored and must **never** be committed. Generate `INTERNAL_API_SECRET` with `openssl rand -hex 32`.

---

## 4. 🖥️ First deploy

```bash
cd /opt/hakkiu
docker compose build          # builds all 4 images (frontend bakes in VITE_* from .env)
docker compose up -d          # starts everything + Caddy
docker compose ps             # all should be "running"/"healthy"
```
Caddy automatically requests Let's Encrypt certificates for all 5 hostnames on first start. Watch it happen:
```bash
docker compose logs -f caddy   # look for "certificate obtained successfully"
```

---

## 5. 💻🔒 Configure automatic deploys (GitHub Actions)

The `.github/workflows/deploy.yml` workflow SSHes in and redeploys after every green CI on `main`. Add these **repository secrets** (GitHub → Settings → Secrets and variables → Actions):

| Secret     | Value                                                        |
|------------|-------------------------------------------------------------|
| `SSH_HOST` | `116.202.8.87`                                              |
| `SSH_USER` | `deploy`                                                    |
| `SSH_KEY`  | contents of the **private** key `~/.ssh/hakkiu_deploy`      |
| `SSH_PORT` | `22` (optional)                                             |

From then on: `git push origin main` → CI runs → on success, the server pulls and rebuilds automatically.

> **⚠️ Changing an env *value* is NOT automatic.** Auto-deploy runs `git reset --hard` +
> `docker compose build` on every push, so **code** changes (and the `VITE_*` rebake) ship
> on their own — nothing extra to do. But `.env` is git-ignored and lives only on the server,
> so pushing to `main` will **never** update a variable's value. When you rotate a secret
> (`INTERNAL_API_SECRET`) or repoint a URL (`VITE_ADMIN_API_URL`, `MAIN_API_URL`, a domain
> move), you must SSH in and edit it by hand:
> ```bash
> ssh deploy@116.202.8.87
> cd /opt/hakkiu && nano .env           # change the value
> docker compose build                  # REQUIRED for VITE_* — they bake in at build time
> docker compose up -d
> ```
> Skipping `build` after touching a `VITE_*` var leaves the **old** value baked into the
> browser bundle (e.g. the admin app keeps calling the old API URL — see Troubleshooting).

---

## 6. 💻 Wire up external services to the new domain

- **Supabase** → Authentication → URL Configuration:
  - Site URL: `https://hakkiu.com`
  - Redirect URLs: `https://hakkiu.com/**`, `https://admin.hakkiu.com/**`
- **Supabase** → Authentication → enable **Confirm email** (per security audit M11).
- **Meta / Google / Firecrawl**: no URL changes needed unless you registered redirect URIs.

---

## 7. ✅ Verification checklist

- [ ] `https://hakkiu.com` loads the customer app (valid padlock / cert).
- [ ] `https://admin.hakkiu.com` loads the admin sign-in.
- [ ] `https://api.hakkiu.com/health` returns `{"status":"ok"}` (or similar 200).
- [ ] `https://admin-api.hakkiu.com/health` returns 200.
- [ ] `https://www.hakkiu.com` redirects to `https://hakkiu.com`.
- [ ] Sign in on the customer app → a scan runs (proves API + Supabase + scraping work).

---

## 8. 🖥️ Backups (cron)

```bash
sudo apt-get install -y postgresql-client
# Set DATABASE_URL (+ optional BACKUP_SSH_TARGET) in /opt/hakkiu/.env, then:
crontab -e
# add:
15 3 * * * /opt/hakkiu/scripts/backup.sh >> /var/log/hakkiu-backup.log 2>&1
```
See `scripts/backup.sh` for details. Test it once manually: `bash /opt/hakkiu/scripts/backup.sh`.

---

## 9. 🖥️ Operations

```bash
docker compose ps                     # status
docker compose logs -f api            # tail one service
docker compose restart api            # restart one service
docker compose up -d --build api      # rebuild + restart one service
docker compose down                   # stop everything (Caddy certs persist in the volume)
```

**Manual deploy / rollback:**
```bash
cd /opt/hakkiu
git reset --hard origin/main          # or: git checkout <known-good-sha>
docker compose up -d --build
```

---

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Cert not issued, Caddy retries | DNS not propagated yet, or ports 80/443 blocked. Check `dig +short hakkiu.com` and `ufw status`. |
| Customer app 502 in Caddy | `frontend` container not healthy — `docker compose logs frontend`. First boot builds workerd; give it a minute. |
| Frontend shows old API URL | `VITE_*` are baked at build time — rebuild: `docker compose up -d --build frontend`. |
| CORS errors in browser | `ALLOWED_ORIGINS` / `ADMIN_ALLOWED_ORIGINS` in `.env` don't match the domain. Fix, then restart `api`/`admin-api`. |
| admin-api can't reach main API | `MAIN_API_URL` must be `http://api:8000/api/v1` (internal network name), not the public URL. |

---

## Notes / trade-offs

- **Customer app runtime:** the app is built for Cloudflare Workers; we self-host it by
  running the built worker under Cloudflare's `workerd` via `wrangler dev --local`. This is
  solid for MVP/moderate traffic. If traffic grows, switching to real Cloudflare hosting is
  one command (`wrangler deploy`) — then drop the `frontend` service and point `hakkiu.com`
  DNS at Cloudflare instead.
- **Secrets** never leave the server `.env` (git-ignored) and GitHub Actions secrets.
- **Caddy volume `caddy_data`** holds your TLS certs — don't delete it or you'll re-request
  certs (and can hit Let's Encrypt rate limits).

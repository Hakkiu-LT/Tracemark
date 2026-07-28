# HAKKIU — Saugumo auditas ir taisymo planas (2026-07-28)

Nuodugni patikra 5 lygiagrečiais subagentais: customer API, admin API, Supabase RLS/migracijos,
frontend (customer + admin SPA), infrastruktūra/paslaptys. Visi CRITICAL radiniai patvirtinti
rankiniu būdu skaitant kodą.

> **Kontekstas prie screenshot'o (`hakkiu.com/sitemap` → 404):** tai NĖRA saugumo spraga.
> `src/routes/__root.tsx` turi `PUBLIC_PATHS` sąrašą; bet koks nežinomas kelias laikomas
> „apsaugotu" ir renderinamas `<RequireAuth>` viduje → 404 parodomas dashboard'o kevale.
> Neautentifikuotas naudotojas kevalo NEPASIEKIA (nukreipiamas į `/auth/sign-in`), o 404
> body — statinis tekstas be jokių duomenų. Kosmetinis UX niuansas. (Norimas failas yra
> `public/sitemap.xml`; `/sitemap` be plėtinio nėra route.)

---

## 🔴 P0 — CRITICAL (taisyti dabar; cross-tenant duomenų nutekėjimas / rakto ekspozicija)

### C1. Gyvas service-role raktas viešai repo HEAD ir git istorijoje
- **Kur:** `security-audit.md:11` re-publikuoja `sb_secret_***REVOKED***`
  (projektas `kdiyjwwejrdqnccfqhyv`). Istorijoje: commit'ai `7d8a174`, `ebcdb79`, `6ba5f3f`.
- **Poveikis:** service-role raktas apeina VISĄ RLS — pilnas read/write/delete visų klientų duomenims.
- **Statusas:** `.env` jau naudoja kitą raktą (`sb_secret_EWETRe...`) → tikėtina jau pasuktas, BET literalas vis dar viešas.
- **Taisymas:**
  1. Supabase Dashboard → projektas `kdiyjwwejrdqnccfqhyv` → Settings → API → **patvirtinti, kad senasis raktas ATŠAUKTAS** (kad `MKexvI7...` nebeveikia). Jei ne — pasukti dabar.
  2. Redaguoti `security-audit.md:11` → pakeisti raktą į `sb_secret_***REDACTED***`.
  3. Išvalyti iš istorijos: `git filter-repo --replace-text` (arba BFG), force-push, visi kolegos re-clone.
  4. Peržiūrėti Supabase logs dėl senojo rakto naudojimo iš nežinomų IP nuo 2026-07-07.

### C2. `profiles.organization_id` neapsaugotas → tenant-izoliacijos apėjimas (LINCHPIN)
- **Kur:** `20260617000001_profiles_rls.sql:5` — `profiles_own` = `FOR ALL USING (auth.uid() = id)` be `WITH CHECK`.
  Hardening (`20260714000001`) užrakino tik `is_admin` ir `plan` (REVOKE + trigger), o `organization_id` — ne.
- **Poveikis:** naudotojas su anon raktu iš naršyklės:
  `supabase.from('profiles').update({organization_id:'<auka>'}).eq('id', myUid)` → tada VISOS politikos,
  kurios scope'ina per `p.organization_id` (cases, infringements, evidence, documents, clients, org_settings,
  notification_deliveries), atveria svetimo tenant'o duomenis. **Vienu UPDATE — pilnas cross-tenant.**
- **Taisymas (migracija):** išplėsti `protect_privileged_profile_columns()` trigger'į, kad užšaldytų ir
  `organization_id` (ne-service_role rašytojams): `NEW.organization_id := OLD.organization_id;` +
  `REVOKE UPDATE (organization_id) ON public.profiles FROM authenticated, anon;`

### C3. `evidence_items` — atviras cross-tenant read/write
- **Kur:** `20260715000002_evidence_items.sql:49` — `FOR ALL USING (auth.role() = 'authenticated')`.
  Lentelė sukurta PO hardening pass'o, tad niekada nebuvo scope'inta.
- **Poveikis:** bet kuris prisijungęs klientas `select * from evidence_items` → visų org'ų įrodymai
  (case_id, source_url, screenshot_url, scores, verdicts, embeddings). Taip pat write/delete.
- **Taisymas:** pakeisti politiką į scope'intą per `cases` join (org arba user), su `WITH CHECK`.

### C4. `brand_assets` — atviras cross-tenant read/write
- **Kur:** `20260715000004_brand_assets.sql:33` — `FOR ALL USING (auth.role() = 'authenticated')`.
- **Poveikis:** visų prekės ženklų logotipai, referenciniai assets, storage keliai (`{brand_id}/{type}/{uuid}`).
- **Taisymas:** scope per `brands` join (user_id / organization_id), su `WITH CHECK`.

### C5. `evidence-screenshots` storage bucket yra VIEŠAS
- **Kur:** `apps/api/.../services/storage.py:44` — `create_bucket(..., {"public": True})`, `get_public_url()` grąžina nuolatinį viešą URL, saugomą `infringements.screenshot_url`.
- **Poveikis:** kiekvienas nutekėjęs/atspėtas URL atveria svetimo tenant'o įrodymo screenshot'ą be auth. Jei bucket listing įjungtas — visas bucket'as enumeruojamas.
- **Taisymas:** padaryti bucket privatų (`{"public": False}`), `get_public_url` → `create_signed_url(path, ttl)`
  (kaip jau daroma `brand-assets`), pridėti `storage.objects` per-org politikas. Minimum — patvirtinti, kad listing išjungtas.

---

## 🟠 P1 — HIGH (privilegijų eskalacija, SSRF, audit spragos, header'iai)

### H1. `staff.manage` turėtojas gali perimti bet kurį ne-super-admin staff account'ą
- **Kur:** `apps/admin-api/.../routes/staff.py:171-282` (`update_staff`). Email/password keitimas ne-super target'ams NĖRA apsaugotas (tik super-admin target apsaugotas eil. 248).
- **Poveikis:** `admin` preset turi `staff.manage` → gali PATCH svetimo kolegos password → prisijungti kaip jis (lateral takeover).
- **Taisymas:** email/password keitimą kitam account'ui gate'inti super-admin / step-up re-auth.

### H2. Sugadintas audit log call → lead mutacijos neįrašomos
- **Kur:** `apps/admin-api/.../routes/leads.py:54-60` — `write_audit_log(...)` iškviestas su neteisingais kwargs (`principal=`, `changes=`), neatitinka signatūros (`services/audit.py:16`). Kelia `TypeError` už try/except ribų.
- **Poveikis:** lead mutacija (jau įvykusi eil. 52) lieka be audit įrašo (repudiation gap) arba 500.
- **Taisymas:** `write_audit_log(principal, "leads.update_status", target_type="sales_lead", target_id=lead_id, metadata={...}, ip=...)`.

### H3. SSRF — screenshot fetch be validacijos
- **Kur:** `apps/api/.../services/ai.py:494` (`generate_evidence_analysis`) — `httpx.get(screenshot_url, follow_redirects=True)` be `validate_ssrf_url`. Vienintelis praleistas kelias po L4 remediacijos.
- **Poveikis:** attacker'io valdomas screenshot/redirect URL → serveris fetch'ina vidinius / metadata endpoint'us.
- **Taisymas:** `validate_ssrf_url(screenshot_url)` prieš fetch + `follow_redirects=False` (kaip `embedding_helper.py`).

### H4. Trūksta `WITH CHECK` persona/mode-isolation politikose (write-side + loose `user_id` branch)
- **Kur:** `20260705000002_law_firm_branding_rls.sql` (cases/infringements/evidence/takedown_reports), `20260629000001`. `FOR ALL USING` be aiškaus `WITH CHECK`; `OR c.user_id = auth.uid()` leidžia prisegti įrašą sau nepaisant org.
- **Taisymas:** kiekvienai politikai pridėti aiškų `WITH CHECK`, pin'inantį `organization_id` prie kviečiančiojo org.

### H5. `org_settings` write ne role-gated
- **Kur:** `20260714000001:125-142` — `FOR ALL` leidžia bet kuriam org nariui keisti `notification_email` ir `persona`. `persona` perjungia visą RLS mode-izoliaciją.
- **Taisymas:** skaidyti į `FOR SELECT` (visi nariai) + `FOR UPDATE/INSERT` gate'intą `organization_members.role IN ('owner','admin')`.

### H6. Wrangler build išpila VISĄ `.env` į `dist/server/.dev.vars`
- **Kur:** `dist/server/.dev.vars` (git-ignored, NEcommit'intas). Plaintext SERVICE_ROLE, STRIPE, RESEND, META_APP_SECRET, INTERNAL_API_SECRET.
- **Poveikis:** jei `dist/` kada `wrangler deploy`'inamas ar kopijuojamas — visos serverio paslaptys nuteka. Šiandien tik lokalus.
- **Taisymas:** patvirtinti, kad `dist/` `.dockerignore`'e (yra) ir niekada `wrangler deploy`'inamas; build step, kuris strip'ina ne-`VITE_` raktus.

### H7. `brands` SELECT politikoje `OR organization_id = auth.uid()` branch
- **Kur:** `20260712000001_brands.sql:38-46`. Ta pati painiava, kurią billing_hardening pašalino kitur.
- **Taisymas:** išmesti `OR organization_id = auth.uid()`; remtis `user_id = auth.uid()` + `user_is_org_member`.

---

## 🟡 P2 — MEDIUM

- **M1.** `documents.py:31` — send-email ownership check praleidžiamas, kai `infringement_id` NULL (fail-open). Fix: deny-by-default 404. (`apps/api`)
- **M2.** Public `POST /staff/request-password-reset` be rate-limit → email bomb + Resend abuse. (`admin-api/routes/auth.py`)
- **M3.** Visame admin-api nėra rate-limit / lockout. Pridėti global limiter + griežtesni bucket'ai create/delete.
- **M4.** Audit `ip = request.client.host` → už proxy rodo proxy IP. Fix: uvicorn `--proxy-headers` + trusted `forwarded-allow-ips`.
- **M5.** Audit write best-effort (swallow + `print`). Fix: struktūrinis error/metric; jautriems veiksmams — fail-closed.
- **M6.** Migruoti org-check nuo `profiles.organization_id` prie `organization_members` / `user_is_org_member`.
- **M7.** `notification_deliveries` turėtų būti read-only `authenticated`'ui (dabar `FOR ALL`).
- **M8.** Main API CORS unconditionally prideda localhost origins net production'e (`apps/api/.../main.py:58-63`). Gate už `if not _is_production`.
- **M9.** Caddyfile API subdomenai (`api.` / `admin-api.`) be security header'ių snippet'o (defence-in-depth).
- **M10.** docker-compose `env_file: .env` abiem servisams → per platus blast radius. Scope per-service `environment:`.
- **M11.** Frontend security header'iai (CSP/HSTS/XFO) gyvena `public/_headers` (Pages konvencija), bet app deploy'inama kaip **Worker** — gali NEBŪTI taikomi. `supabase.ts` token-in-localStorage mitigacija remiasi CSP. **Patikrinti live: `curl -I https://hakkiu.com`**; jei nėra — set'inti `src/server.ts` response'e.

---

## 🟢 P3 — LOW / hardening

- **L1.** `clients.py:127` billing count ne org-scoped (defence-in-depth). Pridėti `.eq("organization_id", org_id)`.
- **L2.** `dependencies.py:57` — `user_id`-kaip-org fallback; provisioninti realų org kiekvienam user'iui.
- **L3.** `internal.py` — patvirtinti `INTERNAL_API_ALLOWED_IPS` set'intas prod'e; nepasitikėti `request.client.host` už untrusted proxy.
- **L4.** `user_is_org_member` (`20260720000014:40-46`) SECURITY DEFINER be `SET search_path`. Fix: `ALTER FUNCTION ... SET search_path = public, pg_temp;`
- **L5.** `apps/admin/.../Leads.tsx:203` — lead website href ne per `ensureAbsoluteUrl` (kiti href — per). Naudoti helper'į.
- **L6.** evidence-screenshot komponentai (`src/components/cases/...`) — `href/src` be `ensureAbsoluteUrl` (konsistencija).
- **L7.** Revoke nenaudojamus live Stripe raktus (billing pašalintas); scope Resend raktą.
- **L8.** `deploy.yml:24` `appleboy/ssh-action@v1.2.2` — pin'inti prie full SHA. Pridėti `permissions: contents: read`.
- **L9.** `list_users(per_page=1000)` / `profiles limit(1000)` tylus truncate admin paieškoje. Paginuoti.
- **L10.** `admin_audit_log` — patvirtinti DB-lygio append-only (revoke UPDATE/DELETE).
- **L11.** Impersonation magic-link TTL trumpas; nelog'inti link'o.

---

## Vykdymo tvarka

1. **Iškart:** C1 (rakto verifikacija/atšaukimas + redakcija), C2–C5 → **viena nauja Supabase migracija** + `storage.py` pakeitimas.
2. **Šią sesiją:** H1–H7 (staff takeover, audit bug, SSRF, RLS WITH CHECK).
3. **Toliau:** P2 → P3.

> ⚠️ DB fix'ai eina per naują migraciją ir `supabase db push` (CLI linked į realų HAKKIU projektą).
> Supabase MCP rodo KITĄ DB — nenaudoti jo šiems fix'ams.

### Patvirtinti geri kontrolės mechanizmai (be radinių)
JWT validacija tikra (GoTrue `get_user` — signature+expiry, ne local decode). Internal secret — `hmac.compare_digest`.
CORS be wildcard. Docker portai bind'inti į `127.0.0.1`, tik Caddy viešas. Containers ne-root. Nėra service-role rakto frontend'e.
`.env` git-ignored ir niekada necommit'intas. Vienas `dangerouslySetInnerHTML` — statinis GA4 snippet. `ensureAbsoluteUrl` blokuoja `javascript:`/`data:` schemas.

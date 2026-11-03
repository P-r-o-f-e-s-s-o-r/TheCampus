# SapiensCampus

**Discover yourself. Find your people.**

Monorepo for the SapiensCampus interest-discovery experience:

| App | Stack | Role |
|---|---|---|
| `web/` | Vite + React | Student quiz + waitlist signup |
| `admin/` | Vite + React + Firebase Auth | Manage questions & view waitlist |
| `functions/` | Firebase Functions (Express) | `/api/questions`, `/api/waitlist`, admin APIs |
| `shared/questions.template.json` | JSON | Import/export template for quiz content |

Firebase project: `sapienscampus-97b6a`

- Web hosting: https://sapienscampus-97b6a.web.app  
- Admin hosting: https://sapienscampus-admin.web.app  

---

## Firestore collections

| Collection | Purpose |
|---|---|
| `questions/{id}` | Quiz prompts (`area`, `title`, `cue`, `icon`, `scene`, `sortOrder`, `active`) |
| `quizMeta/config` | Shared `areas`, `pairs`, `anchors`, `version` |
| `waitlist/{id}` | Signup emails + optional answers/scores |
| `admins/{email}` | Allowlisted admin emails |

Client SDK access is denied by rules — all reads/writes go through Cloud Functions.

---

## Local development

```bash
# API (uses deployed project by default via Vite proxy)
cd functions && npm install

# Student app
cd web && npm install && npm run dev

# Admin app
cd admin && npm install && npm run dev
```

Seed questions + admin allowlist (requires Application Default Credentials / `firebase login`):

```bash
cd functions
ADMIN_EMAIL=sapienscampus@gmail.com ADMIN_PASSWORD='choose-a-password' npm run seed
```

---

## Deploy

```bash
cd web && npm run build
cd ../admin && npm run build
firebase deploy --only firestore,functions,hosting
```

---

## Public API

- `GET /api/questions` — active questions + scoring metadata  
- `POST /api/waitlist` — `{ email, consent, company?, answers?, scores? }`  

## Admin API (Bearer Firebase ID token)

- `GET /api/admin/waitlist`
- `GET|POST /api/admin/questions`
- `PUT|DELETE /api/admin/questions/:id`
- `GET /api/admin/questions/export`
- `POST /api/admin/questions/import`

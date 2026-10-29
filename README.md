# CivicConnect AI

Civic issue reporting platform: citizens report problems (potholes, garbage,
streetlights...), admins review and update them, and citizens track progress.

Frontend: plain HTML/CSS/JS. Backend: Node.js with a SQLite database.
**No `npm install` is needed — there are no dependencies.**

## Run it

1. Install **Node.js 22.13 or newer** (https://nodejs.org, choose "LTS" or newer). Check with `node -v`.
2. In this folder run:

   ```
   node backend/server.js
   ```
   (or `npm start`, or double-click `start.bat` on Windows)
3. Open **http://localhost:3000**

The first start creates the database (`data/civic.db`) and an admin account:

| | |
|---|---|
| Email | `admin@civicconnect.local` |
| Password | `Admin@12345` |

**Change this before showing the site to anyone:** copy `.env.example` to `.env`
and set `ADMIN_EMAIL` / `ADMIN_PASSWORD` (do this before the first start, or
delete `data/` once to recreate the admin).

Citizens register themselves on the Register page. Admins log in on the same
Login page and are sent to the admin dashboard automatically.

## What is saved where

| Data | Where |
|---|---|
| Users, reports, status history | `data/civic.db` (SQLite) |
| Report photos | `data/uploads/` |
| Login signing key | `data/.jwt-secret` (auto-created) |

Back up the whole `data/` folder to back up everything.
Settings such as dark mode, language and brightness stay in the browser.

## Features

- Register / login with a hashed password (scrypt) and signed login tokens
- Date of birth and phone number saved in the database and shown on the profile
- Profile editing, password change, settings (language, dark mode, brightness), help chatbot
- Report an issue with a photo; priority (high / medium / low) is detected automatically
- My Reports with search and status filter, report details page with a status timeline
- Admin: dashboard, all reports with search/filters/pagination, change status and
  priority with a note for the citizen, analytics (by category, status, priority, per day)

## Tests

```
npm test
```
Runs 9 API tests against a temporary database (accounts, validation, ownership
rules, photo upload, admin permissions, blocked private files).

## API (all under `/api`, JSON, `Authorization: Bearer <token>`)

| Method | Path | Who |
|---|---|---|
| GET | `/health`, `/meta` | public |
| POST | `/auth/register`, `/auth/login` | public |
| GET | `/auth/me` | logged in |
| PUT | `/users/me` | logged in |
| POST | `/users/me/password` | logged in |
| POST | `/reports` | logged in |
| GET | `/reports/mine`, `/reports/:id` | owner (admin can open any) |
| GET | `/admin/stats`, `/admin/analytics`, `/admin/reports` | admin |
| PATCH | `/admin/reports/:id` | admin |

## Project layout

```
backend/   server.js (HTTP + static files), routes.js (API), db.js (SQLite),
           auth.js (passwords, tokens), config.js, test/
*.html     pages           api.js        frontend API client
script.js  citizen pages   admin.js      admin helpers
extras.js  settings, translations, chatbot
```

## Before going live (real deployment)

- Set `ADMIN_PASSWORD` and `JWT_SECRET` in `.env`
- Put the app behind HTTPS (for example Nginx or Caddy as a reverse proxy)
- Back up `data/` regularly
- Login rate limiting is in memory and resets when the server restarts
- Email/SMS OTP, Google sign-in and "forgot password" need an email/SMS provider
  and are not connected yet

## Troubleshooting

- *"node:sqlite" error* — your Node is too old; install 22.13 or newer.
- *Port in use* — set `PORT=3001` in `.env`.
- *Opening the HTML files by double-click* — start the server and use http://localhost:3000 instead; the pages need the API.

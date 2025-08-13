
# Ritesh Web & Travel Solutions – Website + Admin

A full-stack template for your travel business.

## Features
- Beautiful landing site with services, destinations, Udyam badge
- Lead capture form with demo OTP and estimates (Budget/Standard/Premium)
- Admin-only panel to set markups, rates per route, and view leads
- Planner (AI-like) combines train/bus/flight + hotel + cab + fees
- Instagram DM link and mailto email button
- SQLite database (file `rwts.db` in project folder)

## Quick Start
1) Install Node.js 18+
2) In project folder:
```
cp .env.example .env
# edit .env -> set ADMIN_KEY and INSTAGRAM_HANDLE
npm install
npm start
```
Open http://localhost:8080

## Admin
- Visit `/admin`
- Enter your ADMIN_KEY (from `.env`) in the top input. It will be used in API headers.
- Configure Settings (markup, fees) and Route Rates (e.g., patna → varanasi).

## OTP
- Demo only: server accepts OTP `111111` until you integrate SMS (Twilio/MSG91).
- Endpoint: POST `/api/send-otp`

## Data
- Leads + rates are stored in `rwts.db` (SQLite). Backup this file regularly.

## Deploy
- You can deploy on a cheap VPS or Railway/Render with persistent volume for the DB.
- Always keep `.env` secret.

## Customize
- `public/assets/styles.css` for colors and layout
- `public/index.html` content & sections
- `public/assets/logo.svg` for your logo

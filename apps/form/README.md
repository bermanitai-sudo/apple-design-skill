# FORM — personal fitness and discipline tracker

A private, installable web app for iPhone that combines running, nutrition, schedule, alarms and three daily
discipline assignments. Single user, no account. All personal data lives in IndexedDB on the phone.

Black `#080808`, white `#FFFFFF`, lime `#B7FF35`. The design follows the Apple Human Interface Guidelines in
this repository: Liquid Glass only on the functional layer (tab bar, sheets, run controls, timer), standard
materials with depth on content cards, motion that follows navigation direction, and Reduce Motion and Reduce
Transparency support.

## What it does

| Section | Features |
| --- | --- |
| Home | Date, discipline ring, today's assignments, weekly running, today's nutrition, next alarm, next event, pending push-ups |
| Running | GPS runs with live map, timer, distance, pace, speed, calorie estimate; pause, resume, finish, discard; manual entry; history, personal records, weekly and monthly summaries |
| Health | Photo food recognition (camera or library) with editable, confidence-flagged estimates; manual entry; meals; calorie and protein totals against your own targets; calendar history |
| Schedule | Events with reminders in day, week and month views; alarms per weekday with names, sounds and a weekly wake-up planner; automatic countdown after dismissing an alarm |
| Daily | Three assignments generated once per day, deadline, streak, history, a 50 push-up accountability challenge for missed days (mark done or skip) |
| Statistics | Running totals, weekly distance, 14-day calories and protein, completion rate, streak, missed days |
| Settings | Name, units, body weight, targets, timer length, deadline, push-up count, notifications, appearance, access code, backup export and import, Calendar export, sample data, erase |

## Deploy (about 10 minutes)

1. Push this folder to a GitHub repository (it can be its own repository).
2. In [Vercel](https://vercel.com), **Add New → Project**, import the repository, and set **Root Directory** to
   `apps/form` if the app stays inside this repository. Vercel detects Vite.
3. Add environment variables (Project → Settings → Environment Variables), from `.env.example`:
   - `APP_ACCESS_CODE`: a long random passcode. Required. The server refuses every API call without it.
   - `ANTHROPIC_API_KEY`: from [console.anthropic.com](https://console.anthropic.com). Required for photo logging.
4. Deploy. Open the URL in **Safari** on your iPhone → Share → **Add to Home Screen**.
5. Open FORM from the Home Screen icon, then Settings → Private access → enter the same passcode.

Keys stay on the server. Nothing with a `VITE_` prefix holds a secret, and the browser only ever sends your
passcode and a downscaled photo.

### Optional: alarms with the app closed

1. `npm run vapid` → set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (`mailto:` your address).
2. Create a free [Upstash Redis](https://upstash.com) database → set `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`.
3. Set `CRON_SECRET` to another random string.
4. Call `GET https://<your-app>/api/cron/tick` every minute with header `Authorization: Bearer <CRON_SECRET>`.
   Vercel Hobby crons run at most daily, so use a free scheduler such as cron-job.org, or Vercel Pro with
   `"crons": [{ "path": "/api/cron/tick", "schedule": "* * * * *" }]` in `vercel.json`.
5. In the app: Schedule → Alarms → Allow notifications → turn on **Background alarms**.

The server stores only your alarm times, time zone, upcoming reminder titles and the push endpoint.

## iPhone limitations, stated plainly

- **A web app cannot run while iOS has suspended it.** JavaScript timers stop when you leave the app or lock
  the screen, so no web app can guarantee an alarm on its own.
- FORM therefore layers three methods:
  1. **In-app alarm.** Exact, with sound and the automatic timer, while FORM is open on screen. Leave it open
     on a charger overnight for this to work.
  2. **Push notifications.** Fire with the app closed. They need iOS 16.4 or later, FORM installed on the Home
     Screen, notification permission and the scheduler above. They use the standard notification sound,
     cannot loop, and obey Silent mode and Focus. Tapping the notification dismisses the alarm and starts the
     countdown.
  3. **Calendar export.** Settings → Export alarms & events creates an `.ics` file with alerts. iOS Calendar
     always alerts on time, but does not start FORM's countdown.
- For a wake-up you cannot miss, also set the time in the Clock app. No web app can override Silent mode.
- **GPS stops when the screen locks.** FORM asks the screen to stay awake during a run (Screen Wake Lock,
  iOS 16.4+). If tracking pauses, the time stays correct and distance resumes from the next real fix, measured
  in a straight line. It never invents points.
- **Storage.** Deleting the Home Screen app deletes its data. Export a backup from Settings regularly.

## Develop

```bash
npm install
npm run dev          # UI at http://localhost:5173 (API routes need `npx vercel dev`)
npm test             # 36 unit and API tests
npm run typecheck
npm run build
npx vite preview --port 4173 & node scripts/smoke.mjs   # end-to-end check in Chromium at iPhone size
npm run icons        # regenerate icons and splash screens
```

Stack: React 18, TypeScript, Tailwind CSS, Framer Motion, Dexie (IndexedDB), Recharts, Leaflet with CARTO dark
tiles, vite-plugin-pwa (Workbox), Vercel functions, Claude vision (`claude-opus-5-5`, override with
`ANTHROPIC_MODEL`) with structured output and server-side refusal fallback.

## Structure

```
api/                  Vercel functions: analyze-food, push/config, push/subscribe, cron/tick
src/lib/              Pure logic and storage: db, dates, units, run math, assignments, alarms, push, backup
src/state/            Transactions: discipline sync (midnight reset, deadline, push-ups), active run
src/components/       UI kit, tab bar, engines (alarms, timer, reminders), route map, onboarding
src/pages/            Home, Running, Health, Schedule, Daily, Statistics, Settings
src/sw.ts             Service worker: offline shell, tile cache, push, notification taps
tests/                Vitest suites (fake IndexedDB, mocked Claude, Redis and web-push)
scripts/              Icon renderer and end-to-end smoke test
```

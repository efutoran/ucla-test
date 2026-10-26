# Demo Day Voting

Live thumbs-up voting for demo day, like the one YC investors use. It's a mobile-friendly web app built with Next.js (hosted on Vercel) and Supabase (Postgres + Realtime).

## Who sees what

| Screen | Who | What they see |
|---|---|---|
| `/` Sign in | Everyone | Investors pick their name, teams pick their team, admin enters the password |
| `/vote` | Investors | Teams grouped by time slot, a 👍 toggle per team, live counts |
| `/team` | Teams | Their live thumb count, rank in slot and overall, **names of the investors who thumbed them** |
| `/leaderboard` | Everyone | Live ranking with counts only, filterable by slot. **No voter names.** |
| `/admin` | Admin | Totals, "now presenting" slot picker, results with voter names, per-investor participation, full vote log, CSV export, roster upload/reset |

There are no accounts. The chosen identity is remembered in the browser (localStorage). Per the requirements, security is intentionally open: the database accepts reads and writes from anyone with the public key.

## Setup (about 10 minutes, free tiers)

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com) (the free tier is fine).
2. Go to **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.

> Free Supabase projects pause after about a week with no activity. Open the dashboard a day before the event to make sure it's awake.

### 2. Vercel
1. Go to [vercel.com/new](https://vercel.com/new) and import `efutoran/ucla-test`. The framework is detected as Next.js.
2. Add these environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the anon key (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
   - `ADMIN_PASSWORD` (required): the admin screen's password. It's checked on the server and never sent to browsers.

   If you connected Supabase through Vercel's Supabase integration (Storage tab / Marketplace), the Supabase variables are added for you. Check Settings → Environment Variables.
3. Deploy, then share the URL (or a QR code of it) with the class.

### 3. Load the roster
Open the app and sign in as **Admin**. Go to **Upload / reset**, choose both CSVs, and press **Reset & load**.

Every upload wipes all teams, investors and votes and starts from scratch. Anyone who is signed in is sent back to the sign-in screen.

**teams.csv**: `team,slot,description` (description is optional). Slots are ordered by where they first appear in the file.
```csv
team,slot,description
Acme Robotics,10:00 - 10:30,Warehouse robots for small businesses
Bruin Bites,10:00 - 10:30,Late-night food delivery for campus
DocuMind,10:30 - 11:00,AI paperwork for clinics
```

**investors.csv**: `name`
```csv
name
Alex Chen
Jordan Lee
```

Sample files are in [`samples/`](samples/).

## During the event
- In the admin screen, set **Now presenting** to the current slot. Every investor's phone jumps to that slot.
- Counts update on every screen within about a second. Phones that were asleep resync when they're reopened.
- Afterwards, use **Export CSV** on the Results, Participation and Vote log tabs.

## Local development
```bash
cp .env.example .env.local   # fill in your Supabase values
npm install
npm run dev                  # http://localhost:3000
```

## How it works
- **Tables:** `time_slots`, `teams`, `investors`, `votes` (primary key `(investor_id, team_id)`, so there's one thumb per investor per team), and `settings` (holds the current slot and the reset marker).
- **Realtime:** clients subscribe to inserts and deletes on `votes` and compute the counts locally. That's at most about 4,000 rows for 100 investors × 40 teams.
- **Reset:** `reset_event(teams, investors)` truncates and reloads everything in one transaction, then bumps `settings.reset_at`, which tells every client to reload.

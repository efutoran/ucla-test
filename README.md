# 'Real' Pitch Event

Live thumbs-up voting for pitch day, like the one YC investors use at demo day. It's a mobile-friendly web app built with Next.js (hosted on Vercel) and Supabase (Postgres + Realtime).

## Who sees what

| Screen | Who | What they see |
|---|---|---|
| `/` Sign in | Everyone | Investors pick their name, teams pick their team, admin enters the password |
| `/vote` | Investors | The "now presenting" team pinned on top, then every team in presentation order. Each card shows the team name, one-liner and members, with a 👍 toggle and live count. |
| `/team` | Teams | Their name, one-liner and members, live thumb count, overall rank, **names of the investors who thumbed them** |
| `/leaderboard` | Everyone | Live ranking of all teams: name, one-liner and count (no team members). **No voter names.** |
| `/admin` | Admin | Totals, "now presenting" team picker, results with voter names and dates, per-investor participation, full vote log, CSV export, roster upload, delete teams/investors |

There are no accounts. The chosen identity is remembered in the browser (localStorage). Per the requirements, security is intentionally open: the database accepts reads and writes from anyone with the public key.

## Setup (about 10 minutes, free tiers)

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com) (the free tier is fine).
2. Go to **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.

   **Upgrading an existing install?** Don't re-run `schema.sql`, because it wipes everything. Instead, run each file in [`supabase/migrations/`](supabase/migrations/) that you haven't run yet, in order. They keep your data.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.

> Free Supabase projects pause after about a week with no activity. Open the dashboard a day before the event to make sure it's awake.

### 2. Vercel
1. Go to [vercel.com/new](https://vercel.com/new) and import `efutoran/ucla-test`. The framework is detected as Next.js.
2. Add these environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the anon key (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
   - `ADMIN_PASSWORD` (required): the admin screen's password. It's checked on the server and never sent to browsers.
   - `VIEWER_PASSWORD` (optional): a second password that opens the admin screen in **view-only** mode. Viewers see every tab and control exactly as the admin does, including Upload and Delete, but anything that would change the event (upload, delete, the presenting team, voting) is turned off. Exporting CSVs still works.

   If you connected Supabase through Vercel's Supabase integration (Storage tab / Marketplace), the Supabase variables are added for you. Check Settings → Environment Variables.
3. Deploy, then share the URL (or a QR code of it) with the class.

### 3. Load the roster
Open the app and sign in as **Admin**. Go to **Upload**, choose one or both CSVs, and press **Upload**. Uploads never wipe anything:
- **New names** are added.
- **A team with the same name** (case-insensitive) gets its date, slot, description and members replaced. Its votes are kept.
- **An investor with the same name** is skipped, so their votes and stats are kept.

To remove old sections or dummy data, use the **Delete** tab. You can tick a whole date's teams at once, or pick individual investors. Deleting removes their votes too.

**teams.csv**: `team,date,slot,description,members`. `description` is the team's one-liner, and `description` and `members` are optional. There's one team per slot. The date (e.g. `10/28`) only appears on admin screens. Put quotes around the members list when it contains commas.
```csv
team,date,slot,description,members
Acme Robotics,10/28,10:00,Warehouse robots for small businesses,"Alice Wu, Ben Ortiz, Chloe Park"
Bruin Bites,10/28,10:10,Late-night food delivery for campus,"Dev Patel, Emma Rossi"
DocuMind,11/4,10:00,AI paperwork for clinics,"Ivan Petrov, Jia Li"
```

**investors.csv**: `name`
```csv
name
Alex Chen
Jordan Lee
```

Sample files are in [`samples/`](samples/).

## During the event
- In the admin screen, set **Now presenting** to the team on stage. It's pinned to the top of every investor's screen, and its votes trigger the celebration animation.
- Counts update on every screen within about a second. Phones that were asleep resync when they're reopened.
- Afterwards, use **Export CSV** on the Results, Participation and Vote log tabs.

## Local development
```bash
cp .env.example .env.local   # fill in your Supabase values
npm install
npm run dev                  # http://localhost:3000
```

## How it works
- **Tables:** `teams` (with `slot_date`, `slot`, `description` and `members`), `investors`, `audience`, `votes` (primary key `(investor_id, team_id)`, so there's one thumb per investor per team), and `settings` (holds the now-presenting team and a roster version).
- **Audience:** while a team is "Now presenting", each signed-in investor's open app records one `audience` row for that team. So does a full admin console with a "Vote as" name selected, whether or not they vote. The Results tab shows the count (👀 ~N) and the thumbs-up rate.
- **Realtime:** clients subscribe to inserts and deletes on `votes` and compute the counts locally.
- **Roster changes:** `import_roster(teams, investors)` adds or updates rows, and `delete_roster(team_ids, investor_ids)` deletes rows and their votes. Both bump `settings.roster_updated_at`, which tells every open client to reload.

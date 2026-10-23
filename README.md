# BID WARS: The Ultimate Office Auction

Auction console + projector screen + live leaderboard for the office auction night.
React + TypeScript + Tailwind CSS, built with Vite. No server or database: everything is saved in the browser.

## Put it on Vercel (no coding)

1. Create a free account at github.com and vercel.com (sign in to Vercel with GitHub).
2. The code is already on GitHub: `venkynani1/Auction-App`.
3. On Vercel: **Add New… → Project** → pick the `Auction-App` repository → **Deploy**. Vercel detects Vite automatically (build `npm run build`, output `dist`).
4. After a minute you get a link like `https://bid-wars.vercel.app`. That is your app.

Or, with Node.js installed: `npm install -g vercel`, then run `vercel` in this folder.

## Run it on your own computer

```bash
npm install
npm run dev      # opens http://localhost:5173
npm run build    # production files in dist/
```

## On the night

- Open the link on the auction laptop. Go to **Setup**: set the starting purse and paste your team names.
- **Players & photos**: click **Add many photos** and select all your photo files at once. Each file is matched by name (e.g. `Thalapathy Vijay.jpg`).
- Open the link in a **second window**, drag it to the projector, click **Projector → Full screen**.
- **Open the team rooms** (Setup → Team rooms → Open rooms). The projector shows one QR code; each team scans it and types its team number to get its own live room.
- Run everything from **Console** in the first window: **NEXT LOT → + bid buttons → tap the leading team → SOLD**. The projector follows every click.
- **Projector shows**: switch between the current lot, the leaderboard (Top 3 + standings) and the final results reveal.
- **Teams & scores**: the full Excel-style table, plus bonus/penalty points and cash for any team.
- **Setup → Export results** gives an Excel CSV. **Save backup** now and then.

Both windows must be in the same browser on the same computer: they sync through the browser itself.
Data stays in that browser. Use **Save backup with photos** to move everything to another computer.

## Rules built in

- Round 1 Actors & Actresses: points shown up front.
- Round 2 Cricketers: points hidden until the player is sold, then revealed.
- Round 3 Singers & Music Directors: every base price ₹50 L, points never shown on screen.
- Round 4 Mystery: 4 sealed slips. After the sale, pick which slip came out; the app applies it
  (51 points, ₹10 Cr, battery % × 2 points, 2 points per ₹1 Cr spent, or a player swap).
- Points start at zero and only count players and bonuses during the 4 rounds.
- After round 4, press **Calculate final points**: every team gets 1 point for each full ₹1 Cr left in its purse,
  the winners are ranked, and **Projector shows → Final results** reveals 3rd, 2nd and the champion.
  (Undo is there if you pressed it too early.)

## Team rooms (participants' phones)

- One room per team: set 30 teams and there are 30 rooms. Everyone scans the **same QR code** and types their team number.
- Each phone shows: "auction starts soon" before the first lot, then **Round 1–4** with the lot on sale and the current bid,
  and its own team's **purse left, points, players bought and bonuses**. Round 3 player points stay secret until the final calculation.
- After the final calculation the phone shows the final points; the team's position appears once the champion is revealed on the projector.
- The auction laptop must be online. Rooms need the one-time Firebase setup below.

### Team PINs

- Every team has a 4-digit PIN (Setup → Team rooms → **Team PINs**). Phones enter the team number **and** the PIN to join, and the PIN is checked again on every bid,
  so nobody can bid for another team. The database itself rejects a wrong PIN, and PINs can never be read from a phone.
- **Print PIN slips** prints one slip per team (team name, number, PIN). **Copy PIN list** copies them as text. **New PINs** (all, or ↻ for one team) asks phones to enter the new PIN.
- Bids are hidden from phones; only the auction laptop can see them until you show them on the projector.
- Turn **PINs off** to go back to number-only joining.

### Team bids from phones

- In **Console → Team bids**, press **Open team bids** (works during a lot or on its own). Every phone gets a **BID** button.
  Each team bids once, in crores, up to its purse. The time is taken from Firebase's server clock, so "fastest" is fair.
- Press **Unique**, **Highest** or **Lowest** to show the result on the projector:
  - **Highest**: biggest amount wins. **Lowest**: smallest amount wins.
  - **Unique**: the highest amount that no other team bid (equal amounts are marked CLASH). If every amount clashes, the fastest highest bid wins.
  - Equal amounts always go to the team that bid first.
- **Use winner** puts that team and amount on the current lot; then press **SOLD** as usual. **End team bidding** removes the BID button.

## Activity points

**Console → Activity points**: type the activity name and points, tap one or more teams, press **Give**. Negative points take points away.
It appears in the standings and on each team's phone, and **Undo** works. (The **± Points / cash** button on the Teams page still works too.)

### Team rooms: one-time Firebase setup (about 10 minutes, free)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (Analytics not needed).
2. **Build → Realtime Database → Create database** (pick a location, start in *locked mode*).
   Open the **Rules** tab, paste the contents of `database.rules.json` from this repo, and **Publish**.
   (Paste it again whenever this file changes: team bids need the newer rules.)
3. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
4. **Project settings (⚙) → Your apps → Web (`</>`)** → register an app (no hosting). Copy the config values.
5. In **Vercel → your project → Settings → Environment Variables**, add these (see `.env.example`):
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
6. **Deployments → Redeploy.** Setup → Team rooms now shows the QR code and the **Open rooms** button.

For local testing, put the same values in a `.env.local` file next to `package.json`.
The room code belongs to the laptop that first opened it. If you switch laptops, press **New room code** in Setup.

## Extras

- `tools/add_photos.py`: downloads each person's photo from Wikipedia into a `photos` folder (run `python tools/add_photos.py` next to the PowerPoint deck). Load that folder in the app with **Players & photos → Add many photos**.
- `docs/APP_BRIEF.md`: the full event brief: rules, all 96 lots with prices and points, scoring.

## Where things are

```
src/data.ts         the 96 lots (edit here or in the app)
src/store.tsx       game rules, scoring, autosave, window sync, undo
src/views/          Console, Projector, Teams, Players, Setup
src/components/     shared UI, podium, confetti, wordmark
src/views/Room.tsx  the participant's phone screen (join + team room)
src/lib/rooms.ts    what is sent to Firebase for the rooms
src/lib/            photos (IndexedDB), sounds, money formatting, CSV
```

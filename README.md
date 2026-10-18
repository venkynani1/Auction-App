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
  (51 points, ₹10 Cr, battery-% points, 2 points per ₹1 Cr spent, or a player swap).
- Final points = player points + bonuses + 1 point for every full ₹1 Cr left in the purse.

## Extras

- `tools/add_photos.py`: downloads each person's photo from Wikipedia into a `photos` folder (run `python tools/add_photos.py` next to the PowerPoint deck). Load that folder in the app with **Players & photos → Add many photos**.
- `docs/APP_BRIEF.md`: the full event brief: rules, all 96 lots with prices and points, scoring.

## Where things are

```
src/data.ts         the 96 lots (edit here or in the app)
src/store.tsx       game rules, scoring, autosave, window sync, undo
src/views/          Console, Projector, Teams, Players, Setup
src/components/     shared UI, podium, confetti, wordmark
src/lib/            photos (IndexedDB), sounds, money formatting, CSV
```

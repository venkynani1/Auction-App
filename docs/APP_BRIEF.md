# BID WARS: The Ultimate Office Auction
## Full brief for building the event app

This document has everything needed to build the app: the event rules, every auction item with price and points, the scoring, the screens the organiser needs, and what has already been made. All prices are in Indian rupees: **1 Cr (crore) = 100 L (lakh)**. In data, store money as decimal crores (50 L = 0.5).

---

## 1. The event in one paragraph

A live office auction game. **20–25 teams** each start with the same virtual purse. Over **4 rounds** the auctioneer puts famous people (and, in the last round, sealed mystery slips) up for bidding. The highest bid wins. Each purchase earns points. At the end, every team also gets **1 point for every full ₹1 Cr left in its purse**. The team with the **highest final points** wins. The auctioneer runs everything from a laptop; a projector shows the audience the current lot and the live top 3.

## 2. Rounds and how each one works

| Round | Category | What the audience sees before bidding | Base price | When points are revealed |
|---|---|---|---|---|
| 1 | Actors & Actresses (31 lots) | Photo, name, base price **and points** | Varies per person (see table) | Shown up front |
| 2 | Cricketers (30 lots) | Photo, name, role, base price. **Points hidden** | Varies per person | Revealed **only after the player is sold** ("SOLD!" + points) |
| 3 | Singers & Music Directors (31 lots) | Photo, name, base price. **Points never shown** to audience | **₹50 L for everyone** | Secret: auctioneer adds them to the winning team |
| 4 | Mystery Round | 5 sealed slips exist; **4 are picked** and auctioned one by one. Teams bid blind | Open bidding | Slip opened after the sale and applied immediately |

Common rules: bidding opens at the base price, the highest bid wins, a team cannot spend more than its remaining purse, unsold lots can come back later.

### Round 4: the 5 mystery slips

| # | Slip | Effect | How to apply it in scoring |
|---|---|---|---|
| 1 | Instant 51 points | The team gets 51 points straight away. | +51 to the team's bonus points |
| 2 | Player swap | Swap one of your players with a player from another team. | Move one purchased player between two teams (price and points move with the player) |
| 3 | Battery bonus | Pick one person from another team. You get double their phone battery % as points. | Organiser enters the battery %; the app adds 2 × that as bonus points |
| 4 | ₹10 Cr cash | You get ₹10 Cr added to your purse. | +₹10 Cr added to the team's purse |
| 5 | Double spend | You get 2 points for every ₹1 Cr you have spent. | Bonus points = 2 × the team's total spent so far |

The team still pays its winning bid for the slip. A slip earns no points of its own beyond its effect.

## 3. Scoring (exact)

```
Remaining purse = Starting purse + cash bonuses − total spent
Points          = sum of points of every lot bought (+ bonus points, − penalties)
Purse points    = floor(Remaining purse in Cr) × 1          (₹2.5 Cr left → 2 points; never negative)
Final points    = Points + Purse points   (purse points stay 0 until the organiser presses "Calculate final points")
Rank            = by Final points, highest first (tie-break: more purse left, then team order)
```
- Starting purse is a single setting, applied to all teams. **It has not been confirmed yet**: the first brief said ₹100 Cr. With prices topping out at ₹8 Cr, ₹100 Cr makes leftover cash worth up to ~100 points, more than any player (max 50). Suggest making it configurable and defaulting to about **₹20 Cr**, or confirm with the organiser.
- Overspending (remaining purse below 0) must be blocked, or at least flagged in red.

## 4. All auction items

Items marked * were added later as suggestions (not from the organiser's handwritten list); keep them but let the organiser edit or delete them.

### Round 1: Actors & Actresses (31)

| Lot | Name | Base price | Points |
|---|---|---|---|
| 1 | Thalapathy Vijay | ₹5.5 Cr | 35 |
| 2 | Thala Ajith | ₹4 Cr | 30 |
| 3 | Rajinikanth | ₹3 Cr | 25 |
| 4 | Allu Arjun | ₹2 Cr | 25 |
| 5 | Prabhas | ₹4 Cr | 40 |
| 6 | Atharvaa | ₹25 L | 15 |
| 7 | Kamal Haasan | ₹2 Cr | 20 |
| 8 | Hrithik Roshan | ₹5 Cr | 37 |
| 9 | Yash | ₹3 Cr | 29 |
| 10 | Shah Rukh Khan | ₹4 Cr | 28 |
| 11 | Nani | ₹2 Cr | 23 |
| 12 | Suriya | ₹4 Cr | 30 |
| 13 | Ram Charan | ₹2 Cr | 16 |
| 14 | Nayanthara | ₹50 L | 10 |
| 15 | Mrunal Thakur | ₹1 Cr | 17 |
| 16 | Trisha | ₹1 Cr | 16 |
| 17 | Janhvi Kapoor | ₹2 Cr | 19 |
| 18 | Chris Evans | ₹6 Cr | 48 |
| 19 | Tom Holland | ₹7 Cr | 53 |
| 20 | Robert Downey Jr. (Dr. Doom) | ₹9 Cr | 62 |
| 21 | Mohanlal | ₹2 Cr | 26 |
| 22 | Vijay Sethupathi | ₹2.5 Cr | 27 |
| 23 | NTR Jr. | ₹1 Cr | 29 |
| 24 | Dhanush* | ₹1.5 Cr | 30 |
| 25 | Dulquer Salmaan* | ₹4 Cr | 28 |
| 26 | Fahadh Faasil* | ₹1.5 Cr | 25 |
| 27 | Deepika Padukone* | ₹2 Cr | 20 |
| 28 | Ranbir Kapoor* | ₹5 Cr | 40 |
| 29 | Samantha Ruth Prabhu* | ₹1 Cr | 15 |
| 30 | Sai Pallavi* | ₹50 L | 12 |
| 31 | Chris Hemsworth | ₹7.5 Cr | 55 |

### Round 2: Cricketers (30) (points secret until sold)

| Lot | Name | Role | Base price | Points (hidden) |
|---|---|---|---|---|
| 1 | Mitchell Starc | Bowler | ₹5 Cr | 30 |
| 2 | Bhuvneshwar Kumar | Bowler | ₹2 Cr | 22 |
| 3 | Harshit Rana | Bowler | ₹1.75 Cr | 14 |
| 4 | Varun Chakravarthy | Bowler | ₹1.5 Cr | 16 |
| 5 | Jasprit Bumrah | Bowler | ₹6 Cr | 33 |
| 6 | Sanju Samson | Wicketkeeper-Batter | ₹6 Cr | 42 |
| 7 | Rajat Patidar | Batter | ₹4 Cr | 35 |
| 8 | Phil Salt | Wicketkeeper-Batter | ₹2.5 Cr | 28 |
| 9 | Ajinkya Rahane | Batter | ₹2 Cr | 24 |
| 10 | Rovman Powell | Batter | ₹50 L | 16 |
| 11 | Shreyas Iyer | Batter | ₹5 Cr | 39 |
| 12 | Priyansh Arya | Batter | ₹50 L | 22 |
| 13 | MS Dhoni | Wicketkeeper-Batter | ₹8.5 Cr | 77 |
| 14 | Rohit Sharma | Batter | ₹6.5 Cr | 45 |
| 15 | Virat Kohli | Batter | ₹7 Cr | 55 |
| 16 | Ruturaj Gaikwad | Batter | ₹2 Cr | 31 |
| 17 | Venkatesh Iyer | All-rounder | ₹2 Cr | 20 |
| 18 | Krunal Pandya | All-rounder | ₹1.5 Cr | 17 |
| 19 | Romario Shepherd | All-rounder | ₹1.5 Cr | 19 |
| 20 | Hardik Pandya | All-rounder | ₹2 Cr | 28 |
| 21 | Jamie Overton | All-rounder | ₹1 Cr | 20 |
| 22 | Shivam Dube | All-rounder | ₹2 Cr | 22 |
| 23 | Suryakumar Yadav* | Batter | ₹3 Cr | 30 |
| 24 | Shubman Gill* | Batter | ₹3 Cr | 30 |
| 25 | Rishabh Pant* | Wicketkeeper-Batter | ₹3 Cr | 28 |
| 26 | Yashasvi Jaiswal* | Batter | ₹2 Cr | 25 |
| 27 | Abhishek Sharma* | Batter | ₹1 Cr | 22 |
| 28 | Ravindra Jadeja* | All-rounder | ₹3 Cr | 30 |
| 29 | Rashid Khan* | Bowler | ₹2 Cr | 27 |
| 30 | Mohammed Siraj* | Bowler | ₹1.5 Cr | 20 |

### Round 3: Singers & Music Directors (31) (base ₹50 L each, points always secret)

| Lot | Name | Type | Base price | Points (secret) |
|---|---|---|---|---|
| 1 | Yuvan Shankar Raja | Music Director | ₹50 L | 22 |
| 2 | Santhosh Narayanan | Music Director | ₹50 L | 10 |
| 3 | M.S. Viswanathan | Music Director | ₹50 L | 28 |
| 4 | Ilaiyaraaja | Music Director | ₹50 L | 40 |
| 5 | Sai Abhyankkar | Music Director | ₹50 L | 30 |
| 6 | Harris Jayaraj | Music Director | ₹50 L | 17 |
| 7 | G.V. Prakash Kumar | Music Director | ₹50 L | 16 |
| 8 | Anirudh Ravichander | Music Director | ₹50 L | 32 |
| 9 | A.R. Rahman | Music Director | ₹50 L | 35 |
| 10 | Devi Sri Prasad | Music Director | ₹50 L | 22 |
| 11 | Mani Sharma | Music Director | ₹50 L | 20 |
| 12 | Shreya Ghoshal | Singer | ₹50 L | 25 |
| 13 | M.M. Keeravani | Music Director | ₹50 L | 35 |
| 14 | Thaman S | Music Director | ₹50 L | 25 |
| 15 | Ravi Basrur | Music Director | ₹50 L | 20 |
| 16 | Naushad Ali | Music Director | ₹50 L | 45 |
| 17 | S.P. Balasubrahmanyam | Singer | ₹50 L | 50 |
| 18 | S. Janaki | Singer | ₹50 L | 30 |
| 19 | K.S. Chithra | Singer | ₹50 L | 35 |
| 20 | M.S. Subbulakshmi | Singer | ₹50 L | 37 |
| 21 | Karthik | Singer | ₹50 L | 20 |
| 22 | Sid Sriram | Singer | ₹50 L | 22 |
| 23 | Arijit Singh | Singer | ₹50 L | 38 |
| 24 | Vijay Antony* | Music Director | ₹50 L | 18 |
| 25 | D. Imman* | Music Director | ₹50 L | 20 |
| 26 | K.J. Yesudas* | Singer | ₹50 L | 42 |
| 27 | Hariharan* | Singer | ₹50 L | 30 |
| 28 | Shankar Mahadevan* | Singer | ₹50 L | 30 |
| 29 | Sonu Nigam* | Singer | ₹50 L | 32 |
| 30 | Chinmayi* | Singer | ₹50 L | 22 |
| 31 | Shaan* | Singer | ₹50 L | 24 |

## 5. What the app must do

The organiser tried a full-featured web app earlier and found it **too hard to update live with 20–25 teams**. Keep the live workflow dead simple: one screen, big buttons, few clicks. Everything else is secondary.

### 5.1 Must have

- **Teams setup**: add/rename/delete 20–25 teams; one starting-purse setting for all.
- **Auction console (organiser's laptop)**: shows the current lot (photo, name, base price, points if allowed for that round), lets the organiser pick the winning team and type the final price, then press **SOLD** or **UNSOLD**, then **NEXT LOT**. Purse and points update instantly. Undo the last action.
- **Round-specific visibility**: Round 1 shows points; Round 2 hides points until SOLD then reveals them; Round 3 never shows points on the audience screen; Round 4 shows a mystery slip, then the organiser picks which slip was opened and the app applies its effect (or lets the organiser enter the bonus points/cash manually).
- **Manual adjustments**: add/remove points (bonus or penalty) and add/remove cash for any team at any time, with a note.
- **Team table** (Excel-like, as the organiser asked): Team name | Purse | Remaining purse | Points | Total spent | Bonus points | Bonus cash | Purse points | **Final points** | Rank. All computed automatically.
- **Audience / projector screen** with a full-screen presentation mode: current lot big in the middle (photo, name, base price, and points only when allowed), the winning bid, then a big "SOLD to TEAM for ₹X" moment.
- **Live dashboard / leaderboard**: big **Top 3** (1st, 2nd, 3rd with team name and final points) plus full standings, updating after every sale.
- **Player database**: add/edit/delete items per round (name, photo, role, base price, points); bulk import from Excel/CSV.
- **Photos**: each person needs a photo. Allow upload per player and/or auto-fetch from Wikipedia (see 7.3).
- **Save automatically** (survives refresh/crash) and **export results to Excel/CSV**.
- **Final results screen**: reveal 3rd, then 2nd, then Champions with confetti.

### 5.2 Nice to have (from the original brief)

- Countdown timer per lot (60 s default, extendable), with "AUCTION CLOSED" at zero.
- Sound effects (bell, bid, hammer, SOLD, winner) with a mute button.
- Special-event announcements (full-screen banners).
- Auction history with filters, simple analytics (highest buy, biggest spender, etc.).
- Separate team view so a team can see its purse, players and points.
- Demo mode that simulates a whole auction for rehearsal.
- Works on projector, laptop, tablet and phone.

## 6. Look and feel

- Name: **BID WARS**, subtitle **THE ULTIMATE OFFICE AUCTION**. Original identity: **no IPL logos, team logos or broadcast graphics**.
- Feel: sports-broadcast auction night. Dark navy/ink background `#0B1020`, panels `#161E36`, gold for money and highlights `#F5B833`, white text.
- Round colours: Round 1 coral `#FF6A3D`, Round 2 green `#2FD58A`, Round 3 violet `#A07BFF`, Round 4 pink `#FF4FA3`.
- Very large type on the projector: player name and current bid readable from the back of the room. Big "SOLD!" stamp moment.
- Organiser screen: large buttons, minimal menus; everything important within one or two clicks.

## 7. Suggested technical approach

### 7.1 Stack

React + TypeScript + Tailwind (or any simple web stack). No backend needed for a single laptop: keep state in localStorage/IndexedDB and sync the console and projector windows on the same computer with `BroadcastChannel`. If teams should watch on their own phones, add a small real-time store (Firebase Realtime Database or Supabase).

### 7.2 Data model

```json
{
  "settings": { "eventName": "BID WARS", "startingPurseCr": 20, "pointsPerCrLeft": 1 },
  "teams": [ { "id": "t1", "name": "Team 1", "bonusPoints": 0, "bonusCashCr": 0 } ],
  "rounds": [
    { "id": "r1", "name": "Actors & Actresses", "pointsVisibility": "always" },
    { "id": "r2", "name": "Cricketers", "pointsVisibility": "afterSale" },
    { "id": "r3", "name": "Singers & Music Directors", "pointsVisibility": "never" },
    { "id": "r4", "name": "Mystery Round", "pointsVisibility": "never", "lots": 4 }
  ],
  "items": [
    { "id": "p1", "roundId": "r1", "lot": 1, "name": "Thalapathy Vijay", "role": "Actor",
      "basePriceCr": 5, "points": 30, "photo": "data-url or file",
      "status": "available | sold | unsold", "teamId": null, "soldPriceCr": null }
  ],
  "slips": [ { "id": "s1", "title": "Instant 51 points", "effect": "bonusPoints", "value": 51 } ],
  "log": [ { "at": "ISO time", "text": "SOLD: Vijay to Team 3 for ₹6 Cr" } ]
}
```
Derived per team: `spent = Σ soldPriceCr`, `remaining = startingPurse + bonusCash − spent`, `points = Σ item points + bonusPoints`, `pursePoints = max(0, floor(remaining)) × pointsPerCrLeft`, `final = points + pursePoints`.

### 7.3 Photos

Fetch the main photo for each person from Wikipedia: `https://en.wikipedia.org/w/api.php?action=query&titles=<Article>&prop=pageimages|pageprops&piprop=name&redirects=1&format=json` gives the image file name (`pageimage`) and Wikidata id. Then `https://commons.wikimedia.org/w/api.php?action=query&titles=File:<name>&prop=imageinfo&iiprop=url|mime&iiurlwidth=960&format=json` gives a ready 960 px `thumburl`. If the article has no image, try the Wikidata P18 property, then a Commons file search. Send a descriptive User-Agent, use standard thumbnail widths (e.g. 960; odd sizes get HTTP errors), pause about 1 s between downloads and retry on HTTP 429. Some names will still have no photo: always allow a manual upload. Crop photos to a portrait 4:5 frame, keeping the top (faces). Useful article titles where the plain name is ambiguous: Vijay (actor), Ajith Kumar, Yash (actor), Nani (actor), Trisha Krishnan, Chris Evans (actor), N. T. Rama Rao Jr., Abhishek Sharma (cricketer), Karthik (singer), Hariharan (singer), Shaan (singer), Naushad.

## 8. What already exists (for reference)

- **BID_WARS_Auction.pptx** (136 slides): title, rules, scoring; per-lot slides for all 3 rounds with photo boxes; Round 2 has a bid slide and a "SOLD!" reveal slide per cricketer; Round 3 shows ₹50 L with points hidden (points are in speaker notes); 4 mystery slip slides + a slide revealing all 5 slips; podium slide.
- **BID_WARS_Scoresheet.xlsx**: Teams sheet with 25 team rows, starting purse cell, 8 purchase slots per team (price + points), Add Points, Add Cash, Total Spent, Purse Points, Final Points, Rank; a Dashboard sheet with live Top 3, full standings and a Top-10 chart; a Players reference sheet; a How-to sheet.
- **add_photos.py**: Python script that downloads Wikipedia/Commons photos and puts them into the deck's photo boxes.
- An earlier full React web app prototype (auctioneer console, live screen, power cards, analytics, demo mode). The organiser found it too complex for live use with 20–25 teams, which is why the simpler Excel workflow was made. The new app should be as easy as the Excel sheet but look like the projector deck.

## 9. Open questions to confirm with the organiser

- Starting purse per team (₹100 Cr from the first brief, or smaller, e.g. ₹20 Cr; see section 3).
- Sanju Samson's points (missing from the handwritten list).
- Handwriting readings to double-check: G.V. Prakash Kumar = 16 points (could be 15), K.S. Chithra = 35 points.
- The 24 starred items were suggested additions; prices and points for them are suggestions.
- Exact number of teams (20–25) and their names.
- Original Round 1 list had "Robert Jr (DR. Doom)": shown as Robert Downey Jr., "as Dr. Doom".

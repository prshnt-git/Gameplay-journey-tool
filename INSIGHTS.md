# Insights

## 1. Ambrose Valley is the primary progression map, and it carries most of the looting behavior

### What caught my eye

Ambrose Valley dominates the dataset not just by match count, but by how much player and bot movement plus looting it absorbs.

### Evidence

- 566 of 796 matches are on Ambrose Valley: **71.1%**
- It contains **66.7%** of all movement samples (`48,754` of `73,059`)
- It contains **77.3%** of all loot events (`9,955` of `12,885`)
- Its top traffic cells are around **(422.4, 806.4)** and **(524.8, 576.0)** on the minimap stage

### Actionable read

If the team wants the fastest impact from a level-design pass, Ambrose Valley is the best target.

- Audit why Ambrose produces far more loot interaction than Lockdown or Grand Rift
- Reuse the successful loot-route structure from Ambrose when revisiting the other maps
- If Ambrose is too dominant in rotation, redistribute reward density or route clarity elsewhere

### Metrics affected

- loot pickup rate
- route diversity
- map preference / replay share

### Why a level designer should care

This is where most of the game’s observed moment-to-moment navigation is happening, so small improvements here influence the largest share of live player journeys.

## 2. The recorded encounter loop is overwhelmingly PvE, not PvP

### What caught my eye

Almost every recorded kill in this slice is tied to bots, not human-vs-human combat.

### Evidence

- `BotKill`: **2,415**
- `Kill`: **3**
- `BotKilled`: **700**
- `Killed`: **3**
- That means **99.88%** of recorded kills are in the bot-combat path rather than human-vs-human eliminations

### Actionable read

This telemetry is telling a strong story about PvE routing and AI contact points, but barely any story about PvP duel spaces.

- If stronger PvP is a design goal, compress human routes toward shared choke points, extracts, or objectives
- Reduce bot interception in the most dominant lanes if bots are absorbing the combat budget before players meet each other
- Track future change with human-vs-human kill rate and distinct human overlap zones

### Metrics affected

- PvP encounter rate
- combat intensity
- player kill mix
- competitive-session retention

### Why a level designer should care

Right now, the layout is not producing many measurable human-vs-human collision points in this data slice. That has direct implications for how tense or player-driven the match feels.

## 3. Lockdown appears to funnel combat and storm pressure into a narrow repeated pocket

### What caught my eye

Lockdown’s highest kill cells and highest death cells overlap tightly, while its biggest traffic cells sit in different places. That suggests movement is broad enough, but fights resolve in one repeated choke.

### Evidence

- Top Lockdown traffic cells: **(550.4, 268.8)** and **(217.6, 396.8)**
- Top Lockdown kill cells: **(627.2, 524.8)** and **(627.2, 550.4)**
- Top Lockdown death cells: **(627.2, 524.8)** and **(627.2, 550.4)**
- Storm deaths per 100 matches:
  - Ambrose Valley: **3.00**
  - Grand Rift: **8.47**
  - Lockdown: **9.94**

### Actionable read

The likely pattern is that players rotate through multiple lanes, then collapse into the same east-central resolution area and get punished there by both combat and late pressure.

- Add one more safe flank or extraction-friendly branch near the `~(627, 525)` cluster
- Pull one reward/objective node closer to the major traffic lanes so fights distribute earlier instead of resolving in one final pocket
- Track whether combat heat spreads across more cells and whether storm death rate drops after iteration

### Metrics affected

- storm death rate
- combat distribution entropy
- route diversity
- extraction success

### Why a level designer should care

When kill and death heat collapse onto the same small area repeatedly, the map risks feeling solved. That usually means fewer meaningful routing decisions and less varied match texture over time.

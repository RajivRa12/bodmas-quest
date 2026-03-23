# BODMAS Quest

An interactive web-based learning game to master BODMAS (Order of Operations).

🎮 **[Play Live](https://bodmas-quest.onrender.com)**

## Features
- 3 Game Modes: Normal, Practice, Challenge
- 3 Difficulty Levels: Easy, Medium, Hard
- 14 Unlockable Achievement Badges
- Global Leaderboard (PHP backend)
- Player Profile & Lifetime Stats
- Hint System
- BODMAS Reference Card
- Dark / Light Theme
- Wrong Answer Review
- PWA — installable as a mobile app
- Fully offline capable (localStorage fallback)

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | PHP 8.2 |
| Data Store | JSON flat file (scores.json) |
| Deployment | Docker + Render.com |

## Run Locally

```bash
# With PHP
php -S localhost:8080

# Without PHP (localStorage mode)
open index.html
```

## Deploy to Render.com

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Select **Docker** runtime
5. Click **Deploy** — it auto-detects `render.yaml`

Your live URL: `https://bodmas-quest.onrender.com`

## Project Structure

```
tgchg/
├── index.html          # Main app (all screens)
├── style.css           # Design system + all components
├── api.php             # PHP REST API (scores/leaderboard)
├── scores.json         # Score data (auto-created)
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (offline)
├── Dockerfile          # Container for deployment
├── render.yaml         # Render.com config
└── js/
    ├── audio.js        # Web Audio API sound engine
    ├── particles.js    # Background particle system
    ├── confetti.js     # Confetti celebration effect
    ├── storage.js      # PHP API + localStorage layer
    ├── achievements.js # 14-badge achievement system
    ├── profile.js      # Lifetime player stats
    ├── questions.js    # BODMAS question generator
    ├── game.js         # Game state machine (3 modes)
    ├── ui.js           # All DOM rendering
    └── main.js         # App bootstrap + event wiring
```

## BODMAS Rules Implemented
**B**rackets → **O**rders → **D**ivision → **M**ultiplication → **A**ddition → **S**ubtraction

All questions are algorithmically generated using real math — no AI for answers.

# Early Settlers

A real-time classroom resource-management game built with Node.js, Express, and Socket.io. Game state is persisted to a GitHub repository (used as a cloud database).

## Stack

- **Runtime:** Node.js 20
- **Framework:** Express 5 + Socket.io 4
- **Data storage:** GitHub file API (via `githubSync.js`)
- **Frontend:** Vanilla HTML/CSS/JS in `client/`

## How to run

The workflow **"run app"** handles everything:

```
npm install && node app.js
```

The server starts on **port 3000** (mapped to external port 80).

## Required secrets

All five must be set in Replit Secrets:

| Secret | Description |
|---|---|
| `GITHUB_TOKEN` | Personal access token with repo read/write |
| `GITHUB_OWNER` | GitHub username or org that owns the data repo |
| `GITHUB_REPO` | Repo where the JSON game-state file lives |
| `GITHUB_PATH` | Path to the JSON file inside that repo |
| `GITHUB_BRANCH` | Branch to read/write (e.g. `main`) |

## Pages

| Route | Description |
|---|---|
| `/` | Main menu (index.html) |
| `/settings.html` | Game Settings — manage players, teams, schools |
| `/dashboard.html` | TV Dashboard — live scoreboard |
| `/controller.html` | Player Action Panel — claim resources, buy buildings |
| `/adjustments.html` | Manual resource adjustments |

## Architecture

- `app.js` — Express server + all Socket.io event handlers, in-memory game state
- `githubSync.js` — pull/push game JSON to GitHub on startup and round transitions
- `structures.js` — building definitions (costs, points, tech-tree requirements)
- `client/js/` — per-page frontend scripts

# Drill study workspace

React frontend for [Drill API](https://github.com/ybelai2/drillapi).

## Features

- Signup, login, logout, and session restoration on refresh.
- Course CRUD with course code, semester, and description.
- Class/lecture CRUD with notes and a persisted studied status.
- Generate and save decks from PowerPoint slides; reopen, edit question/flashcard content, or delete decks.
- Existing Learn, Flashcards, and Test modes.
- Responsive light/dark themes, saved locally, defaulting to the system preference.

## Run

Requires Node 22+:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Start the companion backend at `http://localhost:8080`. Set `VITE_API_URL` to its origin. Without this variable, the frontend uses `https://drillapi.onrender.com`.

```sh
npm run lint
npm run build
```

## Deploy together with the backend

Set `VITE_API_URL` in Vercel and redeploy. Add the exact frontend origin to the backend's `ALLOWED_ORIGINS`. Deploy the matching backend authentication/library changes before using this UI. The backend requires durable PostgreSQL, credentials, and migrations; Gemini generation additionally needs `GEMINI_API_KEY`.

The API session token is kept in sessionStorage, not a cookie, and is sent in the Authorization header. Logout revokes it server-side; sessions expire after seven days. Closing the browser tab normally clears local authentication. Never put backend secrets in Vite environment variables.

Course/class/deck records persist in PostgreSQL across refreshes and devices after signing in. Light/dark preference is local to the browser. Practice answers and test scores are currently session-only. Email verification and password recovery are not implemented.

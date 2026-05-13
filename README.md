# Prime Connects MVP

A phone-first web/PWA MVP for the Prime Connects App product spec. It uses the exact black-and-gold brand direction from the pasted document and runs with no third-party packages so it works in constrained environments.

## Features

- Responsive mobile and desktop web app shell
- Verified account sign-up, login, logout, password reset, failed-login lockout after 5 attempts
- Database-backed sessions using signed HTTP-only cookies
- File-backed JSON database initialized from `data/prime-connects.seed.json`
- Hinge-style onboarding with one profile question/action per screen
- Events list, event detail, check-in, attendee lists, and pending match state
- AI-style match scoring using industries, services, needs, interests, and skill swaps
- One-tap connections with private notes and badge auto-posts
- Private direct messaging only between connected users
- Prime Feed with win posts, badge posts, likes display, and no-link moderation
- Skill Swap publishing
- Account screen with profile and badges

## Run locally

```bash
npm run dev
```

Then open <http://localhost:3000>.

The app creates `data/prime-connects.db.json` on first run from the seed file. Seeded demo users use this password:

```text
PrimePass123
```

Example seeded login:

```text
maya@primeconnects.test
```

New users can sign up and then press the in-app **Verify email and continue** button to simulate clicking an email verification link.

## Checks

```bash
npm run check
```

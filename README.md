# Prime Connects MVP

A phone-first web/PWA MVP for the Prime Connects App product spec. It uses the exact black-and-gold brand direction from the pasted document and runs with no third-party packages so it works in constrained environments.

## Features

- Responsive mobile and desktop web app shell
- Verified account sign-up, login, logout, password reset, failed-login lockout after 5 attempts
- Database-backed sessions using signed HTTP-only cookies
- File-backed JSON database initialized from `data/prime-connects.seed.json`
- Hinge-style onboarding with one profile question/action per screen, immutable age, profile image uploads, custom services, and custom hobbies/interests
- Events list, event detail, event flyers, RSVP links, check-in, attendee lists, and pending match state
- AI-style match scoring using industries, services, needs, interests, and skill swaps
- One-tap connections with private notes and badge auto-posts
- Private direct messaging only between connected users, separated into one thread per two-person conversation
- Prime Feed with win posts, badge posts, likes display, no-link moderation, and professional-content filtering
- Skill Swap publishing
- Account screen with editable profile details, standard image uploads for profile pictures, and badges; age cannot be edited after creation
- Online/recent/offline status indicators
- Admin portal for `networking@primeconnectsindy.com` to manage events, uploaded image/PDF flyers, RSVP links, criteria-based badges, and users

## Run locally

```bash
npm run dev
```

Then open <http://localhost:3000>.

The app creates `data/prime-connects.db.json` on first run from the seed file. Seeded demo users use this password:

```text
PrimePass123
```

Example seeded user login:

```text
maya@primeconnects.test
```

Admin portal login:

```text
networking@primeconnectsindy.com
```

New users can sign up and then press the in-app **Verify email and continue** button to simulate clicking an email verification link.

## Checks

```bash
npm run check
```

## Expo / React Native mobile app

A first Expo mobile client lives in `mobile/`. It reuses the existing Node API, so run the backend first:

```bash
npm run dev
```

In a second terminal, start Expo:

```bash
npm run mobile
```

For Expo Go on a physical device, set the API URL to your computer's LAN IP instead of `localhost`:

```bash
EXPO_PUBLIC_API_URL="http://YOUR-LAN-IP:3000" npm run mobile
```

The mobile app includes the core member experience: login, home, events/check-in, connections, messages, feed, toolbox browsing, account logout, and an admin dashboard summary. Detailed admin file uploads and document editing remain available in the web admin console.

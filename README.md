# Activity Tracker

A small full-stack starter built to refresh modern web skills: **Next.js (App Router), React, TypeScript, Zod, Vitest, GitHub Actions CI**. It logs workouts, validates them through a typed API, and renders a server-side dashboard.

## Run it

Requires Node 20.9+ (Node 22 recommended).

```bash
npm install
npx drizzle-kit migrate
npm run dev        # http://localhost:3000, create an account at /signup
```

Other scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

The app needs Postgres. Create `.env.local` with:

```bash
DATABASE_URL=postgres://...
BETTER_AUTH_SECRET=...      # openssl rand -hex 32
BETTER_AUTH_URL=http://localhost:3000
TEST_DATABASE_URL=postgres://...   # optional, must be a separate database
```

`TEST_DATABASE_URL` enables the Postgres tests, which **truncate its tables**, so never point it at data you care about. `drizzle-kit migrate` only targets `DATABASE_URL`; to migrate the test database, set `DATABASE_URL` to its URL for that one command.

Try the API directly. It needs a session, so sign in first and keep the cookie:

```bash
curl -c cookies.txt -X POST localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3000" \
  -d '{"email":"you@example.com","password":"your-password"}'

curl -b cookies.txt -X POST localhost:3000/api/activities \
  -H "Content-Type: application/json" \
  -d '{"type":"run","durationMinutes":30,"distanceKm":5,"performedAt":"2026-10-31T12:00:00.000Z"}'

curl -b cookies.txt localhost:3000/api/activities

# Should return 422 with field-level errors:
curl -b cookies.txt -X POST localhost:3000/api/activities -H "Content-Type: application/json" \
  -d '{"type":"teleport","durationMinutes":-5}'

# Should return 401:
curl localhost:3000/api/activities
```

## Where each concept lives

| Concept | File |
| --- | --- |
| Schema as single source of truth (runtime + types) | `src/lib/schemas.ts` |
| Interface-based data layer (swappable storage) | `src/lib/store.ts` |
| Pure, unit-testable logic | `src/lib/stats.ts` |
| Route handlers, status codes, validation errors | `src/app/api/activities/route.ts` |
| Server Components, direct data access, no `useEffect` | `src/app/page.tsx` |
| Auth layer 1: optimistic cookie redirect | `src/proxy.ts` |
| Auth layer 2: real session check per route | `src/lib/session.ts` |
| Auth layer 3: ownership in every query | `src/lib/postgres-store.ts` |
| Server Actions, `revalidatePath` | `src/app/actions.ts` |
| Client Components, forms, calling a Server Action | `src/components/ActivityForm.tsx` |
| Layouts and metadata | `src/app/layout.tsx` |
| Error boundaries | `src/app/error.tsx` |
| Tests | `src/lib/*.test.ts` |
| CI | `.github/workflows/ci.yml` |

Read them in that order. Each has a `LEARNING NOTE` comment.

## Exercises (in priority order for job readiness)

1. ~~**Postgres + ORM.** Write a second `ActivityStore` backed by Postgres using Prisma or Drizzle, and swap it in. The route and page should not change. This is the biggest gap to close: typed database access.~~
2. ~~**Edit and delete.** Add `PATCH` and `DELETE` at `app/api/activities/[id]/route.ts` (note: `params` is a Promise in current Next.js). Return `404` for unknown ids. Add tests.~~
3. ~~**Server Actions.** Replace the fetch in `ActivityForm` with a Server Action and compare. Know when you would pick each.~~
4. **Auth.** Add Auth.js (or similar) so activities belong to a user. Protect the API with middleware/`proxy` and per-route checks.
5. **Caching.** Remove `force-dynamic` and use `revalidatePath`/`revalidateTag` instead. Understand what is cached and why. This trips up experienced developers most.
6. **Shared types end to end.** Derive the API response types from the same schemas, and consider a typed client or tRPC.
7. **Ingest external data.** Add a webhook endpoint that accepts wearable-provider payloads (mock them), validates them with Zod, and maps them into `Activity`. This echoes real production experience, so it makes a good interview story.
8. **Deploy.** Vercel for the app plus a hosted Postgres (Neon, Supabase), or Docker on Azure/GCP.
9. **Testing depth.** Add a route-handler test (call `POST(new Request(...))` directly) and a component test with React Testing Library; consider Playwright for one end-to-end flow.

## Things worth being able to explain in interviews

- Server vs. Client Components: what runs where, and why `"use client"` goes on small leaf components.
- Why TypeScript types are not enough at API boundaries, and what Zod adds.
- Why the store is an interface (dependency inversion, testability, swapping storage).
- Trade-offs between route handlers and Server Actions.
- How Next.js caching and revalidation work.

## Known limitations of this starter

- The JSON-file store only backs the tests. It has no concurrency safety or multi-instance support, so the app itself always uses Postgres.
- Sign-up has no email verification or password reset.
- Better Auth's rate limiting only covers its own auth endpoints and keeps counts in memory. The activity API has no rate limiting.

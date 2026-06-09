# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Remy is a voice-first AI co-pilot for home services field representatives (roofing, HVAC, plumbing, etc.). It provides pre-job briefs, live objection coaching, weather intel, GPS co-piloting, and a manager command center. The AI core is Claude (`claude-sonnet-4-6`) accessed via the Anthropic SDK.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test suite is configured.

## Architecture

**Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS

**Services:**
- **Auth:** Clerk (user/org identity, `useUser()` / `auth()`)
- **Database:** Supabase (PostgreSQL — profiles, jobs, conversations, notes, doctrine, memories, invites, companies)
- **AI:** Anthropic Claude via `@anthropic-ai/sdk` — chat at `/api/chat`, specialized agents under `/api/agent/*`
- **TTS:** Cartesia (streaming MP3) at `/api/voice`
- **Payments:** Stripe (webhooks at `/api/webhook`)
- **Email:** Resend at `/api/weekly-email`
- **External:** Google Maps (geocoding, nearby places), OpenWeather

**Key directories:**
- `app/api/` — 23 Next.js route handlers (backend logic lives here)
- `app/dashboard/` — Rep-facing UI (jobs, notes, voice, doctrine, settings, outcome, proposals, broadcasts, timeline)
- `app/boss/` — Manager command center (team analytics, leaderboard, broadcasts)
- `app/onboard/` — Onboarding flow
- `components/` — Shared React components (`RemyCore` animated canvas, `Leaderboard`)
- `lib/` — Core utilities: `remySoul.ts` (system prompt builder), `supabase.ts` (DB client), `useProfile.ts` (auth/profile hook)

## Core Patterns

**System prompt construction** — `lib/remySoul.ts` exports a builder that injects real-time context into Claude: current time/day, rep name and personality, active job details, nearby places, weather, company doctrine, and inferred user intent. Always update this file when adding new context sources.

**Intent detection** — The chat API (`app/api/chat/route.ts`) uses regex patterns to detect when a rep's message implies a note, follow-up, job outcome, or financing request. Detected intents trigger agentic fire-and-forget side effects via `Promise.all([...]).catch(() => {})` so they never block the streaming response.

**Agentic background tasks** — Side effects (DB writes, broadcasts, follow-up scheduling) are kicked off as parallel promises inside `/api/chat` after the response stream starts. They must be wrapped in `.catch(() => {})` to prevent unhandled rejections from crashing the response.

**Rate limiting** — `/api/rate-limit` enforces per-rep daily message quotas tied to subscription plan. Check this before adding new LLM call surfaces.

**Profile access** — Always use `useProfile()` from `lib/useProfile.ts` on the client or `auth()` from Clerk + a Supabase lookup on the server. Never pass user identity through URL params.

**Supabase client** — Import from `lib/supabase.ts`. Server routes use the service role key; client components use the anon key with Clerk JWT.

## ESLint Configuration

The `.eslintrc.json` explicitly disables `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unused-vars`, and `react-hooks/exhaustive-deps`. Don't fight these — the codebase uses `any` intentionally in API response handling.

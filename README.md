# "Never Miss a Customer" — Interactive Demo (DENTAL)

A fictional US dental practice website (**Bright Smile Dental Studio — Family & Cosmetic
Dentistry, Austin TX**) with an embedded AI care coordinator (**Nora**) that demonstrates
Tameer Ali's **"Never Miss a Customer"** automation system to a dental practice owner in
~60 seconds.

**100% static. No backend, no build step, zero external requests, zero tracking.**
Works from `file://` and any static host.

Part of the multi-niche demo factory (see `~/workspace/outreach/demo-links.md`).
Sibling: `~/workspace/outreach/demo/` (Casa Verde restaurant + Maya).

## What it demonstrates (the 4 flows)

1. **Services / pricing / insurance Q&A** — ask about cleanings ($99 new-patient special),
   whitening (from $299), Invisalign (free consult), fillings, crowns, emergency care,
   kids' dentistry, sedation for anxious patients, and the big one: *"do you take my
   insurance?"* → most major PPO plans (Delta, Cigna, Aetna, MetLife, Guardian) +
   benefits verified before the visit, no surprise bills.
2. **Appointment booking** — reason for visit → name → optional text reminder →
   preferred day → time → confirmation card with booking reference (e.g. `BS-KT9X2`).
3. **After-hours lead capture** *(the money flow)* — tap "🌙 After-hours demo":
   a notice reads *"It's 11:42 PM — we're closed right now, but I'm Nora,
   Bright Smile's care coordinator, and I'm still here."* A toothache inquiry →
   name + phone + concern → "Saved! The morning team will call you first thing" →
   a mini **"Saved to your dashboard"** card appears. This is the moment that sells the
   system: *every late-night toothache becomes a morning appointment, not a patient
   lost to the practice down the street.*
4. **Review request** — tap "⭐ Rate your visit" → tap the stars:
   - **5 stars** → "Would you share that on Google?" + Google review button.
   - **1–4 stars** → "What could we do better?" → feedback captured →
     "Our practice manager will personally follow up."

Plus: graceful fallbacks for off-script input (never dead-ends), quick-reply chips,
typing indicator with realistic delays, auto-open nudge after ~8s, and the site's
"Book an appointment" buttons jump straight into the booking flow.

Copy is in **buyer language** ("never miss a patient", "after-hours", "same-day
emergency slots") — never "AI chatbot" jargon. Widget header/footer carries a small
credit: *"Live demo by Tameer Ali · AI Automation"*.

## Personalize per prospect

Append query params — the practice name, tagline, city, address and phone swap
everywhere (page + widget + booking-reference prefix):

```
index.html?biz=Smile%20Works%20Dental&tagline=Family%20Dentistry&city=Denver%2C%20CO&address=88%20Blake%20St%2C%20Denver%2C%20CO%2080202&phone=%28303%29%20555-0119
```

| Param     | Default                          |
|-----------|----------------------------------|
| `biz`     | Bright Smile Dental Studio       |
| `tagline` | Family & Cosmetic Dentistry      |
| `city`    | Austin, TX                       |
| `address` | 4210 N Lamar Blvd, Austin, TX 78756 |
| `phone`   | (512) 555-0182                   |

`?fast=1` skips animation delays (used by the automated test harness).

**Outreach workflow:** for each dental prospect, generate their link with
`?biz=<Their Practice Name>` so the demo greets them as *their own* practice.
The personalized demo is the outreach hook — audit opens, demo closes.

## Hosting options

- **Fastest (recommended):** Netlify Drop / Vercel / Cloudflare Pages / GitHub Pages —
  drag the `demo-dental/` folder, get a public HTTPS link in ~1 minute.
- **Any static host** works — it's plain HTML/CSS/JS.
- **Local preview:** `python3 -m http.server` inside `demo-dental/`, or just double-click
  `index.html` (works from `file://`).

Hosting is handled by the parent agent — this subagent builds and verifies only.

## Verification

End-to-end harness at `/tmp/verify/verify-dental.js` (puppeteer-core + local Chromium):
walks all 4 flows, the 5-star and 3-star review branches, bad-phone rejection,
graceful fallback, `?biz=` personalization, hero-CTA booking jump, and a mobile
viewport — and fails on **any** console/page error.

Last run: **29/29 checks passed, zero console errors** (2026-09-30).

## Files

- `index.html` — dental site + widget markup
- `assets/style.css` — all styling (system fonts only, no external requests)
- `assets/widget.js` — Nora conversation engine (intents, booking/after-hours/review
  state machines, personalization, test hooks via `window.__maya`)

*Note: bookings, leads and reviews in this demo are simulated in the browser —
the footer says so. A real client build wires these to the practice's actual
scheduling/CRM/notification stack.*

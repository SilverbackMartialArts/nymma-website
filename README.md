# Silverback North York MMA website (version 2)

A fast, mobile-first static site (plain HTML/CSS/JS, no build step). It has one job: **get visitors to book a free trial class online**, so they land in your Silverback CRM where staff and the AI sales agent follow up.

Your previous site is untouched in `Desktop\Silverback Website site upgate`. This folder is a full redesign that keeps what already worked there: the light navy/red look, the booking popup and the month calendar, wired to the CRM the same way.

## Right now this is a MOCK-UP

It never talks to your live CRM (`crmBase` is empty) and nothing in the CRM was changed to build it.

- **Booking** (every "Book free class" / "Try free" button): the real booking steps run in **demo mode** on the weekly timetable in `config.js`. Visitors pick a real class time, confirm, and see the booked screen. Nothing is sent anywhere. A small yellow **Demo** tag shows in the popup.
- **Join online** (pricing cards, kids card, booking confirmation, FAQ): a sign-up and payment portal. Pick a program and commitment, choose **Monthly** or **Every 2 weeks**, enter details (a parent for kids), sign the waiver and agreement, then the payment step. The payment step shows where Square's secure card form goes. **No card field exists and nothing is charged.**
- **Bi-weekly prices are placeholders:** monthly price × 12 ÷ 26 (same cost per year). Change `biweekly` in `config.js` to `"half"` for half the monthly price, or confirm your real prices.

## What's on the home page (top to bottom)

| Section | Why it's there |
|---|---|
| **Hero** | Offer in the headline ("First class free"), one big button, and a live **Up next** card listing the next 4 classes. Tapping one opens the booking popup with that class and date already picked. |
| **Proof strip** | 2 free classes, $0 registration fee, adult classes 7 days a week, 2 black belts. |
| **Free trial pass** | Spells out exactly what the trial includes (worth $56 at drop-in prices) next to the 3 steps. |
| **Class finder** | Two taps (who's training + main goal) recommends a first class and shows its next real times. |
| **Programs** | Kickboxing, NoGi Jiu-Jitsu, Wrestling, MMA with real photos and class times. |
| **Never trained?** | Answers the 4 things beginners worry about. |
| **Your first class** | What happens start to finish, and what to bring. |
| **Schedule** | "Next 7 days" view (default) plus the month calendar. Every class is bookable. |
| **Kids** | A parent-focused section: ages 4 to 12, both kids classes, price. |
| **Coaches** | John (big card with photo and titles), plus Mario, Alan, Ariel and Jacob. |
| **More than a gym** | Your real photos: belt promotions, fight nights, team nights out. |
| **Reviews** | Your Google rating (4.9 from 60 reviews) with a link to your Google listing, plus any review quotes you add (see below). The rating also shows under the hero buttons and in the proof strip. |
| **Pricing** | Commitment switch (month-to-month / 3 / 12 months) and a **Pay monthly / Pay every 2 weeks** switch. Each card has "Try free first" and **Join online**. Prices match the CRM plans and the sales knowledge base. |
| **FAQ, Visit, final button, footer** | Includes "Can I sign up for a membership online?". |

`free-trial.html` is the **ad / QR-code landing page** (no menu, one goal). Add `?for=kids` for the parent version: headline, bullets, buttons and the "Up next" list all switch to kids classes.

## Everything written on the site came from nymma.ca or your knowledge base

Nothing is made up: no invented reviews, results, prices or promotions. Coach bios and titles are from the nymma.ca team page. Class times, prices, trial rules and the promo are from the sales knowledge base.

## Things only you can add (these make the biggest difference)

1. **Keep the Google rating current.** `googleRating` and `googleReviewCount` in `assets/js/config.js` (4.9 and 60 on Sept 24, 2026).
2. **Optional review quotes.** Add your favourites to `reviews` in `config.js`, copied word for word from Google. They appear under the rating.
   ```
   reviews: [
     { name: "Alex R.", text: "Paste the review here.", program: "Kickboxing", rating: 5 }
   ],
   ```
3. **Photos of Mario, Alan, Ariel and Jacob.** They show initials for now.
4. **A kids class photo.** The kids section uses a designed card because none of the current photos show a kids class.

## Settings you edit day to day: `assets/js/config.js`

- `crmBase`: the CRM's HTTPS address. Empty = mock-up (demo booking). `"https://book.nymma.ca"` = real online booking.
- `demoMode`: turns the demo booking and the "Demo" tags on while `crmBase` is empty.
- `plans`: membership prices per month before tax (Kickboxing, All Access, Grappling, Kids). The pricing cards and the join portal both read these.
- `biweekly`: `"yearly"` (monthly × 12 ÷ 26) or `"half"`. `taxPercent`: 13 (HST).
- `schedule`: the weekly timetable. The Up next card, class finder, 7-day view and program times all read from it (and switch to the CRM's live classes once `crmBase` is set).
- `promo`: the All Access $176 offer. The yellow bar, ribbon and price switch themselves off after **Sept 30, 2026**.
- `googleRating`, `googleReviewCount`, `reviews`, `googleReviews` (your "leave a review" link), `googleMaps` (your listing), `instagram`, `facebook`, `ga4Id`, `metaPixelId`.

## Going live (not done: the live CRM was deliberately left untouched)

**Booking** only needs the website side: `book.nymma.ca` is already running and accepts requests from `www.nymma.ca`.

**Joining online** also needs work in the CRM, which is why it's a mock-up here:
- a public sign-up entry point, so the Join button can hand people to the CRM's existing secure sign-up page (details, waiver, agreement, Square card);
- every-2-weeks billing plans, which the CRM doesn't support yet;
- your final bi-weekly prices.
Plan that as its own project, tested away from the live system, with a planned restart.

Steps for the website:

1. Put the address in `assets/js/config.js`: `crmBase: "https://book.nymma.ca"` (this turns demo booking off by itself).
2. Hide or remove the Join online buttons until the CRM side above exists, so nobody thinks they've joined.
3. Upload everything **except `dev/` and this README** to a static host (Cloudflare Pages, Netlify, GitHub Pages or GoDaddy hosting) and point `www.nymma.ca` at it. GoDaddy *Website Builder* can't take custom files.
4. Make one real booking with your own phone and email, then cancel it in the CRM.

Photos still load from GoDaddy's image server (`img1.wsimg.com`). If you cancel GoDaddy, save them into `assets/img/` first and update the links.

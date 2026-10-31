/*
  Silverback North York MMA - site settings.
  This is the ONE file you edit for day-to-day changes: CRM address, prices, promo dates, schedule, contact details.
*/
window.SILVERBACK = {
  // The public HTTPS address of your Silverback CRM (the server that answers /api/public/classes).
  // Online booking talks to it directly. Example: "https://book.nymma.ca"   (no trailing slash)
  // Leave "" while this site is a mock-up: nothing is ever sent to the live CRM.
  crmBase: "https://book.nymma.ca",

  // MOCK-UP MODE. While crmBase is "", the booking popup runs the real booking steps on the timetable below
  // (pick a class, confirm, done) without contacting any server, and the online join portal shows the full
  // sign-up and payment steps without taking a card. Both show a small "Demo" tag.
  // Setting crmBase switches booking to the real CRM automatically.
  demoMode: false,

  // Membership prices BEFORE tax, per month. The pricing section and the online join portal both read these.
  // Keep them matching the CRM plans. For kids, "3m" is the "3 months or longer" price (12m is the same).
  plans: [
    { key: "kickboxing", name: "Kickboxing",   includes: "Kickboxing + MMA classes",                          mtm: 179, "3m": 169, "12m": 149 },
    { key: "allaccess",  name: "All Access",   includes: "Every adult class: kickboxing, NoGi jiu-jitsu & MMA",         mtm: 199, "3m": 189, "12m": 169 },
    { key: "grappling",  name: "Grappling",    includes: "NoGi jiu-jitsu & MMA",                                    mtm: 189, "3m": 179, "12m": 159 },
    { key: "kids",       name: "Kids program", includes: "Ages 4 to 12: kids jiu-jitsu & kickboxing",         mtm: 150, "3m": 130, "12m": 130, kids: true }
  ],
  // Paying every 2 weeks. "yearly" = same cost per year as paying monthly (monthly price x 12 / 26, to the cent).
  // This matches the CRM's every-2-weeks plans exactly (e.g. All Access month-to-month $199 -> $91.85 every 2 weeks).
  biweekly: "yearly",
  taxPercent: 13,   // HST, used for the "about $X with tax" line in the join portal

  classMinutes: 60,                                          // used for the calendar file if the CRM doesn't give an end time
  beginnerFriendly: ["Fundamentals", "Kickboxing", "Kids"],  // class names that get the green "Beginner friendly" tag

  phone: "+14163605919",
  phoneDisplay: "416-360-5919",
  whatsapp: "14163605919",
  email: "info@nymma.ca",

  // Optional tracking. Leave blank to load no tracking scripts at all.
  // ga4Id is the SAME Google Analytics 4 property already used on nymma.ca (GoDaddy site) - reusing it
  // (instead of creating a new property) keeps your historical traffic data in one continuous timeline
  // across the site switch, rather than starting over at zero.
  ga4Id: "G-7L91M691GF",
  metaPixelId: "",    // e.g. "123456789012345"

  // Social links (shown in the footer and community section only if filled in).
  facebook: "https://www.facebook.com/people/Silverback-North-York-Mix-Martial-Arts/61554992890038/",
  instagram: "https://www.instagram.com/silverbacknorthyorkmma/",
  googleReviews: "https://g.page/r/CSgg1GBTtZyWEAE/review",       // your "leave us a review" link
  googleMaps: "https://www.google.com/maps?cid=10852748571767480360", // your Google listing, where people read the reviews

  // Your Google rating, shown near the top of the page and in the reviews section.
  // Update these now and then from your Google listing (it was 4.9 from 60 reviews on Sept 24, 2026). Set rating to 0 to hide it.
  googleRating: 4.9,
  googleReviewCount: 60,

  // Optional review quotes shown under the rating. Copy them word for word from Google (ask first if you use a full name). Never make one up.
  // Example: { name: "Alex R.", text: "Paste the review here.", program: "Kickboxing", rating: 5 }
  reviews: [],

  // Current promotion: none running (as of 2026-10-14). To run one, set e.g.
  //   promo: { ends: "2026-12-31T23:59:59-05:00", label: "..." }
  // and add  promo: { "3m": 160 }  to the plan in "plans" above (it must match the sales knowledge base). It switches off by itself after "ends".
  promo: null,

  // Weekly adult + kids timetable. Keep in sync with the CRM schedule.
  // level: "beginner" (great first class) | "all" | "experienced"
  schedule: [
    { day: "Monday",    time: "5:00 PM", name: "Kids Martial Arts",         group: "kids",  program: "kids",      level: "beginner" },
    { day: "Monday",    time: "6:30 PM", name: "Fundamentals NoGi Jiu-Jitsu", group: "adult", program: "grappling", level: "beginner" },
    { day: "Monday",    time: "7:30 PM", name: "NoGi Jiu-Jitsu",            group: "adult", program: "grappling", level: "all" },
    { day: "Monday",    time: "8:30 PM", name: "MMA",                       group: "adult", program: "mma",       level: "all" },

    { day: "Tuesday",   time: "6:00 PM", name: "Kickboxing",                group: "adult", program: "striking",  level: "beginner" },
    { day: "Tuesday",   time: "7:30 PM", name: "NoGi Jiu-Jitsu",            group: "adult", program: "grappling", level: "all" },
    { day: "Tuesday",   time: "8:30 PM", name: "Advanced NoGi Jiu-Jitsu",   group: "adult", program: "grappling", level: "experienced" },

    { day: "Wednesday", time: "6:30 PM", name: "Fundamentals NoGi Jiu-Jitsu", group: "adult", program: "grappling", level: "beginner" },

    { day: "Thursday",  time: "7:30 PM", name: "NoGi Jiu-Jitsu",            group: "adult", program: "grappling", level: "all" },

    { day: "Friday",    time: "5:00 PM", name: "Kids Martial Arts",         group: "kids",  program: "kids",      level: "beginner" },
    { day: "Friday",    time: "6:00 PM", name: "Kickboxing",                group: "adult", program: "striking",  level: "beginner" },
    { day: "Friday",    time: "7:30 PM", name: "NoGi Jiu-Jitsu",            group: "adult", program: "grappling", level: "all" },
    { day: "Friday",    time: "8:30 PM", name: "MMA",                       group: "adult", program: "mma",       level: "all" },

    { day: "Saturday",  time: "12:30 PM", name: "Jiu-Jitsu",                group: "adult", program: "grappling", level: "all" },

    { day: "Sunday",    time: "11:00 AM", name: "Kids Martial Arts",        group: "kids",  program: "kids",      level: "beginner" },
    { day: "Sunday",    time: "12:00 PM", name: "Kickboxing",               group: "adult", program: "striking",  level: "beginner" },
    // Shown on the schedule for information only - not a bookable free trial (see bookable: false below).
    { day: "Sunday",    time: "1:00 PM",  name: "Sparring",                 group: "adult", program: "sparring",  level: "experienced", bookable: false }
  ]
};

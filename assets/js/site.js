/* Silverback North York MMA - page behaviour. Settings live in config.js; online booking lives in booking.js;
   the month calendar lives in schedule.js. Everything that lists classes here (the hero "Up next" card, the class
   finder, the 7-day schedule and the program times) reads the weekly timetable in config.js and, when the CRM is
   reachable, upgrades itself to the CRM's real bookable classes. Any class you click opens the booking popup
   with that class (and date) already picked. */
(function () {
  "use strict";
  var CFG = window.SILVERBACK || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    remove: function (k) { try { sessionStorage.removeItem(k); } catch (e) { /* private mode */ } }
  };
  window.sbStore = store;
  var qs = new URLSearchParams(location.search);

  // Testing aid: on your own computer only, ?crm=http://127.0.0.1:8092 points booking at a test server.
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && qs.get("crm")) CFG.crmBase = qs.get("crm");

  /* ---------- tracking (only loads scripts if you filled in IDs in config.js) ---------- */
  function loadScript(src) { var s = document.createElement("script"); s.async = true; s.src = src; document.head.appendChild(s); }
  if (CFG.ga4Id) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date()); window.gtag("config", CFG.ga4Id);
    loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CFG.ga4Id));
  }
  if (CFG.metaPixelId) {
    (function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = true; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", CFG.metaPixelId); window.fbq("track", "PageView");
  }
  // Events: booking_start = left contact details (a lead); booking_complete = trial booked.
  function track(name) {
    if (window.gtag) { window.gtag("event", name); if (name === "booking_complete") window.gtag("event", "generate_lead"); }
    if (window.fbq) {
      if (name === "booking_start") window.fbq("track", "Lead");
      if (name === "booking_complete") window.fbq("track", "Schedule");
      if (/^(call|sms|wa|email|join)_/.test(name)) window.fbq("track", "Contact");
    }
  }
  window.sbTrack = track;
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-track]");
    if (a) track(a.getAttribute("data-track"));
  });

  /* ---------- ad / campaign tags (kept for the whole visit and sent with every booking) ---------- */
  ["utm_source", "utm_medium", "utm_campaign"].forEach(function (k) {
    var v = qs.get(k);
    if (v) store.set(k, v.slice(0, 120));
  });

  /* ---------- contact + social links ---------- */
  function smsHref(msg) { return "sms:" + CFG.phone + "?&body=" + encodeURIComponent(msg); }
  function waHref(msg) { return "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(msg); }
  $$("[data-tel]").forEach(function (a) { a.href = "tel:" + CFG.phone; if (/^\d/.test(a.textContent.trim())) a.textContent = CFG.phoneDisplay; });
  $$("[data-sms]:not([data-plan-msg])").forEach(function (a) { a.href = smsHref(a.dataset.msg || "Hi! I'd like to try a free class at Silverback."); });
  $$("[data-wa]").forEach(function (a) { a.href = waHref(a.dataset.msg || "Hi! I'd like to try a free class at Silverback."); });
  var anySocial = false;
  [["fbLink", "facebook"], ["igLink", "instagram"], ["grLink", "googleMaps"], ["leaveReview", "googleReviews"], ["fbLink2", "facebook"], ["igLink2", "instagram"]].forEach(function (p) {
    var el = document.getElementById(p[0]); if (!el) return;
    if (CFG[p[1]]) { el.href = CFG[p[1]]; el.hidden = false; el.target = "_blank"; el.rel = "noopener"; if (/2$/.test(p[0])) anySocial = true; }
    else el.hidden = true;
  });
  var socialRow = $("#socialRow"); if (socialRow && anySocial) socialRow.hidden = false;
  var yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- header: mobile menu, shadow on scroll, current-section underline ---------- */
  var burger = $("#burger"), nav = $("#nav"), hdr = $("#hdr");
  if (burger && nav) {
    burger.addEventListener("click", function () { var o = nav.classList.toggle("open"); burger.setAttribute("aria-expanded", o); burger.setAttribute("aria-label", o ? "Close menu" : "Open menu"); });
    $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); burger.setAttribute("aria-label", "Open menu"); }); });
  }
  if (hdr) {
    var onScroll = function () { hdr.classList.toggle("scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }
  var IO = "IntersectionObserver" in window;
  if (IO && nav) {
    var links = {};
    $$("a[href^='#']", nav).forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    var secIO = new IntersectionObserver(function (es) {
      es.forEach(function (en) { var l = links[en.target.id]; if (l) l.classList.toggle("on", en.isIntersecting); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) secIO.observe(s); });
  }

  // Sticky mobile bar: hidden while the hero's own buttons (or the final call to action) are on screen.
  var mbar = $("#mbar");
  if (mbar && IO) {
    var watch = [$("#heroCtas"), $(".final")].filter(Boolean), seen = new Map();
    var barIO = new IntersectionObserver(function (es) {
      es.forEach(function (en) { seen.set(en.target, en.isIntersecting); });
      var anyOn = false; seen.forEach(function (v) { if (v) anyOn = true; });
      mbar.classList.toggle("hide", anyOn);
    });
    watch.forEach(function (el) { barIO.observe(el); });
  }

  /* ---------- reveal-on-scroll ---------- */
  var rv = $$(".rv");
  if (IO && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var rvIO = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); rvIO.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    rv.forEach(function (el) {
      var sibs = $$(":scope > .rv", el.parentElement), i = sibs.indexOf(el);
      if (i > 0) el.style.transitionDelay = Math.min(i, 4) * 70 + "ms";
      rvIO.observe(el);
    });
  } else rv.forEach(function (el) { el.classList.add("in"); });

  /* ---------- promo (switches itself off after the end date in config.js) ---------- */
  var promoOn = false;
  if (CFG.promo && CFG.promo.ends) {
    var msLeft = new Date(CFG.promo.ends).getTime() - Date.now();
    promoOn = msLeft > 0;
    if (promoOn) {
      var daysLeft = Math.ceil(msLeft / 864e5);
      var pbar = $("#promoBar"), ptxt = $("#promoText");
      if (pbar && ptxt) { ptxt.textContent = CFG.promo.label + " · " + (daysLeft <= 1 ? "ends today" : daysLeft + " days left") + "."; pbar.hidden = false; }
      var rib = $("#promoRibbon"); if (rib) rib.hidden = false;
      var pop = $("#popRibbon"); if (pop) pop.hidden = true;
    }
  }

  /* ---------- pricing (plans in config.js), shared with the online join portal (join.js) ---------- */
  var PLANS = Array.isArray(CFG.plans) ? CFG.plans : [];
  var planOf = function (key) { return PLANS.filter(function (p) { return p.key === key; })[0] || null; };
  var promoFor = function (p, term) { return promoOn && p && p.promo && p.promo[term] ? +p.promo[term] : 0; };
  // monthly price before tax for a plan + commitment ("mtm" | "3m" | "12m"), with the current promo applied
  function monthly(key, term) { var p = planOf(key); if (!p) return 0; return promoFor(p, term) || +p[term] || +p["3m"] || 0; }
  function perPayment(key, term, freq) {
    var m = monthly(key, term);
    if (freq !== "biweek") return m;
    return Math.round((CFG.biweekly === "half" ? m / 2 : m * 12 / 26) * 100) / 100;
  }
  var money = function (n) { return "$" + (Math.round(n) === n ? String(n) : n.toFixed(2)); };
  var TERM_LABEL = { mtm: "Month-to-month", "3m": "3-month commitment", "12m": "12-month commitment" };
  var pricing = { term: "3m", freq: "month" };

  // Which membership a class name belongs to, so picking a class elsewhere on the page (a program card, the
  // class finder, the kids section, a calendar day) narrows the pricing section down to just that one plan.
  var INTEREST_KEY = "sb_interest";
  function planKeyForClass(name) {
    var s = String(name || "").toLowerCase();
    if (!s) return null;
    if (s.indexOf("kids") > -1) return "kids";
    if (/kickbox/.test(s)) return "kickboxing";
    if (/jiu-?jitsu|fundamentals|wrestling|grappl/.test(s)) return "grappling";
    if (/\bmma\b/.test(s)) return "allaccess"; // MMA training draws on both striking and grappling classes
    return null;
  }
  function getInterest() { return store.get(INTEREST_KEY); }
  function setInterest(key) { if (key) store.set(INTEREST_KEY, key); else store.remove(INTEREST_KEY); renderPrices(); }
  window.sbInterest = {
    noteClass: function (name) { var k = planKeyForClass(name); if (k) setInterest(k); },
    set: setInterest, get: getInterest, clear: function () { setInterest(null); }, planKeyFor: planKeyForClass
  };

  window.sbPricing = {
    plans: PLANS, plan: planOf, monthly: monthly, perPayment: perPayment, money: money, termLabel: TERM_LABEL,
    per: function (freq) { return freq === "biweek" ? "every 2 weeks" : "per month"; },
    regular: function (key, term) { var p = planOf(key); return p ? +p[term] || 0 : 0; },
    promo: function (key, term) { return promoFor(planOf(key), term); },
    tax: function (n) { return Math.round(n * (100 + (+CFG.taxPercent || 0))) / 100; },
    current: function () { return { term: pricing.term, freq: pricing.freq }; }
  };
  function renderPrices() {
    var interest = getInterest();
    var interestPlan = interest ? planOf(interest) : null;
    var matchExists = !!interestPlan && $$(".plan[data-plan]").some(function (c) { return c.dataset.plan === interest; });
    $$(".plan[data-plan]").forEach(function (card) {
      var key = card.dataset.plan, p = planOf(key); if (!p) return;
      var t = pricing.term, f = pricing.freq, price = perPayment(key, t, f);
      var priceEl = $("[data-price]", card), perEl = $("[data-per]", card), was = $(".was", card);
      if (priceEl) priceEl.textContent = money(price);
      if (perEl) perEl.textContent = (f === "biweek" ? "/2 weeks" : "/month") + " + tax";
      if (was) {
        var reg = +p[t] || 0, regPay = f === "biweek" ? Math.round((CFG.biweekly === "half" ? reg / 2 : reg * 12 / 26) * 100) / 100 : reg;
        was.textContent = promoFor(p, t) && regPay !== price ? "Regular " + money(regPay) + (f === "biweek" ? "/2 weeks" : "/month") : "";
      }
      card.style.display = (!matchExists || key === interest) ? "" : "none";
    });
    var plansBox = $(".plans"), rowBox = $(".plan-row");
    if (plansBox) {
      var plansVisible = $$(".plan", plansBox).filter(function (c) { return c.style.display !== "none"; });
      plansBox.style.display = plansVisible.length ? "" : "none";
      plansBox.classList.toggle("filtered", plansVisible.length === 1);
    }
    if (rowBox) {
      var rowVisible = $$(".plan", rowBox).filter(function (c) { return c.style.display !== "none"; });
      rowBox.classList.toggle("solo", rowVisible.length === 1);
    }
    var note = $("#pricingFilterNote");
    if (note) {
      note.hidden = !matchExists;
      if (matchExists) { var nameEl = $("[data-filter-name]", note); if (nameEl) nameEl.textContent = interestPlan.name; }
    }
    $$(".toggle [data-term]").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.term === pricing.term); });
    $$(".toggle [data-freq]").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.freq === pricing.freq); });
  }
  $$(".toggle [data-term]").forEach(function (b) { b.addEventListener("click", function () { pricing.term = b.dataset.term; renderPrices(); }); });
  $$(".toggle [data-freq]").forEach(function (b) { b.addEventListener("click", function () { pricing.freq = b.dataset.freq; renderPrices(); track("pricing_" + pricing.freq); }); });
  $$("[data-biweekly-note]").forEach(function (el) {
    el.textContent = CFG.biweekly === "half" ? "Every-2-weeks prices are half the monthly price." : "Paying every 2 weeks costs the same per year as paying monthly.";
  });
  var showAllBtn = $("#pricingShowAll");
  if (showAllBtn) showAllBtn.addEventListener("click", function () { window.sbInterest.clear(); track("pricing_show_all"); });
  if ($(".plans")) renderPrices();

  /* ---------- Google rating + reviews (only real numbers and quotes from config.js) ---------- */
  var gRating = +CFG.googleRating || 0, gCount = +CFG.googleReviewCount || 0;
  var gRead = CFG.googleMaps || CFG.googleReviews || "";
  var reviews = Array.isArray(CFG.reviews) ? CFG.reviews.filter(function (r) { return r && r.text; }) : [];
  if (gRating > 0) {
    $$("[data-g-rating]").forEach(function (el) { el.textContent = gRating.toFixed(1); });
    $$("[data-g-count]").forEach(function (el) { el.textContent = gCount; });
    $$(".grating").forEach(function (a) {
      if (!$("#reviews") && gRead) { a.href = gRead; a.target = "_blank"; a.rel = "noopener"; } // landing page: no reviews section, so open Google
      a.hidden = false;
    });
  } else {
    // No rating set: fall back to the "no registration fee" fact in the proof strip and hide the score.
    $$("[data-g-proof]").forEach(function (el) { el.innerHTML = "<b>$0</b><span>registration or initiation fee</span>"; });
    var sc = $("#revScore"); if (sc) sc.hidden = true;
  }
  if ($("#reviews") && (gRating > 0 || reviews.length)) {
    $("#reviewList").innerHTML = reviews.map(function (r) {
      var stars = r.rating ? '<div class="stars" aria-label="' + esc(r.rating) + ' out of 5 stars">' + "★★★★★".slice(0, Math.max(1, Math.min(5, +r.rating))) + "</div>" : "";
      return '<figure class="review">' + stars + "<blockquote>" + esc(r.text) + "</blockquote><figcaption><b>" + esc(r.name || "Member") + "</b>" + (r.program ? "<small>" + esc(r.program) + "</small>" : "") + "</figcaption></figure>";
    }).join("");
    $("#reviews").hidden = false;
    if (gRead) { $("#reviewLink").href = gRead; $("#reviewLink").hidden = false; }
  }

  /* =====================================================================
     Class data shared by the hero "Up next" card, the finder and the 7-day view
     ===================================================================== */
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var pad2 = function (n) { return String(n).padStart(2, "0"); };
  var dateKey = function (d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
  function minsOf(t) { var m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(t || "").trim()); if (!m) return null; return ((+m[1] % 12) + (/pm/i.test(m[3]) ? 12 : 0)) * 60 + +m[2]; }
  var sched = Array.isArray(CFG.schedule) ? CFG.schedule : [];
  var isKids = function (c) { return c.audience === "KIDS" || /kids/i.test(c.name); };
  var isBeginner = function (name) { return (CFG.beginnerFriendly || ["Fundamentals", "Kickboxing", "Kids"]).some(function (k) { return String(name).toLowerCase().indexOf(k.toLowerCase()) >= 0; }); };
  var isAdvanced = function (name) { return /advanced/i.test(name); };
  function kind(c) { var p = String((c.program || "") + " " + c.name).toLowerCase(); if (isKids(c)) return "kids"; if (/kick|strik/.test(p)) return "striking"; if (/mma/.test(p)) return "mma"; return "grappling"; }

  // Next N days of classes from the weekly timetable in config.js, in the same shape the CRM returns.
  function projected(days) {
    var out = [], now = new Date();
    for (var i = 0; i < days; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      sched.forEach(function (c, idx) {
        if (c.day !== DAYS[d.getDay()]) return;
        var m = minsOf(c.time); if (m == null) return;
        var st = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60);
        out.push({ id: "p" + dateKey(d) + idx, name: c.name, program: c.program, audience: c.group === "kids" ? "KIDS" : "ADULT", state: "OPEN",
          date_key: dateKey(d), time_label: c.time, starts_at: st.toISOString(), _start: st, projected: true });
      });
    }
    return out.sort(function (a, b) { return a._start - b._start; });
  }
  function normalize(list) {
    return (list || []).map(function (c) {
      var st = c.starts_at ? new Date(c.starts_at) : null;
      if (!st || isNaN(st)) { var m = minsOf(c.time_label), p = String(c.date_key || "").split("-"); st = p.length === 3 && m != null ? new Date(+p[0], +p[1] - 1, +p[2], Math.floor(m / 60), m % 60) : new Date(0); }
      c._start = st; return c;
    }).sort(function (a, b) { return a._start - b._start; });
  }
  var DATA = projected(14), LIVE = false, listeners = [];
  function onData(fn) { listeners.push(fn); fn(DATA, LIVE); }
  function upgradeToLive() {
    var sb = window.sbBooking;
    if (!sb || !sb.base || !sb.base()) return;
    sb.loadClasses().then(function (d) {
      if (!d || d.enabled === false || !Array.isArray(d.classes) || !d.classes.length) return;
      DATA = normalize(d.classes); LIVE = true;
      listeners.forEach(function (fn) { fn(DATA, LIVE); });
    }).catch(function () { /* keep the timetable version */ });
  }
  function dayWord(d) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var x = new Date(d); x.setHours(0, 0, 0, 0);
    var diff = Math.round((x - t) / 864e5);
    if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow";
    return x.toLocaleDateString("en-US", { weekday: "short" }) + " " + x.getDate();
  }
  var niceDate = function (d) { return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); };
  function bookAttrs(c) { return 'href="#book" data-book-class="' + esc(c.name) + '" data-book-who="' + (isKids(c) ? "CHILD" : "ADULT") + '" data-book-date="' + esc(c.date_key) + '"'; }
  function levelTag(c) {
    if (c.state === "FULL") return '<span class="x">Full</span>';
    if (isKids(c)) return '<span class="k">Kids 4 to 12</span>';
    if (isAdvanced(c.name)) return '<span class="x">Experienced</span>';
    if (isBeginner(c.name)) return "<span>Beginner friendly</span>";
    return "<span>All levels</span>";
  }
  var upcoming = function (list) { var now = Date.now(); return list.filter(function (c) { return c._start.getTime() > now && c.state !== "FULL"; }); };

  /* ---------- hero: the next few classes ---------- */
  var upEl = $("#upNext"), kidsPage = qs.get("for") === "kids";
  if (upEl) onData(function (list) {
    var n = upcoming(list).filter(function (c) { return !kidsPage || isKids(c); }).slice(0, +(upEl.dataset.count || 4));
    if (!n.length) { upEl.innerHTML = '<div class="upnext-empty">See the <a href="#schedule">full schedule</a> to pick a class.</div>'; return; }
    upEl.innerHTML = n.map(function (c) {
      var w = dayWord(c._start);
      return '<a class="nx" ' + bookAttrs(c) + ' data-track="cta_upnext"><span class="nx-when"><small class="' + (w === "Today" ? "today" : "") + '">' + w + "</small><b>" + esc(c.time_label) + '</b></span>' +
        '<span class="nx-name"><b>' + esc(c.name) + "</b>" + levelTag(c) + '</span><span class="nx-go">Try free</span></a>';
    }).join("");
  });

  /* ---------- program cards: real class times from the timetable ---------- */
  function timesFor(key) {
    var byDay = {}, order = [];
    sched.forEach(function (c) {
      if (c.group === "kids" || String(c.name).toLowerCase().indexOf(key.toLowerCase()) < 0) return;
      var d = c.day.slice(0, 3); if (!byDay[d]) { byDay[d] = []; order.push(d); } byDay[d].push(c.time);
    });
    return order.map(function (d) {
      var t = byDay[d], suf = t.map(function (x) { return x.slice(-2); });
      var same = suf.every(function (s) { return s === suf[0]; });
      return d + " " + (same && t.length > 1 ? t.map(function (x) { return x.slice(0, -3); }).join(" & ") + " " + suf[0] : t.join(" & "));
    }).join(" · ");
  }
  $$("[data-times]").forEach(function (el) { var t = timesFor(el.dataset.times); if (t) el.textContent = t; });
  $$("[data-count-classes]").forEach(function (el) { if (sched.length) el.textContent = sched.length; });

  /* ---------- class finder ---------- */
  var FINDER = {
    adult: [
      { id: "fit", label: "Get fit", title: "Kickboxing", book: "Kickboxing", match: /kickboxing/i,
        why: "Pad work, drills and conditioning with proper technique. A serious workout, and the easiest first class for most people." },
      { id: "defence", label: "Self-defence", title: "Fundamentals NoGi Jiu-Jitsu", book: "Fundamentals", match: /fundamentals/i,
        why: "Technique and leverage over size and strength. Fundamentals classes are built for people who have never trained." },
      { id: "mma", label: "Learn MMA", title: "Mixed Martial Arts", book: "MMA", match: /\bmma\b/i,
        why: "Striking, takedowns and ground work together. You don't need any experience to start learning MMA." },
      { id: "grapple", label: "Grappling", title: "NoGi Jiu-Jitsu", book: "Jiu-Jitsu", match: /jiu-jitsu|wrestling/i, skipAdvanced: true,
        why: "Start with Fundamentals on Monday or Wednesday if you're new. Wrestling on Thursday nights is a great add-on." },
      { id: "confidence", label: "Build confidence", title: "Kickboxing", book: "Kickboxing", match: /kickboxing/i,
        why: "Learning real technique in a room that welcomes beginners is a great place to start. Go at your own pace." },
      { id: "curious", label: "Just curious", title: "Try both, free", book: "", match: /kickboxing|fundamentals/i,
        why: "Your free trial covers one striking class and one grappling class. Start with either and use the other one later." }
    ],
    kid: [
      { id: "kconf", label: "Confidence", title: "Kids Martial Arts", book: "Kids Martial Arts", match: /kids martial arts/i,
        why: "Positive character development on the mats: respect, discipline and the confidence that comes from learning real skills." },
      { id: "kbully", label: "Anti-bullying", title: "Kids Martial Arts", book: "Kids Martial Arts", match: /kids martial arts/i,
        why: "Self-defence and bully-proofing through jiu-jitsu, the martial art built on control instead of striking." },
      { id: "kfocus", label: "Focus & discipline", title: "Kids Martial Arts", book: "Kids Martial Arts", match: /kids martial arts/i,
        why: "Structured classes with clear expectations, led by Coach Alan, our kids coach." },
      { id: "kenergy", label: "Burn off energy", title: "Kids Martial Arts", book: "Kids Martial Arts", match: /kids martial arts/i,
        why: "High-energy classes with pad work, drills and jiu-jitsu, Monday, Friday at 5 PM and Sunday at 11 AM." }
    ]
  };
  var fBox = $("#finderBox");
  if (fBox) {
    var F = { who: qs.get("for") === "kids" ? "kid" : "adult", goal: null };
    var goalsEl = $("#finderGoals"), resEl = $("#finderResult");
    var drawGoals = function () {
      $$(".seg button", fBox).forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.who === F.who); });
      goalsEl.innerHTML = FINDER[F.who].map(function (g) { return '<button type="button" class="goalbtn" data-goal="' + g.id + '" aria-pressed="' + (F.goal === g.id) + '">' + esc(g.label) + "</button>"; }).join("");
    };
    var drawResult = function () {
      var g = FINDER[F.who].filter(function (x) { return x.id === F.goal; })[0];
      if (!g) { resEl.innerHTML = '<div class="finder-wait"><b>Pick a goal</b><span>Your recommended class shows up here.</span></div>'; return; }
      if (g.book) window.sbInterest.noteClass(g.book);
      var times = upcoming(DATA).filter(function (c) { return g.match.test(c.name) && (F.who === "kid" ? isKids(c) : !isKids(c)) && !(g.skipAdvanced && isAdvanced(c.name)); }).slice(0, 3);
      var who = F.who === "kid" ? "CHILD" : "ADULT";
      resEl.innerHTML = '<div class="rec"><span class="rec-lab">Your best first class</span><h3>' + esc(g.title) + "</h3><p>" + esc(g.why) + "</p>" +
        (times.length ? '<div class="rec-times">' + times.map(function (c) {
          var w = dayWord(c._start);
          return '<a class="rec-time" ' + bookAttrs(c) + ' data-track="cta_finder"><span>' + esc(w === "Today" || w === "Tomorrow" ? w : niceDate(c._start)) + " · " + esc(c.time_label) + "<small>" + esc(c.name) + "</small></span><em>Book free</em></a>";
        }).join("") + "</div>" : "") +
        '<a class="btn btn-red btn-block" href="#book" data-book-class="' + esc(g.book) + '" data-book-who="' + who + '" data-track="cta_finder_main">Book my free ' + (F.who === "kid" ? "kids " : "") + "class</a>" +
        '<p class="rec-alt" style="margin-top:12px">' + (F.who === "kid" ? "Kids get one free trial class. Ages 4 to 12." : g.id === "curious" ? "Not sure yet? That's what the free classes are for." : "Adults get one free striking and one free grappling class, so you can try both.") + ' <a href="#schedule">See every class</a></p></div>';
    };
    fBox.addEventListener("click", function (e) {
      var w = e.target.closest("[data-who]"), g = e.target.closest("[data-goal]");
      if (w) { if (F.who !== w.dataset.who) { F.who = w.dataset.who; F.goal = null; drawGoals(); drawResult(); } }
      else if (g) { F.goal = g.dataset.goal; drawGoals(); drawResult(); track("finder_" + F.goal); }
    });
    drawGoals();
    onData(function () { if (F.goal) drawResult(); });
  }

  /* ---------- schedule: 7-day view + switch to the month calendar (schedule.js) ---------- */
  var weekEl = $("#scheduleWeek"), calEl = $("#scheduleCal");
  if (weekEl) {
    onData(function (list, live) {
      var start = new Date(); start.setHours(0, 0, 0, 0);
      var now = Date.now(), out = [];
      for (var i = 0; i < 7; i++) {
        var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), k = dateKey(d);
        var day = list.filter(function (c) { return c.date_key === k; });
        var head = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "long" });
        out.push('<div class="wday' + (i === 0 ? " today" : "") + '"><h4>' + head + "<small>" + d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + "</small></h4>" +
          (day.length ? day.map(function (c) {
            var past = c._start.getTime() <= now, full = c.state === "FULL";
            var tag = full ? '<em class="x">Full</em>' : isKids(c) ? '<em class="x">Kids 4 to 12</em>' : isAdvanced(c.name) ? '<em class="x">Experienced</em>' : isBeginner(c.name) ? "<em>Beginner friendly</em>" : "";
            var inner = "<span>" + esc(c.time_label) + "</span><b>" + esc(c.name) + "</b>" + tag;
            return past || full ? '<div class="wcls ' + kind(c) + (past ? " past" : "") + '">' + inner + "</div>"
              : '<a class="wcls ' + kind(c) + '" ' + bookAttrs(c) + ' data-track="cta_week" title="Book ' + esc(c.name) + ' as your free trial">' + inner + "</a>";
          }).join("") : '<div class="wcls past" style="border-left-color:var(--line)"><b style="font-weight:500;color:var(--muted)">No classes</b></div>') + "</div>");
      }
      weekEl.innerHTML = out.join("");
    });
    $$(".viewtabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        var month = b.dataset.view === "month";
        $$(".viewtabs button").forEach(function (x) { x.setAttribute("aria-selected", x === b); });
        weekEl.hidden = month; if (calEl) calEl.hidden = !month;
      });
    });
  }

  /* ---------- landing page: kids variant (free-trial.html?for=kids) ---------- */
  if (document.body.classList.contains("lp") && qs.get("for") === "kids") {
    var set = function (id, t) { var el = document.getElementById(id); if (el) el.innerHTML = t; };
    set("lpTitle", "Kids martial arts in Don Mills. <em>First class free.</em>");
    set("lpLead", "Jiu-jitsu and kickboxing for ages 4 to 12, focused on self-defence, bully-proofing and positive character development. Book a free trial class online in 30 seconds.");
    set("lpBullets", "<li>No card needed</li><li>Ages 4 to 12</li><li>No registration fee</li>");
    $$("[data-lp-cta]").forEach(function (b) { b.setAttribute("data-book-class", "Kids"); b.setAttribute("data-book-who", "CHILD"); b.removeAttribute("data-open-modal"); });
  }

  // booking.js loads after this file; once the page is ready, try to swap the timetable for the CRM's real classes.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(upgradeToLive, 1200); });
  else setTimeout(upgradeToLive, 1200);
})();

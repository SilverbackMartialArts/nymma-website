/*
  Silverback online booking.
  A single popup (like Legion AJJ's "Free 30-Min Intro" modal) that opens from any "Book my free class" button
  on the page. Talks to the Silverback CRM's public booking API (config.js -> crmBase):
    GET  /api/public/token       anti-bot token
    GET  /api/public/classes     real upcoming classes with live spots
    POST /api/public/trial/start saves the lead the moment step 1 is done (even if they never finish)
    POST /api/public/trial       books the trial class -> lead + booking + waiver link + staff task in the CRM
    POST /api/public/inquiry     the "ask a question" form
  Requests are sent as text/plain so browsers don't need a pre-flight check (the CRM parses the JSON either way).
*/
(function () {
  "use strict";
  const CFG = window.SILVERBACK || {};
  const track = window.sbTrack || function () {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const qs = new URLSearchParams(location.search);
  const utm = {};
  ["utm_source", "utm_medium", "utm_campaign"].forEach((k) => { const v = qs.get(k) || (window.sbStore && window.sbStore.get(k)); if (v) utm[k] = String(v).slice(0, 120); });

  const CONSENT = "Silverback North York MMA may contact you by text, phone and email about your inquiry and your trial class.";
  const GOALS = ["Get fit", "Lose weight", "Self-defence", "Learn martial arts", "Confidence", "Compete", "Meet people"];
  const EXPERIENCE = ["Never trained", "A little", "Trained before", "Training elsewhere"];

  /* ---------------- API ---------------- */
  const base = () => String(CFG.crmBase || "").replace(/\/$/, "");

  // Demo mode (config.js demoMode, only while crmBase is empty): the booking steps run on the weekly timetable in
  // config.js and nothing is sent to any server. Setting crmBase switches to the real CRM automatically.
  const demo = () => !base() && !!CFG.demoMode;
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const PROGRAM = { striking: "Kickboxing", grappling: "Grappling", mma: "MMA" };
  const clock = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  function demoClasses(days) {
    const out = [], now = new Date(); let id = 1000;
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      (CFG.schedule || []).forEach((c) => {
        if (c.day !== DAYS[d.getDay()]) return;
        const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(c.time).trim()); if (!m) return;
        const st = new Date(d.getFullYear(), d.getMonth(), d.getDate(), (+m[1] % 12) + (/pm/i.test(m[3]) ? 12 : 0), +m[2]);
        id++; if (st.getTime() < now.getTime() + 60 * 60000) return;   // like the real system: no booking a class that's about to start
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        out.push({ id, name: c.name, program: PROGRAM[c.program] || "Class", coach: null, state: "OPEN", spots_left: null,
          audience: c.group === "kids" ? "KIDS" : "ADULT", date_key: key, starts_at: st.toISOString(),
          date_label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
          day_tag: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short" }),
          time_label: c.time, end_label: clock(new Date(st.getTime() + (CFG.classMinutes || 60) * 60000)) });
      });
    }
    return out;
  }
  async function demoApi(method, path, body) {
    await new Promise((r) => setTimeout(r, 450));
    if (path === "/api/public/token") return [200, { token: "demo" }];
    if (path === "/api/public/classes") return [200, { enabled: true, kids_max_age: 12, classes: demoClasses(21) }];
    if (path === "/api/public/trial/start") return [200, { ok: true }];
    if (path === "/api/public/trial") {
      const c = ((clsCache.d && clsCache.d.classes) || []).find((x) => x.id === (body || {}).session_id) || {};
      return [200, { ok: true, status: "BOOKED", class_name: c.name, when: c.date_label + " at " + c.time_label, confirmation_email: "DEMO" }];
    }
    if (path === "/api/public/inquiry") return [200, { ok: true, thank_you: "We've got your question and will get back to you shortly." }];
    return [404, { ok: false, error: "Not available in demo mode." }];
  }

  async function api(method, path, body) {
    if (demo()) return demoApi(method, path, body);
    const r = await fetch(base() + path, {
      method, credentials: "omit",
      headers: method === "POST" ? { "Content-Type": "text/plain;charset=UTF-8" } : {},
      body: method === "POST" ? JSON.stringify(body) : undefined
    });
    let d = null;
    try { d = await r.json(); } catch (e) { throw new Error("bad-response"); }
    return [r.status, d];
  }
  const tok = { v: null, t: 0, p: null };
  function getToken(force) {
    if (!force && tok.v && Date.now() - tok.t < 50 * 60 * 1000) return Promise.resolve(tok.v);
    if (tok.p && !force) return tok.p;
    tok.p = api("GET", "/api/public/token").then(([s, d]) => {
      if (s !== 200 || !d.token) throw new Error("no-token");
      tok.v = d.token; tok.t = Date.now(); tok.p = null; return tok.v;
    }).catch((e) => { tok.p = null; throw e; });
    return tok.p;
  }
  // The CRM rejects tokens younger than 3 seconds (bot protection), so wait if a very fast visitor got here first.
  async function tokenForSubmit() {
    if (demo()) return "demo";
    const v = await getToken();
    const wait = 3400 - (Date.now() - tok.t);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return v;
  }
  let clsCache = { t: 0, d: null };
  async function loadClasses(force) {
    if (!force && clsCache.d && Date.now() - clsCache.t < 60000) return clsCache.d;
    const [s, d] = await api("GET", "/api/public/classes");
    if (s !== 200) throw new Error("classes");
    clsCache = { t: Date.now(), d };
    return d;
  }

  /* ---------------- helpers ---------------- */
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const digits = (v) => String(v || "").replace(/\D/g, "");
  const beginner = (name) => (CFG.beginnerFriendly || ["Fundamentals", "Kickboxing", "Kids"]).some((k) => String(name).toLowerCase().includes(k.toLowerCase()));
  const mins = (t) => { const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(t || "").trim()); if (!m) return null; return ((+m[1] % 12) + (/pm/i.test(m[3]) ? 12 : 0)) * 60 + +m[2]; };
  function classMinutes(c) {
    const a = mins(c.time_label), b = mins(c.end_label);
    if (a != null && b != null) { const d = (b - a + 1440) % 1440; if (d >= 20 && d <= 240) return d; }
    return CFG.classMinutes || 60;
  }
  function downloadIcs(cls) {
    const st = new Date(cls.starts_at), en = new Date(st.getTime() + classMinutes(cls) * 60000);
    const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Silverback North York MMA//Trial//EN", "BEGIN:VEVENT",
      "UID:trial-" + cls.id + "-" + st.getTime() + "@nymma.ca", "DTSTAMP:" + f(new Date()), "DTSTART:" + f(st), "DTEND:" + f(en),
      "SUMMARY:Free trial: " + cls.name + " at Silverback",
      "LOCATION:Silverback North York MMA\\, 44 Prince Andrew Pl\\, North York\\, ON M3C 2H4 (use the back door)",
      "DESCRIPTION:Bring comfortable athletic clothes and a water bottle. Use the back door entrance.",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "silverback-free-trial.ics";
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const smsHref = (m) => "sms:" + CFG.phone + "?&body=" + encodeURIComponent(m);
  const waHref = (m) => "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(m);
  function contactButtons(msg) {
    return `<div class="fb-btns">
      <a class="btn btn-red btn-lg" href="${smsHref(msg)}" data-track="sms_fallback">Text us</a>
      <a class="btn btn-ghost" href="${waHref(msg)}" target="_blank" rel="noopener" data-track="wa_fallback">Message on WhatsApp</a>
      <a class="btn btn-ghost" href="tel:${esc(CFG.phone)}" data-track="call_fallback">Call ${esc(CFG.phoneDisplay)}</a>
      <a class="btn btn-ghost" href="mailto:${esc(CFG.email)}?subject=${encodeURIComponent("Free trial class")}" data-track="email_fallback">Email ${esc(CFG.email)}</a></div>`;
  }

  /* ---------------- the modal shell ---------------- */
  function buildModal() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal-dialog" id="sbModal" role="dialog" aria-modal="true" aria-labelledby="sbModalTitle" tabindex="-1">
      <div class="modal-head"><h3 class="modal-title" id="sbModalTitle"></h3><div class="mh-right">${demo() ? '<span class="demo-pill" title="Mock-up: nothing is sent or booked">Demo</span>' : ""}<button type="button" class="modal-close" aria-label="Close">&times;</button></div></div>
      <div class="bk" aria-live="polite"></div>
      <div class="also"><span>Questions?</span><a href="tel:${esc(CFG.phone)}" data-tel data-track="call_widget">Call</a><span>&middot;</span>
        <a href="${smsHref("Hi! I'd like to try a free class at Silverback.")}" data-track="sms_widget">Text</a><span>&middot;</span>
        <a href="${waHref("Hi! I'd like to try a free class at Silverback.")}" target="_blank" rel="noopener" data-track="wa_widget">WhatsApp</a></div>
    </div>`;
    document.body.appendChild(overlay);
    const dialog = $(".modal-dialog", overlay);
    let lastFocus = null;
    function show(title) {
      $(".modal-title", overlay).textContent = title;
      lastFocus = document.activeElement;
      overlay.classList.add("open"); document.documentElement.classList.add("modal-open");
      dialog.focus({ preventScroll: true });
    }
    function hide() {
      overlay.classList.remove("open"); document.documentElement.classList.remove("modal-open");
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
    }
    overlay.addEventListener("click", (e) => { if (e.target === overlay) hide(); });
    $(".modal-close", overlay).addEventListener("click", hide);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay.classList.contains("open")) hide(); });
    return { overlay, dialog, show, hide };
  }

  /* ---------------- the booking/ask flow (renders into the modal's .bk) ---------------- */
  function Widget(root, onDone) {
    const body = $(".bk", root);
    const S = {
      mode: "book", step: 1, who: qs.get("for") === "kids" ? "CHILD" : "ADULT",
      fn: "", ln: "", em: "", ph: "", cn: "", ca: "", hp: "", msg: "", classes: [], kidsMax: 12, day: null, prog: "ALL", pick: null,
      goals: [], exp: "", err: "", notice: "", errs: {}, busy: false, result: null, pref: "", ready: false
    };
    const audience = () => (S.who === "CHILD" ? "KIDS" : "ADULT");
    const kid = () => S.who !== "ADULT";
    const visible = () => S.classes.filter((c) => c.audience === "BOTH" || c.audience === audience());
    const prefMatch = (c) => S.pref && String(c.name).toLowerCase().includes(S.pref.toLowerCase());

    function bring() { body.scrollTop = 0; }
    function set(html, focus) {
      body.innerHTML = html;
      const h = $("[data-focus]", body); if (h && focus) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    }
    const wid = root.id || "w";
    const STEP_LABELS = ["Info", "Class", "Confirm"];
    const bar = (n) => `<div class="steptabs" aria-hidden="true">${STEP_LABELS.map((label, i) => {
      const idx = i + 1, state = idx < n ? "done" : idx === n ? "active" : "todo";
      return `<div class="steptab ${state}"><i>${idx < n ? "✓" : idx}</i><span>${label}</span></div>`;
    }).join("")}</div>`;
    const field = (id, label, type, val, extra) => `<div class="fld ${S.errs[id] ? "bad" : ""}"><label for="${wid}-${id}">${label}</label>
      <input id="${wid}-${id}" data-f="${id}" type="${type}" value="${esc(val)}" ${extra || ""}>${S.errs[id] ? `<div class="msg">${esc(S.errs[id])}</div>` : ""}</div>`;
    // a real checkbox/radio row: native input (for accessibility + keyboard) + a styled box + text
    const optRow = (kind, name, value, checked, label, sub) => `<label class="optrow"><input type="${kind}" ${name ? `name="${wid}-${name}"` : ""} data-act="${name}" data-v="${esc(value)}" ${checked ? "checked" : ""}>
      <span class="optbox" aria-hidden="true"></span><span>${esc(label)}${sub ? ` <small>${esc(sub)}</small>` : ""}</span></label>`;
    const errBox = () => (S.err ? `<div class="err" role="alert">${S.err}</div>` : "");
    const hpf = () => `<div class="hp" aria-hidden="true"><label>Website<input data-f="hp" tabindex="-1" autocomplete="off" value="${esc(S.hp)}"></label></div>`;
    const consent = () => `<p class="note">By continuing, you agree that ${CONSENT} See our <a href="privacy.html">privacy notice</a>.</p>`;

    /* ----- fallback when the CRM can't be reached ----- */
    function fallback(reason) {
      const ask = S.mode === "ask";
      set(`<div class="fallback"><h3 data-focus>${ask ? "Ask us anything" : "Book your free class"}</h3>
        <p class="sub">${esc(reason || "Online booking is unavailable right now.")} Text, call or message us and we'll get you booked in.</p>
        ${contactButtons(ask ? "Hi! I have a question about Silverback." : "Hi! I'd like to book a free class at Silverback.")}
        <button class="backlink" data-act="retry">Try online booking again</button></div>`);
    }

    /* ----- step 1: who + details ----- */
    function draw1() {
      set(`${bar(1)}
        <h3 data-focus>Claim your free class</h3><p class="sub">Tell us who's training. Next, you'll pick a real class time.</p>
        <span class="lab">Who is the class for?</span>
        <div class="optlist">
          ${optRow("radio", "who", "ADULT", S.who === "ADULT", "Me", "Adult")}
          ${optRow("radio", "who", "TEEN", S.who === "TEEN", "My teen", `${S.kidsMax + 1} to 17`)}
          ${optRow("radio", "who", "CHILD", S.who === "CHILD", "My child", `4 to ${S.kidsMax}`)}
        </div>
        <div class="fgrid" style="margin-top:12px">
          ${field("fn", kid() ? "Your first name" : "First name", "text", S.fn, 'autocomplete="given-name"')}
          ${field("ln", kid() ? "Your last name" : "Last name", "text", S.ln, 'autocomplete="family-name"')}
          ${field("em", "Email", "email", S.em, 'autocomplete="email" inputmode="email"')}
          ${field("ph", "Mobile phone", "tel", S.ph, 'autocomplete="tel" inputmode="tel"')}
        </div>
        ${kid() ? `<div class="fgrid" style="margin-top:10px">${field("cn", (S.who === "CHILD" ? "Child's" : "Teen's") + " first name", "text", S.cn)}${field("ca", "Their age", "number", S.ca, 'min="4" max="17" inputmode="numeric"')}</div>` : ""}
        ${hpf()}${errBox()}
        <button class="btn btn-red btn-lg btn-block" data-act="go1">See available classes</button>${consent()}`, false);
    }
    function validate1() {
      const e = {};
      if (!S.fn.trim()) e.fn = "Enter your first name";
      if (!S.ln.trim()) e.ln = "Enter your last name";
      if (!isEmail(S.em.trim())) e.em = "Enter a valid email";
      if (digits(S.ph).length < 10) e.ph = "Enter a phone number with area code";
      if (kid()) {
        if (!S.cn.trim()) e.cn = "Enter their name";
        const a = parseInt(S.ca, 10);
        if (!a) e.ca = "Enter their age";
        else if (S.who === "CHILD" && (a < 4 || a > S.kidsMax)) e.ca = `Kids classes are ages 4 to ${S.kidsMax}`;
        else if (S.who === "TEEN" && (a <= S.kidsMax || a > 17)) e.ca = `Enter an age from ${S.kidsMax + 1} to 17`;
      }
      S.errs = e;
      return !Object.keys(e).length;
    }
    function payload(extra) {
      return Object.assign({
        consent: true, company_website: S.hp, landing_page: location.href.slice(0, 400),
        first_name: S.fn.trim(), last_name: S.ln.trim(), email: S.em.trim(), phone: S.ph.trim(),
        participant: S.who, child_name: kid() ? S.cn.trim() : "", child_age: kid() ? String(S.ca).trim() : ""
      }, utm, extra || {});
    }
    async function post(path, extra, retry) {
      const token = await tokenForSubmit();
      const [st, d] = await api("POST", path, Object.assign(payload(extra), { token }));
      if (st === 400 && !d.ok && /wait a moment|reload/i.test(d.error || "") && !retry) { await getToken(true); return post(path, extra, true); }
      return [st, d];
    }
    async function go1() {
      if (S.busy) return;
      S.err = ""; if (!validate1()) { draw1(); const b = $(".fld.bad input", body); if (b) b.focus(); return; }
      S.busy = true; setBusy("Saving…");
      try {
        const [st, d] = await post("/api/public/trial/start");
        if (!d.ok) { S.busy = false; S.err = esc(d.error || "Something went wrong. Please try again."); draw1(); return; }
        track("booking_start");
        try { const c = await loadClasses(true); S.classes = c.classes || []; if (c.kids_max_age) S.kidsMax = c.kids_max_age; } catch (e) { S.classes = []; }
        S.busy = false; S.step = 2; S.day = null; S.pick = null; S.notice = ""; draw2(); bring();
      } catch (e) { S.busy = false; S.err = `We couldn't reach the booking system. Please try again, or <a href="${smsHref("Hi! I'd like to book a free class at Silverback.")}">text us</a> or call ${esc(CFG.phoneDisplay)}.`; draw1(); }
    }
    function setBusy(t) { const b = $('[data-act^="go"],[data-act="book"],[data-act="send"]', body); if (b) { b.disabled = true; b.innerHTML = `<span class="spin"></span>${t}`; } }

    /* ----- step 2: pick a class ----- */
    function draw2() {
      let vis = visible();
      if (S.pref && !vis.some(prefMatch)) S.pref = "";
      const progs = [...new Set(vis.map((c) => c.program).filter(Boolean))];
      if (S.prog === "PREF" && !S.pref) S.prog = "ALL";
      if (S.prog === "ALL" && S.pref && !S.prefUsed) { S.prog = "PREF"; S.prefUsed = true; }
      if (S.prog !== "ALL" && S.prog !== "PREF" && !progs.includes(S.prog)) S.prog = "ALL";
      const list = vis.filter((c) => S.prog === "ALL" || (S.prog === "PREF" ? prefMatch(c) : c.program === S.prog));
      const days = [...new Set(list.map((c) => c.date_key))];
      if (S.prefDate && !S.prefDateUsed && days.includes(S.prefDate)) { S.day = S.prefDate; S.prefDateUsed = true; }
      if (!days.includes(S.day)) S.day = days[0] || null;
      const who = kid() && S.cn ? ` for ${esc(S.cn)}` : "";
      const chipRow = (progs.length > 1 || S.pref) ? `<div class="chips" role="group" aria-label="Filter by program">
          <button type="button" class="chip" data-act="prog" data-v="ALL" aria-pressed="${S.prog === "ALL"}">All classes</button>
          ${S.pref ? `<button type="button" class="chip" data-act="prog" data-v="PREF" aria-pressed="${S.prog === "PREF"}">${esc(S.pref)}</button>` : ""}
          ${progs.map((p) => `<button type="button" class="chip" data-act="prog" data-v="${esc(p)}" aria-pressed="${S.prog === p}">${esc(p)}</button>`).join("")}</div>` : "";
      let out = `${bar(2)}<button class="backlink" data-act="back1">← Edit my details</button>
        <h3 data-focus>Hi ${esc(S.fn)}! Pick a free class${who}</h3>
        <p class="sub">Tap a time. ${beginnerNote()}</p>${S.notice ? `<div class="err" role="alert">${esc(S.notice)}</div>` : ""}${chipRow}`;
      if (!list.length) {
        out += `<div class="empty">${S.who === "CHILD" ? "There are no kids classes open for online booking right now." : "There are no classes open for online booking right now."} We've saved your details and we'll contact you shortly to get you booked in.
          ${contactButtons("Hi! I'd like to book a free class at Silverback.")}</div>`;
        set(out, true); return;
      }
      out += `<div class="days" role="group" aria-label="Choose a day">${days.map((k) => {
        const c = list.find((x) => x.date_key === k), parts = String(c.date_label).split(/,\s*/), wd = c.day_tag || parts[0], dn = String(parts[1] || "").split(" ").pop();
        return `<button type="button" class="day ${c.day_tag === "Today" ? "today" : ""}" data-act="day" data-v="${k}" aria-pressed="${k === S.day}" title="${esc(c.date_label)}"><small>${esc(wd)}</small><b>${esc(dn)}</b></button>`; }).join("")}</div>`;
      out += list.filter((c) => c.date_key === S.day).map((c) => {
        const meta = [(c.program && !c.name.toLowerCase().includes(c.program.toLowerCase())) ? c.program : "", c.coach].filter(Boolean).map(esc).join(" · ");
        const tags = (c.state === "FULL" ? '<span class="tag">Full</span>' : c.state === "WAITLIST" ? '<span class="tag w">Waitlist</span>' :
          (c.spots_left != null && c.spots_left <= 5 ? `<span class="tag r">${c.spots_left} spots left</span>` : (beginner(c.name) ? '<span class="tag g">Beginner friendly</span>' : "")));
        return `<button type="button" class="cls" data-act="pick" data-v="${c.id}" ${c.state === "FULL" ? "disabled" : ""}>
          <span class="t">${esc(c.time_label)}${c.end_label ? `<small>to ${esc(c.end_label)}</small>` : ""}</span>
          <span class="n"><b>${esc(c.name)}</b>${meta ? `<small>${meta}</small>` : ""}</span>${tags}</button>`; }).join("");
      set(out, true);
    }
    const beginnerNote = () => (kid() ? "" : "Not sure? Look for the green Beginner friendly tag.");

    /* ----- step 3: confirm ----- */
    function cls() { return S.classes.find((c) => c.id === S.pick); }
    function draw3() {
      const c = cls(); if (!c) { S.step = 2; draw2(); return; }
      set(`${bar(3)}<button class="backlink" data-act="back2">← Choose a different class</button>
        <h3 data-focus>Confirm your free class</h3>
        <div class="sum"><b>${esc(c.name)}</b><span>${esc(c.date_label)} at ${esc(c.time_label)}${c.end_label ? " to " + esc(c.end_label) : ""}</span><span>${kid() && S.cn ? "For " + esc(S.cn) + " · " : ""}44 Prince Andrew Pl, North York (back door)</span></div>
        <span class="lab">What would you like to get out of training? <em style="font-weight:400;color:var(--muted)">(optional, pick any)</em></span>
        <div class="optlist">${GOALS.map((g) => optRow("checkbox", "goal", g, S.goals.includes(g), g)).join("")}</div>
        <span class="lab">${kid() ? "Has " + (S.cn ? esc(S.cn) : "your child") + " trained martial arts before?" : "Have you trained martial arts before?"} <em style="font-weight:400;color:var(--muted)">(optional)</em></span>
        <div class="optlist">${EXPERIENCE.map((x) => optRow("radio", "exp", x, S.exp === x, x)).join("")}</div>
        ${errBox()}<button class="btn btn-red btn-lg btn-block" data-act="book">${c.state === "WAITLIST" ? "Join the waitlist" : "Confirm my free class"}</button>
        <p class="note">This helps your coach get ready. We'll also send a short waiver to sign online before you come in.</p>`, true);
    }
    async function book() {
      if (S.busy) return; const c = cls(); if (!c) return;
      S.busy = true; S.err = ""; setBusy("Booking…");
      try {
        const [st, d] = await post("/api/public/trial", { session_id: c.id, experience: S.exp, goal: S.goals.join(", ") });
        S.busy = false;
        if (!d.ok) {
          if (st === 409) { try { const x = await loadClasses(true); S.classes = x.classes || []; } catch (e) { /* keep list */ } S.pick = null; S.step = 2; S.notice = d.error; draw2(); bring(); return; }
          S.err = esc(d.error || "Something went wrong. Please try again."); draw3(); return;
        }
        S.result = d; S.picked = c; S.step = 4; track("booking_complete"); draw4(); bring();
      } catch (e) { S.busy = false; S.err = `We couldn't reach the booking system. Your details are saved, so please <a href="${smsHref("Hi! I tried to book " + c.name + " on " + c.date_label + " at " + c.time_label + " on your website.")}">text us</a> or call ${esc(CFG.phoneDisplay)} and we'll confirm it.`; draw3(); }
    }

    /* ----- done ----- */
    function draw4() {
      const d = S.result, c = S.picked, wait = d.status === "WAITLIST";
      const mailed = d.confirmation_email === "SENT";
      set(`<div class="done">
        <div class="check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>
        <h3 data-focus>${wait ? "You're on the waitlist" : "You're booked, " + esc(S.fn) + "!"}</h3>
        <div class="sum" style="text-align:left;margin-top:12px"><b>${esc(d.class_name || c.name)}</b><span>${esc(d.when || c.date_label + " at " + c.time_label)}</span>${kid() && S.cn ? `<span>For ${esc(S.cn)}</span>` : ""}<span>${esc(d.location || "Silverback North York MMA")} · 44 Prince Andrew Pl · <b style="display:inline;font:inherit;font-weight:700;color:var(--ink)">back door entrance</b></span></div>
        <p class="sub" style="margin-top:10px">${wait ? "We'll contact you if a spot opens up." : (demo() ? "Demo mode: this is exactly what visitors see after booking. No real booking was made." : mailed ? "We've emailed your confirmation to " + esc(S.em) + "." : "We'll message you shortly to confirm the details.")}</p>
        ${wait ? "" : `<div class="next"><b>What happens next</b><ol>
          ${d.waiver_url ? "<li>Sign your waiver online (about 2 minutes) so check-in is fast.</li>" : "<li>Watch for your waiver link so check-in is fast.</li>"}
          <li>Wear comfortable athletic clothes and bring water. We teach NoGi, so no gi is needed.</li>
          <li>Come in through the back door. Our coach will take care of you.</li></ol></div>`}
        <div class="row">
          ${d.waiver_url && !wait ? `<a class="btn btn-red btn-lg" href="${esc(d.waiver_url)}" target="_blank" rel="noopener" data-track="waiver_click">Sign my waiver now</a>` : ""}
          ${wait ? "" : `<button class="btn btn-ghost" data-act="ics">Add to my calendar</button>`}
          <a class="btn btn-ghost" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("44 Prince Andrew Pl, North York, ON M3C 2H4")}" target="_blank" rel="noopener">Get directions</a>
          <button class="btn btn-ghost btn-sm" data-act="again">Book another person</button>
        </div>
        <div class="member-tease">Already know you want in? ${document.getElementById("pricing") ? `<a href="#pricing" data-join="${kid() ? "kids" : "allaccess"}" data-track="join_done">Join online</a> or <a href="#pricing">see membership pricing</a>` : `<a href="index.html#pricing">See membership pricing</a>`}.</div>
      </div>`, true);
    }

    /* ----- ask a question ----- */
    function drawAsk() {
      set(`<h3 data-focus>Ask us anything</h3><p class="sub">Tell us what you'd like to know and we'll get back to you.</p>
        <div class="fgrid">
          ${field("fn", "First name", "text", S.fn, 'autocomplete="given-name"')}${field("ln", "Last name", "text", S.ln, 'autocomplete="family-name"')}
          ${field("em", "Email", "email", S.em, 'autocomplete="email" inputmode="email"')}${field("ph", "Phone (optional)", "tel", S.ph, 'autocomplete="tel" inputmode="tel"')}
        </div>
        <div class="fld ${S.errs.msg ? "bad" : ""}" style="margin-top:10px"><label for="${wid}-msg">Your question</label><textarea id="${wid}-msg" data-f="msg" placeholder="What would you like to know?">${esc(S.msg)}</textarea>${S.errs.msg ? `<div class="msg">${esc(S.errs.msg)}</div>` : ""}</div>
        ${hpf()}${errBox()}<button class="btn btn-red btn-lg btn-block" data-act="send">Send my question</button>${consent()}`);
    }
    async function send() {
      if (S.busy) return; S.err = "";
      const e = {};
      if (!S.fn.trim()) e.fn = "Enter your first name"; if (!S.ln.trim()) e.ln = "Enter your last name";
      if (!isEmail(S.em.trim())) e.em = "Enter a valid email";
      if (S.ph.trim() && digits(S.ph).length < 10) e.ph = "Include the area code";
      if (S.msg.trim().length < 5) e.msg = "Tell us what you'd like to know";
      S.errs = e; if (Object.keys(e).length) { drawAsk(); return; }
      S.busy = true; setBusy("Sending…");
      try {
        const [st, d] = await post("/api/public/inquiry", { message: S.msg.trim() });
        S.busy = false;
        if (!d.ok) { S.err = esc(d.error || "Something went wrong."); drawAsk(); return; }
        track("question_sent");
        set(`<div class="done"><div class="check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>
          <h3 data-focus>Thanks, ${esc(S.fn)}!</h3><p class="sub">${esc(d.thank_you || "We've got your message and will get back to you shortly.")}</p>
          <div class="row"><button type="button" class="btn btn-red" data-act="tobook">Book a free class</button></div></div>`, true);
      } catch (x) { S.busy = false; S.err = `We couldn't reach the system. Please <a href="${smsHref("Hi! I have a question about Silverback.")}">text us</a> or call ${esc(CFG.phoneDisplay)}.`; drawAsk(); }
    }

    /* ----- mode / start ----- */
    function render() {
      if (!S.ready) { set('<div class="loading"><span class="spin"></span> Loading…</div>'); return; }
      if (S.mode === "ask") return drawAsk();
      if (S.step === 1) return draw1();
      if (S.step === 2) return draw2();
      if (S.step === 3) return draw3();
      return draw4();
    }
    async function start() {
      set('<div class="loading"><span class="spin"></span> Loading…</div>');
      if (!base() && !demo()) { fallback("Online booking is opening soon."); return; }
      try {
        const [c] = await Promise.all([Promise.race([loadClasses(true), new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 9000))]), getToken()]);
        if (c.enabled === false) { fallback("Online booking is closed right now."); return; }
        S.classes = c.classes || []; if (c.kids_max_age) S.kidsMax = c.kids_max_age;
        S.ready = true; render();
      } catch (e) { fallback("We couldn't reach the booking system."); }
    }

    /* ----- events ----- */
    root.addEventListener("input", (e) => {
      const f = e.target.dataset && e.target.dataset.f; if (!f) return;
      S[f] = e.target.value;
      if (S.errs[f]) { delete S.errs[f]; const w = e.target.closest(".fld"); if (w) { w.classList.remove("bad"); const m = $(".msg", w); if (m) m.remove(); } }
    });
    root.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || !e.target.dataset || !e.target.dataset.f || e.target.tagName === "TEXTAREA") return;
      e.preventDefault(); if (S.mode === "ask") send(); else go1();
    });
    root.addEventListener("click", (e) => {
      const t = e.target.closest("[data-act]"); if (!t || !root.contains(t)) return;
      const a = t.dataset.act, v = t.dataset.v;
      if (a === "who") { S.who = v; S.errs = {}; S.err = ""; draw1(); }
      else if (a === "go1") go1();
      else if (a === "back1") { S.step = 1; S.err = ""; draw1(); }
      else if (a === "prog") { S.prog = v; S.day = null; draw2(); }
      else if (a === "day") { S.day = v; draw2(); }
      else if (a === "pick") { S.pick = +v; S.step = 3; S.err = ""; track("booking_class_selected"); draw3(); bring(); }
      else if (a === "back2") { S.step = 2; draw2(); }
      else if (a === "goal") { S.goals = S.goals.includes(v) ? S.goals.filter((x) => x !== v) : S.goals.concat(v); draw3(); }
      else if (a === "exp") { S.exp = S.exp === v ? "" : v; draw3(); }
      else if (a === "book") book();
      else if (a === "send") send();
      else if (a === "ics") { const c = S.picked; if (c) downloadIcs(c); }
      else if (a === "again") { Object.assign(S, { step: 1, who: "ADULT", cn: "", ca: "", pick: null, goals: [], exp: "", err: "", errs: {}, result: null, day: null }); draw1(); bring(); }
      else if (a === "retry") start();
      else if (a === "tobook") { openMode("book"); }
    });

    function openMode(mode, presel) {
      // Every fresh open of the booking flow starts clean at step 1 (but keeps their name/email/phone if
      // already typed, so closing and reopening from a different link never means retyping contact details).
      if (mode === "book") Object.assign(S, { step: 1, who: "ADULT", cn: "", ca: "", pick: null, goals: [], exp: "", err: "", errs: {}, result: null, day: null, pref: "", prefDate: undefined });
      S.mode = mode === "ask" ? "ask" : "book"; S.err = ""; S.errs = {};
      if (presel) {
        if (presel.who && ["ADULT", "TEEN", "CHILD"].includes(presel.who)) S.who = presel.who;
        if (presel.name) { S.pref = presel.name; S.prefUsed = false; S.prog = "ALL"; }
        if (presel.date) { S.prefDate = presel.date; S.prefDateUsed = false; }
      }
      if (!S.ready) start(); else render();
      bring();
    }

    return { openMode, title: () => (S.mode === "ask" ? "Ask a question" : "Free trial class") };
  }

  /* ---------------- wire it all up ---------------- */
  function init() {
    const modal = buildModal();
    const widget = Widget(modal.dialog);
    widget.openMode("book"); // warms up the token + class list quietly while the modal is still closed

    function open(mode, presel) {
      widget.openMode(mode, presel);
      modal.show(mode === "ask" ? "Ask a question" : "Free trial class");
    }
    window.sbOpenBooking = open;

    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-open-modal],[data-book-class],[data-book-who],[data-book-date]"); if (!t) return;
      e.preventDefault();
      const mode = t.dataset.openModal === "ask" ? "ask" : "book";
      if (t.dataset.bookClass && window.sbInterest) window.sbInterest.noteClass(t.dataset.bookClass);
      open(mode, { name: t.dataset.bookClass || "", who: t.dataset.bookWho || "", date: t.dataset.bookDate || "" });
    });

    // Deep link support: a shared link ending in #book or #ask opens the modal straight away.
    if (/^#(book|ask)$/.test(location.hash)) open(location.hash.slice(1));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  // Shared with schedule.js so the calendar and the booking form use the same cached class list and don't double-poll the CRM.
  window.sbBooking = { loadClasses, api, base };
})();

/*
  Silverback class schedule: a real month calendar (like the one on the Legion AJJ site).
  Fetches real classes from the CRM (assets/js/booking.js -> window.sbBooking.loadClasses), so it always shows
  actual bookable dates and live spots. If the CRM isn't reachable yet, it shows a calendar projected from the
  weekly timetable in config.js instead, so the page still looks and works right before you have a permanent
  CRM address. Clicking a class hands it to the booking widget (assets/js/booking.js) with the date pre-picked.
*/
(function () {
  "use strict";
  const CFG = window.SILVERBACK || {};
  const root = document.getElementById("scheduleCal");
  if (!root) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad2 = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const todayKey = dateKey(new Date());
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const beginner = (name) => (CFG.beginnerFriendly || ["Fundamentals", "Kickboxing", "Kids"]).some((k) => String(name).toLowerCase().includes(k.toLowerCase()));
  function badgeClass(programOrGroup) {
    const p = String(programOrGroup || "").toLowerCase();
    if (p.includes("kick") || p.includes("strik")) return "striking";
    if (p.includes("mma")) return "mma";
    return "grappling";
  }

  /* ---------------- data: live from the CRM, or projected from config.js ---------------- */
  let byDate = {};      // "YYYY-MM-DD" -> [class,...]
  let source = "loading";
  let minKey = todayKey, maxKey = todayKey;

  function indexClasses(list) {
    const map = {};
    (list || []).forEach((c) => { (map[c.date_key] = map[c.date_key] || []).push(c); });
    const keys = Object.keys(map).sort();
    if (keys.length) { minKey = keys[0]; maxKey = keys[keys.length - 1]; }
    return map;
  }

  function projectFromConfig(days) {
    const sched = Array.isArray(CFG.schedule) ? CFG.schedule : [];
    const out = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dow = DOW[d.getDay()];
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
      sched.filter((c) => c.day === dayName).forEach((c, idx) => {
        out.push({
          id: `p-${dateKey(d)}-${idx}`, name: c.name, program: c.program, coach: null, state: "OPEN",
          audience: c.group === "kids" ? "KIDS" : "ADULT", end_label: "", spots_left: null,
          date_key: dateKey(d), date_label: `${dow}, ${d.toLocaleDateString("en-US", { month: "short" })} ${d.getDate()}`,
          time_label: c.time, projected: true
        });
      });
    }
    return out;
  }

  async function fetchLive() {
    if (!window.sbBooking) throw new Error("no-booking-module");
    if (!window.sbBooking.base()) throw new Error("no-crm-address"); // crmBase not set yet: keep the timetable calendar, skip a pointless request
    const data = await window.sbBooking.loadClasses();
    if (data.enabled === false) throw new Error("disabled");
    return data.classes || [];
  }

  async function loadData() {
    byDate = indexClasses(projectFromConfig(35));
    source = "projected";
    render();
    try {
      const live = await fetchLive();
      byDate = indexClasses(live);
      source = "live";
    } catch (e) {
      // keep the projected calendar - it's still useful, and the booking widget itself explains if the CRM is down
    }
    render();
  }

  /* ---------------- calendar state ---------------- */
  const today = new Date();
  const S = { y: today.getFullYear(), m: today.getMonth(), sel: todayKey };

  function monthLabel() { return `${MONTHS[S.m]} ${S.y}`; }
  function firstOfView() { return new Date(S.y, S.m, 1); }
  function canPrev() {
    const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstOfView() > startOfThisMonth;
  }
  function canNext() {
    const startOfNextView = new Date(S.y, S.m + 1, 1);
    return dateKey(startOfNextView) <= maxKey || S.m === today.getMonth() && S.y === today.getFullYear();
  }

  function renderGrid() {
    const first = firstOfView();
    const startPad = first.getDay();
    const daysInMonth = new Date(S.y, S.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(S.y, S.m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells.map((d) => {
      if (!d) return `<div class="cal-day pad"></div>`;
      const k = dateKey(d), list = byDate[k] || [], isPast = k < todayKey, isToday = k === todayKey, isSel = k === S.sel;
      const cls = ["cal-day"];
      if (isPast) cls.push("past"); if (isToday) cls.push("today"); if (isSel && !isPast) cls.push("sel"); if (list.length) cls.push("has");
      const count = list.length ? `<em>${list.length} class${list.length === 1 ? "" : "es"}</em>` : (isPast ? "" : "<em>&nbsp;</em>");
      return `<button type="button" class="${cls.join(" ")}" data-act="pick-day" data-v="${k}" ${isPast ? "disabled" : ""} aria-pressed="${isSel}">
        <b>${d.getDate()}</b>${count}</button>`;
    }).join("");
  }

  function renderList() {
    const list = (byDate[S.sel] || []).slice().sort((a, b) => new Date(a.starts_at || 0) - new Date(b.starts_at || 0));
    const d = new Date(S.sel + "T00:00:00");
    const label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (!list.length) {
      const msg = S.sel < todayKey ? "That date has passed." : "No classes shown for this day yet.";
      return `<div class="cal-list"><h4>${esc(label)}</h4><div class="cal-empty">${msg} Pick another day, or <a href="#book">book a free class</a> and we'll help you find a time.</div></div>`;
    }
    const cards = list.map((c) => {
      const badges = [`<span class="cal-badge ${badgeClass(c.program || c.name)}">${esc(c.program || "Class")}</span>`];
      if (c.audience === "KIDS") badges.push('<span class="cal-badge kids">Kids</span>');
      if (c.state === "FULL") badges.push('<span class="tag">Full</span>');
      else if (c.state === "WAITLIST") badges.push('<span class="tag w">Waitlist</span>');
      else if (c.spots_left != null && c.spots_left <= 5) badges.push(`<span class="tag r">${c.spots_left} spots left</span>`);
      else if (beginner(c.name)) badges.push('<span class="tag g">Beginner friendly</span>');
      return `<div class="cal-card">
        <span class="cc-time">${esc(c.time_label)}${c.end_label ? " – " + esc(c.end_label) : ""}</span>
        <b>${esc(c.name)}</b>${c.coach ? `<span class="cc-meta">Coach: ${esc(c.coach)}</span>` : ""}
        <span class="cc-row">${badges.join("")}</span>
        ${c.state === "FULL" ? "" : `<a class="btn btn-ghost btn-sm" href="#book" data-book-class="${esc(c.name)}" data-book-who="${c.audience === "KIDS" ? "CHILD" : "ADULT"}" data-book-date="${esc(c.date_key)}" data-track="cta_calendar">Book this class as my free trial</a>`}
      </div>`;
    }).join("");
    return `<div class="cal-list"><h4>${esc(label)}</h4><p class="sub">Tap a class to book it as your free trial.</p><div class="cal-cards">${cards}</div></div>`;
  }

  function render() {
    root.innerHTML = `<div class="cal">
      <div class="cal-top">
        <button type="button" class="cal-nav" data-act="prev" aria-label="Previous month" ${canPrev() ? "" : "disabled"}>&larr;</button>
        <h3>${esc(monthLabel())}</h3>
        <button type="button" class="cal-today" data-act="today">Today</button>
        <button type="button" class="cal-nav" data-act="next" aria-label="Next month" ${canNext() ? "" : "disabled"}>&rarr;</button>
      </div>
      <div class="cal-dow">${DOW.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="cal-grid">${renderGrid()}</div>
      ${renderList()}
      <div class="cal-foot">${source === "live" ? "Live from the front-desk schedule. Updated just now." : "Showing our usual weekly schedule. Book a class to lock in a real spot."}</div>
    </div>`;
  }

  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]"); if (!t) return;
    const a = t.dataset.act;
    if (a === "pick-day") { S.sel = t.dataset.v; render(); const list = $(".cal-list", root); if (list) list.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
    else if (a === "prev") { S.m--; if (S.m < 0) { S.m = 11; S.y--; } render(); }
    else if (a === "next") { S.m++; if (S.m > 11) { S.m = 0; S.y++; } render(); }
    else if (a === "today") { S.y = today.getFullYear(); S.m = today.getMonth(); S.sel = todayKey; render(); }
  });

  render();
  loadData();
})();

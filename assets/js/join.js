/*
  Silverback online join portal.
  Opens from any "Join online" button ([data-join="kickboxing" | "allaccess" | "grappling" | "kids"]).
  Steps: 1 plan (program, commitment, pay monthly or every 2 weeks) -> 2 your details -> hand off to the CRM.
  Prices come from config.js "plans" through window.sbPricing (site.js), so the portal always matches the pricing section.
  Step 2's "Continue to secure checkout" calls POST /api/public/membership with the chosen program/commitment/frequency
  (never a price - the CRM always looks up its own plan and its own price) and a name/email/phone. The CRM resolves or
  creates the lead and returns a real, one-person signing link - the same page staff already send from Signup Links -
  and this page redirects the browser straight there. The waiver, the membership agreement and the Square card form
  all happen on that CRM page; this site never collects a card number.
  While crmBase is empty (config.js), this stays in demo mode: the same steps run, but nothing is sent anywhere and
  the last step shows what the redirect would have been instead of actually leaving the page.
*/
(function () {
  "use strict";
  const CFG = window.SILVERBACK || {};
  const B = window.sbBooking;
  const base = () => (B && B.base ? B.base() : "");
  const demo = () => !base() && !!CFG.demoMode;
  const P = window.sbPricing;
  if (!P || !P.plans.length) return;
  const track = window.sbTrack || function () {};
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const digits = (v) => String(v || "").replace(/\D/g, "");
  const age = (iso) => { const d = new Date(iso + "T00:00:00"); if (isNaN(d)) return null; const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

  const S = { step: 1, plan: "allaccess", term: "3m", freq: "month", fn: "", ln: "", em: "", ph: "", dob: "", cn: "", cdob: "", hp: "", errs: {}, err: "", busy: false };
  const plan = () => P.plan(S.plan) || P.plans[0];
  const kids = () => !!plan().kids;
  const terms = () => (kids() ? [["mtm", "Month-to-month"], ["3m", "3 months or longer"]] : [["mtm", "Month-to-month"], ["3m", "3-month commitment"], ["12m", "12-month commitment"]]);
  const price = (t, f) => P.perPayment(S.plan, t || S.term, f || S.freq);
  const every = (f) => ((f || S.freq) === "biweek" ? "every 2 weeks" : "every month");
  const months = () => (S.term === "12m" ? 12 : S.term === "3m" ? 3 : 0);

  /* ---------------- modal shell ---------------- */
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="joinTitle" tabindex="-1">
    <div class="modal-head"><h3 class="modal-title" id="joinTitle">Join Silverback</h3><div class="mh-right">${demo() ? '<span class="demo-pill" title="Mock-up: no payment is taken">Demo</span>' : ""}<button type="button" class="modal-close" aria-label="Close">&times;</button></div></div>
    <div class="bk" aria-live="polite"></div>
    <div class="also"><span>No registration fee</span><span>&middot;</span><span>Secure payments by Square</span></div></div>`;
  document.body.appendChild(overlay);
  const dialog = $(".modal-dialog", overlay), body = $(".bk", overlay);
  let lastFocus = null;
  function show() { lastFocus = document.activeElement; overlay.classList.add("open"); document.documentElement.classList.add("modal-open"); dialog.focus({ preventScroll: true }); }
  function hide() { overlay.classList.remove("open"); if (!document.querySelector(".modal-overlay.open")) document.documentElement.classList.remove("modal-open"); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }
  overlay.addEventListener("click", (e) => { if (e.target === overlay) hide(); });
  $(".modal-close", overlay).addEventListener("click", hide);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay.classList.contains("open")) hide(); });

  /* ---------------- pieces ---------------- */
  const LABELS = ["Plan", "Details", "Checkout"];
  const bar = (n) => `<div class="steptabs" aria-hidden="true">${LABELS.map((l, i) => {
    const k = i + 1, st = k < n ? "done" : k === n ? "active" : "todo";
    return `<div class="steptab ${st}"><i>${k < n ? "✓" : k}</i><span>${l}</span></div>`; }).join("")}</div>`;
  const optRow = (name, value, checked, label, sub) => `<label class="optrow"><input type="radio" name="join-${name}" data-act="${name}" data-v="${esc(value)}" ${checked ? "checked" : ""}>
    <span class="optbox" aria-hidden="true"></span><span>${label}${sub ? ` <small>${sub}</small>` : ""}</span></label>`;
  const field = (id, label, type, extra) => `<div class="fld ${S.errs[id] ? "bad" : ""}"><label for="join-${id}">${label}</label>
    <input id="join-${id}" data-f="${id}" type="${type}" value="${esc(S[id])}" ${extra || ""}>${S.errs[id] ? `<div class="msg">${esc(S.errs[id])}</div>` : ""}</div>`;
  const errBox = () => (S.err ? `<div class="err" role="alert">${esc(S.err)}</div>` : "");
  const back = (to, text) => `<button class="backlink" data-act="back" data-v="${to}">← ${text}</button>`;
  function summary() {
    const p = plan(), pay = price(), promo = P.promo(S.plan, S.term);
    return `<div class="sum jsum"><b>${esc(p.name)}</b>
      <span>${esc(terms().filter((t) => t[0] === S.term)[0][1])}${promo ? ' · <em class="tagline">Limited-time price</em>' : ""}</span>
      <span class="jprice"><strong>${P.money(pay)}</strong> + tax ${every()}</span>
      <span>About ${P.money(P.tax(pay))} per payment with ${+CFG.taxPercent || 0}% HST · No registration fee</span></div>`;
  }
  function keyTerms() {
    const n = months(), pay = P.money(price());
    const rate = `<li><b>Rate:</b> ${pay} plus applicable tax, charged automatically to your card ${every()}.</li>`;
    if (!n) return `<ul>${rate}<li><b>Commitment:</b> none. Month-to-month membership.</li><li><b>Cancelling:</b> email info@nymma.ca at least 15 days before your next billing date.</li></ul>`;
    return `<ul>${rate}<li><b>Commitment:</b> a minimum of ${n} months from your start date. It can't be cancelled during that time except for permanent medical disability or relocation (with documentation).</li>
      <li><b>After ${n} months:</b> it continues month-to-month at the same rate. To cancel, email info@nymma.ca at least 15 days before your next billing date.</li></ul>`;
  }
  function set(html) { body.innerHTML = html; body.scrollTop = 0; }

  /* ---------------- step 1: plan ---------------- */
  function draw1() {
    if (kids() && S.term === "12m") S.term = "3m";
    set(`${bar(1)}<h3>Choose your membership</h3><p class="sub">Pick a program and how you'd like to pay. Prices are before tax.</p>
      <span class="lab">Program</span>
      <div class="optlist">${P.plans.map((p) => optRow("plan", p.key, S.plan === p.key, esc(p.name), esc(p.includes))).join("")}</div>
      <span class="lab">Commitment</span>
      <div class="optlist">${terms().map(([k, l]) => optRow("term", k, S.term === k, l, `${P.money(price(k))} ${S.freq === "biweek" ? "every 2 weeks" : "per month"}${P.promo(S.plan, k) ? " · limited-time price" : ""}`)).join("")}</div>
      <span class="lab">How would you like to pay?</span>
      <div class="optlist">
        ${optRow("freq", "month", S.freq === "month", "Monthly", `${P.money(price(S.term, "month"))} + tax every month`)}
        ${optRow("freq", "biweek", S.freq === "biweek", "Every 2 weeks", `${P.money(price(S.term, "biweek"))} + tax every 2 weeks`)}
      </div>
      ${summary()}
      <button class="btn btn-red btn-lg btn-block" data-act="go" data-v="2">Continue</button>`);
  }

  /* ---------------- step 2: details ---------------- */
  const hpf = () => `<div class="hp" aria-hidden="true"><label>Website<input data-f="hp" tabindex="-1" autocomplete="off" value="${esc(S.hp || "")}"></label></div>`;
  function draw2() {
    const k = kids();
    set(`${bar(2)}${back(1, "Change plan")}<h3>${k ? "Parent or guardian details" : "Your details"}</h3>
      <p class="sub">${k ? "You'll be the account holder. Your receipts go to your email." : "Your receipts go to your email."}</p>
      <div class="fgrid">${field("fn", "First name", "text", 'autocomplete="given-name"')}${field("ln", "Last name", "text", 'autocomplete="family-name"')}
        ${field("em", "Email", "email", 'autocomplete="email" inputmode="email"')}${field("ph", "Mobile phone", "tel", 'autocomplete="tel" inputmode="tel"')}</div>
      <div class="fgrid" style="margin-top:10px">${k ? field("cn", "Child's first name", "text") + field("cdob", "Child's date of birth", "date") : field("dob", "Date of birth", "date", 'autocomplete="bday"')}</div>
      ${hpf()}${errBox()}<button class="btn btn-red btn-lg btn-block" data-act="go" data-v="3">Continue</button>
      <p class="note">By continuing, you agree that Silverback North York MMA may contact you by text, phone and email about your membership. See our <a href="privacy.html">privacy notice</a>.</p>`);
  }
  function valid2() {
    const e = {};
    if (!S.fn.trim()) e.fn = "Enter your first name";
    if (!S.ln.trim()) e.ln = "Enter your last name";
    if (!isEmail(S.em.trim())) e.em = "Enter a valid email";
    if (digits(S.ph).length < 10) e.ph = "Enter a phone number with area code";
    if (kids()) {
      if (!S.cn.trim()) e.cn = "Enter your child's first name";
      const a = age(S.cdob);
      if (a == null) e.cdob = "Enter their date of birth"; else if (a < 4 || a > 12) e.cdob = "The kids program is for ages 4 to 12";
    } else {
      const a = age(S.dob);
      if (a == null) e.dob = "Enter your date of birth"; else if (a < 13) e.dob = "Under 13? Choose the Kids program"; else if (a > 110) e.dob = "Check the year";
    }
    S.errs = e; return !Object.keys(e).length;
  }

  /* ---------------- step 3: review, then hand off to the CRM's secure checkout ---------------- */
  function draw3() {
    const k = kids(), minor = !k && age(S.dob) != null && age(S.dob) < 18;
    set(`${bar(3)}${back(2, "Edit details")}<h3>Review and continue</h3>
      <p class="sub">${k ? `As ${esc(S.cn)}'s parent or guardian, you'll sign for them next.` : minor ? "You're under 18, so a parent or guardian also signs before your first class." : "One more step and you're set."}</p>
      ${summary()}
      <div class="jterms"><b>Key terms</b>${keyTerms()}</div>
      <div class="cardbox" role="note">${LOCK}<div><b>Next: a secure Silverback page</b><span>You'll sign the participation waiver and membership agreement, then enter your card with Square. This site never sees your card number.</span></div></div>
      ${errBox()}<button class="btn btn-red btn-lg btn-block" data-act="pay">Continue to secure checkout</button>`);
  }
  function fallback(reason) {
    const msg = "Hi! I'd like to join Silverback (" + plan().name + ", " + terms().filter((t) => t[0] === S.term)[0][1] + ").";
    const tel = digits(CFG.phone), sms = "sms:" + tel + (/iPhone|iPad|iPod/.test(navigator.userAgent) ? "&" : "?") + "body=" + encodeURIComponent(msg);
    const wa = "https://wa.me/" + (CFG.whatsapp || tel) + "?text=" + encodeURIComponent(msg);
    set(`${bar(3)}${back(2, "Edit details")}<h3>We couldn't reach the sign-up page</h3>
      <p class="sub">${esc(reason || "Please try again in a moment, or reach us directly and we'll get you set up.")}</p>
      <div class="row" style="margin-top:8px"><button class="btn btn-red btn-lg btn-block" data-act="pay">Try again</button></div>
      <div class="row" style="margin-top:8px"><a class="btn btn-ghost" href="${sms}" data-track="sms_fallback">Text us</a>
        <a class="btn btn-ghost" href="${wa}" target="_blank" rel="noopener" data-track="wa_fallback">Message on WhatsApp</a>
        <a class="btn btn-ghost" href="tel:${esc(CFG.phone)}" data-track="call_fallback">Call ${esc(CFG.phoneDisplay)}</a></div>`);
  }
  async function pay() {
    if (S.busy) return;
    S.busy = true; S.err = ""; const b = $('[data-act="pay"]', body); if (b) { b.disabled = true; b.innerHTML = '<span class="spin"></span>Getting your secure page ready…'; }
    if (demo()) {
      await new Promise((r) => setTimeout(r, 700)); S.busy = false; track("join_complete_demo");
      set(`<div class="done"><div class="check" aria-hidden="true">${CHECK}</div><h3>Demo mode</h3>${summary()}
        <p class="sub" style="margin-top:10px">In the live version, you'd now be sent to a secure Silverback page to sign the waiver, sign the membership agreement and enter your card with Square. Nothing was sent and nothing was charged.</p></div>`);
      return;
    }
    try {
      const token = await B.tokenForSubmit();
      const [st, d] = await B.api("POST", "/api/public/membership", {
        token, first_name: S.fn, last_name: S.ln, email: S.em, phone: S.ph, company_website: S.hp,
        plan_key: S.plan, term: S.term, freq: S.freq, landing_page: location.href.slice(0, 400), consent: true,
      });
      if (st === 200 && d && d.ok && d.url) { track("join_redirect"); location.href = d.url; return; }
      S.busy = false; fallback((d && d.error) || "Please try again, or reach us directly.");
    } catch (e) {
      S.busy = false; fallback("We couldn't reach the sign-up system.");
    }
  }

  function render() { [null, draw1, draw2, draw3][S.step](); }

  /* ---------------- events ---------------- */
  overlay.addEventListener("input", (e) => {
    const f = e.target.dataset && e.target.dataset.f; if (!f) return;
    S[f] = e.target.value;
    if (S.errs[f]) { delete S.errs[f]; const w = e.target.closest(".fld"); if (w) { w.classList.remove("bad"); const m = $(".msg", w); if (m) m.remove(); } }
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.target.dataset || !e.target.dataset.f) return;
    e.preventDefault(); const b = $('[data-act="go"],[data-act="pay"]', body); if (b) b.click();
  });
  overlay.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]"); if (!t || !overlay.contains(t)) return;
    const a = t.dataset.act, v = t.dataset.v;
    if (a === "plan") { S.plan = v; draw1(); }
    else if (a === "term") { S.term = v; draw1(); }
    else if (a === "freq") { S.freq = v; track("join_freq_" + v); draw1(); }
    else if (a === "back") { S.step = +v; S.err = ""; S.errs = {}; render(); }
    else if (a === "go") {
      const to = +v; S.err = "";
      if (to === 2) track("join_plan_" + S.plan + "_" + S.term + "_" + S.freq);
      if (to === 3 && !valid2()) { draw2(); const b = $(".fld.bad input", body); if (b) b.focus(); return; }
      if (to === 3) track("join_details");
      S.step = to; render();
    }
    else if (a === "pay") pay();
  });

  function open(key) {
    const cur = P.current();
    if (P.plan(key)) S.plan = key;
    S.term = cur.term; S.freq = cur.freq;
    S.step = 1; S.err = ""; S.errs = {}; S.busy = false;
    document.querySelectorAll(".modal-overlay.open").forEach((o) => { if (o !== overlay) o.classList.remove("open"); });
    render(); show(); track("join_open");
  }
  window.sbOpenJoin = open;
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-join]"); if (!t) return;
    e.preventDefault(); if (window.sbInterest) window.sbInterest.set(t.dataset.join); open(t.dataset.join);
  });
  if (location.hash === "#join") open("allaccess");
})();

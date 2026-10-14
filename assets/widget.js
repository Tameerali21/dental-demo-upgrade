/* Nora — "Never Miss a Customer" demo chat engine (dental edition).
   100% client-side. No network calls, no tracking. Works from file:// .
   Test hooks: ?fast=1 skips delays; window.__maya exposes state + send(). */
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var FAST = qs.get('fast') === '1';

  /* ---------- business profile (personalizable via ?biz= etc.) ---------- */
  var BIZ = {
    name:    qs.get('biz')     || 'Bright Smile Dental Studio',
    tagline: qs.get('tagline') || 'Family & Cosmetic Dentistry',
    city:    qs.get('city')    || 'Austin, TX',
    address: qs.get('addr') || qs.get('address') || '4210 N Lamar Blvd, Austin, TX 78756',
    phone:   qs.get('phone')   || '(512) 555-0182',
    host: 'Nora'
  };
  // short ref prefix from the name's initials, e.g. "Bright Smile" -> "BS", "Rose & Rye" -> "RR"
  BIZ.refPrefix = (BIZ.name.split(/\s+/).map(function (w) { return w.charAt(0); }).filter(function (c) { return /[A-Za-z]/.test(c); }).join('').slice(0, 2).toUpperCase()) || 'BS';

  /* apply personalization to the page */
  function personalize() {
    document.querySelectorAll('[data-biz="name"]').forEach(function (el) { el.textContent = BIZ.name; });
    document.querySelectorAll('[data-biz="tagline"]').forEach(function (el) { el.textContent = BIZ.tagline; });
    document.querySelectorAll('[data-biz="city"]').forEach(function (el) { el.textContent = BIZ.city; });
    document.querySelectorAll('[data-biz="address"]').forEach(function (el) { el.textContent = BIZ.address; });
    document.querySelectorAll('[data-biz="phone"]').forEach(function (el) { el.textContent = BIZ.phone; });
    document.querySelectorAll('[data-biz="host"]').forEach(function (el) { el.textContent = BIZ.host; });
    document.querySelectorAll('[data-biz="host-initial"]').forEach(function (el) { el.textContent = BIZ.host.charAt(0); });
    /* addr-card heading (fleet pattern: explicit id binding, mirrors hvac/legal) */
    var ab = document.getElementById('addr-biz');
    if (ab) ab.textContent = BIZ.name;
    document.title = BIZ.name + ' — ' + BIZ.tagline + ' | ' + BIZ.city;
  }
  /* ---------- deep personalization: ?services= ?hours= ----------
     services: pipe-separated REAL service names -> rendered into the services grid (max 8).
     hours: pipe-separated "Day(s): time" pairs -> rendered into the hours table (max 6).
     Graceful fallback: the page keeps its built-in fictional content when a param is absent. */
  function dpEsc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function deepPersonalize() {
    var svc = qs.get('services');
    if (svc) {
      var items = svc.split('|').map(function (s) { return s.trim(); }).filter(function (s) { return s; }).slice(0, 8);
      var grid = document.querySelector('#services .menu-grid, #menu .menu-grid, #rooms .menu-grid, #practice .menu-grid, #services .cards');
      if (grid && items.length) {
        var isCards = grid.classList.contains('cards');
        grid.innerHTML = items.map(function (name) {
          var n = dpEsc(name);
          if (isCards) {
            return '<div class="card"><div class="ico">&#10003;</div><h3>' + n + '</h3>' +
              '<p>Offered at ' + dpEsc(BIZ.name) + ' &mdash; chat below for details &amp; pricing.</p></div>';
          }
          return '<div class="menu-card"><div class="cat">Service</div><h3>' + n + '</h3>' +
            '<p>Offered at ' + dpEsc(BIZ.name) + ' &mdash; ask ' + dpEsc(BIZ.host) + ' below for details &amp; pricing.</p></div>';
        }).join('');
      }
    }
    var hrs = qs.get('hours');
    if (hrs) {
      var rows = hrs.split('|').map(function (s) { return s.trim(); }).filter(function (s) { return s; }).slice(0, 6);
      var table = document.querySelector('table.hours') || document.querySelector('#visit table');
      if (table && rows.length) {
        var chatCell = null;
        Array.prototype.forEach.call(table.rows, function (r) {
          if (/chat/i.test(r.textContent) && r.cells[1]) chatCell = r.cells[1].innerHTML;
        });
        var html = rows.map(function (r) {
          var i = r.indexOf(':');
          var day = (i > 0 ? r.slice(0, i) : r).trim();
          var time = (i > 0 ? r.slice(i + 1) : '').trim();
          return '<tr><td>' + dpEsc(day) + '</td><td>' + dpEsc(time) + '</td></tr>';
        }).join('');
        if (chatCell) html += '<tr><td>Chat with ' + dpEsc(BIZ.host) + '</td><td>' + chatCell + '</td></tr>';
        table.innerHTML = html;
      }
    }
  }


  /* ---------- leads (localStorage only) ---------- */
  var LEAD_KEY = 'nmc_dental_leads';
  var leads = [];
  try { leads = JSON.parse(localStorage.getItem(LEAD_KEY) || '[]'); } catch (e) { leads = []; }
  function saveLead(l) {
    l.at = new Date().toISOString(); l.biz = BIZ.name;
    leads.push(l);
    try { localStorage.setItem(LEAD_KEY, JSON.stringify(leads)); } catch (e) {}
    renderInbox(); /* keep the prospect-visible inbox panel live */
  }

  /* ---------- captured-leads inbox preview (prospect-visible panel) ----------
     The after-hours card promises "Saved to your dashboard" — this panel makes
     that claim visible on the page. Reads localStorage only, everything escaped. */
  var inboxEls = null;
  function inboxDom() {
    if (!inboxEls) {
      var p = document.getElementById('inbox-panel'),
          l = document.getElementById('inbox-list'),
          t = document.getElementById('inbox-toggle'),
          c = document.getElementById('inbox-count');
      if (!p || !l || !t) return null;
      inboxEls = { panel: p, list: l, toggle: t, count: c };
    }
    return inboxEls;
  }
  function fmtLeadTime(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso || '';
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) { return iso || ''; }
  }
  function renderInbox() {
    var dom = inboxDom();
    if (!dom) return;
    if (dom.count) dom.count.textContent = String(leads.length);
    if (!leads.length) {
      dom.list.innerHTML = '<div class="inbox-empty"><b>No leads yet</b> &mdash; try the &#127769; 11:42 PM after-hours flow in the chat &mdash; the captured lead will appear right here.</div>';
      return;
    }
    dom.list.innerHTML = leads.slice().reverse().map(function (l) {
      var when = l.at
        ? '<time datetime="' + escapeHtml(l.at) + '">' + escapeHtml(fmtLeadTime(l.at)) + '</time>'
        : '&mdash;';
      var detail = (l.details && l.details !== '\u2014' && l.details !== '-')
        ? '<div class="lead-detail">&ldquo;' + escapeHtml(l.details) + '&rdquo;</div>'
        : '';
      return '<div class="lead-row">' +
        '<span class="lead-name">' + escapeHtml(l.name || '\u2014') + '</span>' +
        '<span class="lead-tag">' + escapeHtml(l.topic || 'Lead') + '</span>' +
        '<span class="lead-phone">' + escapeHtml(l.phone || '\u2014') + '</span>' +
        '<span class="lead-src">' + escapeHtml(l.source || '') + '</span>' +
        '<div class="lead-when">Captured ' + when + '</div>' +
        detail +
        '</div>';
    }).join('');
  }

  /* ---------- dom ---------- */
  var panel, msgs, chipsBox, input, bubble, unread, closeBtn;
  var opened = false, autoOpened = false, greeted = false;

  /* conversation state */
  var S = {
    mode: 'idle',          // idle | booking | afterhours | review
    step: 0,
    booking: {},
    ah: {},
    lastTopic: null
  };

  function $(id) { return document.getElementById(id); }

  function delay(ms) {
    return new Promise(function (res) { setTimeout(res, FAST ? 0 : ms); });
  }

  function scrollDown() { msgs.scrollTop = msgs.scrollHeight; }

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }

  /* ---------- rendering ---------- */
  function addUser(text) {
    var row = el('div', 'mrow user');
    row.appendChild(el('div', 'bubble', escapeHtml(text)));
    msgs.appendChild(row); scrollDown();
  }

  function addBot(html, opts) {
    var row = el('div', 'mrow bot');
    row.appendChild(el('div', 'mavatar', BIZ.host.charAt(0)));
    var b = el('div', 'bubble', html);
    row.appendChild(b);
    msgs.appendChild(row);
    if (opts && opts.notice) b.classList.add('notice');
    scrollDown();
    return b;
  }

  function addNotice(html) {
    var row = el('div', 'mrow bot');
    row.appendChild(el('div', 'notice', html));
    row.style.maxWidth = '100%';
    msgs.appendChild(row); scrollDown();
  }

  function addDashCard(rows) {
    var row = el('div', 'mrow bot');
    var card = el('div', 'dashcard');
    card.appendChild(el('div', 'dl-head', '&#128203; Saved to your dashboard'));
    rows.forEach(function (r) {
      card.appendChild(el('div', 'dl-row', '<span>' + r[0] + ':</span> <b>' + escapeHtml(r[1]) + '</b>'));
    });
    row.appendChild(card);
    row.style.maxWidth = '100%';
    msgs.appendChild(row); scrollDown();
  }

  function showTyping() {
    var row = el('div', 'mrow bot', '');
    row.id = 'maya-typing-row';
    row.appendChild(el('div', 'mavatar', BIZ.host.charAt(0)));
    var b = el('div', 'bubble typing', '<i></i><i></i><i></i>');
    row.appendChild(b);
    msgs.appendChild(row); scrollDown();
  }
  function hideTyping() {
    var t = $('maya-typing-row');
    if (t) t.remove();
  }

  function setChips(list) {
    chipsBox.innerHTML = '';
    (list || []).forEach(function (c) {
      var btn = el('button', 'chip', c.label);
      btn.type = 'button';
      btn.addEventListener('click', function () { userSays(c.value || c.label, c.silent); });
      chipsBox.appendChild(btn);
    });
    scrollDown();
  }

  function showStars() {
    chipsBox.innerHTML = '';
    var wrap = el('div', 'stars-row');
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var s = el('button', 'star-btn', '&#11088;');
        s.type = 'button';
        s.setAttribute('aria-label', n + ' star' + (n > 1 ? 's' : ''));
        s.addEventListener('click', function () { pickStars(n); });
        wrap.appendChild(s);
      })(i);
    }
    chipsBox.appendChild(wrap);
    scrollDown();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- bot speech ---------- */
  function say(html, chips, opts) {
    showTyping();
    var wait = Math.min(700 + html.length * 6, 1900);
    return delay(wait).then(function () {
      hideTyping();
      addBot(html);
      setChips(chips);
    });
  }

  function sayMany(items) {
    // items: [{html, chips, notice}]
    var p = Promise.resolve();
    items.forEach(function (it) {
      p = p.then(function () {
        showTyping();
        var wait = Math.min(600 + (it.html || '').length * 5, 1700);
        return delay(wait).then(function () {
          hideTyping();
          if (it.dash) { addDashCard(it.dash); }
          else if (it.notice) { addNotice(it.html); }
          else { addBot(it.html); }
          setChips(it.chips);
        });
      });
    });
    return p;
  }

  /* ---------- helpers ---------- */
  function makeRef() {
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    var r = '';
    for (var i = 0; i < 5; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
    return BIZ.refPrefix + '-' + r;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* word-start keyword match (proven 2026-10-03 standard): "located" must not
     trigger the "cat" amenities keyword, "recall" must not trigger the "call you"
     branch, "anywhere" must not trigger the "where" branch, "foreclosure" must
     not trip the "close" hours keyword. Prefix keywords like 'schedul'/'insur'
     still match 'schedule'/'insurance'; phrases keep word-start match. */
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function has(t) {
    var words = Array.prototype.slice.call(arguments, 1);
    return words.some(function (w) {
      return new RegExp('(^|[^a-z])' + escRe(w)).test(t);
    });
  }

  /* ---------- intent answers ---------- */
  function hoursHtml() {
    return '<b>Our hours:</b><br>Mon&ndash;Fri &middot; 8 AM &ndash; 6 PM<br>' +
      'Saturday &middot; 9 AM &ndash; 2 PM<br>Sunday &middot; closed<br><br>' +
      'Toothache can\'t wait? We hold <b>same-day emergency slots</b> every weekday. Want me to book you in?';
  }

  function servicesHtml() {
    return 'Everything your smile needs, under one roof. &#129463;<br><br>' +
      '<b>Most loved:</b><br>&middot; Cleaning &amp; exam &mdash; <b>$99</b> new-patient special<br>' +
      '&middot; Professional whitening &mdash; from <b>$299</b><br>' +
      '&middot; Invisalign&reg; clear aligners &mdash; <b>free consult</b><br>' +
      '&middot; Tooth-colored fillings &mdash; from <b>$150</b><br>' +
      '&middot; Same-day emergency care<br><br>' +
      'We work with <b>most PPO insurance plans</b> and verify your benefits before your visit &mdash; no surprise bills. What are you looking for?';
  }

  function insuranceHtml() {
    return 'Great news &mdash; we work with <b>most major PPO plans</b>: Delta Dental, Cigna, Aetna, MetLife, Guardian and more. &#129309;<br><br>' +
      'We <b>verify your benefits before your visit</b>, so you\'ll know exactly what\'s covered &mdash; no surprise bills, ever. No insurance? Ask about our in-house membership plan. Want me to book you a visit?';
  }

  function defaultChips() {
    return [
      { label: '&#129463; Our services' },
      { label: '&#128197; Book an appointment' },
      { label: '&#127769; After-hours demo' },
      { label: '&#11088; Rate your visit' }
    ];
  }

  function greet() {
    greeted = true;
    return say(
      'Hi there! I\'m <b>' + escapeHtml(BIZ.host) + '</b>, ' + escapeHtml(BIZ.name) + '\'s care coordinator. &#129463;<br><br>' +
      'Ask me about <b>services</b>, <b>insurance</b> or <b>hours</b> &mdash; or I can <b>book your appointment</b> right now. What can I help with?',
      defaultChips()
    );
  }

  /* ---------- flows ---------- */
  var REASONS = ['Cleaning', 'Toothache', 'Whitening', 'Checkup', 'Braces / Invisalign', 'Filling'];

  function startBooking() {
    S.mode = 'booking'; S.step = 0; S.booking = {};
    return say('Lovely &mdash; let\'s get you in. <b>What\'s the visit for?</b>',
      REASONS.map(function (r) { return { label: r }; }));
  }

  function bookingStep(text) {
    var t = text.toLowerCase().trim();
    if (S.step === 0) {
      var reason = 'Checkup';
      for (var i = 0; i < REASONS.length; i++) {
        if (t.indexOf(REASONS[i].toLowerCase().split(' ')[0]) !== -1) { reason = REASONS[i]; break; }
      }
      if (has(t, 'toothache', 'tooth pain', 'hurt', 'pain', 'emergency', 'broken', 'cracked', 'swollen')) reason = 'Toothache (urgent)';
      if (has(t, 'clean')) reason = 'Cleaning';
      if (has(t, 'whiten')) reason = 'Whitening';
      if (has(t, 'invisalign', 'brace', 'aligner', 'straighten')) reason = 'Braces / Invisalign';
      if (has(t, 'filling', 'cavity')) reason = 'Filling';
      S.booking.reason = reason; S.step = 1;
      return say('<b>' + escapeHtml(reason) + '</b> &mdash; got it. <b>What\'s your name?</b>');
    }
    if (S.step === 1) {
      var name = text.trim();
      if (name.length < 2 || name.length > 40) {
        return say('And your <b>name</b> for the appointment?');
      }
      S.booking.name = name; S.step = 2;
      return say('Thanks, ' + escapeHtml(cap(name.split(' ')[0])) +
        '! Want a <b>text reminder</b> before your visit? Drop your number &mdash; or skip it.',
        [{ label: 'Skip', value: 'skip' }]);
    }
    if (S.step === 2) {
      var digits = t.replace(/\D/g, '');
      if (t !== 'skip' && digits.length < 7) {
        return say('Hmm, that doesn\'t look like a complete number &mdash; mind double-checking it? <i>(or tap Skip)</i>',
          [{ label: 'Skip', value: 'skip' }]);
      }
      if (t !== 'skip') S.booking.phone = text.trim();
      S.step = 3;
      return say('<b>Which day</b> works best for you?',
        [{ label: 'Tomorrow' }, { label: 'Monday' }, { label: 'Wednesday' }, { label: 'Saturday' }]);
    }
    if (S.step === 3) {
      var day = 'Monday';
      if (has(t, 'tomorrow', 'today')) day = 'Tomorrow';
      else {
        var dm = t.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/);
        if (dm) day = cap(dm[0]);
      }
      S.booking.day = day; S.step = 4;
      return say('<b>' + escapeHtml(day) + '</b> it is. <b>Morning or afternoon</b> &mdash; what time suits you?',
        [{ label: '9:00 AM' }, { label: '11:00 AM' }, { label: '2:00 PM' }, { label: '4:00 PM' }, { label: '5:30 PM' }]);
    }
    if (S.step === 4) {
      var tm = t.match(/\d{1,2}(:\d{2})?\s*(am|pm)?/);
      if (!tm) {
        return say('What <b>time</b> should I hold for you? <i>(e.g. 2:00 PM)</i>',
          [{ label: '9:00 AM' }, { label: '2:00 PM' }, { label: '4:00 PM' }]);
      }
      var time = text.trim();
      if (!/am|pm/i.test(time)) time += ' PM';
      var ref = makeRef();
      S.booking.ref = ref;
      var line = '<b>&#9989; You\'re booked!</b><br><br><b>' + escapeHtml(S.booking.reason) + '</b> &middot; ' +
        escapeHtml(S.booking.day) + ' at <b>' + escapeHtml(time) + '</b><br>Patient: <b>' + escapeHtml(S.booking.name) + '</b><br>' +
        'Reference: <span class="ref">' + ref + '</span><br><br>';
      if (S.booking.phone) line += 'We\'ll text your reminder. ';
      line += 'Arrive 10 minutes early &mdash; we\'ll have everything ready. Anything else I can help with?';
      S.mode = 'idle'; S.step = 0;
      return say(line, [{ label: '&#129463; Our services' }, { label: '&#128336; Hours & location' }]);
    }
  }

  function startAfterHours() {
    S.mode = 'afterhours'; S.step = 0; S.ah = {};
    return sayMany([
      {
        notice: true,
        html: '&#127769; <b>It\'s 11:42 PM</b> &mdash; we\'re closed right now, but I\'m ' + escapeHtml(BIZ.host) +
          ', ' + escapeHtml(BIZ.name) + '\'s care coordinator, and I\'m still here. <b>No patient waits till morning.</b>'
      },
      { html: 'What\'s going on? Leave your <b>name</b> and I\'ll make sure the morning team calls you first thing &mdash; <b>toothaches jump the queue</b>.' }
    ]);
  }

  function afterHoursStep(text) {
    var t = text.trim();
    if (S.step === 0) {
      if (t.length < 2 || t.length > 40 || /\d/.test(t)) {
        return say('What <b>name</b> should I save this under?');
      }
      S.ah.name = t; S.step = 1;
      return say('Thanks, ' + escapeHtml(cap(t.split(' ')[0])) + '! And the best <b>number</b> for the morning team to reach you?');
    }
    if (S.step === 1) {
      var digits = t.replace(/\D/g, '');
      if (digits.length < 7) {
        return say('Hmm, that doesn\'t look like a complete number &mdash; mind double-checking it? <i>(digits only is fine)</i>');
      }
      S.ah.phone = t; S.step = 2;
      return say('Got it. Briefly &mdash; <b>what\'s bothering you?</b> <i>(e.g. "toothache", "broken tooth")</i>',
        [{ label: 'Toothache', value: 'Toothache' }, { label: 'Broken tooth', value: 'Broken tooth' }, { label: 'Skip', value: 'skip' }]);
    }
    if (S.step === 2) {
      S.ah.concern = (t === 'skip') ? 'General inquiry' : t;
      saveLead({ name: S.ah.name, phone: S.ah.phone, concern: S.ah.concern, topic: S.ah.concern, details: '—', source: 'after-hours 11:42 PM' });
      S.mode = 'idle'; S.step = 0;
      return sayMany([
        { html: '<b>&#9989; Saved!</b> The morning team will call you <b>first thing</b> &mdash; urgent cases get the day\'s first slots. No need to suffer till 8 AM wondering if anyone saw your message.' },
        {
          dash: [
            ['New lead', S.ah.name],
            ['Phone', S.ah.phone],
            ['Need', S.ah.concern],
            ['Captured', '11:42 PM (after hours)']
          ]
        },
        {
          html: 'That\'s the whole point &mdash; <b>every late-night toothache becomes a morning appointment</b>, not a patient lost to the practice down the street. Anything else tonight?',
          chips: defaultChips()
        }
      ]);
    }
  }

  function startReview() {
    S.mode = 'review'; S.step = 0;
    return say('We\'d love to hear it &mdash; <b>how was your visit?</b> Tap the stars:').then(function () {
      showStars();
    });
  }

  function pickStars(n) {
    chipsBox.innerHTML = '';
    addUser('\u2B50'.repeat(n));
    if (n === 5) {
      S.mode = 'idle';
      say('That made our whole team smile! &#128525;<br><br>Would you <b>share that on Google</b>? It genuinely keeps a local practice like ours thriving.',
        [{ label: 'Not now', value: 'not now' }]).then(function () {
          var row = document.querySelector('#maya-msgs .mrow.bot:last-child .bubble');
          if (row) {
            var a = document.createElement('a');
            a.className = 'gbtn'; a.href = 'https://www.google.com/maps'; a.target = '_blank'; a.rel = 'noopener';
            a.textContent = '\u2B50 Leave a Google review';
            row.appendChild(document.createElement('br'));
            row.appendChild(a); scrollDown();
          }
        });
    } else {
      S.mode = 'review'; S.step = 1;
      say('Thank you for being honest &mdash; that\'s how we get better. <b>What could we do better</b> next time?');
    }
  }

  function reviewStep(text) {
    S.mode = 'idle'; S.step = 0;
    saveLead({ name: '(review feedback)', phone: '\u2014', topic: 'Private feedback', details: text.trim(), source: 'review routing' });
    return say('<b>Noted &mdash; truly.</b> Our practice manager will personally follow up on this.<br><br>' +
      'We\'d love a second chance to earn those last stars. Can I book you in for a follow-up visit?',
      [{ label: '&#128197; Book an appointment' }, { label: 'No thanks', value: 'no thanks' }]);
  }

  /* ---------- main router ---------- */
  function route(text) {
    var t = text.toLowerCase().trim();

    if (S.mode === 'booking') return bookingStep(text);
    if (S.mode === 'afterhours') return afterHoursStep(text);
    if (S.mode === 'review' && S.step === 1) return reviewStep(text);

    if (has(t, 'book', 'appoint', 'schedul', 'visit for', 'slot')) return startBooking();
    if (has(t, 'after hour', 'after-hour', 'closed', 'late night', 'midnight', '11:42')) return startAfterHours();
    if (has(t, 'review', 'rate', 'stars', 'feedback')) return startReview();
    if (has(t, 'toothache', 'tooth pain', 'tooth hurt', 'emergency', 'urgent', 'broken tooth', 'cracked', 'chipped tooth', 'swollen', 'bleeding')) {
      return say('Tooth pain is the worst &mdash; let\'s not wait on it. &#129463;<br><br>We hold <b>same-day emergency slots</b> every weekday, and urgent cases jump the queue. Want me to <b>book you in</b> right now?',
        [{ label: '&#128197; Book an appointment' }, { label: '&#128336; Hours & location' }]);
    }
    if (has(t, 'insurance', 'insur', 'ppo', 'delta', 'cigna', 'aetna', 'metlife', 'guardian', 'coverage', 'covered', 'benefits', 'no insurance')) return say(insuranceHtml(), [{ label: '&#128197; Book an appointment' }]);
    /* location branch runs before service branches (house standard) */
    if (has(t, 'where', 'address', 'location', 'direction', 'park', 'find you')) {
      return say('Find us at <b>' + escapeHtml(BIZ.address) + '</b> &mdash; easy in-and-out in ' + escapeHtml(BIZ.city) + ', free parking right outside. &#128205;<br><br>Call us anytime: <b>' + escapeHtml(BIZ.phone) + '</b>',
        [{ label: '&#128197; Book an appointment' }]);
    }
    if (has(t, 'hour', 'open', 'close', 'when do you', 'what time')) return say(hoursHtml(), [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'whiten')) return say('Our in-office whitening lifts <b>up to 8 shades in one visit</b> &mdash; from <b>$299</b>, enamel-safe and sensitivity-managed. &#10024;<br><br>Want me to book your whitening session?', [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'invisalign', 'brace', 'aligner', 'straighten', 'orthodont')) return say('Yes &mdash; <b>Invisalign&reg; clear aligners</b> with a <b>free consultation</b> and 3D smile preview, so you see the result before you commit. Most cases finish in 6&ndash;12 months. Want the free consult?', [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'clean', 'hygiene', 'scaling', 'polish')) return say('Our gentle cleaning + full exam is <b>$99 for new patients</b> &mdash; polish, gum check, and a complete treatment plan with zero pressure. Most visits take under an hour. &#129463;', [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'filling', 'cavity', 'crown', 'root canal', 'implant', 'extraction', 'wisdom')) return say('We\'ve got you covered &mdash; <b>tooth-colored fillings from $150</b>, crowns from $899, implants with a free 3D scan. Every treatment starts with a clear, written quote &mdash; <b>no surprise bills</b>. Want me to book an exam?', [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'kid', 'child', 'children', 'pediatric', 'toddler', 'family')) return say('We love little smiles! &#128118; <b>Gentle first visits</b> for kids, no scary drills talk, and parents stay chairside the whole time. Family block appointments available too.', [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'nervous', 'anxious', 'scared', 'afraid', 'sedation', 'gentle', 'pain-free', 'painful', 'does it hurt')) return say('You\'re not alone &mdash; and you\'re safe here. &#129293; <b>Gentle, judgment-free care</b> with sedation options for anxious patients. Most of our nervous patients tell us afterwards: <i>"that was it?"</i>', [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'service', 'treatment', 'offer', 'do you do', 'price list', 'menu')) return say(servicesHtml(), [{ label: '&#128197; Book an appointment' }]);
    if (has(t, 'price', 'cost', 'how much', 'expensive', 'cheap', '$$', 'fee')) return say('Honest pricing, in writing: cleaning &amp; exam <b>$99</b> (new patients), whitening from <b>$299</b>, fillings from <b>$150</b>, Invisalign consults <b>free</b>. Insurance verified before your visit &mdash; <b>no surprise bills</b>. &#129463;', [{ label: '&#129463; Our services' }]);
    if (has(t, 'human', 'person', 'real person', 'call you', 'phone number', 'speak to', 'dentist')) return say('Of course &mdash; call us at <b>' + escapeHtml(BIZ.phone) + '</b> during open hours and a real human picks up. But honestly? I can handle <b>appointments, insurance questions, and pricing</b> right here, even at 2 AM. &#128521;', defaultChips());
    if (has(t, 'thank', 'thanks', 'thx', 'great', 'awesome', 'perfect')) return say('Anytime! That\'s what I\'m here for. &#129463;', defaultChips());
    if (has(t, 'bye', 'goodbye', 'see you', 'later')) { S.mode = 'idle'; return say('Take care of that smile &mdash; see you soon at ' + escapeHtml(BIZ.name) + '! &#129463;'); }
    if (/\b(hi+|hello|hey+|hola|yo)\b/.test(t) || has(t, 'good morning', 'good evening')) return say('Hey hey! &#128075; What can I do for you &mdash; <b>services</b>, <b>insurance</b>, or shall I <b>book your appointment</b>?', defaultChips());
    if (has(t, 'no thanks', 'not now', 'nope', "i'm good", 'im good')) { S.mode = 'idle'; return say('No worries at all! I\'m here whenever you need me. &#129463;', defaultChips()); }

    /* graceful fallback — never dead-ends */
    S.lastTopic = text;
    return say('Great question &mdash; let me have the team confirm that for you. &#128172;<br><br>Meanwhile, can I help with an <b>appointment</b>, our <b>services</b>, or <b>insurance</b>?',
      [{ label: '&#128197; Book an appointment' }, { label: '&#129463; Our services' }, { label: '&#128336; Hours & location' }]);
  }

  function userSays(text, silent) {
    if (!text || !text.trim()) return Promise.resolve();
    text = text.trim();
    setChips([]);
    if (!silent) addUser(text);
    return route(text);
  }

  /* ---------- open / close ---------- */
  function openPanel(silent) {
    opened = true;
    panel.classList.add('open');
    bubble.classList.add('hidden');
    unread.classList.add('hidden');
    if (!greeted && !silent) greet();
  }
  function closePanel() {
    opened = false;
    panel.classList.remove('open');
    bubble.classList.remove('hidden');
  }

  function init() {
    panel = $('maya-panel'); msgs = $('maya-msgs'); chipsBox = $('maya-chips');
    input = $('maya-input'); bubble = $('maya-bubble'); unread = $('maya-unread'); closeBtn = $('maya-close');
    personalize();
    deepPersonalize();

    /* bubble click greets normally; hero CTA passes silent=true to skip straight to booking */
    bubble.addEventListener('click', function () { openPanel(); });
    closeBtn.addEventListener('click', closePanel);
    $('maya-send').addEventListener('click', function () { userSays(input.value); input.value = ''; input.focus(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { userSays(input.value); input.value = ''; }
    });

    /* hero CTA opens widget straight into booking */
    document.querySelectorAll('[data-action="book"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        openPanel(true); /* silent: goes straight to booking, no greeting */
        setTimeout(function () { if (S.mode === 'idle') startBooking(); }, FAST ? 50 : 600);
      });
    });

    /* proactive nudge — once, ~8s in */
    setTimeout(function () {
      if (!opened && !autoOpened) {
        autoOpened = true;
        unread.classList.remove('hidden');
        bubble.classList.add('hidden');
        panel.classList.add('open');
        opened = true;
        if (!greeted) greet();
      }
    }, FAST ? 600 : 8000);

    /* captured-leads inbox toggle (prospect-visible "Saved to your dashboard") */
    var idom = inboxDom();
    if (idom) {
      renderInbox();
      idom.toggle.addEventListener('click', function () {
        var isHidden = idom.panel.hasAttribute('hidden');
        if (isHidden) { idom.panel.removeAttribute('hidden'); renderInbox(); }
        else { idom.panel.setAttribute('hidden', ''); }
        idom.toggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      });
    }

    /* test hooks */
    window.__maya = {
      BIZ: BIZ, S: S,
      send: function (t) { openPanel(); return userSays(t); },
      open: openPanel, close: closePanel,
      pickStars: pickStars,
      saveLead: saveLead, renderInbox: renderInbox,
      getLeads: function () { return leads; },
      clearLeads: function () { leads = []; try { localStorage.removeItem(LEAD_KEY); } catch (e) {} renderInbox(); }
    };
    window.__getLeads = function () { return leads; };
    window.__clearLeads = function () { leads = []; try { localStorage.removeItem(LEAD_KEY); } catch (e) {} renderInbox(); };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

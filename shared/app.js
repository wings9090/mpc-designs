/* منطق مشترك: يرسم الأقسام داخل [data-mpc] ويفتح النوافذ عبر [data-open].
   النماذج في هذا النموذج الأولي تُحفظ في المتصفح فقط (localStorage) ولا تُرسل إلى أي خادم. */
(function () {
  const D = window.MPC;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Number(n).toLocaleString('ar-IQ');
  const fmtDate = d => new Date(d).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });
  const newsUrl = sid => D.org.oldSite + 'index.php?name=News&file=article&sid=' + sid;
  const store = {
    get: k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } },
    add: (k, v) => { try { const a = store.get(k); a.push(v); localStorage.setItem(k, JSON.stringify(a)); } catch (e) {} }
  };
  const sampleBadge = '<div class="m-sample"><i class="ph ph-warning"></i> بيانات توضيحية، تُستبدل بالبيانات الرسمية</div>';

  /* ---------- الأقسام ---------- */
  const R = {
    services(el) {
      el.innerHTML = '<div class="m-grid">' + D.services.map(s =>
        `<article class="m-card" data-id="${s.id}"><i class="ph ${s.icon}"></i>${s.tag ? `<span class="m-tag">${s.tag}</span>` : ''}<h3>${s.title}</h3><p>${s.text}</p></article>`).join('') + '</div>';
    },
    news(el) {
      const n = +el.dataset.limit || D.news.length;
      el.innerHTML = '<div class="m-list">' + D.news.slice(0, n).map(x =>
        `<a class="m-news" href="${newsUrl(x.sid)}" target="_blank" rel="noopener">${x.img ? `<img src="${x.img}" alt="" loading="lazy" onerror="this.remove()">` : ''}<time datetime="${x.date}">${fmtDate(x.date)}</time><h3>${x.title}</h3></a>`).join('') + '</div>';
    },
    jobs(el) {
      el.innerHTML = '<div class="m-grid">' + D.jobs.map(j =>
        `<article class="m-card"><h3>${j.place}</h3><p>${j.roles}</p><p class="m-muted"><i class="ph ph-map-pin"></i> التقديم: ${j.apply}</p></article>`).join('') + `</div><p class="m-muted" style="margin-top:1rem">${D.jobsNote}</p>`;
    },
    committees(el) {
      el.innerHTML = `<div class="m-row" style="margin-bottom:1rem"><button class="m-btn" data-locate><i class="ph ph-crosshair"></i> حدّد موقعي</button><a class="m-btn ghost" href="${D.org.urPortal}" target="_blank" rel="noopener"><i class="ph ph-arrow-square-out"></i> الحجز عبر بوابة أور</a></div><p class="m-muted" data-geo-msg aria-live="polite"></p><div class="m-list" data-committee-list></div><p class="m-muted" style="margin-top:1rem">${D.committeesNote}</p>`;
      drawCommittees(el, null);
      $('[data-locate]', el).addEventListener('click', () => locate(el));
    },
    clinics(el) {
      const total = Object.values(D.clinics).reduce((a, b) => a + b.length, 0);
      el.innerHTML = `<div class="m-field"><label for="cq-${uid(el)}">ابحث عن عيادة</label><input class="m-input" id="cq-${uid(el)}" type="search" placeholder="مثال: الكرادة"></div><p class="m-muted" data-count style="margin:.6rem 0"></p><div data-out></div>`;
      const draw = q => {
        let shown = 0;
        const html = Object.entries(D.clinics).map(([g, list]) => {
          const f = list.filter(n => n.includes(q));
          shown += f.length;
          return f.length ? `<h3 class="m-group-title">${g}</h3><div class="m-clinics">${f.map(n => `<span>${n}</span>`).join('')}</div>` : '';
        }).join('');
        $('[data-out]', el).innerHTML = html || '<div class="m-empty">لا توجد عيادة بهذا الاسم. جرّب كلمة أقصر.</div>';
        $('[data-count]', el).textContent = `${num(shown)} من ${num(total)} عيادة`;
      };
      draw('');
      $('input', el).addEventListener('input', e => draw(e.target.value.trim()));
    },
    prices(el) {
      const g = D.prices.groups;
      el.innerHTML = (D.prices.sample ? sampleBadge : '') + `<div class="m-chips">${g.map((x, i) => `<button class="m-chip" aria-pressed="${i === 0}" data-i="${i}">${x.name}</button>`).join('')}</div><table class="m-table"><tbody></tbody></table>`;
      const draw = i => {
        $('tbody', el).innerHTML = g[i].rows.map(r => `<tr><td>${r[0]}</td><td>${num(r[1])} د.ع</td></tr>`).join('');
        $$('.m-chip', el).forEach(b => b.setAttribute('aria-pressed', b.dataset.i == i));
      };
      draw(0);
      el.addEventListener('click', e => { const b = e.target.closest('.m-chip'); if (b) draw(+b.dataset.i); });
    },
    meds(el) {
      const cls = { 'متوفر': 'ok', 'كمية محدودة': 'low', 'غير متوفر': 'no' };
      el.innerHTML = (D.meds.sample ? sampleBadge : '') + `<div class="m-field"><label for="mq-${uid(el)}">ابحث باسم الدواء أو المرض</label><input class="m-input" id="mq-${uid(el)}" type="search" placeholder="مثال: ضغط أو Metformin"></div><table class="m-table" style="margin-top:.8rem"><tbody></tbody></table>`;
      const draw = q => {
        const f = D.meds.items.filter(m => (m.name + m.en + m.group).toLowerCase().includes(q.toLowerCase()));
        $('tbody', el).innerHTML = f.length ? f.map(m => `<tr><td><b>${m.name}</b><br><span class="m-muted"><span dir="ltr">${m.en}</span> / ${m.group}</span></td><td><span class="m-status ${cls[m.status]}">${m.status}</span></td></tr>`).join('')
          : '<tr><td colspan="2"><div class="m-empty">لا يوجد دواء مطابق.</div></td></tr>';
      };
      draw('');
      $('input', el).addEventListener('input', e => draw(e.target.value.trim()));
    },
    steps(el) {
      el.innerHTML = '<div class="m-steps">' + D.steps.map(s => `<div class="m-step"><i class="ph ${s.icon}"></i><h3>${s.title}</h3><p class="m-muted">${s.text}</p></div>`).join('') + '</div>';
    },
    faq(el) {
      el.innerHTML = D.faq.map(f => `<details class="m-faq"><summary>${f.q}</summary><p>${f.a}</p></details>`).join('');
    },
    extras(el) {
      el.innerHTML = '<div class="m-grid">' + D.extras.map(x => {
        const inner = `<i class="ph ${x.icon}"></i><h3>${x.title}</h3><p>${x.text}</p>`;
        return x.open ? `<button class="m-card" data-open="${x.open}" style="text-align:start;cursor:pointer">${inner}</button>`
          : `<a class="m-card" href="${x.href}" ${x.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} style="text-decoration:none">${inner}</a>`;
      }).join('') + '</div>';
    },
    actions(el) {
      el.innerHTML = `<button class="m-btn" data-open="complaint"><i class="ph ph-megaphone"></i> تقديم شكوى</button><button class="m-btn" data-open="meeting"><i class="ph ph-handshake"></i> مقابلة المدير العام</button><button class="m-btn" data-open="nearest"><i class="ph ph-steering-wheel"></i> أقرب لجنة فحص سياقة</button>`;
    }
  };
  let _u = 0; const uid = el => el.dataset.uid || (el.dataset.uid = ++_u);

  /* ---------- أقرب لجنة ---------- */
  const km = (a, b, c, d) => { const r = x => x * Math.PI / 180, h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  function drawCommittees(root, pos) {
    let list = D.committees.map(c => ({ ...c, d: pos ? km(pos.lat, pos.lng, c.lat, c.lng) : null }));
    if (pos) list.sort((a, b) => a.d - b.d);
    $('[data-committee-list]', root).innerHTML = list.map((c, i) =>
      `<div class="m-committee ${pos && i === 0 ? 'nearest' : ''}"><b>${c.name}</b><span class="dist">${pos ? 'نحو ' + num(Math.round(c.d)) + ' كم' : ''}</span><span class="m-muted">${c.city} / ${c.area} / دوام ${c.shift}</span><a class="m-muted" href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}" target="_blank" rel="noopener">الاتجاهات <i class="ph ph-arrow-up-left"></i></a></div>`).join('');
  }
  function locate(root) {
    const msg = $('[data-geo-msg]', root);
    if (!navigator.geolocation) { msg.textContent = 'المتصفح لا يدعم تحديد الموقع. اختر اللجنة من القائمة.'; return; }
    msg.textContent = 'جارٍ تحديد موقعك...';
    navigator.geolocation.getCurrentPosition(
      p => { drawCommittees(root, { lat: p.coords.latitude, lng: p.coords.longitude }); msg.textContent = 'اللجان مرتبة من الأقرب إلى الأبعد عن موقعك.'; },
      () => { msg.textContent = 'تعذر تحديد الموقع. اسمح للمتصفح بالوصول إلى موقعك أو اختر اللجنة من القائمة.'; },
      { timeout: 10000 });
  }

  /* ---------- النوافذ ---------- */
  const field = (id, label, input, help) => `<div class="m-field"><label for="${id}">${label}</label>${input}${help ? `<small>${help}</small>` : ''}<span class="err" data-err="${id}"></span></div>`;
  const inp = (id, type, extra = '') => `<input class="m-input" id="${id}" name="${id}" type="${type}" ${extra}>`;
  const places = () => ['مقر الدائرة', ...Object.keys(D.clinics).map(k => 'عيادات ' + k), 'لجان فحص السياقة', 'الأجنحة الخاصة', 'المختبر الاستشاري'].map(p => `<option>${p}</option>`).join('');
  const FORMS = {
    complaint: {
      title: 'تقديم شكوى', key: 'mpc_complaints', prefix: 'SH',
      html: () => field('c_name', 'الاسم الثلاثي', inp('c_name', 'text', 'required autocomplete="name"'))
        + `<div class="m-two">${field('c_phone', 'رقم الهاتف', inp('c_phone', 'tel', 'required inputmode="tel" dir="ltr" placeholder="07XXXXXXXXX"'))}${field('c_place', 'الجهة المعنية', `<select class="m-input" id="c_place" name="c_place">${places()}</select>`)}</div>`
        + field('c_text', 'تفاصيل الشكوى', '<textarea class="m-input" id="c_text" name="c_text" rows="4" required></textarea>', 'اذكر اسم العيادة والتاريخ إن أمكن.'),
      done: 'استُلمت شكواك. احتفظ بالرقم المرجعي لمتابعتها.'
    },
    meeting: {
      title: 'طلب مقابلة المدير العام', key: 'mpc_meetings', prefix: 'MQ',
      html: () => field('m_name', 'الاسم الثلاثي', inp('m_name', 'text', 'required autocomplete="name"'))
        + `<div class="m-two">${field('m_phone', 'رقم الهاتف', inp('m_phone', 'tel', 'required inputmode="tel" dir="ltr" placeholder="07XXXXXXXXX"'))}${field('m_type', 'صفة مقدم الطلب', '<select class="m-input" id="m_type" name="m_type"><option>مواطن</option><option>موظف في الدائرة</option><option>جهة رسمية</option></select>')}</div>`
        + field('m_date', 'التاريخ المفضل', inp('m_date', 'date'), 'يحدد مكتب المدير العام الموعد النهائي ويبلغك به.')
        + field('m_text', 'موضوع المقابلة', '<textarea class="m-input" id="m_text" name="m_text" rows="3" required></textarea>'),
      done: 'سُجل طلب المقابلة. سيتصل بك مكتب المدير العام لتأكيد الموعد.'
    }
  };
  const dlg = document.createElement('dialog');
  dlg.className = 'm-dialog';
  dlg.innerHTML = '<header><h2></h2><button class="x" aria-label="إغلاق"><i class="ph ph-x"></i></button></header><div class="body"></div>';
  const openDlg = (title, html) => { $('h2', dlg).textContent = title; $('.body', dlg).innerHTML = html; if (!dlg.open) dlg.showModal(); };
  const doneHtml = (text, ref) => `<div class="m-done"><i class="ph ph-check-circle"></i><p>${text}</p>${ref ? `<div class="m-ref">${ref}</div>` : ''}<p class="m-muted">نموذج أولي: الطلب محفوظ في هذا المتصفح فقط ولم يُرسل إلى الدائرة.</p><button class="m-btn" data-close>تم</button></div>`;

  function openForm(kind) {
    const f = FORMS[kind];
    openDlg(f.title, `<form novalidate>${f.html()}<button class="m-btn" type="submit">إرسال</button></form>`);
    $('form', dlg).addEventListener('submit', e => {
      e.preventDefault();
      let ok = true;
      $$('[data-err]', dlg).forEach(s => s.textContent = '');
      $$('input,textarea', e.target).forEach(i => {
        let m = '';
        if (i.required && !i.value.trim()) m = 'هذا الحقل مطلوب.';
        else if (i.type === 'tel' && !/^07\d{9}$/.test(i.value.trim())) m = 'اكتب رقماً عراقياً من 11 رقماً يبدأ بـ 07.';
        if (m) { ok = false; $(`[data-err="${i.id}"]`, dlg).textContent = m; }
      });
      if (!ok) { const bad = $$('[data-err]', dlg).find(s => s.textContent); $('#' + bad.dataset.err, dlg).focus(); return; }
      const ref = f.prefix + '-' + Date.now().toString().slice(-6);
      store.add(f.key, { ref, at: new Date().toISOString(), ...Object.fromEntries(new FormData(e.target)) });
      openDlg(f.title, doneHtml(f.done, ref));
    });
  }
  const OPEN = {
    complaint: () => openForm('complaint'),
    meeting: () => openForm('meeting'),
    nearest() {
      openDlg('أقرب لجنة فحص سياقة', '<div data-mpc="committees"></div>');
      const el = $('[data-mpc]', dlg); R.committees(el); locate(el);
    },
    track() {
      openDlg('متابعة الشكوى', `<form novalidate>${field('t_ref', 'الرقم المرجعي', inp('t_ref', 'text', 'dir="ltr" placeholder="SH-123456"'))}<button class="m-btn" type="submit">بحث</button></form><div data-result aria-live="polite"></div>`);
      $('form', dlg).addEventListener('submit', e => {
        e.preventDefault();
        const v = $('#t_ref', dlg).value.trim().toUpperCase();
        const hit = store.get('mpc_complaints').find(c => c.ref === v);
        const out = $('[data-result]', dlg);
        out.className = 'm-empty';
        out.textContent = !v ? 'اكتب الرقم المرجعي أولاً.' : hit ? `الشكوى ${hit.ref} مسجلة بتاريخ ${fmtDate(hit.at)} وحالتها: قيد المراجعة.` : 'لا توجد شكوى بهذا الرقم على هذا الجهاز.';
      });
    },
    survey() {
      openDlg('قيّم زيارتك', `<form><div class="m-field"><label>كيف كانت الخدمة؟</label><div class="m-stars">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-star="${i}" aria-label="${i} من 5"><i class="ph-fill ph-star"></i></button>`).join('')}</div></div>${field('s_text', 'ملاحظاتك (اختياري)', '<textarea class="m-input" id="s_text" name="s_text" rows="3"></textarea>')}<button class="m-btn" type="submit">إرسال التقييم</button></form>`);
      let stars = 0;
      $('.m-stars', dlg).addEventListener('click', e => { const b = e.target.closest('[data-star]'); if (!b) return; stars = +b.dataset.star; $$('[data-star]', dlg).forEach(x => x.classList.toggle('on', +x.dataset.star <= stars)); });
      $('form', dlg).addEventListener('submit', e => { e.preventDefault(); store.add('mpc_survey', { stars, text: $('#s_text', dlg).value, at: new Date().toISOString() }); openDlg('قيّم زيارتك', doneHtml('شكراً لك. رأيك يساعدنا على تحسين الخدمة.')); });
    },
    sec(o) {
      openDlg(o.dataset.title || '', `<div data-mpc="${o.dataset.sec}"></div>`);
      const el = $('[data-mpc]', dlg); R[o.dataset.sec](el);
    },
    font() {
      const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs')) || 1;
      const next = cur >= 1.3 ? 1 : +(cur + 0.15).toFixed(2);
      document.documentElement.style.setProperty('--fs', next);
      try { localStorage.setItem('mpc_fs', next); } catch (e) {}
    }
  };

  /* ---------- التشغيل ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(dlg);
    try { const fs = localStorage.getItem('mpc_fs'); if (fs) document.documentElement.style.setProperty('--fs', fs); } catch (e) {}
    $$('[data-mpc]').forEach(el => R[el.dataset.mpc] && R[el.dataset.mpc](el));
    $$('[data-org]').forEach(el => el.textContent = D.org[el.dataset.org]);
    $$('[data-count-clinics]').forEach(el => el.textContent = num(Object.values(D.clinics).reduce((a, b) => a + b.length, 0)));
    document.addEventListener('click', e => {
      const o = e.target.closest('[data-open]');
      if (o && OPEN[o.dataset.open]) { e.preventDefault(); OPEN[o.dataset.open](o); return; }
      if (e.target.closest('.x,[data-close]') || e.target === dlg) dlg.close();
    });
    const note = document.createElement('p');
    note.className = 'proto-note';
    note.innerHTML = `نموذج تصميمي مقترح وليس الموقع الرسمي للدائرة. النماذج لا تُرسل إلى أي جهة. الموقع الرسمي: <a href="${D.org.oldSite}" dir="ltr">mpc.gov.iq</a> | <a href="../index.html">كل التصاميم</a>`;
    document.body.prepend(note);
  });
})();

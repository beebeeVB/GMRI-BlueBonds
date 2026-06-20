// ---------- Tidewater SPA ----------
const API = '';
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
let TOKEN = localStorage.getItem('tw_token') || null;
let USER = JSON.parse(localStorage.getItem('tw_user') || 'null');

const money = (n) => '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const bps = (b) => (b / 100).toFixed(2) + '%';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function setSession(token, user) {
  TOKEN = token; USER = user;
  localStorage.setItem('tw_token', token);
  localStorage.setItem('tw_user', JSON.stringify(user));
  renderHeader();
}
function clearSession() {
  TOKEN = null; USER = null;
  localStorage.removeItem('tw_token'); localStorage.removeItem('tw_user');
  renderHeader(); go('home');
}

function renderHeader() {
  const m = $('#usermeta');
  if (USER) {
    m.innerHTML = `<span class="who">${esc(USER.full_name)}</span>
      <button class="btn ghost sm" id="logout">Sign out</button>`;
    $('#logout').onclick = clearSession;
  } else {
    m.innerHTML = `<button class="btn ghost sm" data-nav="login">Sign in</button>
      <button class="btn sm" data-nav="register">Register</button>`;
  }
  document.querySelectorAll('[data-auth]').forEach((el) => el.classList.toggle('hide', !USER));
}

// ---------- router ----------
function go(view, arg) {
  window.scrollTo(0, 0);
  if (view === 'home') return renderHome();
  if (view === 'marketplace') return renderMarketplace();
  if (view === 'register') return renderAuth('register');
  if (view === 'login') return renderAuth('login');
  if (view === 'portfolio') return USER ? renderPortfolio() : renderAuth('login');
  if (view === 'bond') return renderBond(arg);
}
document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) { e.preventDefault(); go(nav.dataset.nav); }
});

// ---------- views ----------
function renderHome() {
  app.innerHTML = `
  <section class="hero">
    <div class="colgrid"></div>
    <div class="wrap">
      <span class="tag"><span class="ping"><i></i><i></i></span>Outcome-linked blue bonds · New England</span>
      <h1>Coupons that pay only when the coast holds<span class="s">Verified by the water itself.</span></h1>
      <p class="sub">Tidewater bonds are wired to marine sensors in the field. When a restored marsh, reef, or shoreline hits its target, the verified outcome mints a sellable credit — and that revenue funds your coupon. The proof and the payment come from the same reading.</p>
      <div class="cta">
        <button class="btn lg" data-nav="marketplace">Browse bonds →</button>
        <button class="btn ghost lg" data-nav="register">Create an account</button>
      </div>

      <div class="loop">
        <div class="loopstep"><div class="n">01</div><h4>Marine tech reads</h4><p>Tide gauges, satellites, drones, eDNA & carbon-flux sensors measure the site continuously.</p><span class="arr">→</span></div>
        <div class="loopstep"><div class="n">02</div><h4>Covenant checks</h4><p>Each reading is tested against the bond's thresholds — acreage, survival, flood-days.</p><span class="arr">→</span></div>
        <div class="loopstep"><div class="n">03</div><h4>Outcome mints credit</h4><p>A met target mints blue-carbon, water-quality, or resilience credits.</p><span class="arr">→</span></div>
        <div class="loopstep"><div class="n">04</div><h4>Revenue → SPV</h4><p>Credit sales flow to the ring-fenced vehicle that holds investor capital.</p><span class="arr">→</span></div>
        <div class="loopstep"><div class="n">05</div><h4>Coupon releases</h4><p>The outcome-linked coupon pays out. Miss a target and that tranche is held, not lost.</p></div>
      </div>
    </div>
  </section>

  <section class="blk"><div class="wrap">
    <div class="stats" id="homestats"></div>
  </div></section>`;

  // pull live aggregate stats from the marketplace
  api('/api/bonds').then(({ bonds }) => {
    const raised = bonds.reduce((a, b) => a + b.raised, 0);
    const projects = new Set(bonds.map((b) => b.project_slug)).size;
    const met = bonds.reduce((a, b) => a + b.metrics_met, 0);
    const total = bonds.reduce((a, b) => a + b.metrics_total, 0);
    $('#homestats').innerHTML = `
      <div class="stat"><div class="v">${money(raised)}</div><div class="l">capital committed</div></div>
      <div class="stat"><div class="v">${projects}</div><div class="l">coastal projects</div></div>
      <div class="stat"><div class="v">${met}/${total}</div><div class="l">covenants currently met</div></div>
      <div class="stat"><div class="v">100%</div><div class="l">sensor-verified coupons</div></div>`;
  }).catch(() => {});
}

function renderMarketplace() {
  app.innerHTML = `<section class="blk"><div class="wrap">
    <div class="seckicker"><span class="no">→</span><span class="eyebrow">Open series</span></div>
    <h2>Put capital on the coastline.</h2>
    <p class="lede">Every bond is tied to a real project and a live verification feed. Yields show the guaranteed base plus the outcome-linked portion.</p>
    <div class="grid c3" id="bondgrid" style="margin-top:34px"></div>
  </div></section>`;

  api('/api/bonds').then(({ bonds }) => {
    $('#bondgrid').innerHTML = bonds.map((b) => {
      const allMet = b.metrics_met === b.metrics_total;
      return `<div class="bondcard" data-bond="${b.id}">
        <span class="tierpill">${esc(b.tier)}</span>
        <div class="series">${esc(b.series)}</div>
        <h3>${esc(b.project_name)}</h3>
        <div class="loc">${esc(b.town)}, ${esc(b.state)} · ${esc(b.type.replace('_', ' '))}</div>
        <div class="yld"><b>${bps(b.total_coupon_bps)}</b><span>${bps(b.base_coupon_bps)} base + ${bps(b.outcome_coupon_bps)} outcome</span></div>
        <div class="progress"><i style="width:${b.pct_funded}%"></i></div>
        <div class="pmeta"><span>${b.pct_funded}% funded</span><span>${money(b.raised)} / ${money(b.target_raise)}</span></div>
        <div class="vbadge ${allMet ? 'ok' : 'hold'}">${allMet ? '✓' : '⊘'} ${b.metrics_met}/${b.metrics_total} covenants met</div>
      </div>`;
    }).join('');
    document.querySelectorAll('[data-bond]').forEach((el) =>
      el.onclick = () => go('bond', el.dataset.bond));
  });
}

function renderBond(id) {
  app.innerHTML = `<section class="blk"><div class="wrap"><div id="bondbody">Loading…</div></div></section>`;
  api('/api/bonds/' + id).then((d) => {
    const { bond, sensors, verification, coupons, revenue_total } = d;
    const last = coupons[0];
    const couponLine = last
      ? `${money(last.outcome_paid)} released · ${money(last.outcome_held)} held`
      : 'awaiting first settlement';

    const vrows = verification.map((m) => {
      const cls = m.status === 'met' ? 'met' : m.status === 'held' ? 'held' : '';
      const ic = m.status === 'met' ? '✓' : m.status === 'held' ? '⊘' : '·';
      const comp = m.comparator === 'gte' ? '≥' : '≤';
      const credit = m.credit_type && m.credit_type !== 'none'
        ? `<span class="creditflag">mints ${m.credit_type.replace('_', ' ')}</span>` : '';
      return `<div class="vrow ${cls}">
        <div class="ic">${ic}</div>
        <div class="body"><div class="lab">${esc(m.label)}</div>
          <div class="sensor">sensor: ${esc(m.sensor_kind)}</div>${credit}</div>
        <div class="read ${cls}"><div class="now">${m.value ?? '—'}</div>
          <div style="color:var(--muted)">target ${comp} ${m.threshold}</div></div>
      </div>`;
    }).join('');

    const srows = sensors.map((s) =>
      `<div class="sensorrow"><div><div class="nm">${esc(s.kind)}</div>
        <div class="vend">${esc(s.vendor || 'field device')} · reads ${esc(s.unit)}</div></div>
        <div class="mono">${s.last_reading ?? '—'} ${esc(s.unit)}</div></div>`).join('');

    app.querySelector('#bondbody').innerHTML = `
      <button class="back" data-nav="marketplace">← all bonds</button>
      <div class="seckicker"><span class="no">${esc(bond.series)}</span><span class="eyebrow">${esc(bond.tier)} series</span></div>
      <h2>${esc(bond.project_name)}</h2>
      <p class="lede">${esc(bond.description || '')}</p>

      <div class="detailhead" style="margin-top:30px">
        <div class="panel">
          <h4>Live verification feed</h4>
          ${vrows}
          <div class="revbar" style="margin-top:20px;margin-left:-26px;margin-right:-26px;margin-bottom:-26px">
            <div class="lbl">Self-sustaining revenue minted from verified outcomes</div>
            <div class="big">${money(revenue_total)}</div>
            <div class="cov">This credit revenue services the coupon — coast performance pays investors.</div>
          </div>
        </div>

        <div>
          <div class="panel">
            <h4>Terms</h4>
            <div class="kv"><span class="k">Total coupon</span><span class="v">${bps(bond.total_coupon_bps)}</span></div>
            <div class="kv"><span class="k">Guaranteed base</span><span class="v">${bps(bond.base_coupon_bps)}</span></div>
            <div class="kv"><span class="k">Outcome-linked</span><span class="v">${bps(bond.outcome_coupon_bps)}</span></div>
            <div class="kv"><span class="k">Term</span><span class="v">${bond.term_years} yrs</span></div>
            <div class="kv"><span class="k">Minimum</span><span class="v">${money(bond.min_investment)}</span></div>
            <div class="kv"><span class="k">Funded</span><span class="v">${bond.pct_funded}%</span></div>
            <div class="kv"><span class="k">Last coupon</span><span class="v">${couponLine}</span></div>
            <button class="btn block" style="margin-top:20px" id="investBtn">Invest in this bond →</button>
          </div>
          <div class="panel" style="margin-top:24px">
            <h4>Marine tech on site</h4>
            ${srows}
          </div>
        </div>
      </div>`;

    $('#investBtn').onclick = () => USER ? openInvest(bond) : go('login');
  }).catch((e) => { app.querySelector('#bondbody').innerHTML = `<div class="msg err">${esc(e.message)}</div>`; });
}

function openInvest(bond) {
  const modal = $('#modal');
  $('#modalcard').innerHTML = `
    <h3>Invest in ${esc(bond.series)}</h3>
    <p style="margin-top:8px;color:var(--ink-soft);font-size:.9rem">Minimum ${money(bond.min_investment)}. Outcome coupon releases as covenants are verified.</p>
    <div class="field"><label>Amount (USD)</label><input id="amt" type="number" min="${bond.min_investment}" step="250" value="${bond.min_investment}"/></div>
    <div id="invmsg"></div>
    <button class="btn block" id="confirm" style="margin-top:18px">Commit capital</button>
    <button class="btn ghost block" id="cancel" style="margin-top:10px">Cancel</button>`;
  modal.classList.add('open');
  $('#cancel').onclick = () => modal.classList.remove('open');
  modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };
  $('#confirm').onclick = async () => {
    const amount = Number($('#amt').value);
    try {
      const r = await api('/api/invest', { method: 'POST', body: { bond_id: bond.id, amount } });
      $('#invmsg').innerHTML = `<div class="msg ok">${esc(r.message)}</div>`;
      setTimeout(() => { modal.classList.remove('open'); go('portfolio'); }, 900);
    } catch (e) {
      $('#invmsg').innerHTML = `<div class="msg err">${esc(e.message)}</div>`;
    }
  };
}

function renderAuth(mode) {
  const isReg = mode === 'register';
  app.innerHTML = `<section class="blk"><div class="wrap">
    <div class="formcard">
      <h2>${isReg ? 'Create your account' : 'Welcome back'}</h2>
      <p style="margin-top:8px;color:var(--ink-soft);font-size:.92rem">${isReg ? 'Register to invest in coastal resilience and track verified outcomes.' : 'Sign in to your portfolio.'}</p>
      <div id="authmsg"></div>
      ${isReg ? `<div class="field"><label>Full name</label><input id="name" placeholder="Jane Harbor"/></div>` : ''}
      <div class="field"><label>Email</label><input id="email" type="email" placeholder="you@coast.me"/></div>
      <div class="field"><label>Password</label><input id="pass" type="password" placeholder="At least 8 characters"/></div>
      ${isReg ? `<div class="field"><label>Home state (optional)</label>
        <select id="state"><option value="">—</option><option>ME</option><option>NH</option><option>MA</option><option>RI</option><option>CT</option><option>VT</option></select></div>
        <label class="checkrow"><input type="checkbox" id="acc"/><span>I am an accredited investor (enables senior tranches)</span></label>` : ''}
      <button class="btn block" id="submit" style="margin-top:20px">${isReg ? 'Create account' : 'Sign in'}</button>
      <p class="formnote">${isReg ? 'Already registered? ' : 'New here? '}<a id="swap">${isReg ? 'Sign in' : 'Create an account'}</a></p>
    </div>
  </div></section>`;

  $('#swap').onclick = () => go(isReg ? 'login' : 'register');
  $('#submit').onclick = async () => {
    const msg = $('#authmsg');
    try {
      let res;
      if (isReg) {
        res = await api('/api/auth/register', { method: 'POST', body: {
          full_name: $('#name').value.trim(),
          email: $('#email').value.trim(),
          password: $('#pass').value,
          state: $('#state').value || undefined,
          accredited: $('#acc').checked,
        }});
      } else {
        res = await api('/api/auth/login', { method: 'POST', body: {
          email: $('#email').value.trim(), password: $('#pass').value } });
      }
      setSession(res.token, res.user);
      go('marketplace');
    } catch (e) { msg.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
  };
}

function renderPortfolio() {
  app.innerHTML = `<section class="blk"><div class="wrap">
    <div class="seckicker"><span class="no">★</span><span class="eyebrow">Your positions</span></div>
    <h2>Portfolio</h2>
    <div id="pbody" style="margin-top:28px">Loading…</div>
  </div></section>`;

  api('/api/invest/portfolio').then(({ positions, summary }) => {
    const sum = `<div class="psum">
      <div class="cell"><div class="v">${money(summary.total_invested)}</div><div class="l">total invested</div></div>
      <div class="cell"><div class="v">${money(summary.projected_annual_income)}</div><div class="l">projected annual income</div></div>
      <div class="cell"><div class="v">${summary.blended_yield_pct}%</div><div class="l">blended live yield</div></div>
      <div class="cell"><div class="v">${summary.position_count}</div><div class="l">positions</div></div>
    </div>`;

    const rows = positions.length ? positions.map((p) =>
      `<div class="prow" style="cursor:pointer" data-bond="${p.bond_id}">
        <div><div class="nm">${esc(p.project_name)}</div><div class="sub">${esc(p.series)} · ${esc(p.town)}, ${esc(p.state)}</div></div>
        <div class="mono">${money(p.amount)}</div>
        <div class="mono">${money(p.base_annual + p.outcome_annual)}/yr</div>
        <div class="mono" style="color:${p.outcome_release_pct === 100 ? 'var(--kelp)' : 'var(--alert)'}">${p.outcome_release_pct}% outcome</div>
      </div>`).join('') : '';

    $('#pbody').innerHTML = sum + (positions.length ? `
      <div class="ptable">
        <div class="prow head"><div>Position</div><div>Principal</div><div>Income (live)</div><div>Outcome paid</div></div>
        ${rows}
      </div>
      <p class="mono" style="margin-top:14px;font-size:11px;color:var(--muted)">Outcome income reflects the latest sensor-verified settlement. Held tranches roll into the next remediation cycle.</p>`
      : `<div class="ptable"><div class="empty">No positions yet. <a data-nav="marketplace" style="color:var(--signal);cursor:pointer">Browse bonds →</a></div></div>`);

    document.querySelectorAll('#pbody [data-bond]').forEach((el) =>
      el.onclick = () => go('bond', el.dataset.bond));
  }).catch((e) => { $('#pbody').innerHTML = `<div class="msg err">${esc(e.message)}</div>`; });
}

// ---------- boot ----------
renderHeader();
go('home');

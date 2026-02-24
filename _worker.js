const D_SH = "sub.096000.xyz",
  D_SP = "https",
  D_SC = "https://raw.githubusercontent.com/org100/demo/main/nodnsleak.ini",
  D_NAME = "优选订阅生成器",
  D_FP = "chrome",
  D_DLS = 7,
  D_RMK = 1,
  D_ALPN = "h2";

/* ---------------- utils ---------------- */
function normFP(v) {
  const s = (v || "").toString().trim().toLowerCase();
  return ["chrome", "firefox", "safari", "edge", "ios", "android", "random"].includes(s) ? s : D_FP;
}

function parseList(x) {
  if (!x) return [];
  return x
    .replace(/[ \t|"'\r\n]+/g, ",")
    .replace(/,+/g, ",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 分块 b64，避免大订阅爆内存/超时
function b64(s) {
  const bytes = new TextEncoder().encode(s);
  const CHUNK = 0x8000;
  let out = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, i + CHUNK);
    out += String.fromCharCode(...sub);
  }
  return btoa(out);
}

function normSub(v) {
  if (!v) return { h: D_SH, p: D_SP };
  let h = v,
    p = "https";
  if (h.startsWith("http://")) {
    h = h.slice(7);
    p = "http";
  } else if (h.startsWith("https://")) {
    h = h.slice(8);
    p = "https";
  }
  h = h.replace(/\/+$/, "");
  return { h, p };
}

function esc(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fto(u, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(u, { signal: c.signal, headers: { Accept: "text/plain,*/*" } });
  } finally {
    clearTimeout(t);
  }
}

/* -------- host / domain helpers -------- */
function stripBracketHost(h) {
  h = (h || "").trim();
  if (h.startsWith("[") && h.endsWith("]")) return h.slice(1, -1);
  return h;
}

function isIPv4(x) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(x)) return false;
  return x.split(".").every((o) => {
    const n = Number(o);
    return n >= 0 && n <= 255;
  });
}

function isIPv6(x) {
  x = stripBracketHost(x).toLowerCase();
  if (!x.includes(":")) return false;
  const y = x.split("%")[0];
  if (!/^[0-9a-f:.]+$/.test(y)) return false;
  return true;
}

function isIPHost(h) {
  const x = stripBracketHost(h).toLowerCase();
  if (!x) return false;
  return isIPv4(x) || isIPv6(x);
}

function rootDomain(h) {
  const x = stripBracketHost(h).toLowerCase();
  if (!x || isIPHost(x)) return "";

  if (/^\.|\.\.|\.$/.test(x)) return "";
  if (!x.includes(".")) return "";
  if (!/^[a-z0-9.\-]+$/.test(x)) return "";

  const parts = x.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");

  const last2 = parts.slice(-2).join(".");

  const SPECIAL_SUFFIXES = new Set([
    "co.uk","org.uk","ac.uk","gov.uk","net.uk","sch.uk","me.uk","ltd.uk","plc.uk",
    "eu.org",
    "com.cn","net.cn","org.cn","gov.cn","edu.cn","ac.cn",
    "com.tw","net.tw","org.tw","idv.tw","gov.tw","edu.tw",
    "com.hk","net.hk","org.hk","edu.hk","gov.hk","idv.hk",
    "co.jp","ne.jp","or.jp","ac.jp","go.jp","ed.jp",
    "com.au","net.au","org.au","edu.au","gov.au","id.au",
    "co.nz","net.nz","org.nz","gov.nz","ac.nz","school.nz",
    "com.br","net.br","org.br","gov.br","edu.br",
    "co.in","net.in","org.in","gov.in","edu.in","ac.in",
    "co.kr","ne.kr","or.kr","go.kr","ac.kr",
    "com.sg","net.sg","org.sg","gov.sg","edu.sg",
    "com.my","net.my","org.my","gov.my","edu.my",
    "co.za","net.za","org.za","gov.za","ac.za",
    "com.ar","net.ar","org.ar","gov.ar",
    "com.mx","net.mx","org.mx","gob.mx",
    "com.ru","net.ru","org.ru",
    "co.it","gov.it",
  ]);

  return SPECIAL_SUFFIXES.has(last2) ? parts.slice(-3).join(".") : last2;
}

function normPort(p) {
  const s = String(p || "").trim();
  if (!/^\d+$/.test(s)) return "443";
  const n = Number(s);
  if (n < 1 || n > 65535) return "443";
  return String(n);
}

function sanitizeHostLike(raw) {
  const s = (raw || "").trim().replace(/\s+/g, "");
  if (!s) return "";

  if (s.startsWith("[") || s.includes(":")) return "";
  if (isIPv4(s)) return "";

  if (!/^[a-zA-Z0-9.\-]+$/.test(s)) return "";
  if (/^\.|\.\.|\.$/.test(s)) return "";
  if (!s.includes(".")) return "";

  const labels = s.split(".");
  for (const label of labels) {
    if (!label) return "";
    if (label.length > 63) return "";
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?$/.test(label)) return "";
  }

  if (s.length > 253) return "";
  return s.toLowerCase();
}

/* ---------------- addr parsing ---------------- */
function parseAddrLine(addr) {
  let t = (addr || "").trim();
  if (!t) return null;

  let remark = "";
  const hashPos = t.indexOf("#");
  if (hashPos >= 0) {
    remark = t.slice(hashPos + 1);
    t = t.slice(0, hashPos).trim();
  }
  if (!t) return null;

  // [IPv6]:port 或 [IPv6]
  if (t.startsWith("[")) {
    const rb = t.indexOf("]");
    if (rb > 0) {
      const ip = t.slice(1, rb);
      let rest = t.slice(rb + 1).trim();
      if (rest.startsWith(":")) rest = rest.slice(1);
      const pt = normPort(rest || "443");
      return { ad: "[" + ip + "]", pt, rk: remark || ip };
    }
  }

  // host:port / ipv4:port / ipv6:port(仅在没有多冒号时)
  const lastColon = t.lastIndexOf(":");
  if (lastColon > 0) {
    const left = t.slice(0, lastColon);
    const right = t.slice(lastColon + 1);
    if (/^\d+$/.test(right)) {
      if (!left.includes(":") || isIPHost(left)) {
        const pt = normPort(right);
        if (isIPv6(left)) return { ad: "[" + stripBracketHost(left) + "]", pt, rk: remark || left };
        return { ad: left, pt, rk: remark || left };
      }
    }
  }

  // 裸 IPv6
  if (isIPv6(t)) return { ad: "[" + stripBracketHost(t) + "]", pt: "443", rk: remark || t };
  return { ad: t, pt: "443", rk: remark || t };
}

/* ---------------- upstream fetch ---------------- */
async function fetchAPI(arr) {
  if (!arr.length) return [];
  const out = [];
  await Promise.allSettled(
    arr.map(async (u) => {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 5000);
      try {
        const r = await fetch(u.startsWith("http") ? u : "https://" + u, {
          signal: c.signal,
          headers: { "User-Agent": "Mozilla/5.0", Accept: "text/plain,*/*" },
        });
        if (!r.ok) return;
        (await r.text())
          .split(/\r?\n/)
          .forEach((l) => {
            const s = l.trim();
            if (s) out.push(s);
          });
      } catch {} finally {
        clearTimeout(t);
      }
    })
  );
  return out;
}

async function fetchCSV(arr, tls, dls, rmk) {
  if (!arr.length) return [];
  const out = [];
  await Promise.allSettled(
    arr.map(async (u) => {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 5000);
      try {
        const r = await fetch(u.startsWith("http") ? u : "https://" + u, { signal: c.signal });
        if (!r.ok) return;

        const rows = (await r.text())
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .split("\n")
          .filter((x) => x && x.trim())
          .map((l) => l.split(",").map((c) => c.trim()));

        const hd = rows[0] || [];
        const ti = hd.findIndex((c) => (c || "").toUpperCase() === "TLS");
        if (ti === -1) return;

        for (const row of rows.slice(1)) {
          if (!row || row.length <= ti) continue;
          if (((row[ti] || "") + "").toUpperCase() !== (tls + "").toUpperCase()) continue;
          if (!(parseFloat(row[row.length - 1] || "0") > dls)) continue;

          const ad = (row[0] || "").trim();
          const pt = normPort(row[1]);
          const ri = ti + rmk;
          const remark = ri >= 0 && ri < row.length && row[ri] ? row[ri] : ad;
          if (ad) out.push(ad + ":" + pt + "#" + remark);
        }
      } catch {} finally {
        clearTimeout(t);
      }
    })
  );
  return out;
}

/* ---------- config + upstream ---------- */
let _C = null,
  _K = "";

async function getCfg(env) {
  const k = [
    env.ADD,
    env.ADDAPI,
    env.ADDCSV,
    env.SUBAPI,
    env.SUBCONFIG,
    env.SUBNAME,
    env.FP,
    env.DLS,
    env.CSVREMARK,
    env.ALPN,
  ].join("|");
  if (_K === k && _C) return _C;

  const n = normSub(env.SUBAPI);
  _C = {
    a0: env.ADD ? parseList(env.ADD) : [],
    a1: env.ADDAPI ? parseList(env.ADDAPI) : [],
    a2: env.ADDCSV ? parseList(env.ADDCSV) : [],
    dls: Number(env.DLS) || D_DLS,
    rmk: Number(env.CSVREMARK) || D_RMK,
    name: env.SUBNAME || D_NAME,
    sc: env.SUBCONFIG || D_SC,
    sh: n.h,
    sp: n.p,
    fp: normFP(env.FP || D_FP),
    alpn: ((env.ALPN || D_ALPN || "h2") + "").trim() || "h2",
  };

  _K = k;
  return _C;
}

async function getUpstreamsRealtime(cfg) {
  const [l1, l2] = await Promise.all([fetchAPI(cfg.a1), fetchCSV(cfg.a2, "TRUE", cfg.dls, cfg.rmk)]);
  return { l1, l2 };
}

/* ---------------- HTML (Beautified) ---------------- */
function makeHTML(title, defAlpn) {
  const t = esc(title);
  const a = JSON.stringify((defAlpn || "h2") + "");

  // 注意：这里必须是模板字符串 `...`
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>${t}</title>
  <style>
    :root{
      --bg:#07070c;
      --panel:rgba(18,18,28,.72);
      --panel2:rgba(28,28,42,.78);
      --bd:rgba(255,255,255,.10);
      --bd2:rgba(0,229,255,.20);
      --tx:#eaeaf2;
      --mut:#9aa0b6;
      --acc:#00e5ff;
      --acc2:#7c3aed;
      --ok:#00ff9d;
      --bad:#ff5d7a;
      --shadow: 0 18px 60px rgba(0,0,0,.55);
      --r:16px;
    }
    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      background:
        radial-gradient(900px 600px at 20% 10%, rgba(124,58,237,.22), transparent 55%),
        radial-gradient(900px 600px at 90% 20%, rgba(0,229,255,.18), transparent 55%),
        radial-gradient(1000px 700px at 50% 110%, rgba(0,255,157,.10), transparent 60%),
        var(--bg);
      color:var(--tx);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
      display:flex;
      align-items:center;
      justify-content:center;
      padding:22px 14px;
    }

    .wrap{width:100%;max-width:860px}
    .top{
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:16px;
      margin-bottom:14px;
    }
    .brand{
      display:flex;
      flex-direction:column;
      gap:10px;
    }
    .tag{
      display:inline-flex;
      align-items:center;
      gap:10px;
      font-size:12px;
      letter-spacing:.14em;
      text-transform:uppercase;
      color:var(--acc);
      opacity:.95;
      user-select:none;
    }
    .tag::before{
      content:"";
      width:28px;height:1px;
      background:linear-gradient(90deg, transparent, var(--acc));
      opacity:.9;
    }
    h1{
      margin:0;
      font-size: clamp(26px, 4vw, 44px);
      line-height:1.05;
      font-weight: 900;
      letter-spacing:-.02em;
      background:linear-gradient(135deg, var(--tx) 35%, var(--acc) 75%);
      -webkit-background-clip:text;
      -webkit-text-fill-color:transparent;
    }
    .hint{
      margin-top:6px;
      color:var(--mut);
      font-size:13px;
      line-height:1.6;
    }

    .grid{
      display:grid;
      grid-template-columns: 1.15fr .85fr;
      gap:14px;
    }
    @media (max-width: 860px){
      .grid{grid-template-columns:1fr}
    }

    .card{
      border:1px solid var(--bd);
      background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: var(--r);
      box-shadow: var(--shadow);
      overflow:hidden;
    }
    .card .hd{
      padding:14px 16px;
      border-bottom:1px solid var(--bd);
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:10px;
      background: rgba(10,10,18,.35);
    }
    .card .ttl{
      font-size:12px;
      letter-spacing:.12em;
      text-transform:uppercase;
      color:var(--mut);
    }
    .pill{
      font-size:12px;
      padding:6px 10px;
      border-radius:999px;
      border:1px solid var(--bd);
      color:var(--mut);
      background:rgba(255,255,255,.04);
      user-select:none;
      white-space:nowrap;
    }
    .pill b{color:var(--tx);font-weight:800}

    .card .bd{
      padding:14px 16px 16px;
    }

    textarea, input{
      width:100%;
      background: var(--panel2);
      color:var(--tx);
      border:1px solid var(--bd);
      border-radius: 14px;
      outline:none;
      padding: 12px 12px;
      font-size: 14px;
      line-height:1.55;
      transition: border-color .15s ease, box-shadow .15s ease;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    textarea{min-height:140px;resize:vertical}
    textarea:focus, input:focus{
      border-color: var(--bd2);
      box-shadow: 0 0 0 3px rgba(0,229,255,.12);
    }

    .err{
      margin-top:10px;
      display:none;
      color: #ffd6de;
      background: rgba(255,93,122,.12);
      border: 1px solid rgba(255,93,122,.22);
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.5;
    }
    .err.on{display:block}

    .btn{
      width:100%;
      border:none;
      border-radius: 14px;
      padding: 13px 14px;
      cursor:pointer;
      font-weight: 900;
      letter-spacing:.02em;
      color:#06060a;
      background: linear-gradient(135deg, var(--acc2), var(--acc));
      box-shadow: 0 14px 40px rgba(0,229,255,.12);
      transition: transform .08s ease, filter .15s ease, opacity .15s ease;
      user-select:none;
    }
    .btn:hover{filter: brightness(1.06)}
    .btn:active{transform: translateY(1px)}
    .btn:disabled{opacity:.55;cursor:not-allowed}

    .row{
      display:flex;
      gap:10px;
      align-items:center;
    }
    .row .grow{flex:1}
    .cpb{
      border:1px solid var(--bd);
      background: rgba(255,255,255,.04);
      color: var(--tx);
      border-radius: 14px;
      padding: 12px 12px;
      cursor:pointer;
      white-space:nowrap;
      font-weight:800;
      transition: border-color .15s ease, transform .08s ease;
    }
    .cpb:hover{border-color: rgba(0,229,255,.35)}
    .cpb:active{transform: translateY(1px)}
    .small{
      margin-top:10px;
      color:var(--mut);
      font-size:12px;
      line-height:1.6;
    }

    .rightCard .bd{padding:16px}
    .kv{
      display:grid;
      grid-template-columns: 110px 1fr;
      gap:8px 10px;
      font-size: 13px;
      color: var(--mut);
    }
    .kv div:nth-child(2n){color: var(--tx)}
    .sep{height:1px;background: var(--bd);margin:14px 0}

    #qr{
      margin-top:14px;
      display:flex;
      justify-content:center;
      padding: 10px;
      border:1px dashed rgba(255,255,255,.14);
      border-radius: 14px;
      background: rgba(0,0,0,.20);
      min-height: 260px;
      align-items:center;
    }

    .toast{
      position: fixed;
      left: 50%;
      bottom: 18px;
      transform: translateX(-50%);
      background: rgba(15,15,25,.86);
      border: 1px solid rgba(255,255,255,.14);
      color: var(--tx);
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 13px;
      box-shadow: 0 18px 60px rgba(0,0,0,.5);
      opacity: 0;
      pointer-events:none;
      transition: opacity .18s ease, transform .18s ease;
    }
    .toast.on{opacity:1; transform: translateX(-50%) translateY(-2px)}
    .kbd{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      border: 1px solid rgba(255,255,255,.16);
      background: rgba(255,255,255,.06);
      padding: 2px 7px;
      border-radius: 8px;
      color: var(--tx);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="brand">
        <div class="tag">Subscription Generator</div>
        <h1>${t}</h1>
        <div class="hint">
          粘贴 <span class="kbd">vmess://</span> / <span class="kbd">vless://</span> / <span class="kbd">trojan://</span> 链接，
          一键生成订阅链接与二维码（默认 ALPN：<span class="kbd" id="defAlpnText"></span>）。
        </div>
      </div>
      <div class="pill">默认指纹 <b>chrome</b></div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="hd">
          <div class="ttl">节点链接</div>
          <div class="pill">支持自动识别参数</div>
        </div>
        <div class="bd">
          <textarea id="lk" placeholder="粘贴 vmess:// / vless:// / trojan:// 链接..."></textarea>
          <div class="err" id="er"></div>
          <div style="height:10px"></div>
          <button class="btn" id="genBtn">⚡ 生成订阅链接</button>
          <div class="small">
            提示：vless/trojan 建议带 <span class="kbd">host=</span>（伪装域名）。若缺失将使用 hostname 兜底。
          </div>
        </div>
      </div>

      <div class="card rightCard">
        <div class="hd">
          <div class="ttl">输出</div>
          <div class="pill">/sub 接口</div>
        </div>
        <div class="bd">
          <div class="kv">
            <div>输出链接</div><div id="st1">未生成</div>
            <div>二维码</div><div id="st2">未生成</div>
            <div>说明</div><div>复制订阅链接导入客户端</div>
          </div>

          <div class="sep"></div>

          <div class="row">
            <div class="grow"><input id="ou" type="text" readonly placeholder="生成后会出现在这里" /></div>
            <button class="cpb" id="cb">复制</button>
          </div>

          <div id="qr">
            <div style="color:var(--mut);font-size:13px;line-height:1.7;text-align:center">
              生成后自动显示二维码<br/>
              <span style="font-size:12px;opacity:.9">若二维码组件加载失败，请直接复制链接</span>
            </div>
          </div>

          <div class="small">
            QR 组件默认从 cdnjs 加载（qrious）。如你要“完全不外链”，我可以给你改成内嵌版。
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

<script>
  var DEF_ALPN = ${a};
  document.getElementById('defAlpnText').textContent = (DEF_ALPN || 'h2');

  var PASS_PARAMS = ['type','path','alpn','fp','mode','serviceName','mux','flow'];

  function se(m){
    var e=document.getElementById('er');
    e.textContent=m;
    e.className='err on';
  }
  function he(){
    document.getElementById('er').className='err';
  }

  function toast(msg){
    var t=document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast on';
    clearTimeout(window.__t_to);
    window.__t_to = setTimeout(function(){ t.className='toast'; }, 1400);
  }

  function setStatus(k1, k2){
    document.getElementById('st1').textContent = k1;
    document.getElementById('st2').textContent = k2;
  }

  function isValidHost(s){
    s=(s||'').trim().replace(/\\s+/g,'').toLowerCase();
    if(!s) return false;
    if(s.startsWith('[')||s.includes(':')) return false;
    if(/^\\d{1,3}(\\.\\d{1,3}){3}$/.test(s)) return false;
    if(!/^[a-z0-9.\\-]+$/.test(s)) return false;
    if(/^\\.|\\.\\.|\\.$/.test(s)) return false;
    if(!s.includes('.')) return false;
    var labels=s.split('.');
    for(var i=0;i<labels.length;i++){
      var lb=labels[i];
      if(!lb||lb.length>63) return false;
      if(!/^[a-z0-9]([a-z0-9\\-]*[a-z0-9])?$/.test(lb)) return false;
    }
    return s.length<=253;
  }

  function b64fix(s){
    s=(s||'').trim().replace(/\\s+/g,'').replace(/-/g,'+').replace(/_/g,'/');
    while(s.length%4)s+='=';
    return s;
  }

  function rqr(txt){
    var box=document.getElementById('qr');
    box.innerHTML='';
    if(!txt) return;

    function draw(){
      var cv=document.createElement('canvas');
      box.appendChild(cv);
      try{
        new QRious({
          element:cv,
          value:txt,
          size:240,
          background:'#0b0b12',
          foreground:'#00e5ff',
          level:'M'
        });
      }catch(e){
        box.innerHTML='<div style="color:#ffd6de;font-size:13px;line-height:1.7;text-align:center">二维码生成失败<br/>请直接复制订阅链接</div>';
      }
    }

    if(typeof QRious==='function'){ draw(); return; }

    var s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
    s.onload=draw;
    s.onerror=function(){
      box.innerHTML='<div style="color:#ffd6de;font-size:13px;line-height:1.7;text-align:center">二维码组件加载失败<br/>请直接复制订阅链接</div>';
    };
    document.head.appendChild(s);
  }

  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    }catch(e){
      // fallback
      try{
        var ta=document.createElement('textarea');
        ta.value=text;
        ta.style.position='fixed';
        ta.style.left='-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      }catch(_){
        return false;
      }
    }
  }

  var btn=document.getElementById('genBtn');
  btn.onclick=function(){
    he();
    var l=document.getElementById('lk').value.trim();
    if(!l){ se('请输入节点链接'); return; }

    btn.disabled=true;
    btn.textContent='⏳ 解析中...';

    try{
      var u0='';
      var defAlpn=(DEF_ALPN||'h2');

      if(l.indexOf('vmess://')===0){
        var raw=atob(b64fix(l.slice(8)));
        var j=JSON.parse(raw);

        var vmHost=(j.host||'').trim();
        if(!vmHost){ se('vmess 链接缺少 host 伪装域名字段'); return; }
        if(!isValidHost(vmHost)){ se('vmess host 字段不是合法域名（不支持 IP，必须含点）：' + vmHost); return; }

        var qp=new URLSearchParams();
        qp.set('host', vmHost.trim().replace(/\\s+/g,'').toLowerCase());
        qp.set('uuid', j.id||'');
        qp.set('type', j.net||'ws');
        qp.set('path', j.path||'/');
        qp.set('fp', 'chrome');
        qp.set('alpn', j.alpn||defAlpn);
        if(j.mode) qp.set('mode', j.mode);
        if(j.serviceName) qp.set('serviceName', j.serviceName);
        if(j.mux) qp.set('mux', j.mux);
        if(j.flow) qp.set('flow', j.flow);

        u0=location.origin+'/sub?'+qp.toString();

      } else if(l.indexOf('vless://')===0 || l.indexOf('trojan://')===0){
        var remarkIdx = l.indexOf('#');
        var lClean = remarkIdx >= 0 ? l.slice(0, remarkIdx) : l;

        var u=new URL(lClean);
        var sp=u.searchParams;

        var h=(sp.get('host')||'').trim();
        var hostFromHostname=false;
        if(!h){
          h=(u.hostname||'').trim();
          hostFromHostname=true;
        }
        if(!h){ se('链接缺少 host 且 hostname 为空，无法生成订阅'); return; }
        if(!isValidHost(h)){
          se('host 不是合法域名（不支持 IP，必须含点，不含冒号/逗号等特殊字符）：' + h);
          return;
        }
        if(hostFromHostname){
          console.warn('[订阅生成器] 链接缺少 host= 参数，已用 hostname 兜底：' + h + '。如伪装域名不正确请手动在链接中补充 host= 参数。');
        }

        var uid=decodeURIComponent(u.username||'');

        var clean=new URLSearchParams();
        clean.set('host', h.trim().replace(/\\s+/g,'').toLowerCase());
        clean.set('uuid', uid);

        PASS_PARAMS.forEach(function(k){
          var v=sp.get(k);
          if(v!==null && v!=='') clean.set(k, v);
        });

        if(!clean.has('alpn') || !clean.get('alpn')){
          clean.set('alpn', defAlpn);
        }

        u0=location.origin+'/sub?'+clean.toString();

      } else {
        se('仅支持 vmess:// / vless:// / trojan://');
        return;
      }

      document.getElementById('ou').value=u0;
      setStatus('已生成', '生成中...');
      rqr(u0);
      setStatus('已生成', '已生成');
      toast('生成成功');

    } catch(e){
      se('解析失败：链接格式有误');
    } finally {
      btn.disabled=false;
      btn.textContent='⚡ 生成订阅链接';
    }
  };

  document.getElementById('cb').onclick=async function(){
    var v=document.getElementById('ou').value;
    if(!v) return;
    var ok = await copyText(v);
    if(ok) toast('已复制');
    else toast('复制失败：请手动复制');
  };
</script>
</body>
</html>`;
}

/* ---------------- Worker ---------------- */
const WORKER_PASSTHROUGH_PARAMS = new Set(["type", "path", "alpn", "fp", "mode", "serviceName", "mux", "flow"]);

export default {
  async fetch(request, env) {
    try {
      const cfg = await getCfg(env);
      const url = new URL(request.url);
      const ua = (request.headers.get("User-Agent") || "").toLowerCase();

      if (url.pathname !== "/sub") {
        return new Response(makeHTML(cfg.name, cfg.alpn), {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
        });
      }

      const host = sanitizeHostLike(url.searchParams.get("host") || "");
      const uuid = (url.searchParams.get("uuid") || url.searchParams.get("password") || "").trim();
      if (!host || !uuid) return new Response("missing host/uuid", { status: 400 });

      const hostRoot = rootDomain(host);

      const baseParams = new URLSearchParams();
      for (const [k, v] of url.searchParams.entries()) {
        if (WORKER_PASSTHROUGH_PARAMS.has(k) && v) baseParams.set(k, v);
      }
      if (!baseParams.has("type")) baseParams.set("type", "ws");
      if (!baseParams.has("fp")) baseParams.set("fp", cfg.fp);
      if (!baseParams.has("alpn")) baseParams.set("alpn", cfg.alpn || "h2");

      const { l1, l2 } = await getUpstreamsRealtime(cfg);
      const all = Array.from(new Set([...cfg.a0, ...l1, ...l2]))
        .map((s) => (s || "").trim())
        .filter((s) => s && !s.startsWith("#"));

      if (!all.length) {
        return new Response("no upstream addresses available (ADD/ADDAPI/ADDCSV all empty or failed)", { status: 502 });
      }

      const isRaw = url.searchParams.get("raw") === "1";

      const FMT_OK = new Set(["clash", "singbox", "surge"]);
      const fmtReq = ((url.searchParams.get("format") || "") + "").toLowerCase();
      const fmt2 = FMT_OK.has(fmtReq) ? fmtReq : "";

      let uaTarget = "";
      if (!isRaw) {
        if (ua.includes("clash")) uaTarget = "clash";
        else if (ua.includes("singbox") || ua.includes("sing-box")) uaTarget = "singbox";
        else if (ua.includes("surge")) uaTarget = "surge";
      }

      const resolvedTarget = isRaw ? "" : fmt2 || uaTarget;

      const body = all
        .map((addr) => {
          const parsed = parseAddrLine(addr);
          if (!parsed) return null;

          const adPlain = stripBracketHost(parsed.ad);
          const addrIsIp = isIPHost(adPlain);

          let sniLine;
          if (addrIsIp) {
            sniLine = host;
          } else {
            const adRoot = rootDomain(adPlain);
            if (hostRoot && adRoot && adRoot === hostRoot) sniLine = adPlain;
            else sniLine = host;
          }

          const sp = new URLSearchParams(baseParams);
          sp.set("host", host);
          sp.set("sni", sniLine);
          sp.set("security", "tls");
          sp.set("encryption", "none");

          const adOut = parsed.ad;
          const ptOut = normPort(parsed.pt);

          return `vless://${encodeURIComponent(uuid)}@${adOut}:${ptOut}?${sp.toString()}#${encodeURIComponent(parsed.rk)}`;
        })
        .filter(Boolean)
        .join("\n");

      if (resolvedTarget) {
        const callbackUrl = new URL(url.href);
        callbackUrl.searchParams.delete("format");
        callbackUrl.searchParams.set("raw", "1");

        const conv = `${cfg.sp}://${cfg.sh}/sub?target=${encodeURIComponent(resolvedTarget)}&url=${encodeURIComponent(
          callbackUrl.toString()
        )}&config=${encodeURIComponent(cfg.sc)}`;

        const r = await fto(conv, 6500);
        if (!r || !r.ok) return new Response("convert upstream error", { status: 502 });
        return new Response(await r.text(), {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
      }

      return new Response(b64(body), {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    } catch (e) {
      return new Response("ERR\n" + (e && e.stack ? e.stack : String(e)), {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  },
};

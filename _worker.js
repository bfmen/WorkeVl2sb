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

// 【关键修复点】优化根域名提取，支持纯数字前缀
function rootDomain(h) {
  const x = stripBracketHost(h).toLowerCase();
  if (!x || isIPHost(x)) return "";

  if (/^\.|\.\.|\.$/.test(x)) return "";
  if (!x.includes(".")) return "";

  const parts = x.split(".").filter(Boolean);
  if (parts.length < 2) return x;

  const last2 = parts.slice(-2).join(".");
  const SPECIAL_SUFFIXES = new Set([
    "co.uk", "org.uk", "ac.uk", "gov.uk", "net.uk", "sch.uk", "me.uk", "ltd.uk", "plc.uk",
    "eu.org", "com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn", "ac.cn",
    "com.tw", "net.tw", "org.tw", "idv.tw", "gov.tw", "edu.tw",
    "com.hk", "net.hk", "org.hk", "edu.hk", "gov.hk", "idv.hk",
    "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp", "ed.jp",
    "com.au", "net.au", "org.au", "edu.au", "gov.au", "id.au",
    "co.nz", "net.nz", "org.nz", "gov.nz", "ac.nz", "school.nz",
    "com.br", "net.br", "org.br", "gov.br", "edu.br",
    "co.in", "net.in", "org.in", "gov.in", "edu.in", "ac.in",
    "co.kr", "ne.kr", "or.kr", "go.kr", "ac.kr",
    "com.sg", "net.sg", "org.sg", "gov.sg", "edu.sg",
    "com.my", "net.my", "org.my", "gov.my", "edu.my",
    "co.za", "net.za", "org.za", "gov.za", "ac.za",
    "com.ar", "net.ar", "org.ar", "gov.ar",
    "com.mx", "net.mx", "org.mx", "gob.mx",
    "com.ru", "net.ru", "org.ru", "co.it", "gov.it",
  ]);

  return SPECIAL_SUFFIXES.has(last2) && parts.length >= 3 ? parts.slice(-3).join(".") : last2;
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
  if (/^\.|\.\.|\.$/.test(s)) return "";
  if (!s.includes(".")) return "";
  const labels = s.split(".");
  for (const label of labels) {
    if (!label) return "";
    if (label.length > 63) return "";
    if (!/^[a-z0-9]([a-z0-9\-]*[a-z0-9])?$/i.test(label)) return "";
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
let _C = null, _K = "";

async function getCfg(env) {
  const k = [
    env.ADD, env.ADDAPI, env.ADDCSV, env.SUBAPI,
    env.SUBCONFIG, env.SUBNAME, env.FP, env.DLS,
    env.CSVREMARK, env.ALPN,
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

/* ---------------- HTML ---------------- */
function makeHTML(title, defAlpn) {
  const t = esc(title);
  const a = JSON.stringify((defAlpn || "h2") + "");
  return `<!doctype html><html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<style>
:root{--bg:#0a0a0f;--s:#13131a;--s2:#1c1c27;--b:#2a2a38;--a:#00e5ff;--a2:#7c3aed;--tx:#e8e8f0;--m:#6b6b80;--ok:#00ff9d}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family: ui-monospace, SFMono-Regular, Consolas, monospace;background:var(--bg);color:var(--tx);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px}
.wrap{width:100%;max-width:640px}.hd{margin-bottom:18px}.tag{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--a);margin-bottom:10px;display:flex;align-items:center;gap:8px}.tag::before{content:'';display:block;width:22px;height:1px;background:var(--a)}
.tt{font-size:clamp(24px,5vw,38px);font-weight:800;background:linear-gradient(135deg,var(--tx),var(--a));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.card{background:var(--s);border:1px solid var(--b);border-radius:12px;padding:18px 16px;margin-bottom:12px}
.lab{font-size:11px;text-transform:uppercase;color:var(--m);margin-bottom:10px}
textarea,input{width:100%;background:var(--s2);border:1px solid var(--b);border-radius:8px;padding:12px;color:var(--tx);outline:none;font-family:inherit}
textarea{min-height:96px;resize:vertical}.btn{width:100%;padding:14px;border-radius:8px;border:none;cursor:pointer;font-weight:800;background:linear-gradient(135deg,var(--a2),var(--a));color:#000}
.rw{display:none;margin-top:12px}.rw.on{display:block}.rrow{display:flex;gap:8px}#qr{margin-top:16px;display:flex;justify-content:center}
.cpb{padding:12px;border-radius:8px;border:1px solid var(--b);background:var(--s2);color:var(--tx);cursor:pointer;white-space:nowrap}
.err{display:none;color:#ff6b6b;margin-top:8px}
.err.on{display:block}
</style></head><body>
<div class="wrap">
  <div class="hd"><div class="tag">Subscription Generator</div><h1 class="tt">${t}</h1></div>
  <div class="card">
    <div class="lab">节点链接</div>
    <textarea id="lk" placeholder="粘贴 vmess:// / vless:// / trojan:// 链接..."></textarea>
    <div class="err" id="er"></div>
  </div>
  <button class="btn" id="genBtn">⚡ 生成订阅链接</button>
  <div class="rw" id="rw">
    <div class="card">
      <div class="lab">订阅链接</div>
      <div class="rrow"><input type="text" id="ou" readonly><button class="cpb" id="cb">复制</button></div>
      <div id="qr"></div>
    </div>
  </div>
</div>
<script>
var DEF_ALPN = ${a};
var PASS_PARAMS = ['type','path','alpn','fp','mode','serviceName','mux','flow','insecure','allowInsecure'];

function se(m){var e=document.getElementById('er');e.textContent=m;e.className='err on';}
function he(){document.getElementById('er').className='err';}

function isValidHost(s){
  s=(s||'').trim().replace(/\\s+/g,'').toLowerCase();
  if(!s) return false;
  if(s.startsWith('[')||s.includes(':')) return false;
  if(/^\\d{1,3}(\\.\\d{1,3}){3}$/.test(s)) return false;
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
  var box=document.getElementById('qr');box.innerHTML='';if(!txt)return;
  function draw(){
    var cv=document.createElement('canvas');
    box.appendChild(cv);
    try{ new QRious({element:cv,value:txt,size:220,background:'#13131a',foreground:'#00e5ff',level:'M'}); }
    catch(e){ box.innerHTML='<div style="color:#ff6b6b;font-size:12px">二维码生成失败</div>'; }
  }
  if(typeof QRious==='function'){ draw(); return; }
  var s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
  s.onload=draw;
  document.head.appendChild(s);
}

document.getElementById('genBtn').onclick=function(){
  he();
  var l=document.getElementById('lk').value.trim();
  if(!l){ se('请输入节点链接'); return; }
  try{
    var u0='';
    var defAlpn=(DEF_ALPN||'h2');
    if(l.indexOf('vmess://')===0){
      var raw=atob(b64fix(l.slice(8)));
      var j=JSON.parse(raw);
      var vmHost=(j.host||'').trim();
      if(!vmHost){ se('vmess 链接缺少 host 伪装域名字段'); return; }
      if(!isValidHost(vmHost)){ se('host 不合法：' + vmHost); return; }
      var qp=new URLSearchParams();
      qp.set('host', vmHost.replace(/\\s+/g,'').toLowerCase());
      qp.set('uuid', j.id||'');
      qp.set('type', j.net||'ws');
      qp.set('path', j.path||'/');
      qp.set('fp', 'chrome');
      qp.set('alpn', j.alpn||defAlpn);
      u0=location.origin+'/sub?'+qp.toString();
    } else if(l.indexOf('vless://')===0 || l.indexOf('trojan://')===0){
      var remarkIdx = l.indexOf('#');
      var lClean = remarkIdx >= 0 ? l.slice(0, remarkIdx) : l;
      var u=new URL(lClean);
      var sp=u.searchParams;
      var h=(sp.get('host')||'').trim();
      if(!h) h=(u.hostname||'').trim();
      if(!h || !isValidHost(h)){ se('host 不合法：' + h); return; }
      var clean=new URLSearchParams();
      clean.set('host', h.replace(/\\s+/g,'').toLowerCase());
      clean.set('uuid', decodeURIComponent(u.username||''));
      PASS_PARAMS.forEach(function(k){
        var v=sp.get(k);
        if(v!==null && v!=='') clean.set(k, v);
      });
      if(!clean.has('alpn')) clean.set('alpn', defAlpn);
      u0=location.origin+'/sub?'+clean.toString();
    } else {
      se('仅支持 vmess:// / vless:// / trojan://');
      return;
    }
    document.getElementById('rw').className='rw on';
    document.getElementById('ou').value=u0;
    rqr(u0);
  } catch(e){ se('解析失败'); }
};

document.getElementById('cb').onclick=function(){
  var v=document.getElementById('ou').value;
  if(!v) return;
  navigator.clipboard.writeText(v);
  this.textContent='已复制';
  var self=this; setTimeout(function(){ self.textContent='复制'; },1500);
};
</script></body></html>`;
}

/* ---------------- Worker ---------------- */
const WORKER_PASSTHROUGH_PARAMS = new Set(["type", "path", "alpn", "fp", "mode", "serviceName", "mux", "flow", "insecure", "allowInsecure"]);

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

      if (!all.length) return new Response("no upstreams", { status: 502 });

      const isRaw = url.searchParams.get("raw") === "1";
      const FMT_OK = new Set(["clash", "singbox", "surge"]);
      const fmtReq = ((url.searchParams.get("format") || "") + "").toLowerCase();
      const resolvedTarget = isRaw ? "" : (FMT_OK.has(fmtReq) ? fmtReq : (ua.includes("clash")?"clash":ua.includes("sing-box")?"singbox":ua.includes("surge")?"surge":""));

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
            // 这里现在能正确对比 880060.xyz 了
            if (hostRoot && adRoot && adRoot === hostRoot) sniLine = adPlain;
            else sniLine = host;
          }

          const sp = new URLSearchParams(baseParams);
          sp.set("host", host);
          sp.set("sni", sniLine);
          sp.set("security", "tls");
          sp.set("encryption", "none");

          return `vless://${encodeURIComponent(uuid)}@${parsed.ad}:${normPort(parsed.pt)}?${sp.toString()}#${encodeURIComponent(parsed.rk)}`;
        })
        .filter(Boolean)
        .join("\n");

      if (resolvedTarget) {
        const callbackUrl = new URL(url.href);
        callbackUrl.searchParams.delete("format");
        callbackUrl.searchParams.set("raw", "1");
        const conv = `${cfg.sp}://${cfg.sh}/sub?target=${encodeURIComponent(resolvedTarget)}&url=${encodeURIComponent(callbackUrl.toString())}&config=${encodeURIComponent(cfg.sc)}`;
        const r = await fto(conv, 6500);
        if (!r || !r.ok) return new Response("convert error", { status: 502 });
        return new Response(await r.text(), { headers: { "content-type": "text/plain; charset=utf-8" } });
      }

      return new Response(b64(body), { headers: { "content-type": "text/plain; charset=utf-8" } });
    } catch (e) {
      return new Response("ERR\n" + String(e), { status: 500 });
    }
  },
};

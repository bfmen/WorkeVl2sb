const D_SH = "sub.096000.xyz",
  D_SP = "https",
  D_SC = "https://raw.githubusercontent.com/org100/demo/main/nodnsleak.ini",
  D_NAME = "优选订阅生成器",
  D_FP = "chrome",
  D_DLS = 7,
  D_RMK = 1,
  D_ALPN = "h2";

function parseAddrLine(addr) {
  let t = (addr || "").trim();
  if (!t) return null;

  let ad = t, pt = "443", rk = t;
  let remark = "";
  const hashPos = t.indexOf("#");
  if (hashPos >= 0) {
    remark = t.slice(hashPos + 1);
    t = t.slice(0, hashPos);
  }
  if (!t) return null;

  // 1) [IPv6]:port
  if (t.startsWith("[")) {
    const rb = t.indexOf("]");
    if (rb > 0) {
      const ip = t.slice(1, rb);
      let rest = t.slice(rb + 1);
      if (rest.startsWith(":")) rest = rest.slice(1);
      if (rest && /^\d+$/.test(rest)) {
        const n = Number(rest);
        if (n >= 1 && n <= 65535) pt = String(n);
      }
      ad = "[" + ip + "]";
      rk = remark || ip;
      return { ad, pt, rk };
    }
  }

  // 2) domain/ip:port — 用最后一个 ":" 拆端口
  const lastColon = t.lastIndexOf(":");
  if (lastColon > 0) {
    const left = t.slice(0, lastColon);
    const right = t.slice(lastColon + 1);
    if (/^\d+$/.test(right)) {
      const n = Number(right);
      if (n >= 1 && n <= 65535) {
        // left 含 ":" 且不是 IPv6 → 脏行（如 example.com:443:1），跳过端口解析
        if (!left.includes(":") || isIPHost(left)) {
          ad = left;
          pt = String(n);
          rk = remark || left;
          return { ad, pt, rk };
        }
      }
    }
  }

  // 3) 没端口，当作纯 host
  ad = t;
  pt = "443";
  rk = remark || ad;
  return { ad, pt, rk };
}

let _C = null,
  _K = "";

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
  return btoa(unescape(encodeURIComponent(s)));
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

/* -------- domain helpers -------- */
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
  if (isIPv4(x)) return true;
  if (isIPv6(x)) return true;
  return false;
}

function rootDomain(h) {
  const x = stripBracketHost(h).toLowerCase();
  if (!x || isIPHost(x)) return "";

  const parts = x.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");

  const last2 = parts.slice(-2).join(".");

  const SPECIAL_SUFFIXES = new Set([
    "eu.org",
    "co.uk",
    "org.uk",
    "ac.uk",
    "gov.uk",
    "net.uk",
    "sch.uk",
  ]);

  if (SPECIAL_SUFFIXES.has(last2)) {
    return parts.slice(-3).join(".");
  }

  return last2;
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
        const fetchUrl = u.startsWith("http") ? u : "https://" + u;
        const r = await fetch(fetchUrl, {
          signal: c.signal,
          headers: {
            Accept: "text/plain,*/*",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
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
        const fetchUrl = u.startsWith("http") ? u : "https://" + u;
        const r = await fetch(fetchUrl, {
          signal: c.signal,
          headers: {
            Accept: "text/plain,*/*",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });
        if (!r.ok) return;

        const rows = (await r.text())
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .split("\n")
          .filter((x) => x && x.trim())
          .map((l) => l.split(",").map((c) => c.trim()));

        if (!rows.length) return;

        const hd = rows[0] || [];
        const ds = rows.slice(1);
        const ti = hd.findIndex((c) => (c || "").toUpperCase() === "TLS");
        if (ti === -1) return;

        for (const row of ds) {
          if (!row || row.length <= ti) continue;
          if (((row[ti] || "") + "").toUpperCase() !== (tls + "").toUpperCase()) continue;
          if (!(parseFloat(row[row.length - 1] || "0") > dls)) continue;

          const ad = row[0];
          const pt = row[1];
          const ri = ti + rmk;
          const remark = ri >= 0 && ri < row.length && row[ri] ? row[ri] : row[0];
          out.push(ad + ":" + pt + "#" + remark);
        }
      } catch {} finally {
        clearTimeout(t);
      }
    })
  );
  return out;
}

/* ---------- config + upstream ---------- */
async function getCfg(env) {
  // 环境变量在 Worker 生命周期内不会变，此缓存为 isolate 级永久缓存
  // 若需热更新环境变量，必须重新部署
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
    alpn: ((env.ALPN || D_ALPN || "") + "").trim() || "h2",
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
  const a = (defAlpn || "h2").toString().trim() || "h2";
  return `<!doctype html><html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<style>
:root{--bg:#0a0a0f;--s:#13131a;--s2:#1c1c27;--b:#2a2a38;--a:#00e5ff;--a2:#7c3aed;--tx:#e8e8f0;--m:#6b6b80;--ok:#00ff9d}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;background:var(--bg);color:var(--tx);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px}
.wrap{width:100%;max-width:640px}
.hd{margin-bottom:18px}
.tag{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--a);opacity:.85;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.tag::before{content:'';display:block;width:22px;height:1px;background:var(--a)}
.tt{font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size:clamp(24px,5vw,38px);font-weight:800;letter-spacing:-.02em;line-height:1.1;background:linear-gradient(135deg,var(--tx),var(--a));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.card{background:var(--s);border:1px solid var(--b);border-radius:12px;padding:18px 16px;margin-bottom:12px}
.lab{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--m);margin-bottom:10px}
textarea,input[type=text]{width:100%;background:var(--s2);border:1px solid var(--b);border-radius:8px;padding:12px 14px;color:var(--tx);font-family:inherit;font-size:13px;line-height:1.6;outline:none}
textarea{min-height:96px;resize:vertical}
.btn{width:100%;padding:14px 20px;border-radius:8px;border:none;cursor:pointer;font-family: system-ui, -apple-system, sans-serif;font-size:15px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;background:linear-gradient(135deg,var(--a2),var(--a));color:#000}
.rrow{display:flex;gap:8px;align-items:stretch}
.ri{flex:1;cursor:pointer}
.cpb{padding:12px 16px;border-radius:8px;border:1px solid var(--b);background:var(--s2);color:var(--tx);cursor:pointer;font-family:inherit;font-size:12px;white-space:nowrap}
.cpb.ok{border-color:var(--ok);color:var(--ok)}
.err{display:none;margin-top:8px;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,80,80,.3);background:rgba(255,80,80,.08);color:#ff6b6b;font-size:13px}
.err.on{display:block}
.rw{display:none;margin-top:12px}
.rw.on{display:block}
#qr{margin-top:16px;display:flex;justify-content:center;min-height:24px}
#qr .qre{font-size:12px;color:#ff6b6b;opacity:.95}
#qr canvas{border-radius:10px;border:1px solid var(--b)}
</style></head><body>
<div class="wrap">
  <div class="hd">
    <div class="tag">Subscription Generator</div>
    <h1 class="tt">${t}</h1>
  </div>

  <div class="card">
    <div class="lab">节点链接</div>
    <textarea id="lk" placeholder="粘贴 vmess:// / vless:// / trojan:// 链接..."></textarea>
    <div class="err" id="er"></div>
  </div>

  <button class="btn" id="genBtn" type="button">⚡ 生成订阅链接</button>

  <div class="rw" id="rw">
    <div class="card">
      <div class="lab">订阅链接</div>
      <div class="rrow">
        <input type="text" class="ri" id="ou" readonly>
        <button class="cpb" id="cb" type="button">复制</button>
      </div>
      <div id="qr"></div>
    </div>
  </div>
</div>

<script>
var DEF_ALPN = ${JSON.stringify(a)};
var u0='';

function se(m){var e=document.getElementById('er');e.textContent=m;e.className='err on';}
function he(){document.getElementById('er').className='err';}

function b64fix(s){
  s=(s||'').trim().replace(/\s+/g,'').replace(/-/g,'+').replace(/_/g,'/');
  while(s.length%4)s+='=';
  return s;
}

function show(x){
  var rw=document.getElementById('rw');
  rw.className='rw on';
  document.getElementById('ou').value=x;
  rqr(x);
  rw.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function gen(){
  he();
  var l=document.getElementById('lk').value.trim();
  if(!l){se('请输入节点链接');return;}

  try{
    var defAlpn = (DEF_ALPN || 'h2');

    if(l.indexOf('vmess://')===0){
      var raw=atob(b64fix(l.slice(8)));
      var j=JSON.parse(raw);
      var alpn = (j.alpn || defAlpn);
      var vmHost = (j.host || '').trim();
      if (!vmHost) { se('vmess 链接缺少 host 伪装域名字段'); return; }

      u0=location.origin+'/sub?host='+encodeURIComponent(vmHost)
        +'&uuid='+encodeURIComponent(j.id||'')
        +'&path='+encodeURIComponent(j.path||'/')
        +'&type='+encodeURIComponent(j.net||'ws')
        +'&fp=chrome'
        +'&alpn='+encodeURIComponent(alpn);

    } else if(l.indexOf('vless://')===0||l.indexOf('trojan://')===0){
      var u;
      try { u = new URL(l); } catch(e) { se('解析失败：链接格式有误'); return; }

      var uu = decodeURIComponent(u.username || '');
      var addr = u.hostname || '';

      var sp = u.searchParams;

      var h = (sp.get('host') || sp.get('sni') || '').trim();
      if(!h){ se('链接里缺少 host/sni 伪装域名，无法生成订阅'); return; }

      var alpn2 = sp.get('alpn') || defAlpn;
      if(!sp.get('alpn')) sp.set('alpn', alpn2);
      sp.delete('host');
      sp.delete('uuid');
      sp.delete('password');
      sp.delete('sni');

      var newQs = sp.toString();
      u0=location.origin+'/sub?host='+encodeURIComponent(h)+'&uuid='+encodeURIComponent(uu)+(newQs?('&'+newQs):'');

    } else {
      se('仅支持 vmess:// / vless:// / trojan://');
      return;
    }

    show(u0);
  } catch(e){
    se('解析失败：链接格式有误');
  }
}

function doCopy(){
  var v=document.getElementById('ou').value;
  if(!v)return;
  navigator.clipboard.writeText(v).then(function(){
    var b=document.getElementById('cb');
    b.textContent='已复制 ✓';b.classList.add('ok');
    setTimeout(function(){b.textContent='复制';b.classList.remove('ok');},1800);
  });
}

function rqr(txt){
  var box=document.getElementById('qr');
  box.innerHTML='';
  if(!txt)return;

  if(txt.length>1500){
    box.innerHTML='<div class="qre">链接过长，无法生成二维码（请直接复制订阅链接）</div>';
    return;
  }

  function drawQR() {
    var cv=document.createElement('canvas');
    box.innerHTML='';
    box.appendChild(cv);
    try {
      new QRious({
        element: cv,
        value: txt,
        size: 220,
        background: '#13131a',
        foreground: '#00e5ff',
        level: 'M'
      });
    } catch(e) {
      box.innerHTML='<div class="qre">二维码生成失败（请直接复制订阅链接）</div>';
    }
  }

  if(typeof QRious !== 'function'){
    box.innerHTML='<div class="qre" style="color:var(--m)">正在加载组件...</div>';
    var cdns = [
      'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js',
      'https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js',
      'https://unpkg.com/qrious@4.0.2/dist/qrious.min.js'
    ];

    function loadCDN(index) {
      if (index >= cdns.length) {
        box.innerHTML='<div class="qre">组件加载失败，请检查网络或直接复制链接</div>';
        return;
      }
      var script = document.createElement('script');
      script.src = cdns[index];
      script.onload = drawQR;
      script.onerror = function() { loadCDN(index + 1); };
      document.head.appendChild(script);
    }

    loadCDN(0);
  } else {
    drawQR();
  }
}

document.addEventListener('DOMContentLoaded', function(){
  document.getElementById('genBtn').addEventListener('click', gen);
  document.getElementById('cb').addEventListener('click', doCopy);
  document.getElementById('ou').addEventListener('click', doCopy);
});
</script>
</body></html>`;
}

/* ---------------- Worker ---------------- */
export default {
  async fetch(request, env) {
    try {
      const cfg = await getCfg(env);
      const { a0, name, sc, sh, sp, fp, alpn: defAlpn } = cfg;

      const url = new URL(request.url);
      const ua = ((request.headers.get("User-Agent") || "") + "").toLowerCase();
      const fmt = ((url.searchParams.get("format") || "") + "").toLowerCase();

      if (url.pathname !== "/sub") {
        return new Response(makeHTML(name, defAlpn), {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
        });
      }

      const KP = new Set([
        "host", "uuid", "password", "path", "sni", "type",
        "fp", "alpn", "security", "encryption", "format",
      ]);

      let host = "", uuid = "", path = "/", type = "ws";
      let qfp = normFP(url.searchParams.get("fp") || fp);
      let alpn = (url.searchParams.get("alpn") || defAlpn || "h2").trim() || "h2";
      let forcedSni = stripBracketHost((url.searchParams.get("sni") || "").trim());
      forcedSni = forcedSni.replace(/\s+/g, "");
      if (forcedSni.length > 255) forcedSni = "";

      const ex = [];
      const seen = new Set(KP);
      for (const [k, v] of url.searchParams.entries()) {
        if (seen.has(k)) continue;
        seen.add(k);
        ex.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
      }

      host = (url.searchParams.get("host") || "").trim();
      uuid = (url.searchParams.get("uuid") || url.searchParams.get("password") || "").trim();
      path = (url.searchParams.get("path") || "/").trim() || "/";
      type = (url.searchParams.get("type") || "ws").trim() || "ws";

      if (!host || !uuid) return new Response("missing host/uuid", { status: 400 });

      let hostPlain = stripBracketHost(host).replace(/\s+/g, "");
      if (!hostPlain) return new Response("missing host/uuid", { status: 400 });

      const { l1, l2 } = await getUpstreamsRealtime(cfg);
      const all = Array.from(new Set([...a0, ...l1, ...l2]))
        .map(s => (s || "").trim())
        .filter(s => s && !s.startsWith("#"));

      const extra = ex.length ? "&" + ex.join("&") : "";
      const prefix = "vless://" + uuid + "@";

      const body = all
        .map((addr) => {
          const parsed = parseAddrLine(addr);
          if (!parsed) return null;
          const { ad, pt, rk } = parsed;
          let ad2 = ad;
          const adPlain = stripBracketHost(ad2);

          let sniLine;
          if (forcedSni) {
            // 用户强制指定
            sniLine = forcedSni;
          } else if (isIPHost(adPlain)) {
            // IP 节点：用 host 伪装域名当 SNI
            sniLine = hostPlain;
          } else {
            // 域名节点（CF 优选域名）：用自身当 SNI
            sniLine = adPlain;
          }

          const qsFixedLine =
            "security=tls" +
            "&sni=" + encodeURIComponent(sniLine) +
            "&alpn=" + encodeURIComponent(alpn) +
            "&fp=" + encodeURIComponent(qfp) +
            "&type=" + encodeURIComponent(type) +
            "&host=" + encodeURIComponent(hostPlain) +
            "&path=" + encodeURIComponent(path) +
            "&encryption=none" +
            extra;

          if (adPlain.includes(":") && !ad2.startsWith("[")) ad2 = "[" + adPlain + "]";

          return prefix + ad2 + ":" + pt + "?" + qsFixedLine + "#" + encodeURIComponent(rk);
        })
        .filter(Boolean)
        .join("\n");

      const convUrl = (t) =>
        sp + "://" + sh +
        "/sub?target=" + t +
        "&url=" + encodeURIComponent(url.href) +
        "&config=" + encodeURIComponent(sc);

      const FMT_OK = new Set(["clash", "singbox", "surge"]);
      const fmt2 = FMT_OK.has(fmt) ? fmt : "";

      let target = null;
      if (ua.includes("clash")) target = "clash";
      else if (ua.includes("singbox") || ua.includes("sing-box")) target = "singbox";
      else if (ua.includes("surge")) target = "surge";

      // fmt 显式指定优先，其次 UA 推断
      const resolvedTarget = fmt2 || target;
      if (resolvedTarget) {
        const r = await fto(convUrl(resolvedTarget), 6500);
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

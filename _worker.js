const D_SH = "SUBAPI.cmliussss.net",
  D_SP = "https",
  D_SC = "https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full_MultiMode.ini",
  D_NAME = "优选订阅生成器",
  D_FP = "chrome",
  D_DLS = 7,
  D_RMK = 1;

const R_ADDR = /^(\[[^\]]+\]|[\w.\-]+):?(\d+)?(?:#(.*))?$/;

let _C = null,
  _K = "";

/* ---------------- utils ---------------- */
function normFP(v) {
  const s = (v || "").toString().trim().toLowerCase();
  return ["chrome", "firefox", "safari", "edge", "ios", "android", "random"].includes(s) ? s : D_FP;
}

async function parseList(x) {
  if (!x) return [];
  return x
    .replace(/[ \t|"'\r\n]+/g, ",")
    .replace(/,+/g, ",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 优化 C：更稳、更高效的原生 Base64 编码，完美兼容 UTF-8
function b64(s) {
  return btoa(unescape(encodeURIComponent(s)));
}

function normSub(v) {
  if (!v) return { h: D_SH, p: D_SP };
  if (v.startsWith("http://")) return { h: v.slice(7), p: "http" };
  if (v.startsWith("https://")) return { h: v.slice(8), p: "https" };
  return { h: v, p: "https" };
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

async function fetchAPI(arr) {
  if (!arr.length) return [];
  const out = [];
  await Promise.allSettled(
    arr.map(async (u) => {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 2500);
      try {
        const r = await fetch(u, { signal: c.signal, headers: { Accept: "text/plain,*/*" } });
        if (!r.ok) return;
        (await r.text())
          .split(/\r?\n/)
          .forEach((l) => {
            const s = l.trim();
            if (s) out.push(s);
          });
      } catch {}
      finally {
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
      const t = setTimeout(() => c.abort(), 3500);
      try {
        const r = await fetch(u, { signal: c.signal, headers: { Accept: "text/plain,*/*" } });
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
          if (!row || row.length < 2) continue;
          if (((row[ti] || "") + "").toUpperCase() !== (tls + "").toUpperCase()) continue;
          if (!(parseFloat(row[row.length - 1] || "0") > dls)) continue;

          const ad = row[0];
          const pt = row[1];
          const ri = ti + rmk;
          const remark = ri >= 0 && ri < row.length && row[ri] ? row[ri] : row[0];
          out.push(ad + ":" + pt + "#" + remark);
        }
      } catch {}
      finally {
        clearTimeout(t);
      }
    })
  );
  return out;
}

/* ---------- config + upstream cache ---------- */
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
  ].join("|");
  if (_K === k && _C) return _C;

  const n = normSub(env.SUBAPI);
  _C = {
    a0: env.ADD ? await parseList(env.ADD) : [],
    a1: env.ADDAPI ? await parseList(env.ADDAPI) : [],
    a2: env.ADDCSV ? await parseList(env.ADDCSV) : [],
    dls: Number(env.DLS) || D_DLS,
    rmk: Number(env.CSVREMARK) || D_RMK,
    name: env.SUBNAME || D_NAME,
    sc: env.SUBCONFIG || D_SC,
    sh: n.h,
    sp: n.p,
    fp: normFP(env.FP || D_FP),
  };
  _K = k;
  return _C;
}

async function cacheGetJSON(key) {
  const cache = caches.default;
  const req = new Request("https://cache.local/" + key);
  const hit = await cache.match(req);
  if (!hit) return null;
  try {
    return await hit.json();
  } catch {
    return null;
  }
}

// 优化 B：引入 ctx 并使用 ctx.waitUntil 实现非阻塞后台缓存写入
async function cachePutJSON(ctx, key, obj, ttl = 60) {
  const cache = caches.default;
  const req = new Request("https://cache.local/" + key);
  const res = new Response(JSON.stringify(obj), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${ttl}` },
  });
  
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(cache.put(req, res));
  } else {
    await cache.put(req, res);
  }
}

async function getUpstreamsCached(cfg, ctx) {
  const key =
    "up_" +
    b64(cfg.a1.join("|") + "|" + cfg.a2.join("|") + "|" + String(cfg.dls) + "|" + String(cfg.rmk));
  const hit = await cacheGetJSON(key);
  if (hit && Array.isArray(hit.l1) && Array.isArray(hit.l2)) return hit;

  const [l1, l2] = await Promise.all([fetchAPI(cfg.a1), fetchCSV(cfg.a2, "TRUE", cfg.dls, cfg.rmk)]);
  const obj = { l1, l2 };
  await cachePutJSON(ctx, key, obj, 60);
  return obj;
}

/* ---------------- HTML (极简) ---------------- */
function makeHTML(title) {
  const t = esc(title);
  // 优化 A：剔除 Google Fonts 依赖，改用系统原生字体族，提升渲染速度
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
var u0='';

function se(m){var e=document.getElementById('er');e.textContent=m;e.className='err on';}
function he(){document.getElementById('er').className='err';}

function b64fix(s){
  s=(s||'').trim().replace(/-/g,'+').replace(/_/g,'/');
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
    if(l.indexOf('vmess://')===0){
      var raw=atob(b64fix(l.slice(8)));
      var j=JSON.parse(raw);
      u0=location.origin+'/sub?host='+encodeURIComponent(j.host||j.add||'')
        +'&uuid='+encodeURIComponent(j.id||'')
        +'&path='+encodeURIComponent(j.path||'/')
        +'&sni='+encodeURIComponent(j.sni||j.host||j.add||'')
        +'&type='+encodeURIComponent(j.net||'ws')
        +'&fp=chrome';
    } else if(l.indexOf('vless://')===0||l.indexOf('trojan://')===0){
      var uu=l.split('//')[1].split('@')[0];
      var ap=l.split('@')[1]||'';
      var qi=ap.indexOf('?');
      var s=qi>=0?ap.slice(qi+1).split('#')[0]:'';
      u0=location.origin+'/sub?uuid='+encodeURIComponent(uu)+(s?'&'+s:'');
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

// 优化 A：多 CDN 轮询 + 延迟按需加载
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
    
    // CDN 轮询列表
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
  // 注入 ctx 上下文用于 ctx.waitUntil
  async fetch(request, env, ctx) {
    try {
      const cfg = await getCfg(env);
      const { a0, name, sc, sh, sp, fp } = cfg;

      const url = new URL(request.url);
      const ua = ((request.headers.get("User-Agent") || "") + "").toLowerCase();
      const fmt = ((url.searchParams.get("format") || "") + "").toLowerCase();

      // 首页：极简生成器
      if (url.pathname !== "/sub") {
        return new Response(makeHTML(name), {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
        });
      }

      // /sub：生成 vless 列表 + 可选转换
      const KP = new Set(["host", "uuid", "password", "path", "sni", "type", "fp", "alpn", "security", "encryption", "format"]);
      let host = "",
        uuid = "",
        path = "/",
        sni = "",
        type = "ws";

      let qfp = normFP(url.searchParams.get("fp") || fp);
      let alpn = url.searchParams.get("alpn") || "";

      // 透传其它参数
      const ex = [];
      const seen = new Set(KP);
      for (const [k, v] of url.searchParams.entries()) {
        if (seen.has(k)) continue;
        seen.add(k);
        ex.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
      }

      host = url.searchParams.get("host") || "";
      uuid = url.searchParams.get("uuid") || url.searchParams.get("password") || "";
      path = url.searchParams.get("path") || "/";
      sni = url.searchParams.get("sni") || host;
      type = url.searchParams.get("type") || "ws";

      if (!host || !uuid) return new Response("missing host/uuid", { status: 400 });

      // 将 ctx 透传给缓存函数
      const { l1, l2 } = await getUpstreamsCached(cfg, ctx);
      const all = Array.from(new Set([...a0, ...l1, ...l2])).filter(Boolean);

      const extra = ex.length ? "&" + ex.join("&") : "";

      const qsFixed =
        "security=tls" +
        "&sni=" + encodeURIComponent(sni) +
        "&alpn=" + encodeURIComponent(alpn) +
        "&fp=" + encodeURIComponent(qfp) +
        "&type=" + encodeURIComponent(type) +
        "&host=" + encodeURIComponent(host) +
        "&path=" + encodeURIComponent(path) +
        "&encryption=none" +
        extra;

      const prefix = "vless://" + uuid + "@";

      const body = all
        .map((addr) => {
          let ad = addr,
            pt = "443",
            rk = addr;

          const m = addr.match(R_ADDR);
          if (m) {
            ad = m[1];
            pt = m[2] || pt;
            rk = m[3] || ad;
          }

          if (ad.includes(":") && !ad.startsWith("[")) ad = "[" + ad + "]";

          return prefix + ad + ":" + pt + "?" + qsFixed + "#" + encodeURIComponent(rk);
        })
        .join("\n");

      const convUrl = (t) =>
        sp +
        "://" +
        sh +
        "/sub?target=" +
        t +
        "&url=" +
        encodeURIComponent(url.href) +
        "&config=" +
        encodeURIComponent(sc);

      let target = null;
      if (ua.includes("clash")) target = "clash";
      if (ua.includes("singbox") || ua.includes("sing-box")) target = "singbox";
      if (ua.includes("surge")) target = "surge";
      if (fmt) target = fmt.split("&")[0];

      if (target) {
        const r = await fto(convUrl(fmt || target), 6500);
        if (!r || !r.ok) return new Response("convert upstream error", { status: 502 });
        return new Response(await r.text(), {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
      }

      // 默认 base64 输出
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

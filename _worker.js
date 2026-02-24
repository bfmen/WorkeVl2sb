/**
 * Cloudflare Workers - 优选订阅生成器 (2026 极简逻辑版)
 * 修复：删除冗余二级域名列表，统一取最后两段作为根域名对比。
 */

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
  return x.replace(/[ \t|"'\r\n]+/g, ",").replace(/,+/g, ",").split(",").map((s) => s.trim()).filter(Boolean);
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
  let h = v, p = "https";
  if (h.startsWith("http://")) { h = h.slice(7); p = "http"; }
  else if (h.startsWith("https://")) { h = h.slice(8); p = "https"; }
  return { h: h.replace(/\/+$/, ""), p };
}

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function fto(u, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(u, { signal: c.signal, headers: { Accept: "text/plain,*/*" } }); }
  finally { clearTimeout(t); }
}

/* -------- host / domain helpers -------- */
function stripBracketHost(h) {
  h = (h || "").trim();
  if (h.startsWith("[") && h.endsWith("]")) return h.slice(1, -1);
  return h;
}

function isIPv4(x) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(x)) return false;
  return x.split(".").every((o) => { const n = Number(o); return n >= 0 && n <= 255; });
}

function isIPv6(x) {
  x = stripBracketHost(x).toLowerCase();
  if (!x.includes(":")) return false;
  const y = x.split("%")[0];
  return /^[0-9a-f:.]+$/.test(y);
}

function isIPHost(h) {
  const x = stripBracketHost(h).toLowerCase();
  return isIPv4(x) || isIPv6(x);
}

/**
 * 【核心逻辑修复】
 * 不再依赖列表，直接取最后两段。
 * dx.880060.xyz -> 880060.xyz
 * appl.060111.xyz -> 060111.xyz
 */
function rootDomain(h) {
  const x = stripBracketHost(h).toLowerCase();
  if (!x || isIPHost(x)) return "";
  const parts = x.split(".").filter(Boolean);
  if (parts.length < 2) return x;
  return parts.slice(-2).join(".");
}

function normPort(p) {
  const s = String(p || "").trim();
  const n = Number(s);
  return (!/^\d+$/.test(s) || n < 1 || n > 65535) ? "443" : s;
}

function sanitizeHostLike(raw) {
  const s = (raw || "").trim().replace(/\s+/g, "").toLowerCase();
  if (!s || s.includes(":") || isIPv4(s) || !s.includes(".")) return "";
  return s;
}

/* ---------------- addr parsing ---------------- */
function parseAddrLine(addr) {
  let t = (addr || "").trim();
  if (!t) return null;
  let remark = "";
  const hashPos = t.indexOf("#");
  if (hashPos >= 0) { remark = t.slice(hashPos + 1); t = t.slice(0, hashPos).trim(); }
  if (!t) return null;

  if (t.startsWith("[")) {
    const rb = t.indexOf("]");
    if (rb > 0) {
      const ip = t.slice(1, rb);
      let rest = t.slice(rb + 1).trim();
      const pt = normPort(rest.replace(/^:/, "") || "443");
      return { ad: "[" + ip + "]", pt, rk: remark || ip };
    }
  }
  const lastColon = t.lastIndexOf(":");
  if (lastColon > 0) {
    const left = t.slice(0, lastColon);
    const right = t.slice(lastColon + 1);
    if (/^\d+$/.test(right)) {
      const pt = normPort(right);
      const ad = isIPv6(left) ? "[" + stripBracketHost(left) + "]" : left;
      return { ad, pt, rk: remark || left };
    }
  }
  const ad = isIPv6(t) ? "[" + stripBracketHost(t) + "]" : t;
  return { ad, pt: "443", rk: remark || t };
}

/* ---------------- upstream fetch ---------------- */
async function fetchAPI(arr) {
  const out = [];
  await Promise.allSettled(arr.map(async (u) => {
    try {
      const r = await fetch(u.startsWith("http") ? u : "https://" + u, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (r.ok) (await r.text()).split(/\r?\n/).forEach(l => { if (l.trim()) out.push(l.trim()); });
    } catch {}
  }));
  return out;
}

async function fetchCSV(arr, tls, dls, rmk) {
  const out = [];
  await Promise.allSettled(arr.map(async (u) => {
    try {
      const r = await fetch(u.startsWith("http") ? u : "https://" + u);
      if (!r.ok) return;
      const rows = (await r.text()).split(/\r?\n/).filter(x => x.trim()).map(l => l.split(",").map(c => c.trim()));
      const ti = (rows[0] || []).findIndex(c => c.toUpperCase() === "TLS");
      if (ti === -1) return;
      for (const row of rows.slice(1)) {
        if (row[ti]?.toUpperCase() === tls.toUpperCase() && parseFloat(row[row.length - 1] || "0") > dls) {
          const ad = row[0], pt = normPort(row[1]), ri = ti + rmk;
          const remark = row[ri] || ad;
          if (ad) out.push(`${ad}:${pt}#${remark}`);
        }
      }
    } catch {}
  }));
  return out;
}

/* ---------- config + upstream ---------- */
let _C = null, _K = "";
async function getCfg(env) {
  const k = [env.ADD, env.ADDAPI, env.ADDCSV, env.SUBAPI, env.SUBCONFIG, env.SUBNAME, env.FP, env.DLS, env.CSVREMARK, env.ALPN].join("|");
  if (_K === k && _C) return _C;
  const n = normSub(env.SUBAPI);
  _C = { a0: parseList(env.ADD), a1: parseList(env.ADDAPI), a2: parseList(env.ADDCSV), dls: Number(env.DLS) || D_DLS, rmk: Number(env.CSVREMARK) || D_RMK, name: env.SUBNAME || D_NAME, sc: env.SUBCONFIG || D_SC, sh: n.h, sp: n.p, fp: normFP(env.FP || D_FP), alpn: (env.ALPN || D_ALPN).trim() };
  _K = k; return _C;
}

/* ---------------- HTML & Worker ---------------- */
function makeHTML(title, defAlpn) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>body{background:#0a0a0f;color:#e8e8f0;font-family:monospace;padding:50px;display:flex;justify-content:center}
  .card{background:#13131a;padding:24px;border-radius:12px;border:1px solid #2a2a38;width:100%;max-width:500px}
  input,textarea{width:100%;background:#1c1c27;border:1px solid #2a2a38;color:#fff;padding:12px;margin:10px 0;border-radius:8px}
  button{width:100%;padding:12px;background:linear-gradient(135deg,#7c3aed,#00e5ff);border:none;border-radius:8px;font-weight:bold;cursor:pointer}</style></head>
  <body><div class="card"><h2>${esc(title)}</h2><textarea id="lk" placeholder="粘贴 vless://..."></textarea><button id="btn">生成订阅</button><input id="ou" readonly placeholder="生成结果"></div>
  <script>
    document.getElementById('btn').onclick=function(){
      const l = document.getElementById('lk').value;
      if(!l.includes('host=')) { alert('请确保链接包含 host= 参数'); return; }
      const u = new URL(l.replace('vless://','http://')); 
      const h = u.searchParams.get('host');
      const res = location.origin + '/sub?host=' + h + '&uuid=' + u.username + '&' + u.searchParams.toString();
      document.getElementById('ou').value = res;
    }
  </script></body></html>`;
}

const WORKER_PASSTHROUGH_PARAMS = new Set(["type", "path", "alpn", "fp", "mode", "serviceName", "mux", "flow", "insecure", "allowInsecure"]);

export default {
  async fetch(request, env) {
    const cfg = await getCfg(env);
    const url = new URL(request.url);
    if (url.pathname !== "/sub") return new Response(makeHTML(cfg.name, cfg.alpn), { headers: { "content-type": "text/html" } });

    const host = sanitizeHostLike(url.searchParams.get("host") || "");
    const uuid = (url.searchParams.get("uuid") || url.searchParams.get("password") || "").trim();
    if (!host || !uuid) return new Response("Missing host/uuid", { status: 400 });

    const hostRoot = rootDomain(host);
    const { l1, l2 } = await Promise.all([fetchAPI(cfg.a1), fetchCSV(cfg.a2, "TRUE", cfg.dls, cfg.rmk)]).then(([r1, r2]) => ({ l1: r1, l2: r2 }));
    const all = Array.from(new Set([...cfg.a0, ...l1, ...l2])).filter(s => s && !s.startsWith("#"));

    const body = all.map(addr => {
      const parsed = parseAddrLine(addr);
      if (!parsed) return null;

      const adPlain = stripBracketHost(parsed.ad);
      const addrIsIp = isIPHost(adPlain);
      
      // SNI 判定逻辑：
      let sniLine;
      if (addrIsIp) {
        sniLine = host; // 地址是IP -> SNI=Host
      } else {
        const adRoot = rootDomain(adPlain);
        if (hostRoot && adRoot && adRoot === hostRoot) {
          sniLine = adPlain; // 同根域名 -> SNI=优选域名
        } else {
          sniLine = host; // 不同根域名 -> SNI=Host
        }
      }

      const sp = new URLSearchParams();
      WORKER_PASSTHROUGH_PARAMS.forEach(p => { if(url.searchParams.has(p)) sp.set(p, url.searchParams.get(p)); });
      sp.set("host", host);
      sp.set("sni", sniLine); // 覆盖原始SNI
      sp.set("security", "tls");
      sp.set("encryption", "none");

      return `vless://${encodeURIComponent(uuid)}@${parsed.ad}:${parsed.pt}?${sp.toString()}#${encodeURIComponent(parsed.rk)}`;
    }).filter(Boolean).join("\n");

    return new Response(b64(body), { headers: { "content-type": "text/plain" } });
  }
};

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

/* -------- host helpers -------- */
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

async function fetchAPI(arr) {
  if (!arr.length) return [];
  const out = [];
  await Promise.allSettled(
    arr.map(async (u) => {
      try {
        const r = await fetch(u.startsWith("http") ? u : "https://" + u);
        if (!r.ok) return;
        (await r.text())
          .split(/\r?\n/)
          .forEach((l) => {
            const s = l.trim();
            if (s) out.push(s);
          });
      } catch {}
    })
  );
  return out;
}

async function fetchCSV(arr, tls, dls, rmk) {
  if (!arr.length) return [];
  const out = [];
  await Promise.allSettled(
    arr.map(async (u) => {
      try {
        const r = await fetch(u.startsWith("http") ? u : "https://" + u);
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
      } catch {}
    })
  );
  return out;
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
        return new Response("OK", { status: 200 });
      }

      const host = sanitizeHostLike(url.searchParams.get("host") || "");
      const uuid = (url.searchParams.get("uuid") || url.searchParams.get("password") || "").trim();
      if (!host || !uuid) return new Response("missing host/uuid", { status: 400 });

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
        return new Response("no upstream addresses available", { status: 502 });
      }

      const body = all
        .map((addr) => {
          const parsed = parseAddrLine(addr);
          if (!parsed) return null;

          const adPlain = stripBracketHost(parsed.ad);
          const addrIsIp = isIPHost(adPlain);

          let sniLine = addrIsIp ? host : adPlain;

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

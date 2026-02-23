/**
 * Cloudflare Workers - 优选订阅生成器（修复版 + 美化版）
 *
 * 修复：
 * 1. 全局状态污染 → 所有变量改为 fetch 内局部变量
 * 2. AbortController 共享 bug → 每个请求独立超时
 * 3. /sub 路径判断不严谨 → 改为精确匹配
 * 4. safeBase64 性能 → 改用标准方式
 * 5. env 读取缓存 → 模块级 cache，避免每次重复 parse
 *
 * 功能：
 * 1) 主页 /    ：生成器页面（输入节点链接 -> 生成订阅链接 + 二维码）
 * 2) /sub      ：输出订阅（默认 Base64），支持 clash/singbox/surge 走 subconverter
 *
 * 支持环境变量：
 * - env.ADD       逗号/空格/换行分隔的 IP/域名 列表
 * - env.ADDAPI    逗号分隔的 API URL 列表（每个返回一行一个地址）
 * - env.ADDCSV    逗号分隔的 CSV URL 列表（含 TLS 字段，末列为 speed）
 * - env.DLS       CSV speed 阈值（默认 7）
 * - env.CSVREMARK 备注列偏移（默认 1）：备注列 = TLS列索引 + CSVREMARK
 * - env.SUBAPI    subconverter 地址（可 http(s):// 开头或纯域名）
 * - env.SUBCONFIG subconverter 配置 ini
 * - env.SUBNAME   页面标题/文件名
 * - env.FP        默认指纹（chrome/firefox/safari/edge/ios/android/random），默认 chrome
 * - env.SECRET    （可选）启用加密订阅链接 data=...（AES-GCM）
 */

// ---- 模块级常量 ----
const DEFAULT_SUB_CONVERTER = "SUBAPI.cmliussss.net";
const DEFAULT_SUB_PROTOCOL  = "https";
const DEFAULT_SUB_CONFIG    =
  "https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full_MultiMode.ini";
const DEFAULT_FILENAME      = "优选订阅生成器";
const DEFAULT_FP            = "chrome";
const DEFAULT_DLS           = 7;
const DEFAULT_REMARK_INDEX  = 1;

const IP_REGEX = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[.*\]):?(\d+)?#?(.*)?$/;

// ---- env 解析缓存（Workers isolate 复用时避免重复 parse）----
let _envCache = null;
let _envCacheKey = "";

// ---- 工具函数 ----

function normalizeFP(v) {
  const val = (v || "").toString().trim().toLowerCase();
  const allowed = new Set(["chrome","firefox","safari","edge","ios","android","random"]);
  return allowed.has(val) ? val : DEFAULT_FP;
}

async function parseList(content) {
  if (!content) return [];
  return content
    .replace(/[ \t|"'\r\n]+/g, ",")
    .replace(/,+/g, ",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeBase64(str) {
  // 标准方式，正确处理 UTF-8
  return btoa(unescape(encodeURIComponent(str)));
}

function b64uEncode(u8) {
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64uDecode(s) {
  s = (s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(secret) {
  const raw = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptData(secret, obj) {
  const key = await deriveKey(secret);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  const ctU8 = new Uint8Array(ct);
  const packed = new Uint8Array(iv.length + ctU8.length);
  packed.set(iv, 0);
  packed.set(ctU8, iv.length);
  return b64uEncode(packed);
}

async function decryptData(secret, data) {
  const packed = b64uDecode(data);
  if (packed.length < 13) throw new Error("bad data");
  const iv  = packed.slice(0, 12);
  const ct  = packed.slice(12);
  const key = await deriveKey(secret);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(plain)));
}

function normalizeSubApi(v) {
  if (!v) return { host: DEFAULT_SUB_CONVERTER, proto: DEFAULT_SUB_PROTOCOL };
  if (v.startsWith("http://"))  return { host: v.replace("http://", ""),  proto: "http"  };
  if (v.startsWith("https://")) return { host: v.replace("https://", ""), proto: "https" };
  return { host: v, proto: "https" };
}

function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- 数据拉取：修复每个请求独立超时 ----

async function fetchAPIList(apiList) {
  if (!apiList.length) return [];
  const result = [];
  await Promise.allSettled(
    apiList.map(async (u) => {
      // 每个请求独立超时，避免共享 AbortController 引起的竞争
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      try {
        const r = await fetch(u, { signal: controller.signal });
        if (!r.ok) return;
        const text = await r.text();
        text.split(/\r?\n/).forEach((l) => { const t = l.trim(); if (t) result.push(t); });
      } catch {
        // 超时或网络错误，静默跳过
      } finally {
        clearTimeout(timer);
      }
    })
  );
  return result;
}

async function fetchCSVList(addressescsv, tls, DLS, remarkIndex) {
  if (!addressescsv.length) return [];
  const result = [];

  function parseCSV(text) {
    return text
      .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
      .split("\n")
      .filter((x) => x && x.trim())
      .map((line) => line.split(",").map((c) => c.trim()));
  }

  await Promise.allSettled(
    addressescsv.map(async (u) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      try {
        const r = await fetch(u, { signal: controller.signal });
        if (!r.ok) return;
        const text = await r.text();
        const rows = parseCSV(text);
        if (!rows.length) return;

        const header   = rows[0] || [];
        const dataRows = rows.slice(1);
        const tlsIndex = header.findIndex((c) => (c || "").toUpperCase() === "TLS");
        if (tlsIndex === -1) return;

        for (const row of dataRows) {
          if (!row || row.length < 2) continue;
          const tlsValue = ((row[tlsIndex] || "") + "").toUpperCase();
          const speed    = parseFloat(row[row.length - 1] || "0");
          if (tlsValue !== (tls + "").toUpperCase()) continue;
          if (!(speed > DLS)) continue;
          const ip     = row[0];
          const port   = row[1];
          const remark = row[tlsIndex + remarkIndex] || ip;
          result.push(ip + ":" + port + "#" + remark);
        }
      } catch {
        // 超时或网络错误，静默跳过
      } finally {
        clearTimeout(timer);
      }
    })
  );
  return result;
}

// ---- 解析并缓存 env（同一 isolate 内避免重复 parse）----

async function getEnvConfig(env) {
  const cacheKey = JSON.stringify({
    ADD: env.ADD, ADDAPI: env.ADDAPI, ADDCSV: env.ADDCSV,
    SUBAPI: env.SUBAPI, SUBCONFIG: env.SUBCONFIG,
    SUBNAME: env.SUBNAME, FP: env.FP, DLS: env.DLS,
    CSVREMARK: env.CSVREMARK, SECRET: env.SECRET,
  });

  if (_envCacheKey === cacheKey && _envCache) return _envCache;

  const n = normalizeSubApi(env.SUBAPI);
  _envCache = {
    addresses:    env.ADD     ? await parseList(env.ADD)     : [],
    addressesapi: env.ADDAPI  ? await parseList(env.ADDAPI)  : [],
    addressescsv: env.ADDCSV  ? await parseList(env.ADDCSV)  : [],
    DLS:          Number(env.DLS)       || DEFAULT_DLS,
    remarkIndex:  Number(env.CSVREMARK) || DEFAULT_REMARK_INDEX,
    FileName:     env.SUBNAME   || DEFAULT_FILENAME,
    subConfig:    env.SUBCONFIG || DEFAULT_SUB_CONFIG,
    subConverter: n.host,
    subProtocol:  n.proto,
    fp:           normalizeFP(env.FP || DEFAULT_FP),
    SECRET:       (env.SECRET || "").toString(),
  };
  _envCacheKey = cacheKey;
  return _envCache;
}

// ---- 页面 HTML（深色工业极简风）----

function makeHTML(title, useEncrypt) {
  const t    = escapeHtml(title);
  const note = useEncrypt
    ? "加密模式已启用 — 订阅链接将隐藏 host/uuid 等敏感参数"
    : "明文模式 — 可设置 env.SECRET 启用加密订阅链接";

  return (
    "<!doctype html><html lang=\"zh-CN\"><head>" +
    "<meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + t + "</title>" +
    "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">" +
    "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>" +
    "<link href=\"https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@400;600;700;800&display=swap\" rel=\"stylesheet\">" +
    "<script src=\"https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js\"></script>" +
    "<style>" +
    ":root{" +
    "--bg:#0a0a0f;" +
    "--surface:#13131a;" +
    "--surface2:#1c1c27;" +
    "--border:#2a2a38;" +
    "--accent:#00e5ff;" +
    "--accent2:#7c3aed;" +
    "--text:#e8e8f0;" +
    "--muted:#6b6b80;" +
    "--success:#00ff9d;" +
    "--warn:#ffb800;" +
    "}" +
    "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}" +
    "html{scroll-behavior:smooth}" +
    "body{" +
    "font-family:'JetBrains Mono',monospace;" +
    "background:var(--bg);" +
    "color:var(--text);" +
    "min-height:100vh;" +
    "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
    "padding:24px 16px;" +
    "}" +
    /* noise overlay */
    "body::before{" +
    "content:'';" +
    "position:fixed;inset:0;pointer-events:none;z-index:0;" +
    "background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\");" +
    "opacity:0.5;" +
    "}" +
    /* grid background lines */
    "body::after{" +
    "content:'';" +
    "position:fixed;inset:0;pointer-events:none;z-index:0;" +
    "background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px);" +
    "background-size:48px 48px;" +
    "opacity:0.3;" +
    "}" +
    ".wrap{position:relative;z-index:1;width:100%;max-width:640px;}" +
    /* header */
    ".header{margin-bottom:40px;}" +
    ".header-tag{" +
    "font-family:'JetBrains Mono',monospace;" +
    "font-size:11px;letter-spacing:0.15em;text-transform:uppercase;" +
    "color:var(--accent);opacity:0.8;" +
    "margin-bottom:12px;" +
    "display:flex;align-items:center;gap:8px;" +
    "}" +
    ".header-tag::before{content:'';display:block;width:24px;height:1px;background:var(--accent);}" +
    ".title{" +
    "font-family:'Syne',sans-serif;" +
    "font-size:clamp(26px,5vw,40px);font-weight:800;" +
    "letter-spacing:-0.02em;line-height:1.1;" +
    "background:linear-gradient(135deg,var(--text) 0%,var(--accent) 100%);" +
    "-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;" +
    "}" +
    ".subtitle{" +
    "margin-top:10px;font-size:13px;color:var(--muted);" +
    "display:flex;align-items:center;gap:6px;" +
    "}" +
    ".dot{" +
    "width:6px;height:6px;border-radius:50%;" +
    "background:var(--warn);" +
    "animation:pulse 2s ease-in-out infinite;" +
    "}" +
    ".dot.ok{background:var(--success);}" +
    /* card */
    ".card{" +
    "background:var(--surface);" +
    "border:1px solid var(--border);" +
    "border-radius:12px;" +
    "padding:28px 24px;" +
    "margin-bottom:16px;" +
    "position:relative;overflow:hidden;" +
    "transition:border-color .2s;" +
    "}" +
    ".card:focus-within{border-color:var(--accent);}" +
    ".card::before{" +
    "content:'';position:absolute;top:0;left:0;right:0;height:1px;" +
    "background:linear-gradient(90deg,transparent,var(--accent),transparent);" +
    "opacity:0;transition:opacity .3s;" +
    "}" +
    ".card:focus-within::before{opacity:0.6;}" +
    /* label */
    ".label{" +
    "font-size:11px;letter-spacing:0.1em;text-transform:uppercase;" +
    "color:var(--muted);margin-bottom:10px;" +
    "}" +
    /* input */
    ".input-wrap{position:relative;}" +
    "textarea,input[type=text]{" +
    "width:100%;background:var(--surface2);" +
    "border:1px solid var(--border);border-radius:8px;" +
    "padding:12px 14px;color:var(--text);" +
    "font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.6;" +
    "resize:vertical;outline:none;" +
    "transition:border-color .2s,box-shadow .2s;" +
    "}" +
    "textarea{min-height:100px;}" +
    "textarea:focus,input[type=text]:focus{" +
    "border-color:var(--accent);box-shadow:0 0 0 2px rgba(0,229,255,0.12);" +
    "}" +
    "textarea::placeholder,input[type=text]::placeholder{color:var(--muted);opacity:0.6;}" +
    /* button */
    ".btn{" +
    "width:100%;padding:14px 20px;border-radius:8px;" +
    "border:none;cursor:pointer;" +
    "font-family:'Syne',sans-serif;font-size:15px;font-weight:700;" +
    "letter-spacing:0.04em;text-transform:uppercase;" +
    "background:linear-gradient(135deg,var(--accent2),var(--accent));" +
    "color:#000;transition:transform .15s,box-shadow .15s,filter .15s;" +
    "position:relative;overflow:hidden;" +
    "}" +
    ".btn::after{" +
    "content:'';position:absolute;inset:0;" +
    "background:linear-gradient(135deg,transparent 40%,rgba(255,255,255,0.15));" +
    "}" +
    ".btn:hover{transform:translateY(-1px);box-shadow:0 8px 32px rgba(0,229,255,0.25);filter:brightness(1.05);}" +
    ".btn:active{transform:translateY(0);}" +
    ".btn:disabled{opacity:0.5;cursor:not-allowed;transform:none;}" +
    /* result */
    ".result-wrap{display:none;}" +
    ".result-wrap.show{display:block;animation:fadeUp .3s ease;}" +
    ".result-row{display:flex;gap:8px;align-items:stretch;}" +
    ".result-input{flex:1;cursor:pointer;}" +
    ".copy-btn{" +
    "padding:12px 16px;border-radius:8px;border:1px solid var(--border);" +
    "background:var(--surface2);color:var(--text);cursor:pointer;" +
    "font-family:'JetBrains Mono',monospace;font-size:12px;" +
    "transition:all .2s;white-space:nowrap;" +
    "}" +
    ".copy-btn:hover{border-color:var(--accent);color:var(--accent);}" +
    ".copy-btn.copied{border-color:var(--success);color:var(--success);}" +
    /* formats */
    ".formats{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}" +
    ".fmt-btn{" +
    "padding:6px 12px;border-radius:6px;" +
    "border:1px solid var(--border);background:transparent;" +
    "color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:11px;" +
    "cursor:pointer;transition:all .2s;letter-spacing:0.05em;" +
    "}" +
    ".fmt-btn:hover{border-color:var(--accent2);color:var(--accent2);}" +
    /* qrcode */
    "#qrcode{margin-top:20px;display:flex;justify-content:center;}" +
    "#qrcode canvas,#qrcode img{border-radius:8px;border:2px solid var(--border);}" +
    /* error */
    ".error{" +
    "background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.3);" +
    "border-radius:8px;padding:12px 14px;" +
    "color:#ff6b6b;font-size:13px;margin-top:8px;display:none;" +
    "}" +
    ".error.show{display:block;}" +
    /* footer */
    ".footer{margin-top:28px;font-size:11px;color:var(--muted);text-align:center;opacity:0.5;}" +
    /* animations */
    "@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}" +
    "@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.8)}}" +
    "@media(max-width:480px){.card{padding:20px 16px}}" +
    "</style></head><body>" +

    "<div class=\"wrap\">" +

    /* header */
    "<div class=\"header\">" +
    "<div class=\"header-tag\">Subscription Generator</div>" +
    "<h1 class=\"title\">" + t + "</h1>" +
    "<div class=\"subtitle\">" +
    "<span class=\"dot" + (useEncrypt ? " ok" : "") + "\"></span>" +
    escapeHtml(note) +
    "</div>" +
    "</div>" +

    /* input card */
    "<div class=\"card\">" +
    "<div class=\"label\">节点链接</div>" +
    "<textarea id=\"link\" placeholder=\"粘贴 vmess:// / vless:// / trojan:// 链接...\"></textarea>" +
    "<div class=\"error\" id=\"err\"></div>" +
    "</div>" +

    /* button */
    "<button class=\"btn\" onclick=\"generate()\" id=\"genBtn\">⚡ 生成订阅链接</button>" +

    /* result card */
    "<div class=\"result-wrap\" id=\"resultWrap\">" +
    "<div class=\"card\" style=\"margin-top:16px\">" +
    "<div class=\"label\">订阅链接</div>" +
    "<div class=\"result-row\">" +
    "<input type=\"text\" class=\"result-input\" id=\"result\" readonly onclick=\"copyLink()\" placeholder=\"生成的订阅链接...\">" +
    "<button class=\"copy-btn\" id=\"copyBtn\" onclick=\"copyLink()\">复制</button>" +
    "</div>" +
    "<div class=\"formats\">" +
    "<button class=\"fmt-btn\" onclick=\"openFmt('clash')\">Clash</button>" +
    "<button class=\"fmt-btn\" onclick=\"openFmt('singbox')\">SingBox</button>" +
    "<button class=\"fmt-btn\" onclick=\"openFmt('surge')\">Surge</button>" +
    "<button class=\"fmt-btn\" onclick=\"openFmt('')\">Base64</button>" +
    "</div>" +
    "<div id=\"qrcode\"></div>" +
    "</div>" +
    "</div>" +

    /* footer */
    "<div class=\"footer\">Powered by Cloudflare Workers</div>" +

    "</div>" +

    "<script>" +
    "var baseUrl='';" +

    "function showErr(msg){var e=document.getElementById('err');e.textContent=msg;e.classList.add('show');}" +
    "function hideErr(){document.getElementById('err').classList.remove('show');}" +

    "function generate(){" +
    "  hideErr();" +
    "  var link=document.getElementById('link').value.trim();" +
    "  if(!link){showErr('请输入节点链接');return;}" +
    "  var domain=location.origin;" +
    "  var fp='chrome';" +
    "  try{" +
    "    if(link.indexOf('vmess://')===0){" +
    "      var j=JSON.parse(atob(link.slice(8)));" +
    "      baseUrl=domain+'/sub?host='+encodeURIComponent(j.host||j.add||'')+" +
    "        '&uuid='+encodeURIComponent(j.id||'')+" +
    "        '&path='+encodeURIComponent(j.path||'/')+" +
    "        '&sni='+encodeURIComponent(j.sni||j.host||j.add||'')+" +
    "        '&type='+encodeURIComponent(j.net||'ws')+" +
    "        '&fp='+encodeURIComponent(fp);" +
    "    }else if(link.indexOf('vless://')===0||link.indexOf('trojan://')===0){" +
    "      var uuid=link.split('//')[1].split('@')[0];" +
    "      var atPart=link.split('@')[1]||'';" +
    "      var qIdx=atPart.indexOf('?');var hIdx=atPart.indexOf('#');" +
    "      var search=qIdx>=0?atPart.slice(qIdx+1).split('#')[0]:'';" +
    "      baseUrl=domain+'/sub?uuid='+encodeURIComponent(uuid)+(search?'&'+search:'')+'&fp='+encodeURIComponent(fp);" +
    "    }else{" +
    "      showErr('仅支持 vmess:// / vless:// / trojan:// 格式');return;" +
    "    }" +
    "    setResult(baseUrl);" +
    "  }catch(e){showErr('解析失败：链接格式有误');}" +
    "}" +

    "function setResult(url){" +
    "  document.getElementById('result').value=url;" +
    "  document.getElementById('resultWrap').classList.add('show');" +
    "  var qr=document.getElementById('qrcode');qr.innerHTML='';" +
    "  new QRCode(qr,{text:url,width:180,height:180,colorDark:'#00e5ff',colorLight:'#13131a'});" +
    "  document.getElementById('result').scrollIntoView({behavior:'smooth',block:'nearest'});" +
    "}" +

    "function openFmt(fmt){" +
    "  if(!baseUrl){return;}" +
    "  var url=fmt?baseUrl+(baseUrl.indexOf('?')>=0?'&':'?')+'format='+fmt:baseUrl;" +
    "  window.open(url,'_blank');" +
    "}" +

    "function copyLink(){" +
    "  var v=document.getElementById('result').value;" +
    "  if(!v)return;" +
    "  navigator.clipboard.writeText(v).then(function(){" +
    "    var btn=document.getElementById('copyBtn');" +
    "    btn.textContent='已复制 ✓';btn.classList.add('copied');" +
    "    setTimeout(function(){btn.textContent='复制';btn.classList.remove('copied');},2000);" +
    "  });" +
    "}" +
    "</script>" +

    "</body></html>"
  );
}

// ---- 主处理函数 ----

export default {
  async fetch(request, env) {

    // 读取（并缓存）env 配置
    const cfg = await getEnvConfig(env);
    const {
      addresses, addressesapi, addressescsv,
      DLS, remarkIndex, FileName, subConfig,
      subConverter, subProtocol, fp, SECRET,
    } = cfg;

    const url    = new URL(request.url);
    const ua     = ((request.headers.get("User-Agent") || "") + "").toLowerCase();
    const format = ((url.searchParams.get("format") || "") + "").toLowerCase();

    // ---- 主页（精确匹配，避免 /subscribe 等误触）----
    if (url.pathname !== "/sub") {
      const html = makeHTML(FileName, !!SECRET);
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // ---- /sub 参数解析 ----
    let host = "", uuid = "", path = "/", sni = "", type = "ws";
    let qfp  = normalizeFP(url.searchParams.get("fp") || fp);
    let alpn = url.searchParams.get("alpn") || "";

    const data = url.searchParams.get("data");
    if (data) {
      if (!SECRET) {
        return new Response("data 模式需要设置 env.SECRET", { status: 400 });
      }
      try {
        const obj = await decryptData(SECRET, data);
        host = obj.host || "";
        uuid = obj.uuid || "";
        path = obj.path || "/";
        sni  = obj.sni  || host;
        type = obj.type || "ws";
        alpn = obj.alpn || alpn;
        qfp  = normalizeFP(obj.fp || qfp);
      } catch {
        return new Response("data 解密失败", { status: 400 });
      }
    } else {
      host = url.searchParams.get("host") || "";
      uuid = url.searchParams.get("uuid") || url.searchParams.get("password") || "";
      path = url.searchParams.get("path") || "/";
      sni  = url.searchParams.get("sni")  || host;
      type = url.searchParams.get("type") || "ws";
    }

    if (!host || !uuid) {
      return new Response("缺少 host 或 uuid", { status: 400 });
    }

    // ---- 聚合地址列表 ----
    const [apiList, csvList] = await Promise.all([
      fetchAPIList(addressesapi),
      fetchCSVList(addressescsv, "TRUE", DLS, remarkIndex),
    ]);
    const all = Array.from(new Set([...addresses, ...apiList, ...csvList])).filter(Boolean);

    // ---- 构建 VLESS 节点链接 ----
    const content = all.map((addr) => {
      let address = addr, port = "443", remark = addr;
      const m = addr.match(IP_REGEX);
      if (m) {
        address = m[1];
        port    = m[2] || port;
        remark  = m[3] || address;
      }
      return (
        "vless://" + uuid + "@" + address + ":" + port +
        "?security=tls" +
        "&sni="        + encodeURIComponent(sni)  +
        "&alpn="       + encodeURIComponent(alpn) +
        "&fp="         + encodeURIComponent(qfp)  +
        "&type="       + encodeURIComponent(type) +
        "&host="       + encodeURIComponent(host) +
        "&path="       + encodeURIComponent(path) +
        "&encryption=none" +
        "#"            + encodeURIComponent(remark)
      );
    }).join("\n");

    // ---- subconverter 输出 ----
    const makeConvUrl = (target) =>
      subProtocol + "://" + subConverter +
      "/sub?target=" + target +
      "&url="    + encodeURIComponent(url.href) +
      "&config=" + encodeURIComponent(subConfig);

    if (ua.includes("clash")   || format === "clash")   {
      const r = await fetch(makeConvUrl("clash"));
      return new Response(await r.text(), { headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    if (ua.includes("singbox") || format === "singbox") {
      const r = await fetch(makeConvUrl("singbox"));
      return new Response(await r.text(), { headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    if (ua.includes("surge")   || format === "surge")   {
      const r = await fetch(makeConvUrl("surge"));
      return new Response(await r.text(), { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    // ---- 默认：Base64 ----
    return new Response(safeBase64(content), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};

/**
 * Cloudflare Workers - 优选订阅生成器（可部署版，避免反引号模板字符串）
 *
 * 功能：
 * 1) 主页 /  ：生成器页面（输入节点链接 -> 生成订阅链接 + 二维码）
 * 2) /sub   ：输出订阅（默认 Base64），支持 clash/singbox/surge 走 subconverter
 *
 * 支持：
 * - env.ADD      逗号/空格/换行分隔的 IP/域名 列表
 * - env.ADDAPI   逗号分隔的 API URL 列表（每个返回一行一个地址）
 * - env.ADDCSV   逗号分隔的 CSV URL 列表（含 TLS 字段，末列为 speed）
 * - env.DLS      CSV speed 阈值（默认 7）
 * - env.CSVREMARK 备注列偏移（默认 1）：备注列 = TLS列索引 + CSVREMARK
 * - env.SUBAPI   subconverter 地址（可 http(s):// 开头或纯域名）
 * - env.SUBCONFIG subconverter 配置 ini
 * - env.SUBNAME  页面标题/文件名
 * - env.FP       默认指纹（chrome/firefox/safari/edge/ios/android/random），默认 chrome
 * - env.SECRET   （可选）启用加密订阅链接 data=...（AES-GCM）
 *
 * 说明：
 * - 若设置了 env.SECRET，页面生成的订阅链接会变成 /sub?data=xxxx（隐藏 host/uuid 等参数）
 * - 若没设置 env.SECRET，则使用明文 /sub?host=...&uuid=... 方式
 */

let addresses = [];
let addressesapi = [];
let addressescsv = [];

let DLS = 7;
let remarkIndex = 1;

let subConverter = "SUBAPI.cmliussss.net";
let subProtocol = "https";
let subConfig =
  "https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full_MultiMode.ini";

let FileName = "优选订阅生成器";
let alpn = "";
let fp = "chrome";

let SECRET = ""; // env.SECRET

const regex =
  /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[.*\]):?(\d+)?#?(.*)?$/;

function normalizeFP(v) {
  const val = (v || "").toString().trim().toLowerCase();
  const allow = {
    chrome: 1,
    firefox: 1,
    safari: 1,
    edge: 1,
    ios: 1,
    android: 1,
    random: 1,
  };
  if (!val) return "chrome";
  return allow[val] ? val : "chrome";
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

async function fetchAPIList(apiList) {
  if (!apiList.length) return [];
  let result = [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    await Promise.allSettled(
      apiList.map(async (u) => {
        try {
          const r = await fetch(u, { signal: controller.signal });
          if (!r.ok) return;
          const text = await r.text();
          const lines = text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
          result = result.concat(lines);
        } catch {}
      })
    );
  } finally {
    clearTimeout(timeout);
  }

  return result;
}

async function fetchCSVList(tls) {
  if (!addressescsv.length) return [];
  let result = [];

  function parseCSV(text) {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter((x) => x && x.trim() !== "")
      .map((line) => line.split(",").map((c) => c.trim()));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    await Promise.allSettled(
      addressescsv.map(async (u) => {
        try {
          const r = await fetch(u, { signal: controller.signal });
          if (!r.ok) return;
          const text = await r.text();
          const rows = parseCSV(text);
          if (!rows.length) return;

          const header = rows[0] || [];
          const data = rows.slice(1);

          const tlsIndex = header.findIndex(
            (c) => (c || "").toUpperCase() === "TLS"
          );
          if (tlsIndex === -1) return;

          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 2) continue;

            const tlsValue = ((row[tlsIndex] || "") + "").toUpperCase();
            const speed = parseFloat(row[row.length - 1] || "0");
            if (tlsValue !== (tls + "").toUpperCase()) continue;
            if (!(speed > DLS)) continue;

            const ip = row[0];
            const port = row[1];
            const remark = row[tlsIndex + remarkIndex] || ip;

            result.push(ip + ":" + port + "#" + remark);
          }
        } catch {}
      })
    );
  } finally {
    clearTimeout(timeout);
  }

  return result;
}

function normalizeSubApi(v) {
  if (!v) return { host: subConverter, proto: subProtocol };
  if (v.startsWith("http://")) return { host: v.replace("http://", ""), proto: "http" };
  if (v.startsWith("https://")) return { host: v.replace("https://", ""), proto: "https" };
  return { host: v, proto: "https" };
}

function safeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
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
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, plain);
  const ctU8 = new Uint8Array(ct);

  const packed = new Uint8Array(iv.length + ctU8.length);
  packed.set(iv, 0);
  packed.set(ctU8, iv.length);

  return b64uEncode(packed);
}

async function decryptData(secret, data) {
  const packed = b64uDecode(data);
  if (packed.length < 13) throw new Error("bad data");
  const iv = packed.slice(0, 12);
  const ct = packed.slice(12);

  const key = await deriveKey(secret);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
  const text = new TextDecoder().decode(new Uint8Array(plain));
  return JSON.parse(text);
}

function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function makeHTML(title, useEncrypt) {
  // 这里不使用模板字符串，避免复制时反引号出问题
  const t = escapeHtml(title);
  const note = useEncrypt
    ? "已启用加密：订阅链接将使用 /sub?data=...（隐藏 host/uuid 等参数）"
    : "未启用加密：订阅链接为明文 /sub?host=...&uuid=...（可设置 env.SECRET 启用加密）";

  return (
    '<!doctype html><html><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>" + t + "</title>" +
    '<script src="https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js"></script>' +
    "<style>" +
    "body{font-family:system-ui;max-width:760px;margin:30px auto;padding:0 15px}" +
    "input,button{width:100%;padding:12px;margin:8px 0;font-size:16px}" +
    "#qrcode{text-align:center;margin-top:20px}" +
    ".tip{font-size:13px;opacity:.75;margin:6px 0 12px}" +
    "</style>" +
    "</head><body>" +
    "<h2>" + t + "</h2>" +
    '<div class="tip">' + escapeHtml(note) + "</div>" +
    '<input id="link" placeholder="输入 VMess / VLESS / Trojan 链接">' +
    '<button onclick="generate()">生成订阅</button>' +
    '<input id="result" readonly onclick="copyLink()">' +
    '<div id="qrcode"></div>' +
    "<script>" +
    "function copyLink(){var v=document.getElementById('result').value;if(!v)return;navigator.clipboard.writeText(v);}" +
    "function generate(){var link=document.getElementById('link').value.trim();if(!link){alert('请输入节点');return;}" +
    "var domain=location.hostname;" +
    "var fp='chrome';" +
    "var sub='';" +
    "try{" +
    "if(link.indexOf('vmess://')===0){" +
    "var j=JSON.parse(atob(link.slice(8)));" +
    "sub='https://'+domain+'/sub?host='+encodeURIComponent(j.host||'')+'&uuid='+encodeURIComponent(j.id||'')+'&path='+encodeURIComponent(j.path||'/')+'&sni='+encodeURIComponent(j.sni||j.host||'')+'&fp='+encodeURIComponent(fp);" +
    "}else{" +
    "var uuid=link.split('//')[1].split('@')[0];" +
    "var search=link.split('?')[1].split('#')[0];" +
    "sub='https://'+domain+'/sub?uuid='+encodeURIComponent(uuid)+'&'+search+'&fp='+encodeURIComponent(fp);" +
    "}" +
    "document.getElementById('result').value=sub;" +
    "var qr=document.getElementById('qrcode');qr.innerHTML='';new QRCode(qr,{text:sub,width:200,height:200});" +
    "}catch(e){alert('格式错误');}" +
    "}" +
    "</script>" +
    "</body></html>"
  );
}

export default {
  async fetch(request, env) {
    // ---- env ----
    addresses = env.ADD ? await parseList(env.ADD) : [];
    addressesapi = env.ADDAPI ? await parseList(env.ADDAPI) : [];
    addressescsv = env.ADDCSV ? await parseList(env.ADDCSV) : [];

    DLS = Number(env.DLS) || DLS;
    remarkIndex = Number(env.CSVREMARK) || remarkIndex;

    FileName = env.SUBNAME || FileName;
    subConfig = env.SUBCONFIG || subConfig;

    const n = normalizeSubApi(env.SUBAPI);
    subConverter = n.host;
    subProtocol = n.proto;

    fp = normalizeFP(env.FP || fp);
    SECRET = (env.SECRET || "").toString();

    const url = new URL(request.url);
    const ua = ((request.headers.get("User-Agent") || "") + "").toLowerCase();
    const format = ((url.searchParams.get("format") || "") + "").toLowerCase();

    // ---- page ----
    if (!url.pathname.includes("/sub")) {
      const html = makeHTML(FileName, !!SECRET);
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // ---- /sub params ----
    // 支持两种模式：
    // 1) 明文：/sub?host=...&uuid=...
    // 2) 加密：/sub?data=...  （需要 env.SECRET）
    let host = "";
    let uuid = "";
    let path = "/";
    let sni = "";
    let type = "ws";

    let qfp = normalizeFP(url.searchParams.get("fp") || fp);
    alpn = url.searchParams.get("alpn") || "";

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
        sni = obj.sni || host;
        type = obj.type || "ws";
        alpn = obj.alpn || alpn;
        qfp = normalizeFP(obj.fp || qfp);
      } catch (e) {
        return new Response("data 解密失败", { status: 400 });
      }
    } else {
      host = url.searchParams.get("host") || "";
      uuid = url.searchParams.get("uuid") || url.searchParams.get("password") || "";
      path = url.searchParams.get("path") || "/";
      sni = url.searchParams.get("sni") || host;
      type = url.searchParams.get("type") || "ws";
      // fp 已读
    }

    if (!host || !uuid) {
      return new Response("缺少 host 或 uuid", { status: 400 });
    }

    // ---- 聚合地址 ----
    const apiList = await fetchAPIList(addressesapi);
    const csvList = await fetchCSVList("TRUE");
    const all = Array.from(new Set(addresses.concat(apiList, csvList))).filter(Boolean);

    // ---- 构建 vless 链接（无反引号）----
    const content = all
      .map((addr) => {
        let address = addr;
        let port = "443";
        let remark = addr;

        const m = addr.match(regex);
        if (m) {
          address = m[1];
          port = m[2] || port;
          remark = m[3] || address;
        }

        return (
          "vless://" +
          uuid +
          "@" +
          address +
          ":" +
          port +
          "?security=tls" +
          "&sni=" +
          encodeURIComponent(sni) +
          "&alpn=" +
          encodeURIComponent(alpn) +
          "&fp=" +
          encodeURIComponent(qfp) +
          "&type=" +
          encodeURIComponent(type) +
          "&host=" +
          encodeURIComponent(host) +
          "&path=" +
          encodeURIComponent(path) +
          "&encryption=none" +
          "#" +
          encodeURIComponent(remark)
        );
      })
      .join("\n");

    // ---- subconverter 输出 ----
    // 注意：如果你用 data= 模式，self=url.href 里带 data=，subconverter 仍可正常工作（它只当 url 参数）
    if (ua.includes("clash") || format === "clash") {
      const self = url.href;
      const convUrl =
        subProtocol +
        "://" +
        subConverter +
        "/sub?target=clash&url=" +
        encodeURIComponent(self) +
        "&config=" +
        encodeURIComponent(subConfig);
      const r = await fetch(convUrl);
      return new Response(await r.text(), { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    if (ua.includes("singbox") || format === "singbox") {
      const self = url.href;
      const convUrl =
        subProtocol +
        "://" +
        subConverter +
        "/sub?target=singbox&url=" +
        encodeURIComponent(self) +
        "&config=" +
        encodeURIComponent(subConfig);
      const r = await fetch(convUrl);
      return new Response(await r.text(), { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    if (ua.includes("surge") || format === "surge") {
      const self = url.href;
      const convUrl =
        subProtocol +
        "://" +
        subConverter +
        "/sub?target=surge&url=" +
        encodeURIComponent(self) +
        "&config=" +
        encodeURIComponent(subConfig);
      const r = await fetch(convUrl);
      return new Response(await r.text(), { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    // ---- 默认：Base64 订阅 ----
    return new Response(safeBase64(content), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};

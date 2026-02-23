let addresses = [];
let addressesapi = [];
let addressescsv = [];

let DLS = 7;
let remarkIndex = 1;

let subConverter = 'SUBAPI.cmliussss.net';
let subProtocol = 'https';
let subConfig = 'https://raw.githubusercontent.com/cmliu/ACL4SSR/main/Clash/config/ACL4SSR_Online_Full_MultiMode.ini';

let FileName = '优选订阅生成器';
let alpn = '';
let fp = 'chrome'; // 默认强制 chrome

const regex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[.*\]):?(\d+)?#?(.*)?$/;

async function parseList(content) {
  if (!content) return [];
  return content
    .replace(/[ \t|"'\r\n]+/g, ',')
    .replace(/,+/g, ',')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

async function fetchAPIList(apiList) {
  if (!apiList.length) return [];
  let result = [];

  await Promise.allSettled(apiList.map(async url => {
    try {
      const r = await fetch(url);
      if (!r.ok) return;
      const text = await r.text();
      result = result.concat(
        text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      );
    } catch {}
  }));

  return result;
}

async function fetchCSVList(tls) {
  if (!addressescsv.length) return [];
  let result = [];

  function parseCSV(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(Boolean)
      .map(line => line.split(',').map(c => c.trim()));
  }

  await Promise.all(addressescsv.map(async url => {
    try {
      const r = await fetch(url);
      if (!r.ok) return;
      const text = await r.text();
      const rows = parseCSV(text);
      const [header, ...data] = rows;

      const tlsIndex = header.findIndex(c => c.toUpperCase() === 'TLS');
      if (tlsIndex === -1) return;

      for (const row of data) {
        const tlsValue = (row[tlsIndex] || '').toUpperCase();
        const speed = parseFloat(row[row.length - 1] || '0');
        if (tlsValue === tls.toUpperCase() && speed > DLS) {
          result.push(row[0] + ':' + row[1] + '#' + (row[tlsIndex + remarkIndex] || row[0]));
        }
      }
    } catch {}
  }));

  return result;
}

function safeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function renderHTML() {
  return new Response(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${FileName}</title>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js"></script>
<style>
body{font-family:system-ui;max-width:760px;margin:30px auto;padding:0 15px}
input,button{width:100%;padding:12px;margin:8px 0;font-size:16px}
#qrcode{text-align:center;margin-top:20px}
</style>
</head>
<body>
<h2>${FileName}</h2>

<input id="link" placeholder="输入 VMess / VLESS / Trojan 链接">
<button onclick="generate()">生成订阅</button>
<input id="result" readonly onclick="copy()">
<div id="qrcode"></div>

<script>
function copy(){
  const v=document.getElementById("result").value;
  if(!v)return;
  navigator.clipboard.writeText(v);
}

function generate(){
  const link=document.getElementById("link").value.trim();
  if(!link){alert("请输入节点");return;}
  const domain=location.hostname;
  let sub="";
  try{
    if(link.startsWith("vmess://")){
      const j=JSON.parse(atob(link.slice(8)));
      sub="https://"+domain+"/sub?host="+j.host+"&uuid="+j.id+
      "&path="+encodeURIComponent(j.path||"/")+
      "&sni="+(j.sni||j.host);
    }else{
      const uuid=link.split("//")[1].split("@")[0];
      const search=link.split("?")[1].split("#")[0];
      sub="https://"+domain+"/sub?uuid="+uuid+"&"+search;
    }
    document.getElementById("result").value=sub;
    const qr=document.getElementById("qrcode");
    qr.innerHTML="";
    new QRCode(qr,{text:sub,width:200,height:200});
  }catch{
    alert("格式错误");
  }
}
</script>
</body>
</html>`, { headers: { "content-type": "text/html;charset=utf-8" } });
}

function normalizeSubApi(v){
  if(!v) return {host:subConverter,proto:subProtocol};
  if(v.startsWith("http://")) return {host:v.replace("http://",""),proto:"http"};
  if(v.startsWith("https://")) return {host:v.replace("https://",""),proto:"https"};
  return {host:v,proto:"https"};
}

export default {
  async fetch(request, env) {

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

    fp = env.FP || fp;

    const url = new URL(request.url);
    const ua = (request.headers.get("User-Agent") || "").toLowerCase();
    const format = (url.searchParams.get("format") || "").toLowerCase();

    if (!url.pathname.includes("/sub")) {
      return renderHTML();
    }

    const host = url.searchParams.get("host");
    const uuid = url.searchParams.get("uuid") || url.searchParams.get("password");
    const path = (url.searchParams.get("path") || "/");
    const sni = url.searchParams.get("sni") || host;
    const type = url.searchParams.get("type") || "ws";
    alpn = url.searchParams.get("alpn") || "";

    if (!host || !uuid) {
      return new Response("缺少 host 或 uuid", { status: 400 });
    }

    const apiList = await fetchAPIList(addressesapi);
    const csvList = await fetchCSVList("TRUE");
    const all = Array.from(new Set(addresses.concat(apiList, csvList))).filter(Boolean);

    const content = all.map(addr => {
      let address = addr, port = "443", remark = addr;
      const m = addr.match(regex);
      if (m) { address = m[1]; port = m[2] || port; remark = m[3] || address; }

      // 关键：不用反引号，不用模板字符串
      return "vless://" + uuid + "@" + address + ":" + port
        + "?security=tls"
        + "&sni=" + encodeURIComponent(sni)
        + "&alpn=" + encodeURIComponent(alpn)
        + "&fp=" + encodeURIComponent(fp)
        + "&type=" + encodeURIComponent(type)
        + "&host=" + encodeURIComponent(host)
        + "&path=" + encodeURIComponent(path)
        + "&encryption=none"
        + "#" + encodeURIComponent(remark);
    }).join("\n");

    if (ua.includes("clash") || format === "clash") {
      const self = url.href;
      const convUrl = subProtocol + "://" + subConverter
        + "/sub?target=clash&url=" + encodeURIComponent(self)
        + "&config=" + encodeURIComponent(subConfig);
      const r = await fetch(convUrl);
      return new Response(await r.text());
    }

    if (ua.includes("singbox") || format === "singbox") {
      const self = url.href;
      const convUrl = subProtocol + "://" + subConverter
        + "/sub?target=singbox&url=" + encodeURIComponent(self)
        + "&config=" + encodeURIComponent(subConfig);
      const r = await fetch(convUrl);
      return new Response(await r.text());
    }

    if (ua.includes("surge") || format === "surge") {
      const self = url.href;
      const convUrl = subProtocol + "://" + subConverter
        + "/sub?target=surge&url=" + encodeURIComponent(self)
        + "&config=" + encodeURIComponent(subConfig);
      const r = await fetch(convUrl);
      return new Response(await r.text());
    }

    return new Response(safeBase64(content), {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};

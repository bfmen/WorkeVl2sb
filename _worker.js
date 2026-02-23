// ===== 只保留：优选订阅生成器页面 + /sub 优选订阅转换输出 =====
// - 已移除“内置节点/快速入口(TOKEN/HOST/UUID/KEY/PASSWORD/...)”相关代码
// - 支持 fp 指定：默认 chrome，可 env.FP 覆盖，也可 /sub?fp= 覆盖（白名单兜底）

let addresses = [];
let addressesapi = [];

let addressesnotls = [];
let addressesnotlsapi = [];

let addressescsv = [];
let DLS = 7;
let remarkIndex = 1; // CSV备注所在列偏移量

let subConverter = 'SUBAPI.cmliussss.net';
let subConfig = atob(
  'aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL2NtbGl1L0FDTDRTU1IvbWFpbi9DbGFzaC9jb25maWcvQUNMNFNTUl9PbmxpbmVfRnVsbF9NdWx0aU1vZGUuaW5p'
);
let subProtocol = 'https';
let noTLS = 'false';
let link;

let 隧道版本作者 = atob('ZWQ=');
let 获取代理IP;

let proxyIPs = [atob('cHJveHlpcC5meHhrLmRlZHluLmlv')];
let 匹配PROXYIP = [];
let socks5DataURL = '';
let BotToken = '';
let ChatID = '';
let 临时中转域名 = [];
let 临时中转域名接口 = '';
let EndPS = '';
let 协议类型 = atob(`\u0056\u006b\u0078\u0046\u0055\u0031\u004d\u003d`); // 默认 VLESS
let FileName = '优选订阅生成器';
let SUBUpdateTime = 6;
let total = 24;
let timestamp = 4102329600000;

const regex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[.*\]):?(\d+)?#?(.*)?$/;
let fakeUserID;
let fakeHostName;

let httpsPorts = ['2053', '2083', '2087', '2096', '8443'];
let MamaJustKilledAMan = ['telegram', 'twitter', 'miaoko'];
let proxyIPPool = [];
let socks5Data;
let alpn = '';

let 网络备案 = `<a href='https://t.me/CMLiussss'>萌ICP备-20240707号</a>`;
let 额外ID = '0';
let 加密方式 = 'auto';
let 网站图标,
  网站头像,
  网站背景,
  xhttp = '';

let fp = 'chrome'; // ✅ 默认 Chrome 指纹

function normalizeFP(v) {
  const val = (v ?? '').toString().trim().toLowerCase();
  const allow = new Set(['chrome', 'firefox', 'safari', 'edge', 'ios', 'android', 'random']);
  if (!val) return 'chrome';
  return allow.has(val) ? val : 'chrome';
}

async function 整理(内容) {
  var 替换后的内容 = 内容.replace(/[\t|"'\r\n]+/g, ',').replace(/,+/g, ',');
  if (替换后的内容.charAt(0) == ',') 替换后的内容 = 替换后的内容.slice(1);
  if (替换后的内容.charAt(替换后的内容.length - 1) == ',')
    替换后的内容 = 替换后的内容.slice(0, 替换后的内容.length - 1);
  return 替换后的内容.split(',');
}

async function 整理优选列表(api) {
  if (!api || api.length === 0) return [];
  let newapi = '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const responses = await Promise.allSettled(
      api.map((apiUrl) =>
        fetch(apiUrl, {
          method: 'get',
          headers: {
            Accept: 'text/html,application/xhtml+xml,application/xml;',
            'User-Agent': FileName + atob('IChodHRwczovL2dpdGh1Yi5jb20vY21saXUvV29ya2VyVmxlc3Myc3ViKQ=='),
          },
          signal: controller.signal,
        }).then((response) => (response.ok ? response.text() : Promise.reject()))
      )
    );

    for (const [index, response] of responses.entries()) {
      if (response.status !== 'fulfilled') continue;
      const content = await response.value;

      const lines = content.split(/\r?\n/);
      let 节点备注 = '';
      let 测速端口 = '443';

      if (lines[0]?.split(',')?.length > 3) {
        const idMatch = api[index].match(/id=([^&]*)/);
        if (idMatch) 节点备注 = idMatch[1];

        const portMatch = api[index].match(/port=([^&]*)/);
        if (portMatch) 测速端口 = portMatch[1];

        for (let i = 1; i < lines.length; i++) {
          const columns = lines[i].split(',')[0];
          if (!columns) continue;
          newapi += `${columns}:${测速端口}${节点备注 ? `#${节点备注}` : ''}\n`;
          if (api[index].includes('proxyip=true')) proxyIPPool.push(`${columns}:${测速端口}`);
        }
      } else {
        if (api[index].includes('proxyip=true')) {
          proxyIPPool = proxyIPPool
            .concat(
              (await 整理(content))
                .map((item) => {
                  const baseItem = item.split('#')[0] || item;
                  if (baseItem.includes(':')) {
                    const port = baseItem.split(':')[1];
                    if (!httpsPorts.includes(port)) return baseItem;
                  } else {
                    return `${baseItem}:443`;
                  }
                  return null;
                })
                .filter(Boolean)
            )
            .filter(Boolean);
        }
        newapi += content + '\n';
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    clearTimeout(timeout);
  }

  return await 整理(newapi);
}

async function 整理测速结果(tls) {
  if (!tls) return [];
  if (!Array.isArray(addressescsv) || addressescsv.length === 0) return [];

  function parseCSV(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => line.split(',').map((cell) => cell.trim()));
  }

  const csvPromises = addressescsv.map(async (csvUrl) => {
    try {
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`);

      const text = await response.text();
      const rows = parseCSV(text);

      const [header, ...dataRows] = rows;
      const tlsIndex = header.findIndex((col) => col.toUpperCase() === 'TLS');
      if (tlsIndex === -1) throw new Error('CSV文件缺少必需的字段');

      return dataRows
        .filter((row) => {
          const tlsValue = row[tlsIndex].toUpperCase();
          const speed = parseFloat(row[row.length - 1]);
          return tlsValue === tls.toUpperCase() && speed > DLS;
        })
        .map((row) => {
          const ipAddress = row[0];
          const port = row[1];
          const dataCenter = row[tlsIndex + remarkIndex];
          const formattedAddress = `${ipAddress}:${port}#${dataCenter}`;

          if (
            csvUrl.includes('proxyip=true') &&
            row[tlsIndex].toUpperCase() === 'TRUE' &&
            !httpsPorts.includes(port)
          ) {
            proxyIPPool.push(`${ipAddress}:${port}`);
          }

          return formattedAddress;
        });
    } catch (e) {
      console.error(`处理CSV ${csvUrl} 时出错:`, e);
      return [];
    }
  });

  const results = await Promise.all(csvPromises);
  return results.flat();
}

async function sendMessage(type, ip, add_data = '') {
  if (!BotToken || !ChatID) return;
  try {
    let msg = '';
    const response = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`);
    if (response.ok) {
      const ipInfo = await response.json();
      msg = `${type}\nIP: ${ip}\n国家: ${ipInfo.country}\n<tg-spoiler>城市: ${ipInfo.city}\n组织: ${ipInfo.org}\nASN: ${ipInfo.as}\n${add_data}`;
    } else {
      msg = `${type}\nIP: ${ip}\n<tg-spoiler>${add_data}`;
    }
    const url = `https://api.telegram.org/bot${BotToken}/sendMessage?chat_id=${ChatID}&parse_mode=HTML&text=${encodeURIComponent(
      msg
    )}`;
    return fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 Chrome/90.0.4430.72',
      },
    });
  } catch (e) {
    console.error('Error sending message:', e);
  }
}

async function nginx() {
  return `
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
  body { width: 35em; margin: 0 auto; font-family: Tahoma, Verdana, Arial, sans-serif; }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and working. Further configuration is required.</p>
<p>For online documentation and support please refer to <a href="http://nginx.org/">nginx.org</a>.<br/>
Commercial support is available at <a href="http://nginx.com/">nginx.com</a>.</p>
<p><em>Thank you for using nginx.</em></p>
</body>
</html>`;
}

function surge(content, url, path) {
  let 每行内容 = content.includes('\r\n') ? content.split('\r\n') : content.split('\n');
  let 输出内容 = '';
  for (let x of 每行内容) {
    if (x.includes(atob(atob('UFNCMGNtOXFZVzRz')))) {
      const host = x.split('sni=')[1].split(',')[0];
      const 备改内容 = `skip-cert-verify=true, tfo=false, udp-relay=false`;
      const 正确内容 = `skip-cert-verify=true, ws=true, ws-path=${path}, ws-headers=Host:"${host}", tfo=false, udp-relay=false`;
      输出内容 += x.replace(new RegExp(备改内容, 'g'), 正确内容).replace('[', '').replace(']', '') + '\n';
    } else {
      输出内容 += x + '\n';
    }
  }
  输出内容 = `#!MANAGED-CONFIG ${url.href} interval=86400 strict=false` + 输出内容.substring(输出内容.indexOf('\n'));
  return 输出内容;
}

function getRandomProxyByMatch(CC, socks5Data) {
  const lowerCaseMatch = CC.toLowerCase();
  let filteredProxies = socks5Data.filter((proxy) => proxy.toLowerCase().endsWith(`#${lowerCaseMatch}`));
  if (filteredProxies.length === 0) filteredProxies = socks5Data.filter((proxy) => proxy.toLowerCase().endsWith(`#us`));
  if (filteredProxies.length === 0) return socks5Data[Math.floor(Math.random() * socks5Data.length)];
  return filteredProxies[Math.floor(Math.random() * filteredProxies.length)];
}

async function MD5MD5(text) {
  const encoder = new TextEncoder();
  const firstPass = await crypto.subtle.digest('MD5', encoder.encode(text));
  const firstPassArray = Array.from(new Uint8Array(firstPass));
  const firstHex = firstPassArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  const secondPass = await crypto.subtle.digest('MD5', encoder.encode(firstHex.slice(7, 27)));
  const secondPassArray = Array.from(new Uint8Array(secondPass));
  const secondHex = secondPassArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return secondHex.toLowerCase();
}

function revertFakeInfo(content, userID, hostName) {
  return content.replace(new RegExp(fakeUserID, 'g'), userID).replace(new RegExp(fakeHostName, 'g'), hostName);
}

function generateFakeInfo(content, userID, hostName) {
  return content.replace(new RegExp(userID, 'g'), fakeUserID).replace(new RegExp(hostName, 'g'), fakeHostName);
}

function isValidIPv4(address) {
  const ipv4Regex =
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(address);
}

async function getLink(重新汇总所有链接) {
  let 节点LINK = [];
  let 订阅链接 = [];

  for (let x of 重新汇总所有链接) {
    if (x.toLowerCase().startsWith('http')) 订阅链接.push(x);
    else 节点LINK.push(x);
  }

  if (订阅链接.length !== 0) {
    function base64Decode(str) {
      const bytes = new Uint8Array(atob(str).split('').map((c) => c.charCodeAt(0)));
      return new TextDecoder('utf-8').decode(bytes);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      const responses = await Promise.allSettled(
        订阅链接.map((apiUrl) =>
          fetch(apiUrl, {
            method: 'get',
            headers: {
              Accept: 'text/html,application/xhtml+xml,application/xml;',
              'User-Agent': 'v2rayN/' + FileName + ' (https://github.com/cmliu/WorkerVless2sub)',
            },
            signal: controller.signal,
          }).then((response) => (response.ok ? response.text() : Promise.reject()))
        )
      );

      const modifiedResponses = responses.map((response, index) => ({
        status: response.status,
        value: response.status === 'fulfilled' ? response.value : null,
        apiUrl: 订阅链接[index],
      }));

      for (const response of modifiedResponses) {
        if (response.status !== 'fulfilled') continue;
        const content = (await response.value) || 'null';

        if (content.includes('://')) {
          const lines = content.includes('\r\n') ? content.split('\r\n') : content.split('\n');
          节点LINK = 节点LINK.concat(lines);
        } else {
          const decoded = base64Decode(content);
          if (decoded.includes('://')) {
            const lines = decoded.includes('\r\n') ? decoded.split('\r\n') : decoded.split('\n');
            节点LINK = 节点LINK.concat(lines);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      clearTimeout(timeout);
    }
  }

  return 节点LINK;
}

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

async function subHtml(request) {
  const url = new URL(request.url);
  const HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${FileName}</title>
  ${网站图标}
  <style>
    :root { --primary-color:#4361ee; --hover-color:#3b4fd3; --bg-color:#f5f6fa; --card-bg:#ffffff; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body {
      ${网站背景}
      background-size:cover; background-position:center; background-attachment:fixed;
      background-color:var(--bg-color);
      font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;
      line-height:1.6; color:#333; min-height:100vh;
      display:flex; justify-content:center; align-items:center;
    }
    .container{
      position:relative; background:rgba(255,255,255,.7);
      backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
      max-width:600px; width:90%; padding:2rem; border-radius:20px;
      box-shadow:0 10px 20px rgba(0,0,0,.05), inset 0 0 0 1px rgba(255,255,255,.1);
      transition:transform .3s ease;
    }
    .container:hover{ transform:translateY(-5px); box-shadow:0 15px 30px rgba(0,0,0,.1), inset 0 0 0 1px rgba(255,255,255,.2); }
    h1{ text-align:center; color:var(--primary-color); margin-bottom:2rem; font-size:1.8rem; }
    .input-group{ margin-bottom:1.5rem; }
    label{ display:block; margin-bottom:.5rem; color:#555; font-weight:500; }
    input{
      width:100%; padding:12px; border:2px solid rgba(0,0,0,.15); border-radius:10px; font-size:1rem;
      transition:all .3s ease; box-shadow: inset 0 2px 4px rgba(0,0,0,.03);
    }
    input:focus{ outline:none; border-color:var(--primary-color); box-shadow:0 0 0 3px rgba(67,97,238,.15), inset 0 2px 4px rgba(0,0,0,.03); }
    button{
      width:100%; padding:12px; background-color:var(--primary-color); color:#fff; border:none; border-radius:10px;
      font-size:1rem; font-weight:600; cursor:pointer; transition:all .3s ease; margin-bottom:1.5rem;
    }
    button:hover{ background-color:var(--hover-color); transform:translateY(-2px); }
    button:active{ transform:translateY(0); }
    #result{ background-color:#f8f9fa; font-family:monospace; word-break:break-all; }
    .github-corner svg{ fill:var(--primary-color); color:var(--card-bg); position:absolute; top:0; right:0; border:0; width:80px; height:80px; }
    .github-corner:hover .octo-arm{ animation:octocat-wave 560ms ease-in-out; }
    @keyframes octocat-wave{ 0%,100%{transform:rotate(0)} 20%,60%{transform:rotate(-25deg)} 40%,80%{transform:rotate(10deg)} }
    @keyframes rotate{ from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    .logo-title{ position:relative; display:flex; justify-content:center; align-items:center; margin-bottom:2rem; }
    .logo-wrapper{ position:absolute; left:0; width:50px; height:50px; }
    .logo-title img{ width:100%; height:100%; border-radius:50%; position:relative; z-index:1; background:var(--card-bg); box-shadow:0 0 15px rgba(67,97,238,.1); }
    .logo-border{
      position:absolute; top:-3px; left:-3px; right:-3px; bottom:-3px; border-radius:50%;
      animation:rotate 3s linear infinite;
      background:conic-gradient(from 0deg, transparent 0%, var(--primary-color) 20%, rgba(67,97,238,.8) 40%, transparent 60%, transparent 100%);
      box-shadow:0 0 10px rgba(67,97,238,.3); filter:blur(.5px);
    }
    .logo-border::after{ content:''; position:absolute; inset:3px; border-radius:50%; background:var(--card-bg); }
    .beian-info{ text-align:center; font-size:13px; }
    .beian-info a{ color:var(--primary-color); text-decoration:none; border-bottom:1px dashed var(--primary-color); padding-bottom:2px; }
    .beian-info a:hover{ border-bottom-style:solid; }
    #qrcode{ display:flex; justify-content:center; align-items:center; margin-top:20px; }
    .info-icon{
      display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%;
      background-color:var(--primary-color); color:#fff; font-size:12px; margin-left:8px; cursor:pointer; font-weight:bold; position:relative; top:-3px;
    }
    .info-tooltip{
      display:none; position:fixed; background:#fff; border:1px solid var(--primary-color); border-radius:8px; padding:15px;
      z-index:1000; box-shadow:0 2px 10px rgba(0,0,0,.1); min-width:200px; max-width:90vw; width:max-content;
      left:50%; top:50%; transform:translate(-50%,-50%); margin:0; line-height:1.6; font-size:13px;
      white-space:normal; word-wrap:break-word; overflow-wrap:break-word;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/@keeex/qrcodejs-kx@1.0.2/qrcode.min.js"></script>
</head>
<body>
  <a href="https://github.com/cmliu/WorkerVless2sub" target="_blank" class="github-corner" aria-label="View source on Github">
    <svg viewBox="0 0 250 250" aria-hidden="true">
      <path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"></path>
      <path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" fill="currentColor" style="transform-origin: 130px 106px;" class="octo-arm"></path>
      <path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" fill="currentColor" class="octo-body"></path>
    </svg>
  </a>

  <div class="container">
    <div class="logo-title">
      ${网站头像}
      <h1>${FileName}</h1>
    </div>

    <div class="input-group">
      <label for="link">节点链接</label>
      <input type="text" id="link" placeholder="请输入 VMess / VLESS / Trojan 链接">
    </div>

    <button onclick="generateLink()">生成优选订阅</button>

    <div class="input-group">
      <div style="display:flex;align-items:center;">
        <label for="result">优选订阅</label>
        <div style="position:relative;">
          <span class="info-icon" onclick="toggleTooltip(event)">!</span>
          <div class="info-tooltip" id="infoTooltip">
            <strong>安全提示</strong>：使用优选订阅生成器时，需要您提交 <strong>节点配置信息</strong> 用于生成优选订阅链接。这意味着订阅器的维护者可能会获取到该节点信息。<strong>请自行斟酌使用风险。</strong><br><br>
            订阅转换后端：<strong><a href='${subProtocol}://${subConverter}/version' target="_blank" rel="noopener noreferrer">${subProtocol}://${subConverter}</a></strong><br>
            订阅转换配置文件：<strong><a href='${subConfig}' target="_blank" rel="noopener noreferrer">${subConfig}</a></strong><br><br>
            指纹：默认 <strong>fp=chrome</strong>
          </div>
        </div>
      </div>
      <input type="text" id="result" readonly onclick="copyToClipboard()">
      <label id="qrcode" style="margin:15px 10px -15px 10px;"></label>
    </div>

    <div class="beian-info">${网络备案}</div>
  </div>

  <script>
    function toggleTooltip(event){
      event.stopPropagation();
      const tooltip=document.getElementById('infoTooltip');
      tooltip.style.display = tooltip.style.display==='block'?'none':'block';
    }
    document.addEventListener('click', function(event){
      const tooltip=document.getElementById('infoTooltip');
      const infoIcon=document.querySelector('.info-icon');
      if (!tooltip.contains(event.target) && !infoIcon.contains(event.target)) tooltip.style.display='none';
    });

    function copyToClipboard(){
      const resultInput=document.getElementById('result');
      if (!resultInput.value) return;
      resultInput.select();
      navigator.clipboard.writeText(resultInput.value).then(()=>{
        const toast=document.createElement('div');
        toast.style.position='fixed';
        toast.style.left='50%';
        toast.style.top='20px';
        toast.style.transform='translateX(-50%)';
        toast.style.padding='8px 16px';
        toast.style.background='#4361ee';
        toast.style.color='white';
        toast.style.borderRadius='4px';
        toast.style.zIndex='1000';
        toast.textContent='已复制到剪贴板';
        document.body.appendChild(toast);
        setTimeout(()=>document.body.removeChild(toast), 2000);
      }).catch(()=>alert('复制失败，请手动复制'));
    }

    function generateLink(){
      const link=document.getElementById('link').value;
      if (!link){ alert('请输入节点链接'); return; }

      const fp='chrome'; // ✅ 页面生成的订阅链接默认 fp=chrome（后端也会默认）
      let uuidType='uuid';
      const 是特洛伊 = link.startsWith('trojan://');
      if (是特洛伊) uuidType='password';

      let subLink='';
      try{
        const isVMess = link.startsWith('vmess://');
        const domain = window.location.hostname;

        if (isVMess){
          const vmessLink = link.split('vmess://')[1];
          const vmessJson = JSON.parse(atob(vmessLink));

          const host = vmessJson.host;
          const uuid = vmessJson.id;
          const path = vmessJson.path || '/';
          const sni  = vmessJson.sni || host;
          const type = vmessJson.type || 'none';
          const alpn = vmessJson.alpn || '';
          const alterId = vmessJson.aid || 0;
          const security = vmessJson.scy || 'auto';

          subLink = \`https://\${domain}/sub?host=\${host}&uuid=\${uuid}&path=\${encodeURIComponent(path)}&sni=\${sni}&type=\${type}&alpn=\${encodeURIComponent(alpn)}&fp=\${encodeURIComponent(fp)}&alterid=\${alterId}&security=\${security}\`;
        } else {
          const uuid = link.split("//")[1].split("@")[0];
          const search = link.split("?")[1].split("#")[0];
          subLink = \`https://\${domain}/sub?\${uuidType}=\${uuid}&\${search}&fp=\${encodeURIComponent(fp)}\`;
        }

        document.getElementById('result').value=subLink;

        const qrcodeDiv=document.getElementById('qrcode');
        qrcodeDiv.innerHTML='';
        new QRCode(qrcodeDiv,{
          text:subLink, width:220, height:220,
          colorDark:"#4a60ea", colorLight:"#ffffff",
          correctLevel:QRCode.CorrectLevel.L, scale:1
        });
      } catch(e){
        alert('链接格式错误，请检查输入');
      }
    }
  </script>
</body>
</html>
  `;
  return new Response(HTML, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
}

export default {
  async fetch(request, env) {
    // ===== env 配置 =====
    BotToken = env.TGTOKEN || BotToken;
    ChatID = env.TGID || ChatID;

    subConverter = env.SUBAPI || subConverter;
    if (subConverter.includes('http://')) {
      subConverter = subConverter.split('//')[1];
      subProtocol = 'http';
    } else {
      subConverter = subConverter.split('//')[1] || subConverter;
    }

    subConfig = env.SUBCONFIG || subConfig;
    FileName = env.SUBNAME || FileName;
    socks5DataURL = env.SOCKS5DATA || socks5DataURL;

    if (env.CMPROXYIPS) 匹配PROXYIP = await 整理(env.CMPROXYIPS);
    if (env.CFPORTS) httpsPorts = await 整理(env.CFPORTS);

    EndPS = env.PS || EndPS;

    网站图标 = env.ICO ? `<link rel="icon" sizes="32x32" href="${env.ICO}">` : '';
    网站头像 = env.PNG ? `<div class="logo-wrapper"><div class="logo-border"></div><img src="${env.PNG}" alt="Logo"></div>` : '';
    if (env.IMG) {
      const imgs = await 整理(env.IMG);
      网站背景 = `background-image: url('${imgs[Math.floor(Math.random() * imgs.length)]}');`;
    } else {
      网站背景 = '';
    }
    网络备案 = env.BEIAN || env.BY || 网络备案;

    // ✅ fp 默认 chrome，可 env.FP 覆盖
    fp = normalizeFP(env.FP || fp);

    const userAgentHeader = request.headers.get('User-Agent');
    const userAgent = userAgentHeader ? userAgentHeader.toLowerCase() : 'null';

    const url = new URL(request.url);
    const format = url.searchParams.get('format') ? url.searchParams.get('format').toLowerCase() : 'null';

    let host = '';
    let uuid = '';
    let path = '';
    let sni = '';
    let type = 'ws';
    let scv = env.SCV || 'false';

    alpn = env.ALPN || alpn;

    // ✅ 允许 /sub?fp= 覆盖（仍有白名单兜底）
    fp = normalizeFP(url.searchParams.get('fp') || fp);

    let UD = Math.floor(((timestamp - Date.now()) / timestamp) * 99 * 1099511627776 / 2);
    if (env.UA) MamaJustKilledAMan = MamaJustKilledAMan.concat(await 整理(env.UA));

    const currentDate = new Date();
    const fakeUserIDMD5 = await MD5MD5(Math.ceil(currentDate.getTime()));
    fakeUserID =
      fakeUserIDMD5.slice(0, 8) +
      '-' +
      fakeUserIDMD5.slice(8, 12) +
      '-' +
      fakeUserIDMD5.slice(12, 16) +
      '-' +
      fakeUserIDMD5.slice(16, 20) +
      '-' +
      fakeUserIDMD5.slice(20);
    fakeHostName = fakeUserIDMD5.slice(6, 9) + '.' + fakeUserIDMD5.slice(13, 19) + '.xyz';

    total = total * 1099511627776;
    let expire = Math.floor(timestamp / 1000);

    link = env.LINK || link;

    if (env.ADD) addresses = await 整理(env.ADD);
    if (env.ADDAPI) addressesapi = await 整理(env.ADDAPI);
    if (env.ADDNOTLS) addressesnotls = await 整理(env.ADDNOTLS);
    if (env.ADDNOTLSAPI) addressesnotlsapi = await 整理(env.ADDNOTLSAPI);

    function moveHttpUrls(sourceArray, targetArray) {
      if (!Array.isArray(sourceArray) || sourceArray.length === 0) return sourceArray || [];
      const httpRegex = /^https?:\/\//i;
      const httpUrls = sourceArray.filter((item) => httpRegex.test(item));
      if (httpUrls.length > 0) {
        targetArray.push(...httpUrls);
        return sourceArray.filter((item) => !httpRegex.test(item));
      }
      return sourceArray;
    }
    addresses = moveHttpUrls(addresses, addressesapi);
    addressesnotls = moveHttpUrls(addressesnotls, addressesnotlsapi);

    if (env.ADDCSV) addressescsv = await 整理(env.ADDCSV);
    DLS = Number(env.DLS) || DLS;
    remarkIndex = Number(env.CSVREMARK) || remarkIndex;

    if (socks5DataURL) {
      try {
        const response = await fetch(socks5DataURL);
        const socks5DataText = await response.text();
        socks5Data = (socks5DataText.includes('\r\n') ? socks5DataText.split('\r\n') : socks5DataText.split('\n')).filter(
          (line) => line.trim() !== ''
        );
      } catch {
        socks5Data = null;
      }
    }

    let 临时proxyIPs = [];
    if (env.PROXYIP) 临时proxyIPs = await 整理(env.PROXYIP);
    if (env.PROXYIPAPI) {
      const proxyIPsapi = await 整理(env.PROXYIPAPI);
      if (proxyIPsapi.length > 0) {
        const response = await fetch(proxyIPsapi[0]);
        if (response.ok) {
          const 响应内容 = await response.text();
          const 整理成数组 = await 整理(响应内容);
          if (整理成数组.length > 0) 临时proxyIPs = 临时proxyIPs.concat(整理成数组);
        }
      }
    }
    临时proxyIPs = [...new Set(临时proxyIPs.filter((item) => item && item.trim() !== ''))];
    if (临时proxyIPs.length > 0) proxyIPs = 临时proxyIPs;

    // ===== 解析参数（仅支持 /sub 参数模式；根路径返回生成器页面）=====
    host = url.searchParams.get('host');
    uuid = url.searchParams.get('uuid') || url.searchParams.get('password') || url.searchParams.get('pw');
    path = url.searchParams.get('path');
    sni = url.searchParams.get('sni') || host;
    type = url.searchParams.get('type') || type;
    scv = url.searchParams.get('allowInsecure') == '1' ? 'true' : url.searchParams.get('scv') || scv;

    const mode = url.searchParams.get('mode') || null;
    const extra = url.searchParams.get('extra') || null;
    xhttp = (mode ? `&mode=${mode}` : '') + (extra ? `&extra=${encodeURIComponent(extra)}` : '');

    alpn = url.searchParams.get('alpn') || (xhttp ? 'h3%2Ch2' : alpn);

    隧道版本作者 =
      url.searchParams.get(atob('ZWRnZXR1bm5lbA==')) || url.searchParams.get(atob('ZXBlaXVz')) || 隧道版本作者;
    获取代理IP = url.searchParams.get('proxyip') || 'false';

    if (url.searchParams.has('alterid')) {
      协议类型 = 'VMess';
      额外ID = url.searchParams.get('alterid') || 额外ID;
      加密方式 = url.searchParams.get('security') || 加密方式;
    } else if (url.searchParams.has(atob('ZWRnZXR1bm5lbA==')) || url.searchParams.has('uuid')) {
      协议类型 = atob('VkxFU1M=');
    } else if (url.searchParams.has(atob('ZXBlaXVz')) || url.searchParams.has('password') || url.searchParams.has('pw')) {
      协议类型 = atob('VHJvamFu');
    }

    // 非 /sub：只返回生成器页面（或 URL/URL302）
    if (!url.pathname.includes('/sub')) {
      const envKey = env.URL302 ? 'URL302' : env.URL ? 'URL' : null;
      if (envKey) {
        const URLs = await 整理(env[envKey]);
        if (URLs.includes('nginx')) {
          return new Response(await nginx(), { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
        }
        const URL = URLs[Math.floor(Math.random() * URLs.length)];
        return envKey === 'URL302' ? Response.redirect(URL, 302) : fetch(new Request(URL, request));
      }
      return await subHtml(request);
    }

    if (!host || !uuid) {
      const responseText = `
缺少必填参数：host 和 uuid
Missing required parameters: host and uuid

${url.origin}/sub?host=[your host]&uuid=[your uuid]&path=[your path]

Tips:
- 默认 fp=chrome，可用 /sub?fp=firefox 覆盖
`;
      return new Response(responseText, { status: 202, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    if (!path || path.trim() === '') path = '/?ed=2560';
    else path = path[0] === '/' ? path : '/' + path;

    // ===== 响应头 =====
    const responseHeaders = {
      'content-type': 'text/plain; charset=utf-8',
      'Profile-Update-Interval': `${SUBUpdateTime}`,
      'Profile-web-page-url': url.origin,
      // "Subscription-Userinfo": `upload=${UD}; download=${UD}; total=${total}; expire=${expire}`,
    };

    if (host.toLowerCase().includes('notls') || host.toLowerCase().includes('worker') || host.toLowerCase().includes('trycloudflare'))
      noTLS = 'true';
    noTLS = env.NOTLS || noTLS;

    let subConverterUrl = generateFakeInfo(url.href, uuid, host);
    const isSubConverterRequest =
      request.headers.get('subconverter-request') || request.headers.get('subconverter-version') || userAgent.includes('subconverter');

    // subconverter 自己请求时不要强塞 alpn（保留原逻辑）
    if (isSubConverterRequest) alpn = '';

    // UA拦截：命中则返回页面/URL（保留原逻辑）
    if (!isSubConverterRequest && MamaJustKilledAMan.some((k) => userAgent.includes(k)) && MamaJustKilledAMan.length > 0) {
      const envKey = env.URL302 ? 'URL302' : env.URL ? 'URL' : null;
      if (envKey) {
        const URLs = await 整理(env[envKey]);
        if (URLs.includes('nginx')) {
          return new Response(await nginx(), { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
        }
        const URL = URLs[Math.floor(Math.random() * URLs.length)];
        return envKey === 'URL302' ? Response.redirect(URL, 302) : fetch(new Request(URL, request));
      }
      return await subHtml(request);
    }

    // ===== client 选择 converter 输出 =====
    if (
      (userAgent.includes('clash') || userAgent.includes('meta') || userAgent.includes('mihomo') || (format === 'clash' && !isSubConverterRequest)) &&
      !userAgent.includes('nekobox') &&
      !userAgent.includes('cf-workers-sub')
    ) {
      subConverterUrl = `${subProtocol}://${subConverter}/sub?target=clash&url=${encodeURIComponent(
        subConverterUrl
      )}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&tfo=false&scv=${scv}&fdn=false&sort=false&new_name=true`;
    } else if (
      (userAgent.includes('sing-box') || userAgent.includes('singbox') || (format === 'singbox' && !isSubConverterRequest)) &&
      !userAgent.includes('cf-workers-sub')
    ) {
      if (协议类型 == 'VMess' && url.href.includes('path=')) {
        const 路径参数前部分 = url.href.split('path=')[0];
        const parts = url.href.split('path=')[1].split('&');
        const 路径参数后部分 = parts.slice(1).join('&') || '';
        const 待处理路径参数 = url.href.split('path=')[1].split('&')[0] || '';
        if (待处理路径参数.includes('%3F')) {
          subConverterUrl = generateFakeInfo(路径参数前部分 + 'path=' + 待处理路径参数.split('%3F')[0] + '&' + 路径参数后部分, uuid, host);
        }
      }
      subConverterUrl = `${subProtocol}://${subConverter}/sub?target=singbox&url=${encodeURIComponent(
        subConverterUrl
      )}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&tfo=false&scv=${scv}&fdn=false&sort=false&new_name=true`;
    } else {
      // ===== 生成 base64 订阅（不走 converter）=====
      if (host.includes('workers.dev')) {
        if (临时中转域名接口) {
          try {
            const resp = await fetch(临时中转域名接口);
            if (resp.ok) {
              const text = await resp.text();
              const nonEmptyLines = text.split('\n').filter((line) => line.trim() !== '');
              临时中转域名 = 临时中转域名.concat(nonEmptyLines);
            }
          } catch (e) {
            console.error('获取临时中转域名失败:', e);
          }
        }
        临时中转域名 = [...new Set(临时中转域名)];
      }

      const newAddressesapi = await 整理优选列表(addressesapi);
      const newAddressescsv = await 整理测速结果('TRUE');
      const uniqueAddresses = Array.from(new Set(addresses.concat(newAddressesapi, newAddressescsv).filter((item) => item && item.trim())));

      let notlsresponseBody;
      if ((noTLS == 'true' && 协议类型 == atob(`\u0056\u006b\u0078\u0046\u0055\u0031\u004d\u003d`)) || 协议类型 == 'VMess') {
        const newAddressesnotlsapi = await 整理优选列表(addressesnotlsapi);
        const newAddressesnotlscsv = await 整理测速结果('FALSE');
        const uniqueAddressesnotls = Array.from(
          new Set(addressesnotls.concat(newAddressesnotlsapi, newAddressesnotlscsv).filter((item) => item && item.trim()))
        );

        notlsresponseBody = uniqueAddressesnotls
          .map((address) => {
            let port = '-1';
            let addressid = address;

            const match = addressid.match(regex);
            if (!match) {
              if (address.includes(':') && address.includes('#')) {
                const parts = address.split(':');
                address = parts[0];
                const subParts = parts[1].split('#');
                port = subParts[0];
                addressid = subParts[1];
              } else if (address.includes(':')) {
                const parts = address.split(':');
                address = parts[0];
                port = parts[1];
              } else if (address.includes('#')) {
                const parts = address.split('#');
                address = parts[0];
                addressid = parts[1];
              }
              if (addressid.includes(':')) addressid = addressid.split(':')[0];
            } else {
              address = match[1];
              port = match[2] || port;
              addressid = match[3] || address;
            }

            const httpPorts = ['8080', '8880', '2052', '2082', '2086', '2095'];
            if (!isValidIPv4(address) && port == '-1') {
              for (let httpPort of httpPorts) if (address.includes(httpPort)) { port = httpPort; break; }
            }
            if (port == '-1') port = '80';

            // proxyip 逻辑（保留）
            if (隧道版本作者.trim() === atob('Y21saXU=') && 获取代理IP.trim() === 'true') {
              let lowerAddressid = addressid.toLowerCase();
              let foundProxyIP = null;

              if (socks5Data) {
                const socks5 = getRandomProxyByMatch(lowerAddressid, socks5Data);
                path = `/${socks5}`;
              } else {
                for (let item of 匹配PROXYIP) {
                  if (item.includes('#') && item.split('#')[1] && lowerAddressid.includes(item.split('#')[1].toLowerCase())) { foundProxyIP = item.split('#')[0]; break; }
                  if (item.includes(':') && item.split(':')[1] && lowerAddressid.includes(item.split(':')[1].toLowerCase())) { foundProxyIP = item.split(':')[0]; break; }
                }
                path = atob('L3Byb3h5aXA9') + (foundProxyIP || proxyIPs[Math.floor(Math.random() * proxyIPs.length)]);
              }
            }

            if (协议类型 == 'VMess') {
              const vmessLink = `vmess://${utf8ToBase64(
                `{"v":"2","ps":"${addressid + EndPS}","add":"${address}","port":"${port}","id":"${uuid}","aid":"${额外ID}","scy":"${加密方式}","net":"ws","type":"${type}","host":"${host}","path":"${path}","tls":"","sni":"","alpn":"${encodeURIComponent(
                  alpn
                )}","fp":"${fp}"}`
              )}`;
              return vmessLink;
            } else {
              // notls vless：无 tls，不写 fp（无意义）
              const vless = `${atob(atob('ZG14bGMzTTZMeTg9')) + uuid}@${address}:${port}?security=&type=${type}&host=${host}&path=${encodeURIComponent(
                path
              )}&encryption=none#${encodeURIComponent(addressid + EndPS)}`;
              return vless;
            }
          })
          .join('\n');
      }

      const responseBody = uniqueAddresses
        .map((address) => {
          let port = '-1';
          let addressid = address;

          const match = addressid.match(regex);
          if (!match) {
            if (address.includes(':') && address.includes('#')) {
              const parts = address.split(':');
              address = parts[0];
              const subParts = parts[1].split('#');
              port = subParts[0];
              addressid = subParts[1];
            } else if (address.includes(':')) {
              const parts = address.split(':');
              address = parts[0];
              port = parts[1];
            } else if (address.includes('#')) {
              const parts = address.split('#');
              address = parts[0];
              addressid = parts[1];
            }
            if (addressid.includes(':')) addressid = addressid.split(':')[0];
          } else {
            address = match[1];
            port = match[2] || port;
            addressid = match[3] || address;
          }

          if (!isValidIPv4(address) && port == '-1') {
            for (let httpsPort of httpsPorts) if (address.includes(httpsPort)) { port = httpsPort; break; }
          }
          if (port == '-1') port = '443';

          // proxyip 逻辑（保留）
          if (隧道版本作者.trim() === atob('Y21saXU=') && 获取代理IP.trim() === 'true') {
            let lowerAddressid = addressid.toLowerCase();
            let foundProxyIP = null;

            if (socks5Data) {
              const socks5 = getRandomProxyByMatch(lowerAddressid, socks5Data);
              path = `/${socks5}`;
            } else {
              for (let item of 匹配PROXYIP) {
                if (item.includes('#') && item.split('#')[1] && lowerAddressid.includes(item.split('#')[1].toLowerCase())) { foundProxyIP = item.split('#')[0]; break; }
                if (item.includes(':') && item.split(':')[1] && lowerAddressid.includes(item.split(':')[1].toLowerCase())) { foundProxyIP = item.split(':')[0]; break; }
              }

              const matchingProxyIP = proxyIPPool.find((proxyIP) => proxyIP.includes(address));
              if (matchingProxyIP) path = atob('L3Byb3h5aXA9') + matchingProxyIP;
              else path = atob('L3Byb3h5aXA9') + (foundProxyIP || proxyIPs[Math.floor(Math.random() * proxyIPs.length)]);
            }
          }

          let 伪装域名 = host;
          let 最终路径 = path;
          let 节点备注 = EndPS;

          if (临时中转域名.length > 0 && host.includes('.workers.dev')) {
            最终路径 = `/${host}${path}`;
            伪装域名 = 临时中转域名[Math.floor(Math.random() * 临时中转域名.length)];
            节点备注 = EndPS + atob('IOW3suWQr+eUqOS4tOaXtuWfn+WQjeS4rei9rOacjeWKoe+8jOivt+WwveW/q+e7keWumuiHquWumuS5ieWfn++8gQ==');
            sni = 伪装域名;
          }

          if (协议类型 == 'VMess') {
            const vmessLink = `vmess://${utf8ToBase64(
              `{"v":"2","ps":"${addressid + 节点备注}","add":"${address}","port":"${port}","id":"${uuid}","aid":"${额外ID}","scy":"${加密方式}","net":"ws","type":"${type}","host":"${伪装域名}","path":"${最终路径}","tls":"tls","sni":"${sni}","alpn":"${encodeURIComponent(
                alpn
              )}","fp":"${fp}","allowInsecure":"${scv == 'true' ? '1' : '0'}","fragment":"1,40-60,30-50,tlshello"}`
            )}`;
            return vmessLink;
          } else if (协议类型 == atob('VHJvamFu')) {
            const trojan = `${atob(atob('ZEhKdmFtRnVPaTh2')) + uuid}@${address}:${port}?security=tls&sni=${sni}&alpn=${encodeURIComponent(
              alpn
            )}&fp=${encodeURIComponent(fp)}&type=${type}&host=${伪装域名}&path=${encodeURIComponent(
              最终路径
            )}${scv == 'true' ? '&allowInsecure=1' : ''}&fragment=${encodeURIComponent('1,40-60,30-50,tlshello')}#${encodeURIComponent(
              addressid + 节点备注
            )}`;
            return trojan;
          } else {
            const vless = `${atob(atob('ZG14bGMzTTZMeTg9')) + uuid}@${address}:${port}?security=tls&sni=${sni}&alpn=${encodeURIComponent(
              alpn
            )}&fp=${encodeURIComponent(fp)}&type=${type}&host=${伪装域名}&path=${encodeURIComponent(
              最终路径
            )}${xhttp}${scv == 'true' ? '&allowInsecure=1' : ''}&fragment=${encodeURIComponent(
              '1,40-60,30-50,tlshello'
            )}&encryption=none#${encodeURIComponent(addressid + 节点备注)}`;
            return vless;
          }
        })
        .join('\n');

      let combinedContent = responseBody;

      if (link) {
        const links = await 整理(link);
        const extraLinks = (await getLink(links)).join('\n');
        combinedContent += '\n' + extraLinks;
      }

      if (notlsresponseBody && noTLS == 'true') {
        combinedContent += '\n' + notlsresponseBody;
      }

      // trojan + surge 仍走 converter
      if (协议类型 == atob('VHJvamFu') && (userAgent.includes('surge') || (format === 'surge' && !isSubConverterRequest)) && !userAgent.includes('cf-workers-sub')) {
        const 特洛伊Links = combinedContent.split('\n');
        const 特洛伊LinksJ8 = generateFakeInfo(特洛伊Links.join('|'), uuid, host);
        subConverterUrl = `${subProtocol}://${subConverter}/sub?target=surge&ver=4&url=${encodeURIComponent(
          特洛伊LinksJ8
        )}&insert=false&config=${encodeURIComponent(subConfig)}&emoji=true&list=false&xudp=false&udp=false&tfo=false&expand=true&scv=${scv}&fdn=false`;
      } else {
        let base64Response;
        try {
          base64Response = btoa(combinedContent);
        } catch {
          // UTF-8 Base64 fallback
          const binary = new TextEncoder().encode(combinedContent);
          let out = '';
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          for (let i = 0; i < binary.length; i += 3) {
            const b1 = binary[i];
            const b2 = binary[i + 1] || 0;
            const b3 = binary[i + 2] || 0;
            out += chars[b1 >> 2];
            out += chars[((b1 & 3) << 4) | (b2 >> 4)];
            out += chars[((b2 & 15) << 2) | (b3 >> 6)];
            out += chars[b3 & 63];
          }
          const padding = 3 - (binary.length % 3 || 3);
          base64Response = out.slice(0, out.length - padding) + '=='.slice(0, padding);
        }
        return new Response(base64Response, { headers: responseHeaders });
      }
    }

    // ===== 走 subconverter 输出 =====
    try {
      // 可选：日志
      // await sendMessage(`#获取订阅 ${FileName}`, request.headers.get('CF-Connecting-IP'), `UA: ${userAgentHeader}</tg-spoiler>\n域名: ${url.hostname}\n<tg-spoiler>入口: ${url.pathname + url.search}</tg-spoiler>`);

      const subConverterResponse = await fetch(subConverterUrl, {
        headers: {
          'User-Agent': `v2rayN/${FileName + atob('IChodHRwczovL2dpdGh1Yi5jb20vY21saXUvRWRnZU9uZS1QYWdlcy1CZXN0SVAyU1VCKQ==')}`,
        },
      });

      if (!subConverterResponse.ok) {
        throw new Error(`Error fetching subConverterUrl: ${subConverterResponse.status} ${subConverterResponse.statusText}`);
      }

      let subConverterContent = await subConverterResponse.text();

      if (协议类型 == atob('VHJvamFu') && (userAgent.includes('surge') || (format === 'surge' && !isSubConverterRequest)) && !userAgent.includes('cf-workers-sub')) {
        subConverterContent = surge(subConverterContent, host, path);
      }

      subConverterContent = revertFakeInfo(subConverterContent, uuid, host);

      if (!userAgent.includes('mozilla')) responseHeaders['Content-Disposition'] = `attachment; filename*=utf-8''${encodeURIComponent(FileName)}`;

      return new Response(subConverterContent, { headers: responseHeaders });
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
  },
};

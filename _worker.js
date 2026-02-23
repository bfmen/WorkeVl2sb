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

function b64(s) {
  const u = new TextEncoder().encode(s);
  let b = "";
  for (let i = 0; i < u.length; i++) b += String.fromCharCode(u[i]);
  return btoa(b);
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

async function cachePutJSON(key, obj, ttl = 60) {
  const cache = caches.default;
  const req = new Request("https://cache.local/" + key);
  const res = new Response(JSON.stringify(obj), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${ttl}` },
  });
  await cache.put(req, res);
}

async function getUpstreamsCached(cfg) {
  const key =
    "up_" +
    b64(cfg.a1.join("|") + "|" + cfg.a2.join("|") + "|" + String(cfg.dls) + "|" + String(cfg.rmk));
  const hit = await cacheGetJSON(key);
  if (hit && Array.isArray(hit.l1) && Array.isArray(hit.l2)) return hit;

  const [l1, l2] = await Promise.all([fetchAPI(cfg.a1), fetchCSV(cfg.a2, "TRUE", cfg.dls, cfg.rmk)]);
  const obj = { l1, l2 };
  await cachePutJSON(key, obj, 60);
  return obj;
}

/* ---------------- HTML (极简) ---------------- */
function makeHTML(title) {
  const t = esc(title);
  return `<!doctype html><html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#0a0a0f;--s:#13131a;--s2:#1c1c27;--b:#2a2a38;--a:#00e5ff;--a2:#7c3aed;--tx:#e8e8f0;--m:#6b6b80;--ok:#00ff9d}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'JetBrains Mono',ui-monospace,monospace;background:var(--bg);color:var(--tx);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px}
.wrap{width:100%;max-width:640px}
.hd{margin-bottom:18px}
.tag{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--a);opacity:.85;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.tag::before{content:'';display:block;width:22px;height:1px;background:var(--a)}
.tt{font-family:'Syne',sans-serif;font-size:clamp(24px,5vw,38px);font-weight:800;letter-spacing:-.02em;line-height:1.1;background:linear-gradient(135deg,var(--tx),var(--a));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.card{background:var(--s);border:1px solid var(--b);border-radius:12px;padding:18px 16px;margin-bottom:12px}
.lab{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--m);margin-bottom:10px}
textarea,input[type=text]{width:100%;background:var(--s2);border:1px solid var(--b);border-radius:8px;padding:12px 14px;color:var(--tx);font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.6;outline:none}
textarea{min-height:96px;resize:vertical}
.btn{width:100%;padding:14px 20px;border-radius:8px;border:none;cursor:pointer;font-family:'Syne',sans-serif;font-size:15px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;background:linear-gradient(135deg,var(--a2),var(--a));color:#000}
.rrow{display:flex;gap:8px;align-items:stretch}
.ri{flex:1;cursor:pointer}
.cpb{padding:12px 16px;border-radius:8px;border:1px solid var(--b);background:var(--s2);color:var(--tx);cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:12px;white-space:nowrap}
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

// 经验阈值：URL 太长 QR 容易溢出（你示例这种长度肯定没问题）
function rqr(txt){
  var box=document.getElementById('qr');
  box.innerHTML='';
  if(!txt)return;

  if(txt.length>1200){
    box.innerHTML='<div class="qre">链接过长，无法生成二维码（请直接复制订阅链接）</div>';
    return;
  }

  if(typeof QRCode!=='function'){
    box.innerHTML='<div class="qre">QRCode 未加载</div>';
    return;
  }
  try{
    var qr=QRCode(0,'M');
    qr.addData(txt);
    qr.make();
    var n=qr.getModuleCount(),sc=4,mg=10,sz=n*sc+mg*2;
    var cv=document.createElement('canvas');
    cv.width=sz;cv.height=sz;
    box.appendChild(cv);
    var ctx=cv.getContext('2d');
    ctx.fillStyle='#13131a';ctx.fillRect(0,0,sz,sz);
    ctx.fillStyle='#00e5ff';
    for(var r=0;r<n;r++)
      for(var col=0;col<n;col++)
        if(qr.isDark(r,col))
          ctx.fillRect(mg+col*sc,mg+r*sc,sc,sc);
  } catch(e){
    box.innerHTML='<div class="qre">二维码生成失败（请直接复制订阅链接）</div>';
  }
}

document.addEventListener('DOMContentLoaded', function(){
  document.getElementById('genBtn').addEventListener('click', gen);
  document.getElementById('cb').addEventListener('click', doCopy);
  document.getElementById('ou').addEventListener('click', doCopy);
});

/* --- embedded QR encoder --- */
(function(g){
function QR8bitByte(d){this.mode=1;this.data=d;}
QR8bitByte.prototype.getLength=function(){return this.data.length;};
QR8bitByte.prototype.write=function(b){for(var i=0;i<this.data.length;i++)b.put(this.data.charCodeAt(i),8);};
function QRBitBuffer(){this.buffer=[];this.length=0;}
QRBitBuffer.prototype.get=function(i){return((this.buffer[Math.floor(i/8)]>>>(7-i%8))&1)===1;};
QRBitBuffer.prototype.put=function(n,l){for(var i=0;i<l;i++)this.putBit(((n>>>(l-i-1))&1)===1);};
QRBitBuffer.prototype.putBit=function(b){var i=Math.floor(this.length/8);if(this.buffer.length<=i)this.buffer.push(0);if(b)this.buffer[i]|=(0x80>>>(this.length%8));this.length++;};
function QRPolynomial(n,s){var o=0;while(o<n.length&&n[o]===0)o++;this.num=new Array(n.length-o+s);for(var i=0;i<n.length-o;i++)this.num[i]=n[i+o];}
QRPolynomial.prototype.get=function(i){return this.num[i];};
QRPolynomial.prototype.getLength=function(){return this.num.length;};
QRPolynomial.prototype.multiply=function(e){var n=new Array(this.getLength()+e.getLength()-1);for(var i=0;i<n.length;i++)n[i]=0;for(var i=0;i<this.getLength();i++)for(var j=0;j<e.getLength();j++)n[i+j]^=QRMath.gexp(QRMath.glog(this.get(i))+QRMath.glog(e.get(j)));return new QRPolynomial(n,0);};
QRPolynomial.prototype.mod=function(e){if(this.getLength()-e.getLength()<0)return this;var r=QRMath.glog(this.get(0))-QRMath.glog(e.get(0));var n=new Array(this.getLength());for(var i=0;i<this.getLength();i++)n[i]=this.get(i);for(var i=0;i<e.getLength();i++)n[i]^=QRMath.gexp(QRMath.glog(e.get(i))+r);return new QRPolynomial(n,0).mod(e);};
var QRMath={glog:function(n){if(n<1)throw new Error('glog');return QRMath.LOG_TABLE[n];},gexp:function(n){while(n<0)n+=255;while(n>=256)n-=255;return QRMath.EXP_TABLE[n];},EXP_TABLE:new Array(256),LOG_TABLE:new Array(256)};
for(var i=0;i<8;i++)QRMath.EXP_TABLE[i]=1<<i;
for(var i=8;i<256;i++)QRMath.EXP_TABLE[i]=QRMath.EXP_TABLE[i-4]^QRMath.EXP_TABLE[i-5]^QRMath.EXP_TABLE[i-6]^QRMath.EXP_TABLE[i-8];
for(var i=0;i<255;i++)QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]]=i;
function QRRSBlock(t,d){this.totalCount=t;this.dataCount=d;}
QRRSBlock.RS_BLOCK_TABLE={'1-L':[[1,26,19]],'1-M':[[1,26,16]],'2-L':[[1,44,34]],'2-M':[[1,44,28]],'3-L':[[1,70,55]],'3-M':[[1,70,44]],'4-L':[[1,100,80]],'4-M':[[2,50,32]],'5-L':[[1,134,108]],'5-M':[[2,67,43]],'6-L':[[2,86,68]],'6-M':[[4,43,27]],'7-L':[[2,98,78]],'7-M':[[4,49,31]],'8-L':[[2,121,97]],'8-M':[[2,60,38],[2,61,39]],'9-L':[[2,146,116]],'9-M':[[3,58,36],[2,59,37]],'10-L':[[2,86,68],[2,87,69]],'10-M':[[4,69,43],[1,70,44]]};
QRRSBlock.getRSBlocks=function(tn,ec){var t=QRRSBlock.RS_BLOCK_TABLE[tn+'-'+ec];if(!t)throw new Error('bad type/ec');var l=[];for(var i=0;i<t.length;i++)for(var j=0;j<t[i][0];j++)l.push(new QRRSBlock(t[i][1],t[i][2]));return l;};
function QRCodeModel(tn,ec){this.typeNumber=tn;this.errorCorrectLevel=ec;this.modules=null;this.moduleCount=0;this.dataCache=null;this.dataList=[];}
QRCodeModel.prototype.addData=function(d){this.dataList.push(new QR8bitByte(d));this.dataCache=null;};
QRCodeModel.prototype.isDark=function(r,c){return this.modules[r][c]===true;};
QRCodeModel.prototype.getModuleCount=function(){return this.moduleCount;};
QRCodeModel.prototype.make=function(){
  if(this.typeNumber<1){
    for(var t=1;t<=10;t++){
      try{this.typeNumber=t;this.dataCache=null;this._make(false,0);return;}catch(e){}
    }
    throw new Error('too long');
  }
  this._make(false,0);
};
QRCodeModel.prototype._make=function(test,mp){
  this.moduleCount=this.typeNumber*4+17;
  this.modules=[];
  for(var r=0;r<this.moduleCount;r++){this.modules[r]=[];for(var c=0;c<this.moduleCount;c++)this.modules[r][c]=null;}
  this._setupPositionProbePattern(0,0);
  this._setupPositionProbePattern(this.moduleCount-7,0);
  this._setupPositionProbePattern(0,this.moduleCount-7);
  this._setupTimingPattern();
  this._setupTypeInfo(test,mp);
  if(!this.dataCache)this.dataCache=QRCodeModel.createData(this.typeNumber,this.errorCorrectLevel,this.dataList);
  this._mapData(this.dataCache,mp);
};
QRCodeModel.prototype._setupPositionProbePattern=function(row,col){
  for(var r=-1;r<=7;r++){
    if(row+r<=-1||this.moduleCount<=row+r)continue;
    for(var c=-1;c<=7;c++){
      if(col+c<=-1||this.moduleCount<=col+c)continue;
      this.modules[row+r][col+c]=((0<=r&&r<=6&&(c===0||c===6))||(0<=c&&c<=6&&(r===0||r===6))||(2<=r&&r<=4&&2<=c&&c<=4));
    }
  }
};
QRCodeModel.prototype._setupTimingPattern=function(){
  for(var i=8;i<this.moduleCount-8;i++){
    if(this.modules[i][6]==null)this.modules[i][6]=(i%2===0);
    if(this.modules[6][i]==null)this.modules[6][i]=(i%2===0);
  }
};
QRCodeModel.prototype._setupTypeInfo=function(test,mp){
  var ec=(this.errorCorrectLevel==='L')?1:0;
  var bits=QRCodeModel.getBCHTypeInfo((ec<<3)|mp);
  for(var i=0;i<15;i++){
    var m=(!test&&((bits>>i)&1)===1);
    if(i<6)this.modules[i][8]=m;
    else if(i<8)this.modules[i+1][8]=m;
    else this.modules[this.moduleCount-15+i][8]=m;
  }
  for(var i=0;i<15;i++){
    var m=(!test&&((bits>>i)&1)===1);
    if(i<8)this.modules[8][this.moduleCount-i-1]=m;
    else if(i<9)this.modules[8][15-i]=m;
    else this.modules[8][15-i-1]=m;
  }
  this.modules[this.moduleCount-8][8]=(!test);
};
QRCodeModel.prototype._mapData=function(data,mp){
  var inc=-1,row=this.moduleCount-1,bi=7,by=0;
  for(var col=this.moduleCount-1;col>0;col-=2){
    if(col===6)col--;
    while(true){
      for(var c=0;c<2;c++){
        if(this.modules[row][col-c]==null){
          var dark=false;
          if(by<data.length)dark=(((data[by]>>>bi)&1)===1);
          if(QRCodeModel.getMask(mp,row,col-c))dark=!dark;
          this.modules[row][col-c]=dark;
          bi--;
          if(bi===-1){by++;bi=7;}
        }
      }
      row+=inc;
      if(row<0||this.moduleCount<=row){row-=inc;inc=-inc;break;}
    }
  }
};
QRCodeModel.PAD0=0xEC;QRCodeModel.PAD1=0x11;
QRCodeModel.getBCHTypeInfo=function(d){var x=d<<10;while(QRCodeModel.getBCHDigit(x)-QRCodeModel.getBCHDigit(0x537)>=0)x^=(0x537<<(QRCodeModel.getBCHDigit(x)-QRCodeModel.getBCHDigit(0x537)));return((d<<10)|x)^0x5412;};
QRCodeModel.getBCHDigit=function(d){var n=0;while(d!==0){n++;d>>>=1;}return n;};
QRCodeModel.getMask=function(mp,i,j){return(i+j)%2===0;};
QRCodeModel.getErrorCorrectPolynomial=function(ec){var a=new QRPolynomial([1],0);for(var i=0;i<ec;i++)a=a.multiply(new QRPolynomial([1,QRMath.gexp(i)],0));return a;};
QRCodeModel.createData=function(tn,ec,dl){
  var rs=QRRSBlock.getRSBlocks(tn,ec);
  var buf=new QRBitBuffer();
  for(var i=0;i<dl.length;i++){var d=dl[i];buf.put(4,4);buf.put(d.getLength(),(tn<10)?8:16);d.write(buf);}
  var tot=0;for(var i=0;i<rs.length;i++)tot+=rs[i].dataCount;
  if(buf.length>tot*8)throw new Error('overflow');
  if(buf.length+4<=tot*8)buf.put(0,4);
  while(buf.length%8!==0)buf.putBit(false);
  while(true){if(buf.length>=tot*8)break;buf.put(QRCodeModel.PAD0,8);if(buf.length>=tot*8)break;buf.put(QRCodeModel.PAD1,8);}
  return QRCodeModel.createBytes(buf,rs);
};
QRCodeModel.createBytes=function(buf,rs){
  var off=0,mDc=0,mEc=0,dc=[],ec=[];
  for(var r=0;r<rs.length;r++){
    var dcc=rs[r].dataCount,ecc=rs[r].totalCount-dcc;
    mDc=Math.max(mDc,dcc);mEc=Math.max(mEc,ecc);
    dc[r]=new Array(dcc);for(var i=0;i<dc[r].length;i++)dc[r][i]=0xff&buf.buffer[i+off];off+=dcc;
    var rp=QRCodeModel.getErrorCorrectPolynomial(ecc);
    var rw=new QRPolynomial(dc[r],rp.getLength()-1);
    var mp2=rw.mod(rp);
    ec[r]=new Array(rp.getLength()-1);
    for(var i=0;i<ec[r].length;i++){var mi=i+mp2.getLength()-ec[r].length;ec[r][i]=(mi>=0)?mp2.get(mi):0;}
  }
  var tot=0;for(var i=0;i<rs.length;i++)tot+=rs[i].totalCount;
  var data=new Array(tot),idx=0;
  for(var i=0;i<mDc;i++)for(var r=0;r<rs.length;r++)if(i<dc[r].length)data[idx++]=dc[r][i];
  for(var i=0;i<mEc;i++)for(var r=0;r<rs.length;r++)if(i<ec[r].length)data[idx++]=ec[r][i];
  return data;
};
g.QRCode=function(t,l){return new QRCodeModel(t,l||'M');};
})(window);
</script>
</body></html>`;
}

/* ---------------- Worker ---------------- */
export default {
  async fetch(request, env) {
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

      // 透传其它参数（如 mode=auto / insecure=0 / allowInsecure=0 等）
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

      const { l1, l2 } = await getUpstreamsCached(cfg);
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

          // ipv6 包一下
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

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
let fp = 'chrome';   // 🔥 默认强制 chrome 指纹

const regex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[.*\]):?(\d+)?#?(.*)?$/;

function utf8ToBase64(str) {
	return btoa(unescape(encodeURIComponent(str)));
}

async function 整理(content) {
	return content
		.replace(/[	|"'\r\n]+/g, ',')
		.replace(/,+/g, ',')
		.split(',')
		.filter(Boolean);
}

async function 整理优选列表(api) {
	if (!api || api.length === 0) return [];
	let result = [];

	await Promise.allSettled(api.map(async url => {
		try {
			const r = await fetch(url);
			if (!r.ok) return;
			const text = await r.text();
			const lines = text.split(/\r?\n/).filter(Boolean);
			result = result.concat(lines);
		} catch {}
	}));

	return result;
}

async function 整理测速结果(tls) {
	if (!addressescsv.length) return [];
	let result = [];

	await Promise.all(addressescsv.map(async url => {
		try {
			const r = await fetch(url);
			const text = await r.text();
			const rows = text.split(/\r?\n/).map(l => l.split(','));
			const header = rows.shift();
			const tlsIndex = header.findIndex(c => c.toUpperCase() === 'TLS');
			rows.forEach(row => {
				if (row[tlsIndex]?.toUpperCase() === tls && parseFloat(row[row.length - 1]) > DLS) {
					result.push(`${row[0]}:${row[1]}#${row[tlsIndex + remarkIndex]}`);
				}
			});
		} catch {}
	}));

	return result;
}

async function subHtml(request) {
	return new Response(`
	<html>
	<head><title>${FileName}</title></head>
	<body>
	<input id="link" placeholder="输入节点链接" style="width:100%">
	<button onclick="gen()">生成</button>
	<input id="out" style="width:100%" readonly>
	<script>
	function gen(){
		let link=document.getElementById("link").value;
		let domain=location.hostname;
		if(link.startsWith("vmess://")){
			let j=JSON.parse(atob(link.split("vmess://")[1]));
			document.getElementById("out").value=
			"https://"+domain+"/sub?host="+j.host+"&uuid="+j.id+"&path="+encodeURIComponent(j.path||"/")+"&sni="+(j.sni||j.host);
		}else{
			let uuid=link.split("//")[1].split("@")[0];
			let search=link.split("?")[1].split("#")[0];
			document.getElementById("out").value=
			"https://"+domain+"/sub?uuid="+uuid+"&"+search;
		}
	}
	</script>
	</body>
	</html>
	`, { headers: { "content-type": "text/html" } });
}

export default {
	async fetch(request, env) {

		addresses = env.ADD ? await 整理(env.ADD) : [];
		addressesapi = env.ADDAPI ? await 整理(env.ADDAPI) : [];
		addressescsv = env.ADDCSV ? await 整理(env.ADDCSV) : [];

		subConverter = env.SUBAPI || subConverter;
		subConfig = env.SUBCONFIG || subConfig;

		const url = new URL(request.url);

		if (!url.pathname.includes("/sub")) {
			return subHtml(request);
		}

		let host = url.searchParams.get('host');
		let uuid = url.searchParams.get('uuid') || url.searchParams.get('password');
		let path = url.searchParams.get('path') || "/";
		let sni = url.searchParams.get('sni') || host;
		let type = url.searchParams.get('type') || "ws";
		alpn = url.searchParams.get('alpn') || "";

		if (!host || !uuid) {
			return new Response("缺少 host 或 uuid", { status: 400 });
		}

		const newapi = await 整理优选列表(addressesapi);
		const newcsv = await 整理测速结果('TRUE');
		const all = Array.from(new Set(addresses.concat(newapi, newcsv)));

		const result = all.map(address => {
			let port = "443";
			let addressid = address;
			const match = address.match(regex);
			if (match) {
				address = match[1];
				port = match[2] || port;
				addressid = match[3] || address;
			}

			return `vless://${uuid}@${address}:${port}?security=tls&sni=${sni}&alpn=${encodeURIComponent(alpn)}&fp=${fp}&type=${type}&host=${host}&path=${encodeURIComponent(path)}#${encodeURIComponent(addressid)}`;
		}).join("\n");

		const base64 = btoa(result);

		return new Response(base64, {
			headers: { "content-type": "text/plain" }
		});
	}
};

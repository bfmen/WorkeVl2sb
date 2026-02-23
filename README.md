# 🛸 优选订阅生成器

> 基于 Cloudflare Workers 的 VLESS 优选 IP 订阅生成器，支持 v2rayN、Clash、Sing-Box、Surge 等主流客户端。

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## ✨ 功能特性

- 🌐 **多源优选 IP** — 支持手动列表、API 拉取、CSV 文件三种方式聚合优选地址
- 📦 **多格式订阅** — 输出 Base64 / Clash / Sing-Box / Surge，自动识别客户端
- 🔒 **AES-GCM 加密** — 可选加密订阅链接，隐藏 uuid/host 等敏感参数
- ⚡ **可视化页面** — 内置生成器页面，粘贴节点链接即可生成订阅 + 二维码
- 🔄 **subconverter 集成** — 自动对接 subconverter，支持自定义配置规则

---

## 🚀 部署步骤

### 1. 创建 Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → **Create Application** → **Create Worker**
3. 将 `worker.js` 的完整内容粘贴到编辑器
4. 点击 **Save and Deploy**

### 2. 配置环境变量

进入 Worker → **Settings** → **Variables** → **Environment Variables**，按需添加以下变量：

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `ADD` | ✅ | 优选 IP/域名列表，支持多种格式（见下方说明） | `yd.example.com:443,1.1.1.1:443` |
| `ADDAPI` | ➖ | 返回优选地址的 API URL，逗号分隔 | `https://api.example.com/ips` |
| `ADDCSV` | ➖ | 含测速结果的 CSV 文件 URL，逗号分隔 | `https://example.com/result.csv` |
| `DLS` | ➖ | CSV 测速过滤阈值（默认 `7` MB/s） | `5` |
| `CSVREMARK` | ➖ | CSV 备注列相对 TLS 列的偏移（默认 `1`） | `1` |
| `SUBAPI` | ➖ | subconverter 地址（默认内置） | `sub.example.com` 或 `https://sub.example.com` |
| `SUBCONFIG` | ➖ | subconverter 规则配置 ini 地址 | `https://example.com/config.ini` |
| `SUBNAME` | ➖ | 页面标题和订阅文件名（默认 `优选订阅生成器`） | `我的订阅` |
| `FP` | ➖ | TLS 指纹（默认 `chrome`） | `chrome` / `firefox` / `safari` / `random` |
| `SECRET` | ➖ | 启用加密订阅，设置任意密码后生效 | `myPassword123` |

> **最少只需配置 `ADD`** 即可正常使用。

---

## 📖 使用方法

### 生成订阅链接

1. 访问你的 Worker 主页（如 `https://your-worker.workers.dev`）
2. 在输入框粘贴 vmess:// / vless:// / trojan:// 节点链接
3. 点击 **生成订阅链接**，获得订阅地址和二维码
4. 将生成的链接导入客户端

### 直接构造订阅 URL

```
https://your-worker.workers.dev/sub?host=your.domain.com&uuid=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx&path=/your-path&sni=your.domain.com&type=ws&fp=chrome&alpn=h2,http/1.1
```

| 参数 | 说明 |
|------|------|
| `host` | 节点域名 |
| `uuid` | 节点 UUID / 密码 |
| `path` | WebSocket 路径 |
| `sni` | TLS SNI（默认同 host）|
| `type` | 传输类型（`ws` / `xhttp` 等）|
| `fp` | TLS 指纹 |
| `alpn` | ALPN 协议 |
| `mode` | xhttp 模式（`auto` / `stream-one` 等）|
| `format` | 强制指定输出格式（`clash` / `singbox` / `surge`）|

### 指定输出格式

在订阅链接末尾追加 `&format=` 参数：

```
# Clash
https://your-worker.workers.dev/sub?...&format=clash

# Sing-Box
https://your-worker.workers.dev/sub?...&format=singbox

# Surge
https://your-worker.workers.dev/sub?...&format=surge
```

客户端也会根据 `User-Agent` 自动识别，无需手动指定。

---

## 🔒 加密订阅

设置 `SECRET` 环境变量后，生成器页面会自动切换为加密模式。

**明文模式：**
```
/sub?host=example.com&uuid=xxxx&path=/ws&...
```

**加密模式（设置 SECRET 后）：**
```
/sub?data=aBcDeFgH...（AES-GCM 加密密文）
```

uuid、host、path 等敏感参数全部隐藏在 `data=` 密文中，服务端解密后正常提供订阅内容。

---

## ⚠️ 注意事项

### 传输协议兼容性

| 传输方式 | Cloudflare CDN 代理 | 直连（灰云）|
|----------|--------------------|----|
| WebSocket (`ws`) | ✅ 完全支持 | ✅ |
| xhttp | ❌ 不支持，会报 `INTERNAL_ERROR` | ✅ |
| gRPC | ⚠️ 需开启 gRPC 支持 | ✅ |

> **经过 Cloudflare CDN 中转时，强烈建议使用 WebSocket 传输协议。**  
> xhttp 为流式传输，Cloudflare 会缓冲请求体导致连接中断。

### ADD 变量格式说明

支持以下所有写法，可以混合使用：

```bash
# 1. 纯域名（端口默认 443）
yd.example.com,dx.example.com

# 2. 域名 + 端口
yd.example.com:443,dx.example.com:2053

# 3. 纯 IP
1.1.1.1:443,104.16.0.1:2083

# 4. IPv6（用方括号包裹）
[2606:4700::1]:443

# 5. 带备注（# 后面是节点名称）
yd.example.com:443#电信优选,dx.example.com:443#联通优选

# 6. 换行分隔（在 Cloudflare 变量编辑器里直接回车）
yd.example.com:443
dx.example.com:443
1.1.1.1:443

# 7. 以上任意混合
yd.example.com:443,dx.example.com,1.1.1.1:2083#美国,dx.example.com:2053#联通
```

> **端口说明：** 不填端口默认为 `443`。Cloudflare 支持的端口还有 `2053` `2083` `2087` `2096` `8443`。

---



`ADDCSV` 指向的 CSV 文件需满足以下格式要求：

- 第一行为表头，必须包含 `TLS` 列
- 第一列为 IP 地址，第二列为端口
- 最后一列为测速结果（MB/s），低于 `DLS` 阈值的条目会被过滤
- TLS 值为 `TRUE` 的条目才会被采用

```csv
IP,PORT,COLO,TLS,REMARK,SPEED
1.1.1.1,443,LAX,TRUE,洛杉矶,12.5
2.2.2.2,443,SJC,FALSE,圣何塞,8.3
```

---

## 🔧 常见问题

**Q: v2rayN 提示订阅导入失败**  
A: 检查 `ADD` 环境变量是否已配置；直接访问 `/sub?...` 链接，返回内容应为一串 Base64 字符串。将其粘贴到 [base64decode.org](https://www.base64decode.org) 解码，确认能看到 `vless://` 开头的节点。

**Q: 节点全部超时/无法连接**  
A: 确认使用的是 WebSocket 而非 xhttp（Cloudflare CDN 不支持 xhttp 流式传输）；确认 3x-ui 面板中 TLS 设置正确（Cloudflare 代理时服务端应选择 `none` 或与 Cloudflare SSL 模式匹配）。

**Q: Clash 格式订阅为空**  
A: 检查 `SUBAPI` 配置的 subconverter 地址是否可访问；Worker 需要能够请求外部网络。

**Q: 如何批量添加优选 IP？**  
A: 在 `ADD` 中用逗号分隔，或使用 `ADDAPI` 指向一个每行返回一个地址的 API 接口，Worker 会在每次订阅请求时自动拉取最新列表。

---

## 📄 License

MIT License — 自由使用，保留署名即可。

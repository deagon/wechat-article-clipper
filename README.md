# WeChat Article Clipper

一键将微信公众号文章转换为 Markdown 并下载到本地的 Chrome 扩展。

## 功能

- 在微信公众号文章页面点击扩展图标，一键提取文章内容
- 自动转换为 Markdown 格式，保留标题、作者、发布时间
- 下载文章配图，生成本地可离线阅读的完整文档包

## 使用方法

1. 打开任意微信公众号文章页面（`mp.weixin.qq.com`）
2. 点击浏览器工具栏中的扩展图标
3. 点击"下载文章"按钮，文章及图片将保存到本地

## 权限说明

| 权限 | 用途 |
|---|---|
| `activeTab` | 读取当前标签页的文章内容 |
| `scripting` | 在文章页面执行内容提取脚本 |
| `https://mp.weixin.qq.com/*` 等域名 | 访问文章页面及下载配图 |

---

## 隐私权声明 / Privacy Policy

**最后更新：2026 年 4 月**

### 数据收集

本扩展**不收集、不存储、不传输任何用户数据**。

- 扩展仅在用户主动点击"下载文章"时，读取**当前标签页**中微信公众号文章的页面内容（标题、作者、正文 HTML、图片 URL）。
- 所有处理均在用户本地设备上完成，处理结果直接保存为本地文件。
- 扩展不包含任何分析、遥测或广告代码，不与任何第三方服务通信。

### 图片下载

扩展会向微信图片 CDN（`*.qpic.cn`、`*.qq.com` 等域名）发起网络请求，以便将文章配图下载到本地。这些请求由用户本地浏览器直接发出，扩展作者无法访问相关数据。

### 第三方共享

本扩展不与任何第三方共享用户数据。

### 联系方式

如对本隐私权声明有任何疑问，请通过 GitHub Issues 提交反馈。

---

### Privacy Policy (English)

**Last updated: April 2026**

**WeChat Article Clipper does not collect, store, or transmit any user data.**

- The extension reads page content (title, author, article HTML, image URLs) from the active WeChat article tab **only when the user explicitly clicks the download button**.
- All processing occurs entirely on the user's local device. Output is saved as local files only.
- The extension contains no analytics, telemetry, or advertising code, and makes no requests to any third-party service.
- Image downloads are fetched directly from WeChat's CDN by the user's browser. The extension author has no access to this data.
- No user data is shared with any third party.

For questions, please open a GitHub Issue.

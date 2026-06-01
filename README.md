# Amazon Web Script

这是一个在 Amazon 上根据 Greeting Cards 选品的自动化脚本项目。脚本会通过 Playwright 打开浏览器，加载卖家精灵 Chrome 扩展，进入 Amazon Greeting Cards 畅销榜，筛选标题包含 `pop up` 且近 30 天子体月销量大于等于 1000 的商品，并把商品信息、ASIN、卖家精灵数据和参考图片写入 Excel 表格。

## 脚本功能

### 脚本一：生成新的选品表格

运行 `npm start`。

脚本会重新采集当前 Amazon Greeting Cards Top 100 中符合条件的商品，并在 `OUTPUT_ROOT` 指定的目录下生成一个新的输出文件夹。输出内容包括 Excel 表格、下载后的参考图片和运行日志。

### 脚本二：追加新增商品

运行 `npm run append-new -- --input /path/to/已有选品表格.xlsx`。

脚本会读取已有 Excel 表格中的 `商品ID`，然后重新执行和脚本一相同的采集流程。每发现一个今天符合条件的商品，就会先判断它的商品 ID 是否已经存在于输入表格中；如果已经存在就跳过，如果不存在就采集完整信息并追加到原表格末尾。输入和输出是同一个 Excel 文件。

## 前置要求

- Node.js 18 或更高版本
- Playwright Chromium
- 可以正常访问 Amazon.com 的网络环境
- 卖家精灵账号
- 已解压的卖家精灵 Chrome 扩展目录
- Excel 模板文件

本项目主要在 macOS 上测试。Windows 理论上也可以运行，因为脚本本身是 Node.js + Playwright；主要区别是路径写法不同，例如 Windows 路径通常类似 `C:\Users\YourName\Desktop\extension`，macOS 路径通常类似 `/Users/yourname/Desktop/extension`。

## 安装

```bash
npm install
npx playwright install chromium
```

复制配置文件：

```bash
cp .env.example .env
```

Windows PowerShell 可以使用：

```powershell
Copy-Item .env.example .env
```

## 配置

在 `.env` 中填写配置：

```env
SELLER_SPRITE_USERNAME=
SELLER_SPRITE_PASSWORD=
SELLER_SPRITE_EXTENSION_PATH=
SEARCH_QUERY=pop up greeting card
MIN_CHILD_MONTHLY_SALES=1000
AMAZON_COUNTRY=US
AMAZON_ZIP=10001
AMAZON_LOGIN_ATTEMPTS=2
OUTPUT_ROOT=outputs
TEMPLATE_PATH=/path/to/选品表格-模板.xlsx
USER_DATA_DIR=browser-profile
HEADLESS=false
```

`OUTPUT_ROOT=outputs` 表示脚本输出结果的根目录。脚本一每次运行都会在这个目录下创建一个新的结果文件夹，用来保存 Excel、图片和日志。

`SELLER_SPRITE_EXTENSION_PATH` 表示卖家精灵扩展的本地路径。这里需要填写已经解压后的 Chrome 扩展目录，并且这个目录里面必须能看到 `manifest.json` 文件。

`.env` 不应该提交到 GitHub，因为里面会包含账号、密码和本机路径。

## 使用

生成新的选品表格：

```bash
npm start
```

追加新增商品到已有表格：

```bash
npm run append-new -- --input /path/to/已有选品表格.xlsx
```

如果 Amazon 或卖家精灵出现验证码、人工确认、同步登录等页面，需要在脚本打开的浏览器里手动完成。完成后脚本会继续执行。

## 测试

```bash
npm run check
npm test
```

## 不要上传的内容

以下内容已经通过 `.gitignore` 忽略，不建议上传到 GitHub：

- `.env`
- `node_modules/`
- `outputs/`
- `browser-profile/`
- `backups/`
- `extensions/sellersprite-extension/`
- `.playwright/`

卖家精灵扩展请由使用者自行下载并在 `.env` 中配置路径。

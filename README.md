# Amazon_Web_Script

Amazon 贺卡选品自动化脚本。项目包含两个脚本，用于从 Amazon Greeting Cards 页面采集满足条件的商品，并生成或更新 Excel 选品表格。

## 功能

- 脚本一：生成当天完整选品表格。
- 脚本二：输入一个已有表格，只把当天新增商品追加到这个表格底部。

默认筛选条件：

- 关键词 `pop up greeting card`
- 商品标题包含 `pop up`、`popup`、`pop-up` 等类似字眼
- 近 30 天销量（子体）`>= 1000`
- Amazon 类目为 `Greeting Cards`

这些配置可以在 `.env` 中修改。

## 一、Mac 安装

### 1. 安装基础软件

需要先安装：

- Git
- Node.js 18 或更高版本
- Google Chrome，可选；默认使用 Playwright 自带的 Chromium
- 卖家精灵 Chrome 扩展

如果使用 Homebrew：

```bash
brew install git node
```

如果你想改用自己电脑上的 Google Chrome，再安装 Chrome：

```bash
brew install --cask google-chrome
```

检查版本：

```bash
git --version
node -v
```

### 2. 下载项目

```bash
cd ~/Documents
mkdir -p project
cd project
git clone https://github.com/Yuewei481/Amazon_Web_Script.git
cd Amazon_Web_Script
```

### 3. 安装依赖

```bash
npm install
npx playwright install chromium
```

### 4. 准备卖家精灵扩展

请自行下载卖家精灵 Chrome 扩展并解压。解压后的目录里必须能看到 `manifest.json` 文件。

例如：

```text
/Users/你的用户名/Desktop/sellersprite-extension/manifest.json
```

`.env` 里填写的是扩展文件夹路径，不是 `manifest.json` 文件本身。

### 5. 配置 `.env`

```bash
cp .env.example .env
nano .env
```

Mac 示例：

```env
SELLER_SPRITE_USERNAME="你的卖家精灵账号"
SELLER_SPRITE_PASSWORD="你的卖家精灵密码"
SELLER_SPRITE_EXTENSION_PATH="/Users/你的用户名/Desktop/sellersprite-extension"
SEARCH_QUERY="pop up greeting card"
CATEGORY_NAME="Greeting Cards"
TITLE_KEYWORDS="pop up,popup,pop-up"
MIN_CHILD_MONTHLY_SALES=1000
AMAZON_COUNTRY=US
AMAZON_ZIP=10001
AMAZON_LOGIN_ATTEMPTS=2
OUTPUT_ROOT=outputs
USER_DATA_DIR=browser-profile
HEADLESS=false
```

## 二、Windows 安装

### 1. 安装基础软件

Windows 需要先安装：

- Git for Windows
- Node.js 18 或更高版本
- Google Chrome，可选；默认使用 Playwright 自带的 Chromium
- 卖家精灵 Chrome 扩展

### 2. 打开 Git Bash 或 PowerShell

本项目可以直接用 `npm` 命令运行。Windows 推荐使用 Git Bash；如果你更熟悉 PowerShell，也可以使用 PowerShell。

### 3. 下载项目

例如放在 `D:\Amazon_Web_Script`：

```bash
cd /d
git clone https://github.com/Yuewei481/Amazon_Web_Script.git
cd Amazon_Web_Script
```

如果放在 Documents：

```bash
cd ~/Documents
git clone https://github.com/Yuewei481/Amazon_Web_Script.git
cd Amazon_Web_Script
```

### 4. 安装依赖

```bash
npm install
npx playwright install chromium
```

### 5. 准备卖家精灵扩展

请自行下载卖家精灵 Chrome 扩展并解压。解压后的目录里必须能看到 `manifest.json` 文件。

例如：

```text
C:/Users/你的用户名/Desktop/sellersprite-extension/manifest.json
```

`.env` 里填写的是扩展文件夹路径，不是 `manifest.json` 文件本身。

### 6. 配置 `.env`

Git Bash：

```bash
cp .env.example .env
notepad .env
```

PowerShell：

```powershell
Copy-Item .env.example .env
notepad .env
```

Windows 示例：

```env
SELLER_SPRITE_USERNAME="你的卖家精灵账号"
SELLER_SPRITE_PASSWORD="你的卖家精灵密码"
SELLER_SPRITE_EXTENSION_PATH="C:/Users/你的用户名/Desktop/sellersprite-extension"
SEARCH_QUERY="pop up greeting card"
CATEGORY_NAME="Greeting Cards"
TITLE_KEYWORDS="pop up,popup,pop-up"
MIN_CHILD_MONTHLY_SALES=1000
AMAZON_COUNTRY=US
AMAZON_ZIP=10001
AMAZON_LOGIN_ATTEMPTS=2
OUTPUT_ROOT=outputs
USER_DATA_DIR=browser-profile
HEADLESS=false
```

## 三、配置 `.env`

`.env` 用来保存本机运行配置和卖家精灵账号信息，不应该提交到 GitHub。

主要配置说明：

- `SELLER_SPRITE_USERNAME`：卖家精灵账号。
- `SELLER_SPRITE_PASSWORD`：卖家精灵密码。
- `SELLER_SPRITE_EXTENSION_PATH`：卖家精灵扩展的本地路径。目录里必须包含 `manifest.json`。
- `SEARCH_QUERY`：Amazon 搜索关键词，默认是 `pop up greeting card`。
- `CATEGORY_NAME`：要进入的 Amazon Best Sellers 分类名，默认是 `Greeting Cards`。这个名称需要和卖家精灵/亚马逊页面上显示的分类文字一致。
- `TITLE_KEYWORDS`：商品标题关键词过滤，多个关键词用英文逗号分隔，默认是 `pop up,popup,pop-up`。商品标题只要包含其中任意一个关键词，就会继续采集；如果写成 `TITLE_KEYWORDS=`，则不限制标题关键词。
- `MIN_CHILD_MONTHLY_SALES`：最低近 30 天子体销量，默认是 `1000`。
- `AMAZON_COUNTRY`：Amazon 站点国家，默认是 `US`。
- `AMAZON_ZIP`：Amazon 邮政编码，默认是 `10001`。
- `OUTPUT_ROOT`：输出结果根目录，默认是 `outputs`。
- `USER_DATA_DIR`：浏览器用户数据目录，默认是 `browser-profile`。
- `HEADLESS`：是否无头运行。调试时建议使用 `false`。

`OUTPUT_ROOT=outputs` 表示脚本输出结果的根目录。脚本一每次运行都会在这个目录下创建一个新的结果文件夹，用来保存 Excel、图片和日志。

`SELLER_SPRITE_EXTENSION_PATH` 表示卖家精灵扩展的本地路径。这里需要填写已经解压后的 Chrome 扩展目录，并且这个目录里面必须能看到 `manifest.json` 文件。

Excel 模板已经包含在项目的 `templates/选品表格-模板.xlsx` 中，不需要用户在 `.env` 里单独填写模板路径。

## 四、运行脚本

下面的路径请换成你本机项目的绝对路径。

### Mac 运行脚本一

```bash
cd /Users/你的用户名/Documents/project/Amazon_Web_Script
npm start
```

脚本一会生成完整选品表格。

默认输出位置：

```text
outputs/pop-up-greeting-card-YYYY-MM-DD-HHMM/选品表格-pop-up-greeting-card-YYYY-MM-DD.xlsx
```

### Windows 运行脚本一

Git Bash 中可以使用：

```bash
cd /d/Amazon_Web_Script
npm start
```

或者：

```bash
cd /c/Users/你的用户名/Documents/Amazon_Web_Script
npm start
```

### Mac 运行脚本二

```bash
cd /Users/你的用户名/Documents/project/Amazon_Web_Script
npm run append-new -- --input "/Users/你的用户名/Desktop/已有选品表格.xlsx"
```

### Windows 运行脚本二

```bash
cd /d/Amazon_Web_Script
npm run append-new -- --input "C:/Users/你的用户名/Desktop/已有选品表格.xlsx"
```

脚本二不会生成新的最终表格，也不会在 `outputs/` 里留下新的结果文件夹，而是直接修改你输入的原有表格：

- 已存在的商品 ID：跳过
- 今日新增商品 ID：采集完整信息并追加到表格底部
- 今日消失的商品 ID：不删除，继续保留
- 运行过程中的临时图片和日志会放在系统临时目录，用完后自动清理

## 五、修改输出位置

默认情况下，脚本一会输出到项目文件夹里的：

```text
outputs/
```

### Mac 输出目录示例

在 `.env` 里修改：

```env
OUTPUT_ROOT="/Users/你的用户名/Desktop/amazon-outputs"
```

### Windows 输出目录示例

在 `.env` 里修改：

```env
OUTPUT_ROOT="C:/Users/你的用户名/Desktop/amazon-outputs"
```

脚本一会把完整选品表格、图片和日志输出到这个目录。脚本二不会使用这个目录留下结果文件夹，最终只会直接修改你输入的 Excel 表格本身。

## 六、常见注意事项

- `.env` 中只要值里有空格，就建议使用英文双引号，例如 `SEARCH_QUERY="pop up greeting card"`。
- 如果你修改了搜索词和分类，也要按需要修改 `TITLE_KEYWORDS`。例如采集 baby toys 时，可以设置为 `TITLE_KEYWORDS="baby,toy,teether"`；如果不想按标题过滤，可以设置为 `TITLE_KEYWORDS=`。
- Windows 路径推荐使用 `C:/...`，不要混用中文引号。
- 第一次运行时，Amazon 或卖家精灵可能要求人工登录、验证码、同步网页端账号等操作。请在脚本打开的浏览器里手动完成。
- 脚本搜索 `pop up greeting card` 后，会自动等待 2 分钟，用来给你在搜索结果页手动同步卖家精灵。
- 卖家精灵加载速度可能较慢，脚本会等待数据出现后再采集。
- 如果卖家精灵显示部分字段为 `N/A`，通常是 Amazon 或卖家精灵暂时没有返回对应数据。
- 如果 Amazon 出现异常页面，可以稍后重试，或者清理 `browser-profile/` 后重新运行。
- 如果脚本提示已有运行正在进行，说明另一个 `npm start` 或 `append-new` 还没结束。请先关闭另一个终端；如果确认旧脚本已经停止，可以删除 `browser-profile/.run.lock` 后再运行。
- 不要把 `.env`、`outputs/`、`browser-profile/`、`node_modules/`、卖家精灵扩展目录上传到 GitHub。

## 七、不要上传的内容

以下内容已经通过 `.gitignore` 忽略，不建议上传到 GitHub：

- `.env`
- `node_modules/`
- `outputs/`
- `browser-profile/`
- `backups/`
- `extensions/sellersprite-extension/`
- `.playwright/`

卖家精灵扩展请由使用者自行下载并在 `.env` 中配置路径。

## 八、Codex 自动化

本项目也可以链接到 Codex 自动化里，让 Codex 每天自动运行脚本来爬取数据。

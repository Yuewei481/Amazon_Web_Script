# Amazon_Web_Script

Amazon 自动化选品脚本。项目包含两个常用命令：

- `npm start`：创建一份新的完整选品 Excel。
- `npm run append-new -- --input "已有表格路径"`：把今天新增的商品追加到已有 Excel 底部。

脚本会打开浏览器，进入 Amazon，配合卖家精灵采集商品信息、图片和销量数据。

## 一、先读这个

### 1. Windows 终端不要混用

Windows 可以使用 Git Bash，也可以使用 PowerShell。

请从下载项目、安装依赖、启动脚本开始，始终使用同一个终端。

- 如果你准备用 Git Bash 运行脚本，就用 Git Bash 完成下载项目、安装依赖、启动脚本。
- 如果你准备用 PowerShell 运行脚本，就用 PowerShell 完成下载项目、安装依赖、启动脚本。

不要一会儿用 PowerShell，一会儿用 Git Bash。两个终端的路径写法不同，混用很容易导致 `cd` 路径错误、找不到文件、找不到 `.env` 或找不到 Excel。

### 2. 项目推荐放置位置

为了让命令前后一致，建议按下面位置放项目。

Mac 推荐：

```text
/Users/你的用户名/Documents/project/Amazon_Web_Script
```

Windows 推荐：

```text
D:\Amazon_Web_Script
```

如果你的电脑没有 D 盘，也可以放在：

```text
C:\Users\你的用户名\Documents\Amazon_Web_Script
```

### 3. 卖家精灵扩展路径

`.env` 里的 `SELLER_SPRITE_EXTENSION_PATH` 要填写卖家精灵扩展文件夹路径，不是 `manifest.json` 文件路径。

正确示例：

```text
C:/Users/你的用户名/Desktop/sellersprite-extension
```

这个文件夹里面必须能看到：

```text
manifest.json
```

错误示例：

```text
C:/Users/你的用户名/Desktop/sellersprite-extension/manifest.json
```

## 二、Mac 安装教程

### 1. 安装基础软件

Mac 需要安装：

- Git
- Node.js 18 或更高版本
- 卖家精灵 Chrome 扩展

如果你已经安装 Homebrew，可以在 Terminal 里运行：

```bash
brew install git node
```

如果你没有 Homebrew，也可以直接去 Node.js 官网下载安装包，安装 Node.js 18 或更高版本。

安装后检查版本：

```bash
git --version
node -v
npm -v
```

如果这三个命令都能显示版本号，就可以继续。

### 2. 下载项目

打开 Terminal，运行：

```bash
cd ~/Documents
mkdir -p project
cd project
git clone https://github.com/Yuewei481/Amazon_Web_Script.git
cd Amazon_Web_Script
```

运行完以后，项目位置应该是：

```text
/Users/你的用户名/Documents/project/Amazon_Web_Script
```

### 3. 安装依赖

继续在同一个 Terminal 窗口里运行：

```bash
npm install
npx playwright install chromium
```

### 4. 创建并编辑 `.env`

继续在项目目录里运行：

```bash
cp .env.example .env
open -e .env
```

系统会用 TextEdit 打开 `.env`。修改完以后按 `Command + S` 保存。

Mac `.env` 示例：

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

## 三、Windows 安装教程：Git Bash 版本

如果你选择 Git Bash，就从这一节开始一直用 Git Bash。不要中途换成 PowerShell。

### 1. 安装基础软件

Windows 需要安装：

- Git for Windows
- Node.js 18 或更高版本
- 卖家精灵 Chrome 扩展

安装 Git for Windows 后，电脑里会出现 Git Bash。

安装 Node.js 时，使用默认选项即可。安装完成后关闭旧的 Git Bash 窗口，重新打开一个新的 Git Bash，让它读取新的环境变量。

### 2. 检查版本

打开 Git Bash，运行：

```bash
git --version
node -v
npm -v
```

如果这三个命令都能显示版本号，就可以继续。

如果 Git Bash 提示 `node: command not found` 或 `npm: command not found`，说明 Node.js 没有正确安装，或者安装后没有重新打开 Git Bash。请重新安装 Node.js，并重新打开 Git Bash。

### 3. 下载项目到 D 盘

如果你的电脑有 D 盘，推荐放在 `D:\Amazon_Web_Script`。

在 Git Bash 里运行：

```bash
cd /d
git clone https://github.com/Yuewei481/Amazon_Web_Script.git
cd /d/Amazon_Web_Script
```

如果你的电脑没有 D 盘，放到 Documents：

```bash
cd /c/Users/你的用户名/Documents
git clone https://github.com/Yuewei481/Amazon_Web_Script.git
cd /c/Users/你的用户名/Documents/Amazon_Web_Script
```

注意把 `你的用户名` 换成 Windows 电脑上的真实用户名。

### 4. 安装依赖

继续在同一个 Git Bash 窗口里运行：

```bash
npm install
npx playwright install chromium
```

### 5. 创建并编辑 `.env`

如果项目在 D 盘，先确认你在项目目录：

```bash
cd /d/Amazon_Web_Script
```

然后运行：

```bash
cp .env.example .env
notepad .env
```

系统会用记事本打开 `.env`。修改完以后按 `Ctrl + S` 保存。

Windows Git Bash `.env` 示例：

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
OUTPUT_ROOT=C:/Users/你的用户名/Desktop/Amazon_output
USER_DATA_DIR=browser-profile
HEADLESS=false
```

Windows 路径推荐在 `.env` 里写成 `C:/...`，不要写中文引号。

## 四、Windows 安装教程：PowerShell 版本

如果你选择 PowerShell，就从这一节开始一直用 PowerShell。不要中途换成 Git Bash。

### 1. 安装基础软件

Windows 需要安装：

- Git for Windows
- Node.js 18 或更高版本
- 卖家精灵 Chrome 扩展

安装 Node.js 后，关闭旧的 PowerShell 窗口，重新打开一个新的 PowerShell。

### 2. 检查版本

打开 PowerShell，运行：

```powershell
git --version
node -v
npm -v
```

如果这三个命令都能显示版本号，就可以继续。

如果 PowerShell 提示无法识别 `node` 或 `npm`，说明 Node.js 没有正确安装，或者安装后没有重新打开 PowerShell。请重新安装 Node.js，并重新打开 PowerShell。

### 3. 下载项目到 D 盘

如果你的电脑有 D 盘，推荐放在 `D:\Amazon_Web_Script`。

在 PowerShell 里运行：

```powershell
Set-Location D:\
git clone https://github.com/Yuewei481/Amazon_Web_Script.git
Set-Location D:\Amazon_Web_Script
```

如果你的电脑没有 D 盘，放到 Documents：

```powershell
Set-Location "$HOME\Documents"
git clone https://github.com/Yuewei481/Amazon_Web_Script.git
Set-Location "$HOME\Documents\Amazon_Web_Script"
```

### 4. 安装依赖

继续在同一个 PowerShell 窗口里运行：

```powershell
npm install
npx playwright install chromium
```

### 5. 创建并编辑 `.env`

如果项目在 D 盘，先确认你在项目目录：

```powershell
Set-Location D:\Amazon_Web_Script
```

然后运行：

```powershell
Copy-Item .env.example .env
notepad .env
```

系统会用记事本打开 `.env`。修改完以后按 `Ctrl + S` 保存。

Windows PowerShell `.env` 示例：

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
OUTPUT_ROOT=C:/Users/你的用户名/Desktop/Amazon_output
USER_DATA_DIR=browser-profile
HEADLESS=false
```

## 五、`.env` 配置说明

常用配置：

- `SELLER_SPRITE_USERNAME`：卖家精灵账号，必须填写。
- `SELLER_SPRITE_PASSWORD`：卖家精灵密码，必须填写。
- `SELLER_SPRITE_EXTENSION_PATH`：卖家精灵扩展文件夹路径，必须填写。
- `SEARCH_QUERY`：Amazon 搜索词。
- `CATEGORY_NAME`：搜索后要进入的 Amazon Best Sellers 分类名。
- `TITLE_KEYWORDS`：标题关键词过滤，多个关键词用英文逗号分隔。
- `MIN_CHILD_MONTHLY_SALES`：最低近 30 天子体销量。
- `AMAZON_COUNTRY`：Amazon 站点国家，通常写 `US`。
- `AMAZON_ZIP`：Amazon 邮编，默认 `10001`。
- `OUTPUT_ROOT`：脚本一输出文件夹。
- `USER_DATA_DIR`：浏览器用户数据目录，默认 `browser-profile`。
- `HEADLESS`：是否隐藏浏览器窗口，日常使用建议 `false`。

示例：

```env
SEARCH_QUERY="massage gun"
CATEGORY_NAME="handheld massagers"
TITLE_KEYWORDS="RENPHO,cotsoco"
MIN_CHILD_MONTHLY_SALES=1000
```

这个配置表示：

- 在 Amazon 搜索 `massage gun`。
- 进入 `handheld massagers` 这个 Best Sellers 分类。
- 只记录标题里包含 `RENPHO` 或 `cotsoco` 的商品。
- 只记录近 30 天子体销量大于等于 `1000` 的商品。

如果想不限制标题关键词，可以写：

```env
TITLE_KEYWORDS=
```

## 六、使用教程：脚本一，创建新的完整 Excel

脚本一适合第一次创建某个搜索词的完整选品表格。

### Mac

打开 Terminal：

```bash
cd /Users/你的用户名/Documents/project/Amazon_Web_Script
npm start
```

### Windows Git Bash

如果项目在 D 盘，打开 Git Bash：

```bash
cd /d/Amazon_Web_Script
npm start
```

如果项目在 Documents：

```bash
cd /c/Users/你的用户名/Documents/Amazon_Web_Script
npm start
```

### Windows PowerShell

如果项目在 D 盘，打开 PowerShell：

```powershell
Set-Location D:\Amazon_Web_Script
npm start
```

如果项目在 Documents：

```powershell
Set-Location "$HOME\Documents\Amazon_Web_Script"
npm start
```

### 脚本一输出在哪里

如果 `.env` 里写的是：

```env
OUTPUT_ROOT=outputs
```

结果会输出到项目里的 `outputs` 文件夹。

如果 Windows `.env` 里写的是：

```env
OUTPUT_ROOT=C:/Users/你的用户名/Desktop/Amazon_output
```

结果会输出到桌面的 `Amazon_output` 文件夹。

每次运行会生成一个新的文件夹，里面有 Excel、图片和日志。

## 七、使用教程：脚本二，追加新增商品到已有 Excel

脚本二适合第二天继续采集同一个搜索词，并把今天新增商品追加到已有 Excel 底部。

运行脚本二前，请关闭要写入的 Excel 文件。不要一边打开 Excel 编辑，一边让脚本写入。

### Mac

打开 Terminal：

```bash
cd /Users/你的用户名/Documents/project/Amazon_Web_Script
npm run append-new -- --input "/Users/你的用户名/Desktop/已有选品表格.xlsx"
```

也可以输入到 `--input ` 后，把 Excel 文件拖进 Terminal，再按回车。

### Windows Git Bash

如果项目在 D 盘，打开 Git Bash：

```bash
cd /d/Amazon_Web_Script
npm run append-new -- --input "C:/Users/你的用户名/Desktop/已有选品表格.xlsx"
```

也可以先输入：

```bash
npm run append-new -- --input
```

然后输入一个空格，把 Excel 文件拖进 Git Bash，再按回车。

### Windows PowerShell

如果项目在 D 盘，打开 PowerShell：

```powershell
Set-Location D:\Amazon_Web_Script
npm run append-new -- --input "C:/Users/你的用户名/Desktop/已有选品表格.xlsx"
```

PowerShell 也可以拖入 Excel 文件，但拖入后请确认路径被英文双引号包住。

### 脚本二会生成新表格吗

不会。脚本二会直接修改你传入的那个 Excel 文件：

- 已存在的商品 ID：跳过。
- 新出现的商品 ID：追加到表格底部。
- 今天没出现的旧商品：保留，不删除。

## 八、运行过程中需要人工做什么

### 1. Amazon 登录

第一次运行时，浏览器可能打开 Amazon 登录页面。

你需要手动：

1. 输入 Amazon 账号。
2. 输入密码。
3. 完成验证码或安全验证。

完成后不要关闭浏览器，脚本会自动继续。

### 2. 手动同步卖家精灵

当终端里出现这句话：

```text
请在搜索结果页手动同步卖家精灵。脚本会等待 5 分钟后继续运行。
```

你需要去浏览器里的 Amazon 搜索结果页检查卖家精灵。

- 如果卖家精灵需要登录或同步，就按页面提示完成。
- 如果卖家精灵数据已经正常显示，就不用操作。

完成后不用按终端，等待 5 分钟，脚本会自动继续。

### 3. 判断脚本是否结束

如果脚本打开的浏览器还没有自动关闭，通常说明脚本还在运行，请继续等待。

如果终端回到可以输入命令的状态，说明脚本已经结束。

## 九、常见问题

### 1. 提示已有脚本正在运行

报错类似：

```text
Another Amazon Web Script run is already active
```

先确认没有另一个 Terminal、Git Bash 或 PowerShell 正在运行脚本。

如果确认旧脚本已经停止，可以删除锁文件。

Mac：

```bash
cd /Users/你的用户名/Documents/project/Amazon_Web_Script
rm -f browser-profile/.run.lock
```

Windows Git Bash：

```bash
cd /d/Amazon_Web_Script
rm -f browser-profile/.run.lock
```

Windows PowerShell：

```powershell
Set-Location D:\Amazon_Web_Script
Remove-Item .\browser-profile\.run.lock -ErrorAction SilentlyContinue
```

### 2. Git Bash 里找不到 node 或 npm

原因通常是 Node.js 没装好，或者安装 Node.js 后没有重新打开 Git Bash。

处理方法：

1. 重新安装 Node.js 18 或更高版本。
2. 关闭所有 Git Bash。
3. 重新打开 Git Bash。
4. 运行：

```bash
node -v
npm -v
```

### 3. PowerShell 里找不到 node 或 npm

处理方法：

1. 重新安装 Node.js 18 或更高版本。
2. 关闭所有 PowerShell。
3. 重新打开 PowerShell。
4. 运行：

```powershell
node -v
npm -v
```

### 4. 提示找不到卖家精灵扩展

检查 `.env` 里的：

```env
SELLER_SPRITE_EXTENSION_PATH=
```

它必须指向扩展文件夹，并且这个文件夹里必须有 `manifest.json`。

### 5. Amazon 页面异常或加载很慢

可以稍后重试。脚本已经会等待页面和卖家精灵数据加载，但 Amazon 页面偶尔会很慢或显示异常页面。

### 6. Excel 写入失败

运行脚本二前，请关闭要写入的 Excel 文件。Excel 打开时可能会锁住文件，导致脚本无法写入。

## 十、不要做的事情

- 不要同时运行两个脚本。
- 不要在脚本运行时关闭终端。
- 不要在脚本运行时关闭脚本打开的浏览器。
- 不要把 `.env` 上传到 GitHub。
- 不要把 `browser-profile` 上传到 GitHub。
- 不要把 `outputs` 上传到 GitHub。
- 不要把卖家精灵扩展文件夹上传到 GitHub。

## 十一、不要上传的内容

以下内容已经通过 `.gitignore` 忽略，不建议上传到 GitHub：

- `.env`
- `node_modules/`
- `outputs/`
- `browser-profile/`
- `backups/`
- `extensions/sellersprite-extension/`
- `.playwright/`

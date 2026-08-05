# 🎬 AnimeHub - 无广告动漫在线平台

一款纯前端的动漫在线观看网站，支持移动端适配，可一键部署到 GitHub Pages。

## ✨ 功能特性

- 🎥 **在线播放** - 自定义视频播放器，支持弹幕、倍速、画质切换、进度记忆
- 📢 **更新提醒** - 追番日历 + 浏览器通知，动漫更新第一时间知晓
- ⭐ **追番收藏** - 本地存储收藏列表和观看进度，换设备也不怕
- 🔍 **搜索筛选** - 支持关键词搜索 + 多分类快速筛选
- 📱 **移动适配** - 完美适配手机/平板/PC 全设备
- 🚀 **极速体验** - 纯静态页面，秒开无广告，PWA 支持离线访问
- 🎨 **精美 UI** - 深色模式，暗色主题，护眼不累眼

## 🚀 部署到 GitHub Pages（最简单的方法）

### 方法一：通过 GitHub Actions 自动部署（推荐）

1. **创建 GitHub 仓库**
   - 登录 GitHub，点击右上角 `+` → `New repository`
   - 仓库名随便填（例如 `animehub`），选择 Public，点击 `Create repository`

2. **上传代码**（二选一）
   
   **方式 A：网页上传**
   - 进入刚创建的仓库，点击 `Add file` → `Upload files`
   - 把本项目所有文件拖进去（包括 .github 文件夹）
   - 底部填写 Commit message，点击 `Commit changes`

   **方式 B：命令行上传**
   ```bash
   # 进入项目目录
   cd /workspace
   
   # 初始化 git
   git init
   git add .
   git commit -m "init: 动漫平台初始化"
   git branch -M main
   
   # 替换为你自己的仓库地址
   git remote add origin https://github.com/你的用户名/仓库名.git
   git push -u origin main
   ```

3. **开启 GitHub Pages**
   - 仓库页面点击顶部 `Settings`
   - 左侧菜单找到 `Pages`
   - 在 `Build and deployment` → `Source` 中选择 **GitHub Actions**
   - 等待 1-2 分钟，页面上方会显示部署成功的网址 ✅

4. **访问你的网站**
   - 地址格式：`https://你的用户名.github.io/仓库名/`
   - 完成！把链接分享给朋友吧 🎉

### 方法二：静态文件直接部署

1. 仓库设置 → Pages → Source 选择 `Deploy from a branch`
2. Branch 选择 `main` / `root`，保存即可

## 📱 添加到手机桌面（PWA）

网站支持 PWA，可以像 App 一样使用：

- **iPhone**：Safari 打开网站 → 分享按钮 → 添加到主屏幕
- **Android**：Chrome 打开网站 → 菜单 → 添加到主屏幕 / 安装应用

## ⚙️ 自定义你的动漫数据

编辑 `js/data.js` 中的 `ANIME_DATA` 数组：

```javascript
{
    id: 1,                  // 唯一 ID
    name: '进击的巨人',       // 动漫名称
    coverEmoji: '⚔️',       // 封面占位图（没有图片时用 emoji）
    cover: '图片URL',        // 实际封面图（可选）
    banner: '渐变色背景',     // 详情页顶栏背景
    desc: '剧情简介...',
    score: 9.5,             // 评分
    category: ['热血', '科幻'], // 分类
    year: 2023,
    status: '连载中',         // 连载中 / 完结
    studio: 'MAPPA',        // 制作公司
    totalEp: 87,            // 总集数
    updatedEp: 87,          // 更新到第几集
    updateDay: 1,           // 周几更新 (0=周日, 1=周一, ... 6=周六)
    lastUpdate: '2023-11-05', // 最后更新日期
    isHot: true,            // 是否上首页推荐
    isNew: false,           // 是否显示 NEW 标签
    videoSources: [         // 每一集的播放地址
        { ep: 1, title: '第1话 开始', url: '视频直链地址.m3u8或mp4' },
        // ...
    ]
}
```

## 🎯 视频源说明

目前代码中使用的是公共测试视频源（示例用）。替换为真实视频源：

- 支持 **MP4 / M3U8 / WebM** 等浏览器可播放格式
- M3U8 需要服务器支持 CORS 跨域
- 如果视频加载失败，可能是：
  1. 视频源失效了 → 换一个地址
  2. 跨域限制 → 视频服务器需允许跨域

## 📂 项目结构

```
/workspace
├── index.html              # 首页（列表/更新/收藏）
├── detail.html             # 动漫详情页
├── watch.html              # 播放页
├── manifest.json           # PWA 配置
├── .nojekyll               # GitHub Pages 配置（必须）
├── .github/workflows/
│   └── deploy.yml          # 自动部署配置
├── css/
│   └── style.css           # 样式（响应式）
└── js/
    ├── data.js             # 动漫数据（改这个添加番剧）
    ├── app.js              # 首页逻辑
    ├── detail.js           # 详情页逻辑
    └── watch.js            # 播放器逻辑
```

## 🛠️ 本地预览

直接双击 `index.html` 即可在浏览器打开。
如需完整功能（通知等），启动一个本地服务器：

```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx serve .
```

然后访问 http://localhost:8000

## 📋 更新后续动漫列表

网站上线后，要添加新番或更新集数：
1. 在本地修改 `js/data.js`
2. 重新 push 到 GitHub 仓库
3. GitHub Actions 会自动重新部署，1分钟后生效 ✨

## 🎨 自定义主题颜色

修改 `css/style.css` 顶部的 CSS 变量：

```css
:root {
    --primary: #e94560;    /* 主题色 */
    --bg: #0f0f1a;         /* 背景色 */
    --bg-card: #16213e;    /* 卡片色 */
    /* ... */
}
```

---

**Made with ❤️ 纯 HTML/CSS/JS，零依赖，零构建，打开即玩**

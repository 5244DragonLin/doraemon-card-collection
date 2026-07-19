# kadong-card-collection

基于纯前端（原生 HTML/CSS/JS，零构建）的卡动文创多 IP 卡牌收藏管理网站，支持真 3D Coverflow 圆环预览、卡包/级别分层浏览、收藏进度与本地持久化；当前内置哆啦A梦、三国志8 REMAKE、CF穿越火线三个 IP，可在顶部一键切换。

## 📸项目预览

![卡包浏览](assets/image-20260707111340818.png)

![卡牌预览与 3D Coverflow 圆环](assets/image-20260707111348807.png)

## 为什么需要？

- 卡动文创各 IP 的卡牌散落在大量图鉴文件夹中，难一眼览尽已收集情况
- 想以"翻卡"的仪式感浏览卡片，普通相册式列表缺乏沉浸感
- 收藏进度靠记忆，无法量化"还差哪些"
- 同一个收藏站要同时管理多个 IP（哆啦A梦 / 三国志 / CF穿越火线），而非各建一套

**kadong-card-collection 解决这些问题**：一个零依赖、可离线打开的本地收藏站，把卡动文创图鉴目录变成可检索、可标记、按 IP 隔离的多合一收藏册。

## ⭐亮点

- **多 IP 合一**：内置哆啦A梦、三国志8 REMAKE、CF穿越火线三个 IP，顶部一键切换，数据与收藏彼此隔离
- **真 3D Coverflow**：基于 CSS `perspective + rotateY + translateZ` 的弧形圆环预览，卡牌沿弧排列、左右渐退消失
- **流畅拖拽**：鼠标/触摸横向拖拽，浮点 `virtualIndex` 连续更新，松手平滑吸附
- **分层浏览**：各 IP 按卡包（卡牌类 + 周边类）与级别从低到高分组
- **收藏管理**：一键标记拥有、localStorage 按 IP 持久化、导入导出 JSON 备份
- **检索筛选**：实时搜索 + 只看未拥有，快速定位缺口
- **智能去重标记**：同一卡面在不同卡包中复用时，标记一张自动同步标记所有同图卡牌；基于文件名 + wHash 感知哈希双重验证，精确区分同名但不同设计的卡牌
- **进度可视化**：总进度 + 卡包进度条 + 级别进度
- **每 IP 主题色**：切换 IP 时界面强调色与头部渐变随 IP 切换
- **零依赖离线**：纯前端无构建，`file://` 直接打开，数据内联规避 CORS

## 🚀快速开始

### 1. 克隆项目

```bash
# Gitee 镜像（国内访问快）
git clone https://gitee.com/yhl5244/kadong-card-collection.git

# GitHub 原仓库
git clone https://github.com/5244DragonLin/kadong-card-collection.git

cd kadong-card-collection
```

### 2. 安装 Python 依赖

Python 脚本（数据生成/去重检测）依赖：

```bash
pip install -r requirements.txt
```

> 如果仅浏览收藏（不重新生成数据），此步可跳过。

### 3. 配置文件（可选）

数据脚本默认已指向本地图鉴根目录，一般无需修改。如需自定义，复制 `config.example.yaml` 为 `config.yaml` 后按需调整（见「配置文件」章节）。

### 4. 打开网站 / 重新生成数据

```bash
# 方式一：直接打开（出厂已内置全部数据，开箱即用）
# 双击 index.html，浏览器以 file:// 协议打开，无需 HTTP 服务器

# 方式二：重新生成数据（图鉴目录有变动时）
python generate_data.py
```

> 数据已内联为 `data.js`（`var CARD_COLLECTIONS = {...};`），通过 `<script>` 标签加载，绕过了 `file://` 下的 `fetch` CORS 限制。仓库出厂已内置前端所需的全部数据文件，开箱即用。

## 🗄️项目结构

```text
kadong-card-collection/
├── index.html                  # 主页面（HTML 骨架，引用外部 CSS/JS）
├── style.css                   # 全部样式（多 IP 主题 + 3D 圆环 + 动画 + 响应式）
├── app.js                     # 核心交互（数据加载 / IP 切换 / 卡包 / 收藏 / 搜索 / 进度 / 导入导出）
├── carousel.js                 # 3D 圆环模块（Coverflow 渲染/拖拽/吸附/键盘）
├── config.js                  # 前端常量配置（IP 列表 / 每 IP 主题色 / 级别排序 / 级别配色 / 3D 参数）
├── data.js                     # 卡牌数据（脚本生成，var CARD_COLLECTIONS = { "<IP>": {...} }）
├── duplicate_groups.js         # 去重图片组映射数据（脚本生成，按 IP 分桶）
├── favicons/                   # 站点图标
├── assets/                     # README 截图与捐赠收款码
├── generate_data.py           # 数据生成脚本（按根目录遍历各 IP）
├── generate_duplicate_groups.py # 去重图片检测脚本（按 IP 分桶）
├── config.example.yaml        # 数据脚本配置参考模板
├── docs/                       # ARCHITECTURE.md / PRD.md / 图示
├── tests/                      # verify_data.py 数据校验
├── requirements.txt            # Python 依赖（PyYAML / Pillow / imagehash / numpy / scipy）
├── README.md
└── LICENSE
```

Script 加载顺序：

```html
<script src="data.js"></script>              <!-- 1. 数据 → CARD_COLLECTIONS -->
<script src="duplicate_groups.js"></script>  <!-- 2. 去重组数据 → DUPLICATE_GROUPS（按 IP 分桶） -->
<script src="config.js"></script>            <!-- 3. 配置 → AppConfig -->
<script src="app.js"></script>                <!-- 4. 核心逻辑 → App + CollectionStore -->
<script src="carousel.js"></script>            <!-- 5. 圆环模块 → CoverflowCarousel -->
```

## ⚙️配置文件（可选）

`config.example.yaml` 是配置文件模板，复制为 `config.yaml` 后按需修改：

```bash
cp config.example.yaml config.yaml
```

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `paths.root_dir` | 卡牌图片**根目录**（含各 IP 子目录：哆啦A梦 / 三国志8 REMAKE / CF穿越火线） | 内置默认值 |
| `paths.output_file` | `data.js` 输出路径 | 脚本同目录 `data.js` |
| `scan.image_extensions` | 扫描的图片扩展名 | `.png`, `.jpg`, `.jpeg` |
| `ips` | IP 顺序（与 `config.js` 中 `IP_LIST` 一致，决定切换器顺序与默认进入的 IP） | 内置 3 个 IP |
| `ip_pack_orders` | 各 IP 的卡包自定义排序（未列出的 IP 按文件夹名排序） | 哆啦A梦 15 项手写顺序；其余 IP 留空 |
| `rarity_order` | 全局级别排序表（从低到高，覆盖 3 个 IP 的全部级别） | 内置统一排序 |

> 若未提供 `config.yaml`，脚本回退到内置默认值。

## ❓️FAQ

**需要安装 Node / npm 吗？**

不需要。项目是纯前端零依赖，直接双击 `index.html` 即可，无需任何构建或本地服务器。

**三个 IP 的收藏数据会互相串扰吗？**

不会。收藏标记按 IP 隔离存储于 localStorage（键为 `kadong_collection_v1_<IP>`），切换 IP 时自动加载对应收藏，导出备份文件名也带 IP 名。

**为什么卡牌图片显示不出来？**

图片来自卡动文创图鉴整理到本地的目录，由 `generate_data.py` 以 `file:///` 加载。请确保 `config.yaml` 中 `paths.root_dir`（或脚本内置默认值）指向的图鉴根目录保持原位；若移动或重新采集，重新运行脚本生成 `data.js` 即可（卡牌 ID 基于名称，收藏数据不丢失）。

**收藏数据存在哪里？会丢失吗？**

收藏标记保存在浏览器 localStorage，随浏览器 / 设备隔离。建议用"导出收藏"生成 JSON 备份，换设备时"导入收藏"恢复。

**可以自定义卡包顺序或级别顺序吗？**

可以。在 `config.yaml` 中配置 `ip_pack_orders`（按 IP）与 `rarity_order`（全局），或编辑脚本内置默认值后重新运行脚本。

**卡牌图片切换卡包后加载慢怎么办？**

仓库已优化图片加载策略：移除原生 `loading="lazy"`，切换卡包后所有图片立即并行从本地硬盘读取。如仍遇卡顿，请确认已从最新仓库拉取代码。

## 📝已知问题 / 待改进点

- [x] 多 IP 支持：v1.0 新增 IP 切换器、每 IP 主题色与收藏隔离，数据脚本改为按根目录遍历各 IP
- [x] 不同卡包的同级别卡牌完全一致时的去重标记：v0.3 已通过智能去重标记（文件名 + wHash 感知哈希聚类）解决
- [x] 卡牌预览图边缘模糊：删除 `image-rendering: crisp-edges` 硬边放大，`object-fit: cover` 改为 `contain`
- [x] 切换卡包后图片加载延迟：移除 `loading="lazy"`，改后所有图片立即并行加载
- [ ] 各 IP 的级别（rarity）中文/英文语义排序仍按通用规则，可按手感在 `config.yaml` 的 `rarity_order` 中微调
- [ ] 新增第四个 IP 时，只需将其子目录放入图鉴根目录并在 `config.yaml` 的 `ips` 中登记即可

## 🤝贡献

欢迎提 Issue 和 PR！

1. Fork 本仓库
2. 创建分支 `git checkout -b feature/your-feature`
3. 提交改动 `git commit -m "feat: ..."`
4. 推送并发起 Pull Request

## 📋更新日志

### v1.0

- **新增：** 多 IP 合一——内置哆啦A梦、三国志8 REMAKE、CF穿越火线三个 IP，顶部一键切换，数据与收藏按 IP 隔离
- **新增：** 每 IP 主题色——切换 IP 时头部渐变、强调色、左上角铃铛、右下角返回顶部按钮及辉光全部随 IP 同步变化
- **优化：** 切换卡包 / 卡级别时滚动跳动修复（关闭滚动锚定并切换后还原滚动位置）
- **优化：** 级别排序可配置（DR/CP 紧接 SSR、TR 置于 UR 之前），仅改 config 即生效、无需重跑脚本
- **优化：** IP 列表去写死——前端运行时从 `data.js` 派生 IP 列表，已知 IP 精选配色、未知 IP 哈希自动配色，新增 IP 零代码改动
- **优化：** 仓库由 `doraemon-card-collection` 更名为 `kadong-card-collection`（GitHub / Gitee 同步）

### v0.3

- **新增：** 智能去重标记：新增 `generate_duplicate_groups.py`（去重组生成脚本）与 `duplicate_groups.js`（去重组映射数据），基于文件名 + wHash 感知哈希双重验证，精确识别同一卡面在不同卡包中的复用。前端标记一张卡牌时自动同步标记同组所有卡牌，区分同名但不同设计的情况
- **新增：** 去重数据流：`generate_duplicate_groups.py` 读取 `data.js` → 按文件名分组 → wHash 聚类 → 输出 `duplicate_groups.js`
- **新增：** 一键返回顶部按钮：右下角新增浮动圆形"返回顶部"按钮（↑），滚动超过 300px 时淡入显示，点击平滑滚动到页面顶部。铃铛金渐变圆形设计，与暖色主题统一
- **新增：** 过滤按钮三合一拆分：将原"全部显示"按钮拆分为三个独立互斥按钮——「全部显示」（金色高亮）、「只看已拥有」（绿色高亮）、「只看未拥有」（红色高亮），点击切换时自动刷新卡牌视图，状态跨卡包保留

### v0.2

- **新增：** MIT 许可证（`LICENSE`），补齐开源合规
- **新增：** 启用配置文件：`generate_data.py` 自动读取同目录 `config.yaml`（缺省回退内置默认值，缺 PyYAML 自动降级）；数据来源 / 扫描 / 排序均可配置
- **新增：** 「关联项目」章节：说明卡牌数据来自上游采集工具 [kadong_cards_crawler](https://gitee.com/yhl5244/kadong_cards_crawler)（GitHub 镜像同步），并在快速开始 / 数据生成 / FAQ 等处补充数据源说明
- **优化：** 站点图标整理：7 个 favicon 收拢至 `favicons/` 目录，根目录结构更清爽，`index.html` 引用同步更新
- **修复：** 侧边栏底部空隙：`.sidebar` 高度由 `calc(100vh - 128px)` 修正为 `calc(100vh - 80px)`，左侧与页面底部齐平（移动端隐藏逻辑不变）
- **修复：** 首页预览图虚线 / 模糊：删除 `image-rendering: crisp-edges` 硬边放大，`object-fit: cover` 改为 `contain`，卡牌完整显示、边缘平滑

### v0.1

- 初版卡牌收藏站：卡包 / 级别分层浏览、收藏标记、进度展示、搜索筛选

## 🔗关联项目

本项目自身只做展示与收藏管理，卡牌数据来自上游采集工具：

- **[kadong_cards_crawler](https://github.com/5244DragonLin/kadong_cards_crawler)** — 卡动文创（kadong）正版卡牌图鉴爬取/整理工具，本项目的 `data.js` 数据源（覆盖哆啦A梦 / 三国志8 REMAKE / CF穿越火线等多个 IP）
  - GitHub：https://github.com/5244DragonLin/kadong_cards_crawler
  - Gitee：https://gitee.com/yhl5244/kadong_cards_crawler

> 使用前请先克隆并运行 kadong_cards_crawler 获取图鉴根目录（各 IP 子目录），再在 `config.yaml` 中将 `paths.root_dir` 指向它的根目录，最后运行 `python generate_data.py`。

## ☕捐赠

如果这个项目对你有帮助，可以请我喝杯咖啡~

| 支付宝 | 微信 |
|--------|------|
| ![支付宝](assets/donate_alipay.jpg) | ![微信](assets/donate_wechat.jpg) |

## ⚠️免责声明

本项目为个人收藏与学习用途的辅助工具，所有卡牌图片及 IP 版权归原作者及权利方所有。

项目不对图片做任何重新分发；数据由使用者本地的图鉴目录生成。因使用本工具产生的一切后果由使用者自行承担，作者不承担任何法律责任。

## 📃许可证

本项目基于 [MIT](LICENSE) 协议开源。

/**
 * 集卡册 - 全局配置常量（多 IP 版）
 *
 * 定义 IP 列表 / 每 IP 主题色 / 级别排序表 / 级别颜色映射 /
 * Coverflow 3D 参数 / localStorage key / 动画时长等。
 * 全局暴露为 window.AppConfig，供 app.js / carousel.js 引用。
 *
 * 作者：工程师 寇豆码（Kou）
 */

(function (global) {
  'use strict';

  /**
   * IP 列表（运行时从 data.js 派生，单一数据源）
   * 前端不再写死 IP 名：直接读取 CARD_COLLECTIONS 的所有键。
   * 数据由 generate_data.py 按 config.yaml 的 ips 生成，
   * 因此"新增 IP"只需改 config.yaml + 重跑脚本，前端零改动。
   * IP_LIST_FALLBACK 仅在 data.js 尚未生成时回退使用。
   */
  var IP_LIST_FALLBACK = [
    "哆啦A梦",
    "三国志8 REMAKE",
    "CF穿越火线",
    "龙族"
  ];
  function ipList() {
    var keys = Object.keys(global.CARD_COLLECTIONS || {});
    return keys.length ? keys : IP_LIST_FALLBACK;
  }

  /**
   * 每个 IP 的主题强调色
   * 切换 IP 时由 AppConfig.setCurrentIp 应用到 CSS 变量（--accent / --accent-2 / --header-bg）
   * 仅影响界面配色，不影响数据与收藏
   */
  var IP_THEMES = {
    "哆啦A梦": {
      accent:   "#F39C12",
      accent2:  "#FFD700",
      headerBg: "linear-gradient(135deg, #F39C12 0%, #FFD700 50%, #F39C12 100%)"
    },
    "三国志8 REMAKE": {
      accent:   "#C0392B",
      accent2:  "#E1A93C",
      headerBg: "linear-gradient(135deg, #8E1B1B 0%, #C0392B 50%, #8E1B1B 100%)"
    },
    "CF穿越火线": {
      accent:   "#E74C3C",
      accent2:  "#34495E",
      headerBg: "linear-gradient(135deg, #1B2631 0%, #34495E 55%, #E74C3C 100%)"
    },
    "龙族": {
      accent:   "#16A085",
      accent2:  "#1ABC9C",
      headerBg: "linear-gradient(135deg, #0E6655 0%, #16A085 50%, #0E6655 100%)"
    }
  };

  /**
   * 全局级别排序表（从低到高）
   * 覆盖 3 个 IP 的全部级别代码（共享卡牌类级别 + 各 IP 专属级别）。
   * 与 generate_data.py 中 rarity_order 保持一致。
   * 未列出的未知级别排最后（见 UNKNOWN_RANK）。
   */
  var RARITY_ORDER = [
    "R", "SR", "SSR", "DR", "CP", "TR", "UR", "SP", "SSP", "SSS", "EX", "IM", "LP",
    "FR", "FP", "PR", "TB", "PL", "OC", "SJ", "SS", "S", "MAX",
    "MZ", "CGF", "DM", "GF", "ZR", "CR", "WR",
    "MR", "GR", "GP", "QR", "MP", "WRP", "GSP", "EXP",
    /* 中文 / 特殊级别（统一排最后，按展示需要微调） */
    "金属卡", "特殊SSP", "隐藏款SSP金版", "隐藏款SSP", "SSP银版",
    "隐藏款", "隐藏版", "奇妙世界", "梦想摇摇乐", "流光云彩",
    "趣味拼图", "双人款", "单人款", "梦幻花边", "EX内页", "EX封面",
    /* 龙族（集卡社图鉴）专属级别 */
    "SEC", "LGP", "USP", "XP", "MSP", "CSP"
  ];

  /**
   * 级别 → 排序 rank 映射
   * 已知级别: 0 ~ N
   * "?" 未知级别: -1（排最前）
   * 未知级别默认 rank: UNKNOWN_RANK（排最后，按名称排序）
   */
  var RARITY_RANK = {};
  RARITY_ORDER.forEach(function (r, i) {
    RARITY_RANK[r] = i;
  });
  RARITY_RANK["?"] = -1;
  var UNKNOWN_RANK = 99999;

  /**
   * 级别颜色映射表
   * 每个级别对应一个渐变背景色和文字颜色，用于动态生成级别徽章样式
   * 与 style.css 中 .rarity-badge[data-rarity="X"] 选择器保持一致
   * 已覆盖 3 个 IP 的全部级别代码
   */
  var LEVEL_COLORS = {
    "R":       { bg: "linear-gradient(135deg, #8BC34A, #558B2F)", text: "#fff" },
    "SR":      { bg: "linear-gradient(135deg, #29B6F6, #0288D1)", text: "#fff" },
    "SSR":     { bg: "linear-gradient(135deg, #7E57C2, #4527A0)", text: "#fff" },
    "UR":      { bg: "linear-gradient(135deg, #FF7043, #D84315)", text: "#fff" },
    "TR":      { bg: "linear-gradient(135deg, #FFA726, #E65100)", text: "#fff" },
    "ZR":      { bg: "linear-gradient(135deg, #AB47BC, #6A1B9A)", text: "#fff" },
    "CR":      { bg: "linear-gradient(135deg, #FFCA28, #F57F17)", text: "#fff" },
    "DR":      { bg: "linear-gradient(135deg, #EF5350, #C62828)", text: "#fff" },
    "SP":      { bg: "linear-gradient(135deg, #EC407A, #AD1457)", text: "#fff" },
    "SSP":     { bg: "linear-gradient(135deg, #5C6BC0, #283593)", text: "#fff" },
    "SSS":     { bg: "linear-gradient(135deg, #26C6DA, #006064)", text: "#fff" },
    "EX":      { bg: "linear-gradient(135deg, #FF8A65, #BF360C)", text: "#fff" },
    "IM":      { bg: "linear-gradient(135deg, #8D6E63, #3E2723)", text: "#fff" },
    "LP":      { bg: "linear-gradient(135deg, #78909C, #37474F)", text: "#fff" },
    "FR":      { bg: "linear-gradient(135deg, #42A5F5, #1565C0)", text: "#fff" },
    "FP":      { bg: "linear-gradient(135deg, #9CCC65, #33691E)", text: "#fff" },
    "CP":      { bg: "linear-gradient(135deg, #FFD54F, #F57F17)", text: "#4a3728" },
    "PR":      { bg: "linear-gradient(135deg, #FF8A65, #D84315)", text: "#fff" },
    "TB":      { bg: "linear-gradient(135deg, #4DD0E1, #006064)", text: "#fff" },
    "PL":      { bg: "linear-gradient(135deg, #A1887F, #3E2723)", text: "#fff" },
    "OC":      { bg: "linear-gradient(135deg, #FFB74D, #E65100)", text: "#fff" },
    "SJ":      { bg: "linear-gradient(135deg, #BA68C8, #4A148C)", text: "#fff" },
    "SS":      { bg: "linear-gradient(135deg, #4DB6AC, #004D40)", text: "#fff" },
    "S":       { bg: "linear-gradient(135deg, #F06292, #880E4F)", text: "#fff" },
    "MAX":     { bg: "linear-gradient(135deg, #DCE775, #827717)", text: "#4a3728" },
    "MZ":      { bg: "linear-gradient(135deg, #80DEEA, #006064)", text: "#fff" },
    "CGF":     { bg: "linear-gradient(135deg, #CE93D8, #6A1B9A)", text: "#fff" },
    "DM":      { bg: "linear-gradient(135deg, #FFAB91, #BF360C)", text: "#fff" },
    "GF":      { bg: "linear-gradient(135deg, #B2DFDB, #004D40)", text: "#fff" },
    /* 三国志8 REMAKE 专属级别 */
    "GP":      { bg: "linear-gradient(135deg, #A4B494, #5C6B4F)", text: "#fff" },
    "GR":      { bg: "linear-gradient(135deg, #4DB6AC, #00695C)", text: "#fff" },
    "WR":      { bg: "linear-gradient(135deg, #FFB74D, #E65100)", text: "#fff" },
    "MR":      { bg: "linear-gradient(135deg, #BA68C8, #4A148C)", text: "#fff" },
    /* CF穿越火线 专属级别 */
    "WRP":     { bg: "linear-gradient(135deg, #4DD0E1, #00838F)", text: "#fff" },
    "GSP":     { bg: "linear-gradient(135deg, #5C6BC0, #283593)", text: "#fff" },
    "QR":      { bg: "linear-gradient(135deg, #66BB6A, #2E7D32)", text: "#fff" },
    "MP":      { bg: "linear-gradient(135deg, #FF7043, #BF360C)", text: "#fff" },
    "EXP":     { bg: "linear-gradient(135deg, #8D6E63, #3E2723)", text: "#fff" },
    /* 龙族（集卡社图鉴）专属级别 */
    "SEC":     { bg: "linear-gradient(135deg, #BFC9CA, #7F8C8D)", text: "#fff" },
    "LGP":     { bg: "linear-gradient(135deg, #1ABC9C, #117A65)", text: "#fff" },
    "USP":     { bg: "linear-gradient(135deg, #9B59B6, #6C3483)", text: "#fff" },
    "XP":      { bg: "linear-gradient(135deg, #E67E22, #CA6F1E)", text: "#fff" },
    "MSP":     { bg: "linear-gradient(135deg, #3498DB, #21618C)", text: "#fff" },
    "CSP":     { bg: "linear-gradient(135deg, #FD79A8, #E84393)", text: "#fff" },
    /* 中文 / 特殊级别（周边与隐藏款） */
    "金属卡":   { bg: "linear-gradient(135deg, #B0BEC5, #455A64)", text: "#fff" },
    "特殊SSP":  { bg: "linear-gradient(135deg, #BA68C8, #4A148C)", text: "#fff" },
    "隐藏款SSP金版": { bg: "linear-gradient(135deg, #FFD54F, #F57F17)", text: "#4a3728" },
    "隐藏款SSP": { bg: "linear-gradient(135deg, #7986CB, #1A237E)", text: "#fff" },
    "SSP银版": { bg: "linear-gradient(135deg, #B0BEC5, #455A64)", text: "#fff" },
    "隐藏款":   { bg: "linear-gradient(135deg, #7986CB, #1A237E)", text: "#fff" },
    "隐藏版":   { bg: "linear-gradient(135deg, #9575CD, #4527A0)", text: "#fff" },
    "奇妙世界": { bg: "linear-gradient(135deg, #FFD54F, #FF6F00)", text: "#4a3728" },
    "梦想摇摇乐": { bg: "linear-gradient(135deg, #4DD0E1, #00838F)", text: "#fff" },
    "流光云彩": { bg: "linear-gradient(135deg, #81D4FA, #01579B)", text: "#fff" },
    "趣味拼图": { bg: "linear-gradient(135deg, #AED581, #33691E)", text: "#fff" },
    "双人款":   { bg: "linear-gradient(135deg, #FF8A65, #D84315)", text: "#fff" },
    "单人款":   { bg: "linear-gradient(135deg, #FFD54F, #FF8F00)", text: "#4a3728" },
    "梦幻花边": { bg: "linear-gradient(135deg, #F48FB1, #AD1457)", text: "#fff" },
    "EX内页":  { bg: "linear-gradient(135deg, #FF8A65, #BF360C)", text: "#fff" },
    "EX封面":  { bg: "linear-gradient(135deg, #FFAB91, #BF360C)", text: "#fff" },
    "?":       { bg: "#BDBDBD", text: "#fff" }
  };

  /** 默认级别颜色（未知级别兜底） */
  var DEFAULT_LEVEL_COLOR = { bg: "#BDBDBD", text: "#fff" };

  /**
   * localStorage 存储键（按 IP 隔离，避免不同 IP 收藏互相串扰）
   * value 格式: {"ownedIds": ["id1","id2",...], "savedAt": "ISO8601"}
   */
  var STORAGE_KEY_BASE = 'ccb_collection_v1';
  function storageKeyFor(ip) {
    return STORAGE_KEY_BASE + '_' + ip;
  }

  /**
   * Coverflow 3D 圆环参数
   * 控制卡牌的 3D 排列效果
   */
  var COVERFLOW = {
    ANGLE_STEP: 28,       // 每偏移1张的 rotateY 角度（度）
    SPACING: 130,         // 每偏移1张的水平间距（px）
    DEPTH: 100,           // 每偏移1张的纵深退后（px）
    MIN_SCALE: 0.4,       // 最小缩放比例
    MIN_OPACITY: 0.15,    // 最小透明度
    MAX_BLUR: 6,          // 最大模糊（px）
    MAX_VISIBLE: 4,        // 每侧最多可见卡牌数（共9张可见）
    CARD_WIDTH: 140,       // 圆环卡牌宽度（px）
    CARD_HEIGHT: 190       // 圆环卡牌高度（px）
  };

  /**
   * 动画时长常量（用于 JS 中 setTimeout/transition 时长同步）
   */
  var ANIMATION = {
    CARD_FADE_DELAY: 50,      // 卡牌入场动画延迟（ms，IntersectionObserver后）
    MODAL_TRANSITION: 300,    // 弹窗过渡时长（ms）
    COVERFLOW_SNAP: 400,      // 圆环吸附过渡时长（ms）
    MODAL_CLOSE_DELAY: 250     // 弹窗关闭动画延迟（ms）
  };

  /**
   * 应用当前 IP 主题到 CSS 变量
   * 在 App.selectIp / App.init 中调用
   * @param {string} ip - IP 名称
   */
  /**
   * 未知 IP 的自动配色（确定性哈希）
   * IP 名 → FNV-1a 哈希 → 整数 N → N mod 360 = 色相 H → HSL 配色。
   * 同一 IP 名永远得到同一颜色；不同名字分散到色环不同位置。
   * 已知 IP 已在 IP_THEMES 中精选，仅当无手写条目时走此兜底。
   */
  function autoThemeFor(ip) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < ip.length; i++) {
      h ^= ip.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h = h >>> 0;
    var hue = h % 360;
    var hue2 = (hue + 28) % 360;
    return {
      accent:   "hsl(" + hue + ", 65%, 50%)",
      accent2:  "hsl(" + hue2 + ", 60%, 42%)",
      headerBg: "linear-gradient(135deg, hsl(" + hue + ",65%,50%), hsl(" + hue2 + ",60%,42%))"
    };
  }

  /**
   * 颜色字符串 → "r, g, b" 通道（供 rgba(var(--accent-rgb), a) 带透明度使用）。
   * 支持 "#RGB" / "#RRGGBB" / "hsl(h, s%, l%)" 三种格式；解析失败回退到哆啦A梦金。
   */
  function _colorToRgbChannels(c) {
    if (!c) return "243, 156, 18";
    c = String(c).trim();
    if (c.charAt(0) === "#") {
      var h = c.slice(1);
      if (h.length === 3) {
        h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      }
      var n = parseInt(h, 16);
      if (isNaN(n)) return "243, 156, 18";
      return ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255);
    }
    var m = c.match(/hsl\(\s*([\d.]+)[\s,]*(?:%)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/i);
    if (m) {
      var hue = parseFloat(m[1]), s = parseFloat(m[2]) / 100, l = parseFloat(m[3]) / 100;
      var a = s * Math.min(l, 1 - l);
      var f = function (k) {
        var x = (k + hue / 30) % 12;
        var rgb = l - a * Math.max(-1, Math.min(x - 3, Math.min(9 - x, 1)));
        return Math.round(255 * rgb);
      };
      return f(0) + ", " + f(8) + ", " + f(4);
    }
    return "243, 156, 18";
  }

  function setCurrentIp(ip) {
    // 已知 IP 用精选配色；未知 IP 走确定性哈希自动配色（可在 IP_THEMES 中手写条目覆盖）
    var t = IP_THEMES[ip] || autoThemeFor(ip);
    if (!t) return;
    var root = document.documentElement;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-2', t.accent2);
    root.style.setProperty('--header-bg', t.headerBg);
    // 辉光用：同一主题色的 RGB 通道，供 rgba(...) 携带透明度
    root.style.setProperty('--accent-rgb', _colorToRgbChannels(t.accent));
    root.style.setProperty('--accent-2-rgb', _colorToRgbChannels(t.accent2));
  }

  /** 全局暴露 */
  global.AppConfig = {
    get IP_LIST() { return ipList(); },
    ipList: ipList,
    autoThemeFor: autoThemeFor,
    IP_THEMES: IP_THEMES,
    RARITY_ORDER: RARITY_ORDER,
    RARITY_RANK: RARITY_RANK,
    UNKNOWN_RANK: UNKNOWN_RANK,
    LEVEL_COLORS: LEVEL_COLORS,
    DEFAULT_LEVEL_COLOR: DEFAULT_LEVEL_COLOR,
    storageKeyFor: storageKeyFor,
    setCurrentIp: setCurrentIp,
    COVERFLOW: COVERFLOW,
    ANIMATION: ANIMATION
  };

})(typeof window !== 'undefined' ? window : this);

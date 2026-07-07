/**
 * 哆啦A梦卡牌收藏站 - 全局配置常量
 *
 * 定义级别排序表、级别颜色映射、Coverflow 3D 参数、localStorage key、动画时长等。
 * 全局暴露为 window.AppConfig，供 app.js / carousel.js 引用。
 *
 * 作者：工程师 寇豆码（Kou）
 */

(function (global) {
  'use strict';

  /**
   * 级别排序表（从低到高，30项）
   * 包含 29 个 ASCII 级别 + 1 个中文级别（金属卡）
   * 与 generate_data.py 中 RARITY_ORDER 保持一致
   */
  var RARITY_ORDER = [
    "R", "SR", "SSR", "UR", "TR", "ZR", "CR", "DR", "SP", "SSP", "SSS",
    "EX", "IM", "LP", "FR", "FP", "CP", "PR", "TB", "PL", "OC", "SJ",
    "SS", "S", "MAX", "MZ", "CGF", "DM", "GF", "金属卡"
  ];

  /**
   * 级别 → 排序 rank 映射
   * 已知级别: 0 ~ 29
   * "?" 未知级别: -1（排最前）
   * 未知中文级别（周边类）: 99999（排最后，按名称排序）
   */
  var RARITY_RANK = {};
  RARITY_ORDER.forEach(function (r, i) {
    RARITY_RANK[r] = i;
  });
  RARITY_RANK["?"] = -1;
  // 未知级别默认 rank
  var UNKNOWN_RANK = 99999;

  /**
   * 级别颜色映射表
   * 每个级别对应一个渐变背景色和文字颜色，用于动态生成级别徽章样式
   * 与 style.css 中 [data-rarity="X"] 选择器保持一致
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
    "金属卡":   { bg: "linear-gradient(135deg, #B0BEC5, #455A64)", text: "#fff" },
    "?":       { bg: "#BDBDBD", text: "#fff" },
    /* 周边中文级别（统一用温暖渐变） */
    "单人款":   { bg: "linear-gradient(135deg, #FFD54F, #FF8F00)", text: "#4a3728" },
    "双人款":   { bg: "linear-gradient(135deg, #FF8A65, #D84315)", text: "#fff" },
    "隐藏款":   { bg: "linear-gradient(135deg, #7986CB, #1A237E)", text: "#fff" },
    "隐藏版":   { bg: "linear-gradient(135deg, #9575CD, #4527A0)", text: "#fff" },
    "梦幻花边": { bg: "linear-gradient(135deg, #F48FB1, #AD1457)", text: "#fff" },
    "流光云彩": { bg: "linear-gradient(135deg, #81D4FA, #01579B)", text: "#fff" },
    "趣味拼图": { bg: "linear-gradient(135deg, #AED581, #33691E)", text: "#fff" },
    "奇妙世界": { bg: "linear-gradient(135deg, #FFD54F, #FF6F00)", text: "#4a3728" },
    "梦想摇摇乐": { bg: "linear-gradient(135deg, #4DD0E1, #00838F)", text: "#fff" }
  };

  /** 默认级别颜色（未知级别兜底） */
  var DEFAULT_LEVEL_COLOR = { bg: "#BDBDBD", text: "#fff" };

  /**
   * localStorage 存储键
   * value 格式: {"ownedIds": ["id1","id2",...], "savedAt": "ISO8601"}
   */
  var STORAGE_KEY = 'doraemon_collection_v2';

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
    MAX_VISIBLE: 4,       // 每侧最多可见卡牌数（共9张可见）
    CARD_WIDTH: 140,      // 圆环卡牌宽度（px）
    CARD_HEIGHT: 190      // 圆环卡牌高度（px）
  };

  /**
   * 动画时长常量（用于 JS 中 setTimeout/transition 时长同步）
   */
  var ANIMATION = {
    CARD_FADE_DELAY: 50,      // 卡牌入场动画延迟（ms，IntersectionObserver后）
    MODAL_TRANSITION: 300,    // 弹窗过渡时长（ms）
    COVERFLOW_SNAP: 400,      // 圆环吸附过渡时长（ms）
    MODAL_CLOSE_DELAY: 250    // 弹窗关闭动画延迟（ms）
  };

  /** 全局暴露 */
  global.AppConfig = {
    RARITY_ORDER: RARITY_ORDER,
    RARITY_RANK: RARITY_RANK,
    UNKNOWN_RANK: UNKNOWN_RANK,
    LEVEL_COLORS: LEVEL_COLORS,
    DEFAULT_LEVEL_COLOR: DEFAULT_LEVEL_COLOR,
    STORAGE_KEY: STORAGE_KEY,
    COVERFLOW: COVERFLOW,
    ANIMATION: ANIMATION
  };

})(typeof window !== 'undefined' ? window : this);

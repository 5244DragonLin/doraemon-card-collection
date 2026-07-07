#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
哆啦A梦卡牌收藏站 - 数据生成脚本（升级重做版 v2.0）

功能：
1. 扫描源目录下所有卡包子目录（卡牌类 + 周边类）
2. 同时扫描 .png / .jpg / .jpeg 图片文件
3. 三级正则解析策略识别卡牌级别（纯ASCII / 中文+ASCII混合 / 纯中文）
4. 生成 data.js：var DORAEMON_DATA = {...};
5. 卡牌ID基于 md5(packFullName + "/" + cardName) 前16位，路径变化不影响收藏数据
6. 支持读取同目录 config.yaml 覆盖内置默认值（需 PyYAML；pip install pyyaml）

作者：工程师 寇豆码（Kou）
日期：2025-07
"""

import os
import json
import re
import hashlib
from datetime import datetime

try:
    import yaml
except ImportError:
    yaml = None  # 未安装 PyYAML 时回退到脚本内置默认值

# ========== 路径配置 ==========
SOURCE_DIR = r"E:\BaiduSyncdisk\其他\卡动文创图鉴\哆啦A梦"
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.js")

# ========== 图片扩展名 ==========
IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg')

# ========== 卡包排序表（自定义顺序）==========
PACK_ORDER = [
    "卡牌｜经典版｜第1弹",
    "卡牌｜豪华版｜第1弹",
    "卡牌｜珍藏版｜第1弹",
    "卡牌｜豪华珍藏版｜第1弹",
    "卡牌｜寻梦卡百宝袋｜第1弹",
    "卡牌｜地球交响乐｜第1弹",
    "卡牌｜经典版｜第2弹",
    "卡牌｜豪华版｜第2弹",
    "卡牌｜珍藏版｜第2弹",
    "卡牌｜奇妙珍藏版｜第2弹",
    "卡牌｜奇妙珍藏卡｜第3弹",
    "周边｜奇妙世界色纸｜第1弹",
    "周边｜珍藏版徽章｜第1弹",
    "周边｜梦想摇摇乐｜第1弹",
    "周边｜妙趣版立牌｜第1弹",
]
PACK_RANK = {name: i for i, name in enumerate(PACK_ORDER)}

# ========== 级别排序表（从低到高，30项）==========
# 与 config.js 中 RARITY_ORDER 保持一致
RARITY_ORDER = [
    "R", "SR", "SSR", "UR", "TR", "ZR", "CR", "DR", "SP", "SSP", "SSS",
    "EX", "IM", "LP", "FR", "FP", "CP", "PR", "TB", "PL", "OC", "SJ",
    "SS", "S", "MAX", "MZ", "CGF", "DM", "GF", "金属卡"
]
RARITY_RANK = {r: i for i, r in enumerate(RARITY_ORDER)}


def get_rarity_sort_key(rarity):
    """获取级别排序键。? 未知排最前(-1)，未知中文级别排最后(99999)"""
    if rarity == "?":
        return -1
    return RARITY_RANK.get(rarity, 99999)


def parse_card_filename(filename):
    """
    解析卡牌文件名，提取级别代码、完整名称、级别名、编号。

    三级解析策略：
      第一级：纯 ASCII 级别代码（R, SR, SSR, UR, CP, EX, MAX 等）→ 直接用作级别
      第二级：中文+ASCII 混合前缀（特殊SSP, 隐藏款SSP, 隐藏款SSP金版, SSP银版, EX内页, EX封面）
              → re.findall 提取 ASCII 字母，优先匹配已知级别
      第三级：纯中文前缀（金属卡, 单人款, 双人款, 隐藏款, 梦幻花边, 流光云彩, 趣味拼图, 奇妙世界, 梦想摇摇乐）
              → 直接用作级别

    Returns:
        tuple: (level, full_name, rarity_name, number)
    """
    name_no_ext = os.path.splitext(filename)[0]

    # 按第一个 "-" 分割前缀和剩余部分
    parts = name_no_ext.split("-", 1)
    if len(parts) < 2:
        # 无 "-" 分隔，无法解析级别
        return "?", name_no_ext, "", ""

    prefix = parts[0]  # 第一个 "-" 之前的部分

    # === 第一级：纯 ASCII 级别代码（标准情况）===
    # 匹配 R, SR, SSR, UR, CP, DR, SP, EX, MAX, MZ 等
    if re.match(r'^[A-Za-z]+$', prefix):
        level = prefix

    # === 第二级：中文+ASCII 混合前缀 ===
    # 如: 特殊SSP, 隐藏款SSP, 隐藏款SSP金版, SSP银版, EX内页, EX封面
    # 策略: 提取所有 ASCII 字母序列，优先匹配最长的已知级别
    elif re.search(r'[A-Za-z]', prefix):
        ascii_codes = re.findall(r'[A-Za-z]+', prefix)
        level = "?"
        # 按长度降序，优先匹配最长的已知级别（避免 SSP 中先匹配到 SP）
        for code in sorted(ascii_codes, key=len, reverse=True):
            if code in RARITY_RANK:
                level = code
                break
        if level == "?":
            # 无已知级别匹配，取最长的 ASCII 序列作为级别
            level = max(ascii_codes, key=len)

    # === 第三级：纯中文前缀（金属卡、周边类级别）===
    # 如: 金属卡, 单人款, 双人款, 隐藏款, 梦幻花边, 流光云彩, 趣味拼图, 奇妙世界, 梦想摇摇乐
    else:
        level = prefix  # 直接使用中文前缀作为级别

    # === 提取级别名和编号 ===
    all_parts = name_no_ext.split("-")
    if len(all_parts) >= 3 and all_parts[-1].isdigit():
        # 最后一段是纯数字编号: {级别}-{级别名}-{编号}
        number = all_parts[-1]
        rarity_name = "-".join(all_parts[1:-1])
    elif len(all_parts) >= 2:
        # 最后一段不是数字: {级别}-{级别名} 或 {级别}-{级别名}-{非数字后缀}
        number = ""
        rarity_name = "-".join(all_parts[1:])
    else:
        number = ""
        rarity_name = ""

    return level, name_no_ext, rarity_name, number


def parse_pack_dirname(dirname):
    """
    解析卡包目录名，提取类型和简称。
    如 '卡牌｜珍藏版｜第1弹' -> ('卡牌', '珍藏版｜第1弹', '卡牌｜珍藏版｜第1弹')
    如 '周边｜妙趣版立牌｜第1弹' -> ('周边', '妙趣版立牌｜第1弹', '周边｜妙趣版立牌｜第1弹')
    """
    parts = dirname.split("｜", 1)
    if len(parts) == 2:
        return parts[0], parts[1], dirname
    return dirname, dirname, dirname


def generate_card_id(pack_full_name, card_name):
    """
    生成卡牌唯一ID：md5(packFullName + "/" + cardName) 前16位。
    基于卡包全名和卡牌名，不依赖路径，源目录移动不影响收藏数据。
    """
    raw = f"{pack_full_name}/{card_name}"
    return hashlib.md5(raw.encode('utf-8')).hexdigest()[:16]


def load_config():
    """加载同目录 config.yaml（可选）覆盖脚本内置默认值。

    返回 (cfg, loaded)。cfg 含 source_dir / output_file / image_extensions /
    pack_order / rarity_order。未提供配置文件或缺少 PyYAML 时回退到内置默认值。
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, "config.yaml")

    cfg = {
        "source_dir": SOURCE_DIR,
        "output_file": OUTPUT_FILE,
        "image_extensions": IMAGE_EXTENSIONS,
        "pack_order": PACK_ORDER,
        "rarity_order": RARITY_ORDER,
    }

    if not os.path.exists(config_path):
        return cfg, False

    if yaml is None:
        print("[WARN] 未检测到 PyYAML，无法读取 config.yaml，将使用脚本内置默认值。")
        print("       如需使用配置文件，请先安装依赖: pip install pyyaml")
        return cfg, False

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            user_cfg = yaml.safe_load(f) or {}
    except Exception as e:
        print(f"[WARN] 读取 config.yaml 失败（{e}），回退到内置默认值。")
        return cfg, False

    paths = user_cfg.get("paths", {}) or {}
    scan = user_cfg.get("scan", {}) or {}

    if paths.get("source_dir"):
        cfg["source_dir"] = paths["source_dir"]
    if paths.get("output_file"):
        out = paths["output_file"]
        cfg["output_file"] = out if os.path.isabs(out) else os.path.join(script_dir, out)
    if scan.get("image_extensions"):
        cfg["image_extensions"] = tuple(scan["image_extensions"])
    if user_cfg.get("pack_order"):
        cfg["pack_order"] = list(user_cfg["pack_order"])
    if user_cfg.get("rarity_order"):
        cfg["rarity_order"] = list(user_cfg["rarity_order"])

    return cfg, True


def main():
    """主函数：加载配置，扫描源目录，解析卡牌，生成 data.js"""
    cfg, loaded = load_config()
    source_dir = cfg["source_dir"]
    output_file = cfg["output_file"]
    image_extensions = cfg["image_extensions"]
    pack_order = cfg["pack_order"]
    rarity_order = cfg["rarity_order"]

    global PACK_RANK, RARITY_RANK
    PACK_RANK = {name: i for i, name in enumerate(pack_order)}
    RARITY_RANK = {r: i for i, r in enumerate(rarity_order)}

    if loaded:
        print("[INFO] 已加载配置文件: config.yaml")

    if not os.path.isdir(source_dir):
        print(f"错误：源目录不存在: {source_dir}")
        return

    packs = []
    total_cards = 0
    unknown_count = 0  # 记录 ? 未知级别数量

    # 遍历顶层卡包目录（按 pack_order 自定义顺序排列）
    pack_dirs = sorted(
        [d for d in os.listdir(source_dir) if os.path.isdir(os.path.join(source_dir, d))],
        key=lambda d: PACK_RANK.get(d, 99999)
    )
    for pack_idx, pack_dirname in enumerate(pack_dirs):
        pack_path = os.path.join(source_dir, pack_dirname)
        if not os.path.isdir(pack_path):
            continue

        pack_type, pack_name, pack_full_name = parse_pack_dirname(pack_dirname)

        cards = []
        for filename in os.listdir(pack_path):
            # 同时扫描 .png / .jpg / .jpeg
            if not filename.lower().endswith(image_extensions):
                continue

            file_ext = os.path.splitext(filename)[1]  # .png 或 .jpg
            level, card_name, rarity_name, number = parse_card_filename(filename)

            if level == "?":
                unknown_count += 1

            # 图片绝对路径（正斜杠格式，前端加 file:/// 前缀加载）
            file_path = os.path.join(pack_path, filename).replace("\\", "/")

            card_id = generate_card_id(pack_full_name, card_name)

            cards.append({
                "id": card_id,
                "name": card_name,
                "rarity": level,
                "rarityName": rarity_name,
                "number": number,
                "path": file_path,
                "fileExt": file_ext
            })

        # 按级别排序（从低到高），同级别按文件名排序
        cards.sort(key=lambda c: (get_rarity_sort_key(c["rarity"]), c["name"]))

        pack_id = f"p{pack_idx:02d}"

        packs.append({
            "id": pack_id,
            "type": pack_type,
            "name": pack_name,
            "fullName": pack_full_name,
            "cardCount": len(cards),
            "cards": cards
        })

        total_cards += len(cards)
        print(f"  {pack_id} [{pack_type}] {pack_name}: {len(cards)} 张")

    # 生成 meta 信息
    meta = {
        "generatedAt": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "sourceDir": source_dir.replace("\\", "/"),
        "totalPacks": len(packs),
        "totalCards": total_cards,
        "version": "2.1"
    }

    # 组装完整数据
    data = {
        "meta": meta,
        "packs": packs
    }

    # 输出 data.js（var DORAEMON_DATA = {...}; 格式，不是纯 JSON）
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("var DORAEMON_DATA = ")
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    # 统计输出
    print(f"\n========== 数据生成完成 ==========")
    print(f"卡包总数: {len(packs)}")
    print(f"卡牌总数: {total_cards}")
    print(f"? 未知级别卡牌: {unknown_count} 张")
    print(f"输出文件: {output_file}")

    if unknown_count > 0:
        print(f"\n⚠ 警告：仍有 {unknown_count} 张卡牌级别未识别，请检查文件名格式！")
    else:
        print(f"\n✓ 所有卡牌级别均成功识别！")


if __name__ == "__main__":
    main()

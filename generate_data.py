#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
卡动文创图鉴 - 数据生成脚本（多 IP 版 v2.0）

功能：
1. 遍历根目录（卡动文创图鉴）下的各个 IP 子目录（哆啦A梦 / 三国志8 REMAKE / CF穿越火线）
2. 每个 IP 内扫描各卡包子目录（卡牌类 + 周边类）
3. 同时扫描 .png / .jpg / .jpeg 图片文件
4. 三级正则解析策略识别卡牌级别（纯ASCII / 中文+ASCII混合 / 纯中文）
5. 生成 data.js：var CARD_COLLECTIONS = { "<IP>": {meta, packs[]}, ... };
6. 卡牌ID基于 md5(packFullName + "/" + cardName) 前16位，路径变化不影响收藏数据
7. 支持读取同目录 config.yaml 覆盖内置默认值（需 PyYAML；pip install pyyaml）

作者：工程师 寇豆码（Kou）
日期：2026-07
"""

import os
import sys
import json
import re
import hashlib
from datetime import datetime

try:
    import yaml
except ImportError:
    yaml = None  # 未安装 PyYAML 时回退到脚本内置默认值

# ========== 路径配置 ==========
# 根目录：包含各个 IP 子目录（每个 IP 内有各自的卡包子目录）
ROOT_DIR = r"D:\BaiduSyncdisk\其他\卡动文创图鉴"
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.js")

# ========== 图片扩展名 ==========
IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg')

# ========== IP 列表（数据生成数据源；前端运行时从 data.js 派生，不再写死）==========
IP_LIST = [
    "哆啦A梦",
    "三国志8 REMAKE",
    "CF穿越火线"
]

# ========== 各 IP 卡包排序表（自定义顺序，未列出的排最后）==========
# 仅哆啦A梦有完整手写顺序；其余 IP 留空 → 按文件夹名排序
IP_PACK_ORDERS = {
    "哆啦A梦": [
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
    ],
    "三国志8 REMAKE": None,
    "CF穿越火线": None,
}

# ========== 全局级别排序表（从低到高，覆盖 3 个 IP）==========
# 与 config.js 中 RARITY_ORDER 保持一致
RARITY_ORDER = [
    "R", "SR", "SSR", "UR", "SP", "SSP", "SSS", "EX", "IM", "LP",
    "FR", "FP", "PR", "TB", "PL", "OC", "SJ", "SS", "S", "MAX",
    "MZ", "CGF", "DM", "GF", "TR", "ZR", "CR", "DR", "CP", "WR",
    "MR", "GR", "GP", "QR", "MP", "WRP", "GSP", "EXP",
    "金属卡", "特殊SSP", "隐藏款SSP金版", "隐藏款SSP", "SSP银版",
    "隐藏款", "隐藏版", "奇妙世界", "梦想摇摇乐", "流光云彩",
    "趣味拼图", "双人款", "单人款", "梦幻花边", "EX内页", "EX封面"
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
              → re.findall 提取 ASCII 字母，优先匹配最长的已知级别
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
    else:
        level = prefix  # 直接使用中文前缀作为级别

    # === 提取级别名和编号 ===
    all_parts = name_no_ext.split("-")
    if len(all_parts) >= 3 and all_parts[-1].isdigit():
        number = all_parts[-1]
        rarity_name = "-".join(all_parts[1:-1])
    elif len(all_parts) >= 2:
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


def _default_cfg():
    """脚本内置默认配置。"""
    return {
        "root_dir": ROOT_DIR,
        "output_file": OUTPUT_FILE,
        "image_extensions": IMAGE_EXTENSIONS,
        "ips": IP_LIST,
        "ip_pack_orders": IP_PACK_ORDERS,
        "rarity_order": RARITY_ORDER,
    }


def load_config():
    """加载同目录 config.yaml（可选）覆盖脚本内置默认值。

    优先级：本地 config.yaml > config.example.yaml > 内置默认值。
    返回 (cfg, loaded)。cfg 含 root_dir / output_file / image_extensions /
    ips / ip_pack_orders / rarity_order。
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    local_path = os.path.join(script_dir, "config.yaml")
    example_path = os.path.join(script_dir, "config.example.yaml")

    if os.path.exists(local_path):
        used_path = local_path
    elif os.path.exists(example_path):
        used_path = example_path
    else:
        return _default_cfg(), False

    if yaml is None:
        print("[WARN] 未检测到 PyYAML，无法读取配置文件，将使用脚本内置默认值。")
        print("       如需使用配置文件，请先安装依赖: pip install pyyaml")
        return _default_cfg(), False

    try:
        with open(used_path, "r", encoding="utf-8") as f:
            user_cfg = yaml.safe_load(f) or {}
    except Exception as e:
        print(f"[WARN] 读取配置文件失败（{e}），回退到内置默认值。")
        return _default_cfg(), False

    cfg = _default_cfg()
    paths = user_cfg.get("paths", {}) or {}
    scan = user_cfg.get("scan", {}) or {}

    if paths.get("root_dir"):
        cfg["root_dir"] = paths["root_dir"]
    if paths.get("output_file"):
        out = paths["output_file"]
        cfg["output_file"] = out if os.path.isabs(out) else os.path.join(script_dir, out)
    if scan.get("image_extensions"):
        cfg["image_extensions"] = tuple(scan["image_extensions"])
    if user_cfg.get("ips"):
        cfg["ips"] = list(user_cfg["ips"])
    if user_cfg.get("ip_pack_orders"):
        # 与内置合并：用户提供的优先，未提供的 IP 回退内置
        merged = dict(IP_PACK_ORDERS)
        for ip, order in user_cfg["ip_pack_orders"].items():
            merged[ip] = list(order) if order else None
        cfg["ip_pack_orders"] = merged
    if user_cfg.get("rarity_order"):
        cfg["rarity_order"] = list(user_cfg["rarity_order"])

    print(f"[INFO] 已加载配置文件: {os.path.basename(used_path)}")
    return cfg, True


def build_ip_data(ip_name, ip_dir, image_extensions, pack_order, rarity_order):
    """扫描单个 IP 目录，生成该 IP 的 {meta, packs[]} 数据。"""
    global RARITY_RANK
    RARITY_RANK = {r: i for i, r in enumerate(rarity_order)}

    packs = []
    total_cards = 0
    unknown_count = 0

    # 遍历 IP 内各卡包目录
    pack_dirs = [d for d in os.listdir(ip_dir) if os.path.isdir(os.path.join(ip_dir, d))]
    pack_rank = {name: i for i, name in enumerate(pack_order)} if pack_order else None
    pack_dirs.sort(key=lambda d: (pack_rank.get(d, 99999) if pack_rank else d))

    for pack_idx, pack_dirname in enumerate(pack_dirs):
        pack_path = os.path.join(ip_dir, pack_dirname)
        if not os.path.isdir(pack_path):
            continue

        pack_type, pack_name, pack_full_name = parse_pack_dirname(pack_dirname)

        cards = []
        for filename in os.listdir(pack_path):
            if not filename.lower().endswith(image_extensions):
                continue

            file_ext = os.path.splitext(filename)[1]  # .png 或 .jpg
            level, card_name, rarity_name, number = parse_card_filename(filename)

            if level == "?":
                unknown_count += 1

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
        print(f"  [{ip_name}] {pack_id} [{pack_type}] {pack_name}: {len(cards)} 张")

    meta = {
        "generatedAt": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "sourceDir": ip_dir.replace("\\", "/"),
        "totalPacks": len(packs),
        "totalCards": total_cards,
        "version": "2.1"
    }
    return {"meta": meta, "packs": packs}, unknown_count


def main():
    """主函数：加载配置，遍历各 IP 扫描目录，生成 data.js"""
    cfg, loaded = load_config()
    root_dir = cfg["root_dir"]
    output_file = cfg["output_file"]
    image_extensions = cfg["image_extensions"]
    ips = cfg["ips"]
    ip_pack_orders = cfg["ip_pack_orders"]
    rarity_order = cfg["rarity_order"]

    if not os.path.isdir(root_dir):
        print(f"错误：根目录不存在: {root_dir}")
        return

    collections = {}
    total_unknown = 0
    total_cards_all = 0

    for ip in ips:
        ip_dir = os.path.join(root_dir, ip)
        if not os.path.isdir(ip_dir):
            print(f"[WARN] 跳过不存在的 IP 目录: {ip_dir}")
            continue
        print(f"\n========== 处理 IP：{ip} ==========")
        pack_order = ip_pack_orders.get(ip)
        ip_data, unknown = build_ip_data(ip, ip_dir, image_extensions, pack_order, rarity_order)
        collections[ip] = ip_data
        total_unknown += unknown
        total_cards_all += ip_data["meta"]["totalCards"]

    if not collections:
        print("错误：没有任何 IP 数据生成。")
        return

    # 输出 data.js（var CARD_COLLECTIONS = {...}; 格式，不是纯 JSON）
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("var CARD_COLLECTIONS = ")
        json.dump(collections, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    print(f"\n========== 数据生成完成 ==========")
    print(f"IP 数量: {len(collections)}")
    for ip, data in collections.items():
        print(f"  {ip}: {data['meta']['totalPacks']} 卡包 / {data['meta']['totalCards']} 张")
    print(f"全部卡牌: {total_cards_all} 张")
    print(f"? 未知级别卡牌: {total_unknown} 张")
    print(f"输出文件: {output_file}")

    if total_unknown > 0:
        print(f"\n⚠ 警告：仍有 {total_unknown} 张卡牌级别未识别，请检查文件名格式！")
    else:
        print(f"\n✓ 所有卡牌级别均成功识别！")

    # 运行重复图片检测
    import subprocess
    dup_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generate_duplicate_groups.py")
    if os.path.exists(dup_script):
        print(f"\n[INFO] 运行重复图片检测: generate_duplicate_groups.py")
        result = subprocess.run([sys.executable, dup_script], capture_output=True, text=True)
        print(result.stdout)
        if result.returncode != 0:
            print(f"[ERROR] 重复检测脚本执行失败:\n{result.stderr}")
    else:
        print(f"\n[WARN] 未找到 generate_duplicate_groups.py，跳过重复检测。")


if __name__ == "__main__":
    main()

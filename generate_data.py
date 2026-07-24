#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
集卡册 - 数据生成脚本（多 IP 版 v2.1）

功能：
1. 遍历各商家图鉴根目录下的各个 IP 子目录（哆啦A梦 / 三国志8 REMAKE / CF穿越火线）
2. 每个 IP 内扫描各卡包子目录（卡牌类 + 周边类）
3. 同时扫描 .png / .jpg / .jpeg 图片文件
4. 三级正则解析策略识别卡牌级别（纯ASCII / 中文+ASCII混合 / 纯中文）
5. 生成 data.js：var CARD_COLLECTIONS = { "<IP>": {meta, packs[]}, ... };
6. 卡牌ID基于 md5(packFullName + "/" + cardName) 前16位，路径变化不影响收藏数据
7. 所有配置均从 config.yaml 读取，不再保留硬编码默认值（需 PyYAML；pip install pyyaml）

作者：工程师 寇豆码（Kou）
日期：2026-07
"""

import os
import sys
import json
import re
import hashlib
from datetime import datetime

# 修复 GBK 终端下 Unicode 输出问题（如 ✓ 符号）
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

try:
    import yaml
except ImportError:
    print("错误：未检测到 PyYAML，无法读取 config.yaml。")
    print("      请先安装依赖: pip install pyyaml")
    sys.exit(1)

# ========== 全局级别排序表（从低到高，覆盖所有 IP）==========
# 作为初始默认值，config.yaml 中 rarity_order 会覆盖此值
RARITY_ORDER = [
    "R", "SR", "SSR", "DR", "CP", "TR", "UR", "SP", "SSP", "SSS", "EX", "IM", "LP",
    "FR", "FP", "PR", "TB", "PL", "OC", "SJ", "SS", "S", "MAX",
    "MZ", "CGF", "DM", "GF", "ZR", "CR", "WR",
    "MR", "GR", "GP", "QR", "MP", "WRP", "GSP", "EXP",
    "金属卡", "特殊SSP", "隐藏款SSP金版", "隐藏款SSP", "SSP银版",
    "隐藏款", "隐藏版", "奇妙世界", "梦想摇摇乐", "流光云彩",
    "趣味拼图", "双人款", "单人款", "梦幻花边", "EX内页", "EX封面",
    "SEC", "LGP", "USP", "XP", "MSP", "CSP"
]
RARITY_RANK = {r: i for i, r in enumerate(RARITY_ORDER)}


def get_rarity_sort_key(rarity):
    """获取级别排序键。? 未知排最前(-1)，未知中文级别排最后(99999)"""
    if rarity == "?":
        return -1
    return RARITY_RANK.get(rarity, 99999)


def _tail_number_sort_key(card):
    """尾部编号排序键：按稀有度 → 前缀（区分 SSR/★SSR）→ 后缀编号排序；
    无数字（如 LGP 的 _B/_W 黑白变体）排最后，同组内按名称稳定排列。"""
    rarity_rank = get_rarity_sort_key(card["rarity"])
    prefix = card["name"].split("-", 1)[0]  # 提取前缀，区分 SSR / ★SSR
    seg = re.split(r'[_-]', card["name"])[-1]
    m = re.search(r'\d+', seg)
    if m:
        return (0, rarity_rank, prefix, int(m.group()), card["name"])
    return (1, rarity_rank, prefix, 0, card["name"])


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


def load_config():
    """强制从同目录 config.yaml 读取配置；不存在则报错退出。

    返回 cfg，含 root_dirs / output_file / image_extensions /
    ips / ip_pack_orders / rarity_order / card_secondary_sort / pack_type_overrides。
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, "config.yaml")

    if not os.path.exists(config_path):
        print(f"错误：config.yaml 不存在: {config_path}")
        print("      请复制 config.example.yaml 为 config.yaml 并修改配置后重试。")
        sys.exit(1)

    with open(config_path, "r", encoding="utf-8") as f:
        user_cfg = yaml.safe_load(f) or {}

    # ----- 验证必填字段 -----
    paths = user_cfg.get("paths", {}) or {}
    raw_roots = paths.get("root_dirs")
    if not raw_roots:
        print("错误：config.yaml 中缺少 paths.root_dirs 配置，请指定至少一个图片根目录。")
        sys.exit(1)
    if isinstance(raw_roots, str):
        raw_roots = [raw_roots]
    root_dirs = [str(r) for r in raw_roots]

    ips = user_cfg.get("ips")
    if not ips:
        print("错误：config.yaml 中缺少 ips 配置，请指定至少一个 IP 名称。")
        sys.exit(1)
    ips = list(ips)

    # ----- 组装配置 -----
    cfg = {
        "root_dirs": root_dirs,
        "ips": ips,
        "image_extensions": ('.png', '.jpg', '.jpeg'),
        "output_file": os.path.join(script_dir, "data.js"),
        "ip_pack_orders": {},
        "rarity_order": list(RARITY_ORDER),
        "card_secondary_sort": {},
        "pack_type_overrides": {},
        "run_duplicate_detection": False,
    }

    # 输出路径
    out = paths.get("output_file")
    if out:
        cfg["output_file"] = out if os.path.isabs(out) else os.path.join(script_dir, out)

    # 图片扩展名
    scan = user_cfg.get("scan", {}) or {}
    raw_exts = scan.get("image_extensions")
    if raw_exts:
        cfg["image_extensions"] = tuple(str(e) for e in raw_exts)

    # 卡包排序
    raw_orders = user_cfg.get("ip_pack_orders", {}) or {}
    if raw_orders:
        merged = {}
        for ip, order in raw_orders.items():
            merged[ip] = list(order) if order else None
        cfg["ip_pack_orders"] = merged

    # 级别排序
    raw_rarity = user_cfg.get("rarity_order")
    if raw_rarity:
        cfg["rarity_order"] = list(raw_rarity)

    # 类型覆盖
    raw_override = user_cfg.get("pack_type_overrides", {}) or {}
    if raw_override:
        cfg["pack_type_overrides"] = dict(raw_override)

    # 重复图片检测开关
    cfg["run_duplicate_detection"] = bool(user_cfg.get("run_duplicate_detection", False))

    # 卡牌二级排序方式（per-IP）
    raw_sort = user_cfg.get("card_secondary_sort", {}) or {}
    if raw_sort:
        cfg["card_secondary_sort"] = dict(raw_sort)

    print(f"[INFO] 已加载配置文件: config.yaml")
    return cfg


def build_ip_data(ip_name, ip_dir, image_extensions, pack_order, rarity_order, secondary_sort="name", pack_type_override=None):
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

        if secondary_sort == "number":
            cards.sort(key=_tail_number_sort_key)
        else:
            # 同一级别内：按卡牌全名排序（天然按前缀分组，SSR 前缀排在 ★SSR 前）
            cards.sort(key=lambda c: (get_rarity_sort_key(c["rarity"]), c["name"]))

        pack_id = f"p{pack_idx:02d}"
        packs.append({
            "id": pack_id,
            "type": pack_type_override if pack_type_override else pack_type,
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
    cfg = load_config()
    root_dirs = cfg["root_dirs"]
    output_file = cfg["output_file"]
    image_extensions = cfg["image_extensions"]
    ips = cfg["ips"]
    ip_pack_orders = cfg["ip_pack_orders"]
    rarity_order = cfg["rarity_order"]

    existing = [d for d in root_dirs if os.path.isdir(d)]
    if not existing:
        print(f"错误：所有图片根目录均不存在: {root_dirs}")
        return
    if len(existing) < len(root_dirs):
        print(f"[WARN] 以下根目录不存在，已跳过: {[d for d in root_dirs if not os.path.isdir(d)]}")

    collections = {}
    total_unknown = 0
    total_cards_all = 0

    for ip in ips:
        # 在已确认存在的 root_dirs 中查找该 IP 子目录
        ip_dir = None
        for root in existing:
            cand = os.path.join(root, ip)
            if os.path.isdir(cand):
                ip_dir = cand
                break
        if not ip_dir:
            print(f"[WARN] 跳过不存在的 IP 目录（所有 root_dirs 中均未找到）: {ip}")
            continue
        print(f"\n========== 处理 IP：{ip} ==========")
        pack_order = ip_pack_orders.get(ip)
        secondary_sort = cfg.get("card_secondary_sort", {}).get(ip, "name")
        pack_type_override = cfg.get("pack_type_overrides", {}).get(ip)
        ip_data, unknown = build_ip_data(ip, ip_dir, image_extensions, pack_order, rarity_order, secondary_sort=secondary_sort, pack_type_override=pack_type_override)
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

    # 运行重复图片检测（按 config.yaml 配置开关）
    if cfg.get("run_duplicate_detection"):
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
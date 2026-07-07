#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
哆啦A梦卡牌收藏站 - 数据验证脚本

验证 data.js 的数据完整性：
1. 卡包总数 = 15（11 卡牌 + 4 周边）
2. 卡牌总数 = 1708
3. ? 未知级别卡牌数 = 0
4. 特殊前缀卡牌级别正确
5. 卡牌 id 格式为 16 位 hex
6. card.path 为正斜杠绝对路径
7. .png 和 .jpg 文件都被扫描

作者：QA 工程师 严过关（Yan）
"""

import json
import re
import os
import sys
from collections import Counter

# ========== 路径配置 ==========
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_JS = os.path.join(PROJECT_DIR, "data.js")

# ========== 测试结果统计 ==========
PASS_COUNT = 0
FAIL_COUNT = 0
RESULTS = []


def record(name, passed, detail=""):
    """记录测试结果"""
    global PASS_COUNT, FAIL_COUNT
    status = "PASS" if passed else "FAIL"
    if passed:
        PASS_COUNT += 1
    else:
        FAIL_COUNT += 1
    msg = f"  [{status}] {name}"
    if detail:
        msg += f" — {detail}"
    RESULTS.append(msg)
    print(msg)


def load_data_js(filepath):
    """加载 data.js，去除 var DORAEMON_DATA = 前缀和结尾 ; 后 json.loads"""
    with open(filepath, "r", encoding="utf-8") as f:
        raw = f.read()

    prefix = "var DORAEMON_DATA = "
    if not raw.startswith(prefix):
        raise ValueError(f"data.js 开头不符合预期，期望以 '{prefix}' 开头")

    # 去除前缀和结尾的 ;\n
    json_str = raw[len(prefix):]
    json_str = json_str.rstrip()
    if json_str.endswith(";"):
        json_str = json_str[:-1]

    return json.loads(json_str)


def main():
    print("=" * 60)
    print("哆啦A梦卡牌收藏站 - 数据验证脚本")
    print("=" * 60)

    # 加载数据
    try:
        data = load_data_js(DATA_JS)
        print(f"\n数据加载成功: {DATA_JS}\n")
    except Exception as e:
        print(f"数据加载失败: {e}")
        sys.exit(1)

    packs = data.get("packs", [])
    meta = data.get("meta", {})
    all_cards = []
    for pack in packs:
        all_cards.extend(pack.get("cards", []))

    # ========== 测试 1: 卡包总数 = 15 ==========
    total_packs = len(packs)
    record("卡包总数 = 15", total_packs == 15,
           f"实际: {total_packs}")

    # ========== 测试 2: 11 卡牌 + 4 周边 ==========
    card_packs = [p for p in packs if p.get("type") == "卡牌"]
    merch_packs = [p for p in packs if p.get("type") == "周边"]
    record("卡牌类卡包 = 11", len(card_packs) == 11,
           f"实际: {len(card_packs)}")
    record("周边类卡包 = 4", len(merch_packs) == 4,
           f"实际: {len(merch_packs)}")

    # ========== 测试 3: 卡牌总数 = 1708 ==========
    total_cards = len(all_cards)
    meta_total = meta.get("totalCards", 0)
    record("卡牌总数 = 1708", total_cards == 1708,
           f"实际: {total_cards}, meta.totalCards: {meta_total}")
    record("meta.totalCards 与实际卡牌数一致", total_cards == meta_total,
           f"实际: {total_cards} vs meta: {meta_total}")

    # ========== 测试 4: ? 未知级别卡牌数 = 0 ==========
    unknown_cards = [c for c in all_cards if c.get("rarity") == "?"]
    record("? 未知级别卡牌数 = 0", len(unknown_cards) == 0,
           f"实际: {len(unknown_cards)}")

    # ========== 测试 5: 特殊前缀卡牌级别正确 ==========
    # 抽查: 特殊SSP→SSP, 隐藏款SSP→SSP, EX内页→EX, 金属卡→金属卡
    special_checks = {
        "特殊SSP": "SSP",
        "隐藏款SSP": "SSP",
        "EX内页": "EX",
        "金属卡": "金属卡",
    }

    for prefix, expected_rarity in special_checks.items():
        # 在所有卡牌中查找 name 以该前缀开头的卡牌
        matching = [c for c in all_cards if c.get("name", "").startswith(prefix + "-")]
        if not matching:
            record(f"特殊前缀 '{prefix}' 存在卡牌", False,
                   f"未找到以 '{prefix}-' 开头的卡牌")
        else:
            wrong = [c for c in matching if c.get("rarity") != expected_rarity]
            record(f"特殊前缀 '{prefix}' → 级别 '{expected_rarity}'",
                   len(wrong) == 0,
                   f"匹配 {len(matching)} 张, 错误 {len(wrong)} 张" +
                   (f", 错误示例: {wrong[0]['name']} → {wrong[0]['rarity']}" if wrong else ""))

    # ========== 测试 6: 卡牌 id 格式为 16 位 hex ==========
    hex_pattern = re.compile(r'^[0-9a-f]{16}$')
    bad_ids = [c for c in all_cards if not hex_pattern.match(c.get("id", ""))]
    record("卡牌 id 格式为 16 位 hex", len(bad_ids) == 0,
           f"错误数量: {len(bad_ids)}" +
           (f", 示例: {bad_ids[0].get('id')}" if bad_ids else ""))

    # ========== 测试 7: card.path 为正斜杠绝对路径 ==========
    bad_paths = [c for c in all_cards if "\\" in c.get("path", "") or not c.get("path", "").startswith("/")]
    # 路径应包含盘符格式如 D:/...
    bad_paths = [c for c in all_cards if "\\" in c.get("path", "")]
    record("card.path 为正斜杠路径（无反斜杠）", len(bad_paths) == 0,
           f"错误数量: {len(bad_paths)}" +
           (f", 示例: {bad_paths[0].get('path')}" if bad_paths else ""))

    # ========== 测试 8: .png 和 .jpg 文件都被扫描 ==========
    ext_counter = Counter()
    for c in all_cards:
        ext = c.get("fileExt", "")
        ext_counter[ext] += 1
    has_png = ext_counter.get(".png", 0) > 0
    has_jpg = ext_counter.get(".jpg", 0) > 0
    record(".png 文件被扫描", has_png, f"数量: {ext_counter.get('.png', 0)}")
    record(".jpg 文件被扫描", has_jpg, f"数量: {ext_counter.get('.jpg', 0)}")
    record("PNG + JPG 总数 = 1708",
           ext_counter.get(".png", 0) + ext_counter.get(".jpg", 0) == 1708,
           f"PNG: {ext_counter.get('.png', 0)}, JPG: {ext_counter.get('.jpg', 0)}, 总计: {sum(ext_counter.values())}")

    # ========== 测试 9: 卡牌 id 唯一性 ==========
    all_ids = [c.get("id") for c in all_cards]
    duplicate_ids = [item for item, count in Counter(all_ids).items() if count > 1]
    record("卡牌 id 唯一性（无重复）", len(duplicate_ids) == 0,
           f"重复 id 数量: {len(duplicate_ids)}" +
           (f", 示例: {duplicate_ids[0]}" if duplicate_ids else ""))

    # ========== 测试 10: 每个卡包 cardCount 与实际 cards 数量一致 ==========
    mismatched_packs = [p for p in packs if p.get("cardCount") != len(p.get("cards", []))]
    record("卡包 cardCount 与实际 cards 数量一致", len(mismatched_packs) == 0,
           f"不一致数量: {len(mismatched_packs)}" +
           (f", 示例: {mismatched_packs[0]['name']}" if mismatched_packs else ""))

    # ========== 测试 11: 所有卡牌都有必要字段 ==========
    required_fields = ["id", "name", "rarity", "rarityName", "number", "path", "fileExt"]
    missing_field_cards = []
    for c in all_cards:
        for field in required_fields:
            if field not in c:
                missing_field_cards.append((c.get("id", "unknown"), field))
    record("所有卡牌都有必要字段", len(missing_field_cards) == 0,
           f"缺失字段数量: {len(missing_field_cards)}" +
           (f", 示例: {missing_field_cards[0]}" if missing_field_cards else ""))

    # ========== 测试 12: 级别分布统计 ==========
    rarity_dist = Counter(c.get("rarity") for c in all_cards)
    print(f"\n  级别分布统计（共 {len(rarity_dist)} 种级别）:")
    for rarity, count in sorted(rarity_dist.items(), key=lambda x: (-x[1], x[0])):
        print(f"    {rarity}: {count} 张")

    # ========== 汇总 ==========
    print("\n" + "=" * 60)
    print(f"验证汇总: 通过 {PASS_COUNT} / 总计 {PASS_COUNT + FAIL_COUNT}")
    print(f"结果: {'ALL PASS' if FAIL_COUNT == 0 else 'HAS FAILURES'}")
    print("=" * 60)

    sys.exit(0 if FAIL_COUNT == 0 else 1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
卡动文创图鉴 - 数据验证脚本（多 IP 版）

验证 data.js 中每个 IP 的数据完整性：
1. 每个 IP 卡包数 > 0
2. 每个 IP 卡牌数 > 0
3. ? 未知级别卡牌数 = 0（逐 IP）
4. 卡牌 id 格式为 16 位 hex
5. card.path 为正斜杠绝对路径（无反斜杠）
6. .png 和 .jpg 文件都被扫描（逐 IP）
7. 卡牌 id 唯一性（逐 IP）
8. 每个卡包 cardCount 与实际 cards 数量一致（逐 IP）
9. 所有卡牌都有必要字段（逐 IP）
10. 级别分布统计（逐 IP）

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
    """加载 data.js，去除 var CARD_COLLECTIONS = 前缀和结尾 ; 后 json.loads"""
    with open(filepath, "r", encoding="utf-8") as f:
        raw = f.read()

    prefix = "var CARD_COLLECTIONS = "
    if not raw.startswith(prefix):
        # 兼容旧单 IP 格式
        alt = "var DORAEMON_DATA = "
        if raw.startswith(alt):
            prefix = alt
        else:
            raise ValueError(f"data.js 开头不符合预期，期望以 '{prefix}' 开头")

    json_str = raw[len(prefix):]
    json_str = json_str.rstrip()
    if json_str.endswith(";"):
        json_str = json_str[:-1]

    return json.loads(json_str)


def main():
    print("=" * 60)
    print("卡动文创图鉴 - 数据验证脚本（多 IP）")
    print("=" * 60)

    # 加载数据
    try:
        data = load_data_js(DATA_JS)
        print(f"\n数据加载成功: {DATA_JS}\n")
    except Exception as e:
        print(f"数据加载失败: {e}")
        sys.exit(1)

    if not isinstance(data, dict):
        print("数据结构异常：CARD_COLLECTIONS 应为 { ip: {meta, packs} }")
        sys.exit(1)

    hex_pattern = re.compile(r'^[0-9a-f]{16}$')
    required_fields = ["id", "name", "rarity", "rarityName", "number", "path", "fileExt"]
    total_cards_all = 0

    for ip, ip_data in data.items():
        print(f"\n---------- IP：{ip} ----------")
        packs = ip_data.get("packs", [])
        meta = ip_data.get("meta", {})
        all_cards = []
        for pack in packs:
            all_cards.extend(pack.get("cards", []))

        # ========== 测试 1: 卡包数 > 0 ==========
        record(f"[{ip}] 卡包数 > 0", len(packs) > 0, f"实际: {len(packs)}")

        # ========== 测试 2: 卡牌数 > 0 ==========
        total_cards = len(all_cards)
        total_cards_all += total_cards
        record(f"[{ip}] 卡牌数 > 0", total_cards > 0,
               f"实际: {total_cards}, meta.totalCards: {meta.get('totalCards', 0)}")
        record(f"[{ip}] meta.totalCards 与实际卡牌数一致",
               total_cards == meta.get("totalCards", -1),
               f"实际: {total_cards} vs meta: {meta.get('totalCards', 0)}")

        # ========== 测试 3: ? 未知级别卡牌数 = 0 ==========
        unknown_cards = [c for c in all_cards if c.get("rarity") == "?"]
        record(f"[{ip}] ? 未知级别卡牌数 = 0", len(unknown_cards) == 0,
               f"实际: {len(unknown_cards)}")

        # ========== 测试 4: 卡牌 id 格式为 16 位 hex ==========
        bad_ids = [c for c in all_cards if not hex_pattern.match(c.get("id", ""))]
        record(f"[{ip}] 卡牌 id 格式为 16 位 hex", len(bad_ids) == 0,
               f"错误数量: {len(bad_ids)}" +
               (f", 示例: {bad_ids[0].get('id')}" if bad_ids else ""))

        # ========== 测试 5: card.path 为正斜杠路径 ==========
        bad_paths = [c for c in all_cards if "\\" in c.get("path", "")]
        record(f"[{ip}] card.path 为正斜杠路径（无反斜杠）", len(bad_paths) == 0,
               f"错误数量: {len(bad_paths)}" +
               (f", 示例: {bad_paths[0].get('path')}" if bad_paths else ""))

        # ========== 测试 6: 图片文件被扫描（png/jpg/jpeg 至少一种，且总数 = 卡牌数）==========
        ext_counter = Counter()
        for c in all_cards:
            ext_counter[c.get("fileExt", "")] += 1
        has_png = ext_counter.get(".png", 0) > 0
        has_jpg = ext_counter.get(".jpg", 0) > 0
        has_jpeg = ext_counter.get(".jpeg", 0) > 0
        scanned = ext_counter.get(".png", 0) + ext_counter.get(".jpg", 0) + ext_counter.get(".jpeg", 0)
        record(f"[{ip}] 图片文件被扫描（png/jpg/jpeg）",
               (has_png or has_jpg or has_jpeg),
               f"PNG:{ext_counter.get('.png', 0)}, JPG:{ext_counter.get('.jpg', 0)}, JPEG:{ext_counter.get('.jpeg', 0)}")
        record(f"[{ip}] 扫描图片总数 = 卡牌数",
               scanned == total_cards,
               f"扫描:{scanned} vs 卡牌:{total_cards}")

        # ========== 测试 7: 卡牌 id 唯一性（逐 IP）==========
        all_ids = [c.get("id") for c in all_cards]
        duplicate_ids = [item for item, count in Counter(all_ids).items() if count > 1]
        record(f"[{ip}] 卡牌 id 唯一性（无重复）", len(duplicate_ids) == 0,
               f"重复 id 数量: {len(duplicate_ids)}" +
               (f", 示例: {duplicate_ids[0]}" if duplicate_ids else ""))

        # ========== 测试 8: 每个卡包 cardCount 与实际一致 ==========
        mismatched = [p for p in packs if p.get("cardCount") != len(p.get("cards", []))]
        record(f"[{ip}] 卡包 cardCount 与实际 cards 数量一致", len(mismatched) == 0,
               f"不一致数量: {len(mismatched)}" +
               (f", 示例: {mismatched[0]['name']}" if mismatched else ""))

        # ========== 测试 9: 所有卡牌都有必要字段 ==========
        missing_field_cards = []
        for c in all_cards:
            for field in required_fields:
                if field not in c:
                    missing_field_cards.append((c.get("id", "unknown"), field))
        record(f"[{ip}] 所有卡牌都有必要字段", len(missing_field_cards) == 0,
               f"缺失字段数量: {len(missing_field_cards)}" +
               (f", 示例: {missing_field_cards[0]}" if missing_field_cards else ""))

        # ========== 测试 10: 级别分布统计 ==========
        rarity_dist = Counter(c.get("rarity") for c in all_cards)
        print(f"  [{ip}] 级别分布（共 {len(rarity_dist)} 种）:")
        for rarity, count in sorted(rarity_dist.items(), key=lambda x: (-x[1], x[0])):
            print(f"      {rarity}: {count} 张")

    # ========== 汇总 ==========
    print("\n" + "=" * 60)
    print(f"验证汇总：通过 {PASS_COUNT} / 总计 {PASS_COUNT + FAIL_COUNT}")
    print(f"总计卡牌数（全部 IP）：{total_cards_all}")
    print(f"结果: {'ALL PASS' if FAIL_COUNT == 0 else 'HAS FAILURES'}")
    print("=" * 60)

    sys.exit(0 if FAIL_COUNT == 0 else 1)


if __name__ == "__main__":
    main()

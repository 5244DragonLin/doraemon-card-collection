#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
集卡册 - 重复图片检测脚本（多 IP 版）

功能：
1. 读取 data.js 中所有 IP 的卡牌数据
2. 每个 IP 内按文件名（card.name 字段）分组
3. 对每组 ≥2 张卡，用 Pillow + imagehash 计算 wHash
4. 按 wHash 距离 ≤5 聚类为同一组
5. 输出 duplicate_groups.js：var DUPLICATE_GROUPS = { "<IP>": {cardId: groupIndex}, ... };

依赖：pip install pillow imagehash
"""

import os
import json
from collections import defaultdict

try:
    from PIL import Image
    import imagehash
except ImportError:
    print("请先安装依赖: pip install pillow imagehash")
    exit(1)


def read_data_js(filepath):
    """读取 data.js，提取所有 IP 的卡牌数据（多 IP 结构）"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    prefix = 'var CARD_COLLECTIONS = '
    if content.startswith(prefix):
        json_str = content[len(prefix):]
    elif content.startswith('var DORAEMON_DATA = '):
        # 兼容旧格式（单 IP）
        json_str = content[len('var DORAEMON_DATA = '):]
    else:
        raise ValueError("data.js 开头不符合预期")
    json_str = json_str.rstrip()
    if json_str.endswith(';'):
        json_str = json_str[:-1]

    data = json.loads(json_str)
    # 兼容：单 IP 旧格式（直接含 packs）包裹为虚拟 IP
    if 'packs' in data:
        return {"__legacy__": data}
    return data


def compute_whash(image_path):
    """计算图片的 wHash"""
    try:
        img = Image.open(image_path)
        return imagehash.whash(img)
    except Exception as e:
        print(f"  警告: 无法处理图片 {image_path}: {e}")
        return None


def cluster_by_distance(hashes, threshold=5):
    """
    基于哈希距离聚类（无向图连通分量）。
    返回局部 group_index 列表与成员列表。
    """
    n = len(hashes)
    if n == 0:
        return [-1] * n, []

    adj = [[] for _ in range(n)]
    for i in range(n):
        if hashes[i] is None:
            continue
        for j in range(i + 1, n):
            if hashes[j] is None:
                continue
            try:
                dist = hashes[i] - hashes[j]
            except Exception:
                continue
            if dist <= threshold:
                adj[i].append(j)
                adj[j].append(i)

    visited = [False] * n
    groups = [-1] * n
    group_members = []
    local_group_idx = 0

    for i in range(n):
        if visited[i] or hashes[i] is None:
            continue
        stack = [i]
        visited[i] = True
        members = []
        while stack:
            v = stack.pop()
            members.append(v)
            groups[v] = local_group_idx
            for neighbor in adj[v]:
                if not visited[neighbor]:
                    visited[neighbor] = True
                    stack.append(neighbor)
        if len(members) >= 2:
            group_members.append(members)
            local_group_idx += 1

    return groups, group_members


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_js_path = os.path.join(script_dir, 'data.js')
    output_path = os.path.join(script_dir, 'duplicate_groups.js')

    if not os.path.exists(data_js_path):
        print(f"错误: data.js 不存在: {data_js_path}")
        exit(1)

    print("读取 data.js ...")
    collections = read_data_js(data_js_path)
    print(f"共 {len(collections)} 个 IP")

    duplicate_groups = {}  # { ip: { cardId: groupIndex } }

    for ip, ip_data in collections.items():
        cards = []
        for pack in ip_data.get('packs', []):
            for card in pack.get('cards', []):
                cards.append({
                    'id': card['id'],
                    'name': card['name'],
                    'path': card['path']
                })
        print(f"\n[IP] {ip} — 共 {len(cards)} 张卡牌")

        # 按卡牌名分组
        name_groups = defaultdict(list)
        for i, card in enumerate(cards):
            name_groups[card['name']].append(i)

        multi_name_groups = {
            name: indices
            for name, indices in name_groups.items()
            if len(indices) >= 2
        }
        total_multi = sum(len(v) for v in multi_name_groups.values())
        print(f"  同名卡组（≥2张）: {len(multi_name_groups)} 组，共 {total_multi} 张卡牌")

        ip_group_idx = 0
        ip_dup = {}

        for name, indices in multi_name_groups.items():
            print(f"  处理: {name} ({len(indices)} 张)")
            hashes = []
            for idx in indices:
                card = cards[idx]
                img_path = card['path'].replace('/', '\\')
                h = compute_whash(img_path)
                hashes.append(h)
                status = "OK" if h is not None else "FAIL"
                print(f"    [{status}] {os.path.basename(img_path)}")

            local_groups, members_list = cluster_by_distance(hashes, threshold=5)
            for members in members_list:
                for m in members:
                    card_id = cards[indices[m]]['id']
                    ip_dup[card_id] = ip_group_idx
                ip_group_idx += 1

        duplicate_groups[ip] = ip_dup
        print(f"  → {ip} 分组数: {ip_group_idx}，涉及卡牌: {len(ip_dup)}")

    # 输出 duplicate_groups.js
    json_str = json.dumps(duplicate_groups, ensure_ascii=False)
    output_content = f"var DUPLICATE_GROUPS = {json_str};\n"

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(output_content)

    total_groups = sum(len(set(v.values())) for v in duplicate_groups.values())
    total_cards = sum(len(v) for v in duplicate_groups.values())
    print(f"\n========== 去重分组完成 ==========")
    print(f"总 IP 数: {len(duplicate_groups)}")
    print(f"总分组数: {total_groups}")
    print(f"涉及卡牌数: {total_cards}")
    print(f"输出文件: {output_path}")


if __name__ == '__main__':
    main()

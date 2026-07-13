#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
哆啦A梦卡牌收藏站 - 重复图片检测脚本

功能：
1. 读取 data.js 中所有卡牌数据
2. 按文件名（card.name 字段）分组
3. 对每组 ≥2 张卡，用 Pillow + imagehash 计算 wHash
4. 按 wHash 距离 ≤5 聚类为同一组
5. 输出 duplicate_groups.js：var DUPLICATE_GROUPS = { cardId: groupIndex, ... };

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
    """读取 data.js，提取所有卡牌数据"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    json_str = content.strip()
    if json_str.startswith('var DORAEMON_DATA = '):
        json_str = json_str[len('var DORAEMON_DATA = '):]
    if json_str.endswith(';'):
        json_str = json_str[:-1]

    data = json.loads(json_str)
    cards = []
    for pack in data.get('packs', []):
        for card in pack.get('cards', []):
            cards.append({
                'id': card['id'],
                'name': card['name'],
                'path': card['path']
            })
    return cards


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

    返回：
      groups: 每个元素所属的局部 group_index（≥0 表示分组号，-1 表示未分配到任一组）
      group_members: list of list，每个子列表是该组成员的 hashes 索引
    """
    n = len(hashes)
    if n == 0:
        return [-1] * n, []

    # 构建邻接表
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
        # BFS/DFS 收集连通分量
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
        # 只有 ≥2 个成员的组才算有效去重组
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
    cards = read_data_js(data_js_path)
    print(f"共 {len(cards)} 张卡牌")

    # 按卡牌名分组（card.name 字段即文件名去扩展名）
    name_groups = defaultdict(list)
    for i, card in enumerate(cards):
        name_groups[card['name']].append(i)

    # 筛选出 ≥2 张卡的同名组
    multi_name_groups = {
        name: indices
        for name, indices in name_groups.items()
        if len(indices) >= 2
    }
    total_multi = sum(len(v) for v in multi_name_groups.values())
    print(f"同名卡组（≥2张）: {len(multi_name_groups)} 组，共 {total_multi} 张卡牌")

    # 全局 group index，输出到 duplicate_groups.js
    global_group_idx = 0
    duplicate_groups = {}  # cardId -> globalGroupIndex

    for name, indices in multi_name_groups.items():
        print(f"\n处理: {name} ({len(indices)} 张)")

        # 计算每张图片的 wHash
        hashes = []
        for idx in indices:
            card = cards[idx]
            # 转换路径分隔符为 Windows 格式
            img_path = card['path'].replace('/', '\\')
            h = compute_whash(img_path)
            hashes.append(h)
            status = "OK" if h is not None else "FAIL"
            print(f"  [{status}] {os.path.basename(img_path)}")

        # 聚类（wHash 距离 ≤5）
        local_groups, members_list = cluster_by_distance(hashes, threshold=5)

        # 将有效组成员映射到全局 group index
        for members in members_list:
            for m in members:
                card_id = cards[indices[m]]['id']
                duplicate_groups[card_id] = global_group_idx
            global_group_idx += 1

    # 输出 duplicate_groups.js
    json_str = json.dumps(duplicate_groups, ensure_ascii=False)
    output_content = f"var DUPLICATE_GROUPS = {json_str};\n"

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(output_content)

    print(f"\n========== 去重分组完成 ==========")
    print(f"总分组数: {global_group_idx}")
    print(f"涉及卡牌数: {len(duplicate_groups)}")
    print(f"输出文件: {output_path}")


if __name__ == '__main__':
    main()

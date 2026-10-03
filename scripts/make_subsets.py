#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 MCEval-AgriQA 的 test.jsonl 切分五个任务子集。

背景
----
老师代码包的 README 中，四个 `tools/*_seed8888.py` 编排器要求传入"对应任务的有序子集"
（如 completion139.jsonl、reasoning_test20.jsonl），但代码包里**没有提供这些文件**。
本脚本按 question_type 从 test.jsonl 稳定重建它们。

子集划分（与论文 Table 1 完全一致）
-----------------------------------
    closed_set       179  = judgment(35) + single_choice(144)
    multi_label       24  = multiple_choice(24)
    completion       139  = fill_blank(139)
    open_generation  327  = term_explanation(130) + short_answer(197)
    reasoning         20  = scenario_reasoning(20)
    ------------------------------------------------
    合计             689

用法
----
    python scripts/make_subsets.py \
        --dataset-dir "老师给的资料/MCEval_AgriQA代码/dataset" \
        --out-dir data/subsets

    # 额外生成 5 题快速冒烟测试集
    python scripts/make_subsets.py --dataset-dir ... --out-dir ... --make-demo
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import OrderedDict
from pathlib import Path

# 任务组 -> 覆盖的 question_type（顺序即输出顺序，保持与 test.jsonl 一致的原始顺序）
TASK_GROUPS: "OrderedDict[str, tuple[str, ...]]" = OrderedDict([
    ("closed_set", ("judgment", "single_choice")),
    ("multi_label", ("multiple_choice",)),
    ("completion", ("fill_blank",)),
    ("open_generation", ("term_explanation", "short_answer")),
    ("reasoning", ("scenario_reasoning",)),
])

# 论文 Table 1 中 test 集的期望题量，用于自校验
EXPECTED_COUNTS = {
    "closed_set": 179,
    "multi_label": 24,
    "completion": 139,
    "open_generation": 327,
    "reasoning": 20,
}

# test 集九字段 schema（必须保持顺序，run_full_prompt.py 会校验）
SCHEMA = (
    "id", "split", "question", "question_type", "task_type",
    "options", "answer", "explanation", "source",
)


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8-sig") as f:
        return [json.loads(line) for line in f if line.strip()]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="切分 MCEval-AgriQA test 集任务子集")
    parser.add_argument(
        "--dataset-dir",
        type=Path,
        default=Path("老师给的资料/MCEval_AgriQA代码/dataset"),
        help="含 train/dev/test.jsonl 的目录",
    )
    parser.add_argument("--out-dir", type=Path, default=Path("data/subsets"))
    parser.add_argument(
        "--make-demo",
        action="store_true",
        help="额外生成每个任务组各取 1 题的 demo.jsonl，用于快速验证流水线",
    )
    args = parser.parse_args()

    test_path = args.dataset_dir / "test.jsonl"
    if not test_path.exists():
        print(f"[FAIL] 找不到 {test_path}", file=sys.stderr)
        return 1

    rows = read_jsonl(test_path)

    # 字段 schema 校验
    for i, row in enumerate(rows, 1):
        if tuple(row) != SCHEMA:
            print(f"[FAIL] 第 {i} 行字段或顺序不符：{tuple(row)}", file=sys.stderr)
            return 1

    print(f"读取 {test_path}  ->  {len(rows)} 行，schema 校验通过")
    print()

    ok = True
    demo_rows: list[dict] = []
    for group, question_types in TASK_GROUPS.items():
        subset = [r for r in rows if r.get("question_type") in question_types]
        expected = EXPECTED_COUNTS[group]
        flag = "OK " if len(subset) == expected else "!! "
        if len(subset) != expected:
            ok = False
        print(f"[{flag}] {group:16s} {len(subset):4d} 题 (期望 {expected:4d})  题型: {', '.join(question_types)}")

        out_path = args.out_dir / f"{group}.jsonl"
        write_jsonl(out_path, subset)

        if subset:
            demo_rows.append(subset[0])

    total = sum(len([r for r in rows if r.get("question_type") in qts]) for qts in TASK_GROUPS.values())
    print()
    print(f"合计 {total} 题" + ("（与论文 Table 1 一致）" if total == 689 else "  <<< 与 689 不符！"))

    if args.make_demo and demo_rows:
        demo_path = args.out_dir / "demo.jsonl"
        write_jsonl(demo_path, demo_rows)
        print(f"已生成冒烟测试集: {demo_path}  ({len(demo_rows)} 题，每任务组 1 题)")

    print(f"输出目录: {args.out_dir.resolve()}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

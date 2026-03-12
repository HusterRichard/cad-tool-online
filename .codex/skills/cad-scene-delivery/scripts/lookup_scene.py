#!/usr/bin/env python3
"""
Resolve CadToolOnline scene metadata from the global PRD and local scene docs.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


SCENE_ROW_RE = re.compile(
    r"^\|\s*(SC\d{2})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|"
)


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def latest_file(directory: Path, pattern: str) -> str | None:
    matches = sorted(directory.glob(pattern))
    if not matches:
        return None
    return str(matches[-1].relative_to(repo_root())).replace("\\", "/")


def find_global_prd(root: Path) -> Path:
    matches = sorted((root / "docs" / "prd" / "global").glob("GLOBAL_PRD_CADToolOnline_*.md"))
    if not matches:
        raise FileNotFoundError("No global PRD file found under docs/prd/global")
    return matches[-1]


def parse_scene(global_prd: Path, scene_id: str) -> dict[str, str]:
    for line in global_prd.read_text(encoding="utf-8").splitlines():
        match = SCENE_ROW_RE.match(line)
        if not match:
            continue
        current_scene_id, module, scene_name, help_path, screen_id = match.groups()
        if current_scene_id == scene_id:
            return {
                "scene_id": current_scene_id,
                "module": module.strip(),
                "scene_name": scene_name.strip(),
                "help_path": help_path.strip(),
                "screen_id": screen_id.strip(),
            }
    raise KeyError(f"Scene {scene_id} not found in {global_prd}")


def resolve_help_file(root: Path, help_path: str) -> str | None:
    relative = help_path.lstrip("/")
    help_file = root / "ref" / "Docs" / "CADToolBox" / relative
    if not help_file.exists():
        return None
    return str(help_file.relative_to(root)).replace("\\", "/")


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve one CadToolOnline scene.")
    parser.add_argument("scene_id", help="Scene ID such as SC01 or SC12")
    args = parser.parse_args()

    scene_id = args.scene_id.strip().upper()
    if not re.fullmatch(r"SC\d{2}", scene_id):
        print("scene_id must look like SC01 or SC12", file=sys.stderr)
        return 2

    root = repo_root()
    global_prd = find_global_prd(root)
    scene = parse_scene(global_prd, scene_id)

    result = {
        "scene_id": scene["scene_id"],
        "scene_name": scene["scene_name"],
        "module": scene["module"],
        "screen_id": scene["screen_id"],
        "global_prd": str(global_prd.relative_to(root)).replace("\\", "/"),
        "help_path": scene["help_path"],
        "help_file": resolve_help_file(root, scene["help_path"]),
        "existing_prd": latest_file(root / "docs" / "prd" / "scenarios", f"{scene_id}_PRD_*.md"),
        "existing_plan": latest_file(root / "docs" / "plan" / "scenarios", f"{scene_id}_PLAN_*.md"),
        "existing_qa": latest_file(root / "docs" / "qa" / "plans", f"{scene_id}_QA_*.md"),
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

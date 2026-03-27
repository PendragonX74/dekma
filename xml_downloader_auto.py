#!/usr/bin/env python3
"""
xml_downloader_auto.py

Scans for new Theory and Revision exams in active years (2026, 2027).

Instead of scanning local XML files to determine what already exists,
this version reads data/exam_manifest.json (committed to the repo).
This means:
  - The DEKMA RESULTS/ folder never needs to be committed.
  - Works correctly in ephemeral CI environments (GitHub Actions).

For each exam type (R, T) per active year per centre:
  - Re-downloads the last REFRESH_WINDOW exams (default 2) unconditionally,
    so any server-side corrections to recent data are picked up.
  - Then scans forward from max+1 until the first gap, picking up new exams.

Writes ROOT_FOLDER/.new_downloads marker if anything changed so you know
when to re-run parse_results.py.
"""

import json
import time
import requests
import xml.etree.ElementTree as ET
from pathlib import Path

BASE_URL       = "http://dekma.api.dekma.edu.lk/api/Performance/GetExamResult"
CENTERS        = ["Galle", "Matara", "Hambanthota"]
EXAM_TYPES     = ["R", "T"]
ACTIVE_YEARS   = [2026, 2027]

ROOT_FOLDER    = Path("DEKMA RESULTS")
MANIFEST_FILE  = Path("data/exam_manifest.json")

# How many of the most-recent exams per type to always re-download,
# even if already present — catches server-side data corrections.
REFRESH_WINDOW = 2

ROOT_FOLDER.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept":     "application/xml, text/xml, */*",
    "Connection": "keep-alive",
}

TIMEOUT        = 15
SLEEP_BETWEEN  = 0.4
MAX_SCAN_AHEAD = 500


# ─── helpers ─────────────────────────────────────────────────────────────────

def is_valid_xml(content: bytes) -> bool:
    try:
        root = ET.fromstring(content)
        return any(el.tag.endswith("Performance") for el in root)
    except Exception:
        return False


def save_file(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def fetch_exam(center: str, exam_code: str) -> bytes | None:
    params = {"center": center, "exam": exam_code, "cutOutMark": "0"}
    try:
        resp = requests.get(BASE_URL, params=params, headers=HEADERS, timeout=TIMEOUT)
    except Exception as e:
        print(f"    [{exam_code}] request error: {e}")
        return None
    if resp.status_code != 200:
        return None
    content = resp.content
    if not content or not is_valid_xml(content):
        return None
    return content


def load_manifest() -> dict:
    """
    Load data/exam_manifest.json.
    Returns a dict keyed by "<city_slug>_<year>" → list of exam ID strings.
    Example: {"galle_2026": ["T-2026-001", "R-2026-001", ...]}
    """
    if not MANIFEST_FILE.exists():
        return {}
    try:
        return json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[WARN] Could not read manifest: {e}")
        return {}


def city_slug(city: str) -> str:
    import re
    return re.sub(r'[^a-z0-9]+', '_', city.lower()).strip('_')


def known_numbers_from_manifest(manifest: dict, city: str,
                                exam_type: str, year: int) -> list[int]:
    """
    Return sorted list of exam numbers already processed for this
    city/year/type combination, read from the manifest.

    Manifest exam IDs look like:
      "T-2026-003"    (regular theory)
      "TM-2025-003"   (theory model)
      "R-2026-001"    (regular revision)
      "RM-2025-001"   (revision model)

    We match on the first character (T or R) regardless of model suffix.
    """
    key  = f"{city_slug(city)}_{year}"
    ids  = manifest.get(key, [])
    nums = []
    for eid in ids:
        # eid starts with exam_type letter (T or R)
        if not eid.startswith(exam_type):
            continue
        try:
            nums.append(int(eid.split("-")[-1]))
        except ValueError:
            continue
    return sorted(nums)


# ─── main ────────────────────────────────────────────────────────────────────

def main():
    print("Starting xml_downloader_auto.py")
    print(f"Centres:      {CENTERS}")
    print(f"Active years: {ACTIVE_YEARS}")
    print(f"Refresh window: last {REFRESH_WINDOW} exams per type always re-checked\n")

    manifest        = load_manifest()
    new_or_updated  = False

    for center in CENTERS:
        for year in ACTIVE_YEARS:
            print(f"\n── {center} {year} ──────────────────────────────")
            year_folder = ROOT_FOLDER / center / str(year)

            for exam_type in EXAM_TYPES:
                nums    = known_numbers_from_manifest(manifest, center, exam_type, year)
                max_num = max(nums) if nums else 0

                # ── Refresh window: re-download last N existing exams ─────
                # Even if already saved locally, re-fetch in case the server
                # corrected the data after the original download.
                refresh_start = max(1, max_num - REFRESH_WINDOW + 1)
                refresh_end   = max_num  # inclusive

                if max_num > 0:
                    print(f"  Refreshing  {exam_type}: "
                          f"{exam_type}-{year}-{refresh_start:03d} … "
                          f"{exam_type}-{year}-{refresh_end:03d}")
                    for n in range(refresh_start, refresh_end + 1):
                        exam_code = f"{exam_type}-{year}-{n:03d}"
                        content   = fetch_exam(center, exam_code)
                        file_path = year_folder / f"{exam_code}.xml"
                        if content is None:
                            print(f"    [{exam_code}] no valid XML — skipping refresh")
                            time.sleep(SLEEP_BETWEEN)
                            continue
                        # Check if content actually changed before marking dirty
                        if file_path.exists() and file_path.read_bytes() == content:
                            print(f"    [{exam_code}] unchanged")
                        else:
                            save_file(file_path, content)
                            print(f"    [{exam_code}] refreshed (data changed)")
                            new_or_updated = True
                        time.sleep(SLEEP_BETWEEN)

                # ── Forward scan: look for brand-new exams ────────────────
                start_n = max_num + 1
                print(f"  Scanning    {exam_type} from "
                      f"{exam_type}-{year}-{start_n:03d}...")

                for test_n in range(start_n, start_n + MAX_SCAN_AHEAD):
                    exam_code = f"{exam_type}-{year}-{test_n:03d}"
                    content   = fetch_exam(center, exam_code)
                    if content is None:
                        print(f"    [{exam_code}] no valid XML — end of sequence")
                        break
                    file_path = year_folder / f"{exam_code}.xml"
                    save_file(file_path, content)
                    print(f"    [{exam_code}] saved (new)")
                    new_or_updated = True
                    time.sleep(SLEEP_BETWEEN)

    marker = ROOT_FOLDER / ".new_downloads"
    if new_or_updated:
        marker.write_text("new\n", encoding="utf-8")
        print("\n✓ New or updated files saved — marker written:", marker)
        print("  Run parse_results.py to regenerate the data chunks.")
    else:
        if marker.exists():
            marker.unlink()
        print("\n✓ No new or changed exams found.")

    print("Done.")


if __name__ == "__main__":
    main()

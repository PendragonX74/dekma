#!/usr/bin/env python3
"""
xml_downloader_auto.py

Scans for new Theory and Revision exams in active years (2026, 2027).
Starts from max(existing)+1 and stops at the first gap.

Writes ROOT_FOLDER/.new_downloads marker if anything changed so you know
when to re-run parse_results.py.
"""

import time
import requests
import xml.etree.ElementTree as ET
from pathlib import Path

BASE_URL     = "http://dekma.api.dekma.edu.lk/api/Performance/GetExamResult"
CENTERS      = ["Galle", "Matara", "Hambanthota"]
EXAM_TYPES   = ["R", "T"]
ACTIVE_YEARS = [2026, 2027]

ROOT_FOLDER = Path("DEKMA RESULTS")
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

def existing_numbers(year_folder: Path, exam_type: str, year: int) -> list[int]:
    if not year_folder.exists():
        return []
    prefix = f"{exam_type}-{year}-"
    nums = []
    for f in year_folder.iterdir():
        if not f.is_file() or f.suffix.lower() != ".xml":
            continue
        stem = f.stem
        if not stem.startswith(prefix) or stem.endswith("(M)"):
            continue
        try:
            nums.append(int(stem[len(prefix):]))
        except ValueError:
            continue
    return sorted(nums)


# ─── main ────────────────────────────────────────────────────────────────────

def main():
    print("Starting xml_downloader_auto.py")
    print(f"Centres:      {CENTERS}")
    print(f"Active years: {ACTIVE_YEARS}\n")

    new_or_updated = False

    for center in CENTERS:
        for year in ACTIVE_YEARS:
            print(f"\n── {center} {year} ──────────────────────────────")
            year_folder = ROOT_FOLDER / center / str(year)

            for exam_type in EXAM_TYPES:
                nums    = existing_numbers(year_folder, exam_type, year)
                start_n = (max(nums) if nums else 0) + 1
                print(f"  Scanning {exam_type} from {exam_type}-{year}-{start_n:03d}...")

                for test_n in range(start_n, start_n + MAX_SCAN_AHEAD):
                    exam_code = f"{exam_type}-{year}-{test_n:03d}"
                    content   = fetch_exam(center, exam_code)
                    if content is None:
                        print(f"    [{exam_code}] no valid XML — end of sequence")
                        break
                    file_path = year_folder / f"{exam_code}.xml"
                    save_file(file_path, content)
                    print(f"    [{exam_code}] saved")
                    new_or_updated = True
                    time.sleep(SLEEP_BETWEEN)

    marker = ROOT_FOLDER / ".new_downloads"
    if new_or_updated:
        marker.write_text("new\n", encoding="utf-8")
        print("\n✓ New files saved — marker written:", marker)
        print("  Run parse_results.py to regenerate the data chunks.")
    else:
        if marker.exists():
            marker.unlink()
        print("\n✓ No new exams found.")

    print("Done.")


if __name__ == "__main__":
    main()

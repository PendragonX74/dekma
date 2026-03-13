#!/usr/bin/env python3
"""
xml_downloader_auto.py

Smart downloader with two operating modes per year:

  ACTIVE years (2026+):
    • Re-check only the last REFRESH_LAST_N Theory and Revision exams for
      server-side score corrections (the only ones DEKMA still updates).
    • Then scan forward from max(existing)+1 to pick up brand-new exams.
    • No model papers — DEKMA only issues those for pre-2026 years.

  HISTORICAL years (< 2026, e.g. 2025):
    • Never re-download existing regular T/R files (they are finalized).
    • Scan for Theory Model and Revision Model papers not yet on disk.
      API format:  ?exam=T-2025-002(M)
      File saved:  DEKMA RESULTS/<center>/<year>/T-2025-002(M).xml
      Stops after 3 consecutive API misses so gaps don't cause an infinite scan.

Writes ROOT_FOLDER/.new_downloads marker if anything changed so you know
when to re-run parse_results.py.
"""

import hashlib
import time
import requests
import xml.etree.ElementTree as ET
from pathlib import Path

BASE_URL   = "http://dekma.api.dekma.edu.lk/api/Performance/GetExamResult"
CENTERS    = ["Galle", "Matara", "Hambanthota"]
EXAM_TYPES = ["R", "T"]

# Years that still receive brand-new exams and occasional score corrections.
ACTIVE_YEARS = [2026, 2027]

# Years whose regular exams are finalized but may still have model papers
# we have not downloaded yet.  Add 2024, 2023 etc. if you have earlier data.
HISTORICAL_YEARS = [2025]

# How many of the most-recent T and R exams to re-check for updates
# in active years.  2 covers the typical DEKMA correction window.
REFRESH_LAST_N = 2

# After this many consecutive API misses we stop the model-paper scan.
MODEL_SCAN_MISS_LIMIT = 3

ROOT_FOLDER    = Path("DEKMA RESULTS")
ROOT_FOLDER.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept":     "application/xml, text/xml, */*",
    "Connection": "keep-alive",
}

TIMEOUT        = 15
SLEEP_BETWEEN  = 0.4   # polite delay between requests (seconds)
MAX_SCAN_AHEAD = 500   # safety cap for forward sequential scan


# ─── helpers ─────────────────────────────────────────────────────────────────

def is_valid_xml(content: bytes) -> bool:
    """True if content is parseable XML with at least one <Performance> element."""
    try:
        root = ET.fromstring(content)
        return any(el.tag.endswith("Performance") for el in root)
    except Exception:
        return False

def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()

def file_md5(path: Path) -> str:
    return md5(path.read_bytes())

def save_file(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)

def fetch_exam(center: str, exam_code: str) -> bytes | None:
    """
    Fetch one exam from the DEKMA API.
    exam_code examples:  T-2026-003   R-2025-001(M)
    Returns raw bytes on success, None if server returns nothing useful.
    """
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

def existing_numbers(year_folder: Path, exam_type: str, year: int,
                     model: bool = False) -> list[int]:
    """
    Return a sorted list of exam numbers already saved for this type/mode.
    model=True  → looks for  T-2025-003(M).xml
    model=False → looks for  T-2026-003.xml
    """
    if not year_folder.exists():
        return []
    prefix = f"{exam_type}-{year}-"
    nums = []
    for f in year_folder.iterdir():
        if not f.is_file() or not f.suffix.lower() == ".xml":
            continue
        stem = f.stem   # e.g. "T-2025-003(M)" or "T-2026-003"
        if not stem.startswith(prefix):
            continue
        is_model_file = stem.endswith("(M)")
        if model != is_model_file:
            continue
        try:
            numpart = stem[len(prefix):]
            if model:
                numpart = numpart[:-3]   # strip trailing "(M)"
            nums.append(int(numpart))
        except ValueError:
            continue
    return sorted(nums)


# ─── per-year strategies ─────────────────────────────────────────────────────

def refresh_recent(center: str, year: int) -> bool:
    """
    Re-download only the last REFRESH_LAST_N T and R exams in an active year.
    Overwrites the local copy only when the server content has changed.
    Returns True if any file was updated.
    """
    year_folder = ROOT_FOLDER / center / str(year)
    any_updated = False

    for exam_type in EXAM_TYPES:
        nums = existing_numbers(year_folder, exam_type, year)
        if not nums:
            continue
        to_check = nums[-REFRESH_LAST_N:]
        labels   = [f"{exam_type}-{year}-{n:03d}" for n in to_check]
        print(f"  Re-checking {exam_type} exams for updates: {labels}")

        for n in to_check:
            exam_code = f"{exam_type}-{year}-{n:03d}"
            file_path = year_folder / f"{exam_code}.xml"
            content   = fetch_exam(center, exam_code)
            if content is None:
                print(f"    [{exam_code}] no valid response — keeping existing file")
                time.sleep(SLEEP_BETWEEN)
                continue
            if not file_path.exists() or md5(content) != file_md5(file_path):
                save_file(file_path, content)
                print(f"    [{exam_code}] UPDATED (server content changed)")
                any_updated = True
            else:
                print(f"    [{exam_code}] unchanged")
            time.sleep(SLEEP_BETWEEN)

    return any_updated


def scan_new_regular(center: str, year: int) -> bool:
    """
    Forward-scan for brand-new T and R exams starting from max(existing)+1.
    Stops at the first gap.  Returns True if any new file was saved.
    """
    year_folder = ROOT_FOLDER / center / str(year)
    any_new = False

    for exam_type in EXAM_TYPES:
        nums    = existing_numbers(year_folder, exam_type, year)
        start_n = (max(nums) if nums else 0) + 1
        print(f"  Scanning for new {exam_type} exams from {exam_type}-{year}-{start_n:03d}...")

        for test_n in range(start_n, start_n + MAX_SCAN_AHEAD):
            exam_code = f"{exam_type}-{year}-{test_n:03d}"
            content   = fetch_exam(center, exam_code)
            if content is None:
                print(f"    [{exam_code}] no valid XML — end of sequence")
                break
            file_path = year_folder / f"{exam_code}.xml"
            save_file(file_path, content)
            print(f"    [{exam_code}] saved (new)")
            any_new = True
            time.sleep(SLEEP_BETWEEN)

    return any_new


def scan_missing_models(center: str, year: int) -> bool:
    """
    Scan for Theory Model and Revision Model papers in a historical year.
    Skips numbers already on disk.  Stops after MODEL_SCAN_MISS_LIMIT
    consecutive API misses so we don't scan forever when DEKMA returns nothing.
    Returns True if any new file was saved.
    """
    year_folder = ROOT_FOLDER / center / str(year)
    any_new = False

    for exam_type in EXAM_TYPES:
        existing       = set(existing_numbers(year_folder, exam_type, year, model=True))
        consec_misses  = 0
        label_type     = f"{exam_type} Model"
        print(f"  Scanning for new {label_type} papers ({center}/{year})...")

        for test_n in range(1, MAX_SCAN_AHEAD + 1):
            if test_n in existing:
                # Already downloaded — reset the miss counter and continue
                consec_misses = 0
                continue

            exam_code = f"{exam_type}-{year}-{test_n:03d}(M)"
            content   = fetch_exam(center, exam_code)

            if content is None:
                consec_misses += 1
                if consec_misses >= MODEL_SCAN_MISS_LIMIT:
                    print(f"    [{exam_code}] {MODEL_SCAN_MISS_LIMIT} consecutive misses "
                          f"— stopping {label_type} scan")
                    break
                time.sleep(SLEEP_BETWEEN)
                continue

            consec_misses = 0
            file_path = year_folder / f"{exam_code}.xml"
            save_file(file_path, content)
            print(f"    [{exam_code}] saved (new model paper)")
            any_new = True
            time.sleep(SLEEP_BETWEEN)

    return any_new


# ─── main ────────────────────────────────────────────────────────────────────

def main():
    print("Starting xml_downloader_auto.py")
    print(f"Centres:          {CENTERS}")
    print(f"Active years:     {ACTIVE_YEARS}  (new exams + recent refresh)")
    print(f"Historical years: {HISTORICAL_YEARS}  (model papers only)")
    print(f"Refresh last N:   {REFRESH_LAST_N} per type in active years\n")

    new_or_updated = False

    for center in CENTERS:

        # ── Active years: re-check recent exams + scan for new ───────────
        for year in ACTIVE_YEARS:
            print(f"\n── {center} {year} (active) ──────────────────────────────")
            try:
                updated = refresh_recent(center, year)
                new     = scan_new_regular(center, year)
                if updated or new:
                    new_or_updated = True
            except Exception as e:
                print(f"  Error while processing {center} {year}: {e}")

        # ── Historical years: model papers only ──────────────────────────
        for year in HISTORICAL_YEARS:
            print(f"\n── {center} {year} (historical — model papers only) ────────")
            try:
                new = scan_missing_models(center, year)
                if new:
                    new_or_updated = True
            except Exception as e:
                print(f"  Error while processing {center} {year} models: {e}")

    marker = ROOT_FOLDER / ".new_downloads"
    if new_or_updated:
        marker.write_text("new\n", encoding="utf-8")
        print("\n✓ Files changed — marker written:", marker)
        print("  Run parse_results.py to regenerate the data chunks.")
    else:
        if marker.exists():
            marker.unlink()
        print("\n✓ No changes detected.")

    print("Done.")


if __name__ == "__main__":
    main()

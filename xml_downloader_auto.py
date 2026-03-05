#!/usr/bin/env python3
"""
xml_downloader_auto.py

Resume-safe downloader with server-side update detection:
 - Re-downloads all existing XML files and updates them if DEKMA has changed them
 - Then scans for new files starting from max(existing)+1
 - Uses basic XML validation
 - Writes a small marker file `.new_downloads` if any files were saved or updated
"""

import os
import time
import hashlib
import requests
import xml.etree.ElementTree as ET
from pathlib import Path

BASE_URL = "http://dekma.api.dekma.edu.lk/api/Performance/GetExamResult"

CENTERS = ["Galle", "Matara", "Hambanthota"]

# All years that might still receive new exams or server-side corrections.
# Include the current year plus any recent years whose data DEKMA may still update.
YEARS = [2025, 2026, 2027]

EXAM_TYPES = ["R", "T"]

ROOT_FOLDER = Path("DEKMA RESULTS")
ROOT_FOLDER.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/xml, text/xml, */*",
    "Connection": "keep-alive"
}

TIMEOUT = 15
SLEEP_BETWEEN = 0.4  # polite delay between requests

def is_valid_xml(content: bytes) -> bool:
    try:
        root = ET.fromstring(content)
        for elem in root:
            if elem.tag.endswith("Performance"):
                return True
        return False
    except Exception:
        return False

def file_hash(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()

def content_hash(content: bytes) -> str:
    return hashlib.md5(content).hexdigest()

def find_max_existing_number(year_folder: Path, exam_type: str, year: int) -> int:
    if not year_folder.exists():
        return 0
    maxnum = 0
    prefix = f"{exam_type}-{year}-"
    for f in year_folder.iterdir():
        if not f.is_file():
            continue
        name = f.name
        if name.startswith(prefix) and name.lower().endswith(".xml"):
            try:
                numpart = name[len(prefix):].split(".")[0]
                n = int(numpart)
                if n > maxnum:
                    maxnum = n
            except Exception:
                continue
    return maxnum

def save_file(path: Path, content: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(content)

def fetch_exam(center: str, exam_code: str) -> bytes | None:
    """Fetch a single exam from the API. Returns content bytes or None on failure."""
    params = {"center": center, "exam": exam_code, "cutOutMark": "00"}
    try:
        resp = requests.get(BASE_URL, params=params, headers=HEADERS, timeout=TIMEOUT)
    except Exception as e:
        print(f"  [{exam_code}] request error: {e}")
        return None
    if resp.status_code != 200:
        return None
    content = resp.content
    if not content or not is_valid_xml(content):
        return None
    return content

def refresh_existing_files(center: str, year: int) -> bool:
    """
    Re-download every already-existing XML file for this center+year and
    overwrite it if DEKMA has changed the content server-side.
    This is what detects score corrections that the server applies to old exams.
    Returns True if any file was updated.
    """
    year_folder = ROOT_FOLDER / center / str(year)
    if not year_folder.exists():
        return False

    any_updated = False
    for exam_type in EXAM_TYPES:
        prefix = f"{exam_type}-{year}-"
        existing = sorted(
            f for f in year_folder.iterdir()
            if f.is_file() and f.name.startswith(prefix) and f.name.lower().endswith(".xml")
        )
        if not existing:
            continue
        print(f"  Refreshing {len(existing)} existing {exam_type} file(s) for {center}/{year}...")
        for f in existing:
            exam_code = f.stem
            content = fetch_exam(center, exam_code)
            if content is None:
                print(f"    [{exam_code}] no valid response during refresh — keeping existing file")
                time.sleep(SLEEP_BETWEEN)
                continue
            if content_hash(content) != file_hash(f):
                save_file(f, content)
                print(f"    [{exam_code}] UPDATED (server content changed)")
                any_updated = True
            else:
                print(f"    [{exam_code}] unchanged")
            time.sleep(SLEEP_BETWEEN)
    return any_updated

def download_new_files(center: str, year: int) -> bool:
    """
    Download any new exam files that don't exist yet, starting from
    max(existing) + 1. Returns True if any new file was saved.
    """
    year_folder = ROOT_FOLDER / center / str(year)
    any_new = False

    for exam_type in EXAM_TYPES:
        start_no = find_max_existing_number(year_folder, exam_type, year) + 1
        test_no = start_no

        MAX_TRIES = 500
        tries = 0

        while tries < MAX_TRIES:
            tries += 1
            exam_code = f"{exam_type}-{year}-{test_no:03d}"
            content = fetch_exam(center, exam_code)

            if content is None:
                print(f"  [{center} {exam_code}] no valid XML — stopping sequence")
                break

            file_path = year_folder / f"{exam_code}.xml"
            if file_path.exists():
                # Shouldn't happen (we started from max+1), but guard anyway
                print(f"  [{center} {exam_code}] already exists, skipping")
            else:
                save_file(file_path, content)
                print(f"  [{center} {exam_code}] saved (new)")
                any_new = True

            test_no += 1
            time.sleep(SLEEP_BETWEEN)

    return any_new

def main():
    print("Starting xml_downloader_auto.py")
    print(f"Checking centers: {CENTERS}")
    print(f"Checking years:   {YEARS}\n")
    new_or_updated = False

    for center in CENTERS:
        for year in YEARS:
            print(f"\n── {center} {year} ──────────────────────────────")
            try:
                # Pass 1: refresh existing files (catches server-side score corrections)
                updated = refresh_existing_files(center, year)
                # Pass 2: download any brand-new exam files
                new     = download_new_files(center, year)
                if updated or new:
                    new_or_updated = True
            except Exception as e:
                print(f"  Error while checking {center} {year}: {e}")

    marker = ROOT_FOLDER / ".new_downloads"
    if new_or_updated:
        marker.write_text("new\n", encoding="utf-8")
        print("\n✓ Files changed — marker created:", marker)
        print("  Run parse_results.py to regenerate the data chunks.")
    else:
        if marker.exists():
            marker.unlink()
        print("\n✓ No changes detected.")

    print("Done.")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
xml_downloader_auto.py

Resume-safe downloader:
 - Scans existing files under DEKMA RESULTS/<center>/<year>/
 - For each exam type (T and R) starts from max(existing)+1
 - Downloads only genuinely new XML files
 - Uses basic XML validation (same as your previous is_valid_xml)
 - Writes a small marker file `.new_downloads` if any new files were saved
"""

import os
import time
import requests
import xml.etree.ElementTree as ET
from pathlib import Path

BASE_URL = "http://dekma.api.dekma.edu.lk/api/Performance/GetExamResult"

# Configure centers and years you want to monitor
CENTERS = ["Galle", "Matara", "Hambanthota"]
YEARS = range(2019, 2029)            # adjust end year as you prefer, end is exclusive
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
        # Simple rule: XML contains at least one 'Performance' node
        for elem in root:
            if elem.tag.endswith("Performance"):
                return True
        return False
    except Exception:
        return False

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

def download_for_center_year(center: str, year: int) -> bool:
    """
    Returns True if at least one new file was downloaded for this center/year.
    """
    year_folder = ROOT_FOLDER / center / str(year)
    any_new = False

    for exam_type in EXAM_TYPES:
        start_no = find_max_existing_number(year_folder, exam_type, year) + 1
        test_no = start_no

        # safety ceiling to avoid infinite loops in weird cases
        MAX_TRIES = 500
        tries = 0

        while tries < MAX_TRIES:
            tries += 1
            exam_code = f"{exam_type}-{year}-{test_no:03d}"
            params = {"center": center, "exam": exam_code, "cutOutMark": "00"}

            try:
                resp = requests.get(BASE_URL, params=params, headers=HEADERS, timeout=TIMEOUT)
            except Exception as e:
                print(f"[{center} {exam_code}] request error: {e}, retrying after short wait")
                time.sleep(2)
                continue

            if resp.status_code != 200:
                print(f"[{center} {exam_code}] stopped, status {resp.status_code}")
                break

            content = resp.content
            if not content or not is_valid_xml(content):
                # No valid XML at this code means server hasn't uploaded that exam yet
                print(f"[{center} {exam_code}] not valid XML, stopping for this sequence")
                break

            # If we reached here, XML is valid. Save file if not already present.
            file_path = year_folder / f"{exam_code}.xml"
            if file_path.exists():
                print(f"[{center} {exam_code}] already exists, skipping")
            else:
                save_file(file_path, content)
                print(f"[{center} {exam_code}] saved")
                any_new = True

            test_no += 1
            time.sleep(SLEEP_BETWEEN)

    return any_new

def main():
    print("Starting xml_downloader_auto.py")
    new_downloads = False
    for center in CENTERS:
        for year in YEARS:
            print(f"Checking {center} {year}")
            try:
                changed = download_for_center_year(center, year)
                if changed:
                    new_downloads = True
            except Exception as e:
                print(f"Error while checking {center} {year}: {e}")
                # continue scanning other centers/years

    # Touch marker if new files saved
    marker = ROOT_FOLDER / ".new_downloads"
    if new_downloads:
        marker.write_text("new\n", encoding="utf-8")
        print("New files downloaded, marker created:", marker)
    else:
        if marker.exists():
            marker.unlink()
        print("No new files downloaded")

    print("Done.")

if __name__ == "__main__":
    main()
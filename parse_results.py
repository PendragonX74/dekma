#!/usr/bin/env python3
"""
parse_results.py
Reads DEKMA RESULTS/<center>/<year>/*.xml and writes data/results.js
"""

import re
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT_FOLDER = Path("DEKMA RESULTS")
OUTPUT_FILE = Path("data/results.js")

CENTERS = ["Galle", "Matara", "Hambanthota"]
NS = "http://schemas.datacontract.org/2004/07/DTO"

def tag(name):
    return f"{{{NS}}}{name}"

def parse_student_name(raw):
    raw = raw.strip()
    match = re.search(r'\(([A-Za-z])\)\s*$', raw)
    if match:
        return raw[:match.start()].strip(), match.group(1).upper()
    return raw, ""

def exam_type_info(exam_type):
    return {"T": ("theory", "Theory"), "R": ("revision", "Revision")}.get(exam_type, (exam_type.lower(), exam_type))

def parse_xml_file(filepath):
    try:
        root = ET.parse(filepath).getroot()
    except Exception as e:
        print(f"  [WARN] Could not parse {filepath.name}: {e}")
        return []
    students = []
    for perf in root.findall(tag("Performance")):
        try:
            mark   = int(perf.find(tag("Mark")).text.strip())
            rank   = int(perf.find(tag("Rank")).text.strip())
            school = perf.find(tag("School")).text.strip()
            name, gender = parse_student_name(perf.find(tag("StudentName")).text)
            students.append({"name": name, "school": school, "marks": mark, "rank": rank, "gender": gender})
        except Exception as e:
            print(f"  [WARN] Skipping record in {filepath.name}: {e}")
    return students

def parse_filename(filename):
    match = re.fullmatch(r'([A-Z])-(\d{4})-(\d+)', Path(filename).stem)
    return (match.group(1), int(match.group(2)), int(match.group(3))) if match else None

def build_data():
    data = {}
    for center in CENTERS:
        center_path = ROOT_FOLDER / center
        if not center_path.exists():
            print(f"[SKIP] {center_path} not found")
            continue
        data[center] = {}
        for year_folder in sorted([d for d in center_path.iterdir() if d.is_dir() and d.name.isdigit()], key=lambda d: int(d.name)):
            year = int(year_folder.name)
            print(f"  {center} / {year} ...")
            exams = []
            for xml_file in sorted(f for f in year_folder.iterdir() if f.suffix.lower() == ".xml"):
                parsed = parse_filename(xml_file.name)
                if not parsed or parsed[1] != year:
                    continue
                exam_type, _, number = parsed
                type_key, type_label = exam_type_info(exam_type)
                students = parse_xml_file(xml_file)
                if not students:
                    continue
                exam_id = f"{exam_type}-{year}-{number:03d}"
                exams.append({"id": exam_id, "label": f"{type_label} {number}", "type": type_key, "number": number, "students": students})
                print(f"    {exam_id}: {len(students)} students")
            if exams:
                data[center][str(year)] = {"exams": exams}
    return data

def main():
    print(f"Reading: {ROOT_FOLDER.resolve()}")
    print(f"Writing: {OUTPUT_FILE.resolve()}\n")
    if not ROOT_FOLDER.exists():
        print("ERROR: DEKMA RESULTS folder not found. Run xml_downloader_auto.py first.")
        return
    data = build_data()
    if not data:
        print("ERROR: No data found.")
        return
    total_exams = sum(len(yd["exams"]) for cd in data.values() for yd in cd.values())
    total_students = sum(len(e["students"]) for cd in data.values() for yd in cd.values() for e in yd["exams"])
    print(f"\n{len(data)} centers | {total_exams} exams | {total_students} student records")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    json_str = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    OUTPUT_FILE.write_text(f"window.dekmaData={json_str};", encoding="utf-8")
    print(f"Wrote {OUTPUT_FILE} ({OUTPUT_FILE.stat().st_size / 1024 / 1024:.2f} MB)")
    print("Done.")

if __name__ == "__main__":
    main()
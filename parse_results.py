#!/usr/bin/env python3
"""
parse_results.py

Reads DEKMA RESULTS/<center>/<year>/*.xml and updates chunked data files:
 - data/results_<city>_<year>.js    (e.g. data/results_galle_2020.js)
 - data/results_index.js            (window.dekmaChunks)

New exams are merged into existing chunk data – already‑present exams are left untouched.
"""

import re
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT_FOLDER = Path("DEKMA RESULTS")
OUTPUT_DIR = Path("data")

CENTERS = ["Galle", "Matara", "Hambanthota"]
NS = "http://schemas.datacontract.org/2004/07/DTO"

def slug(s):
    """Convert a city name to the slug used in filenames and variable names."""
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

def tag(name):
    return f"{{{NS}}}{name}"

def parse_student_name(raw):
    raw = raw.strip()
    match = re.search(r'\(([A-Za-z])\)\s*$', raw)
    if match:
        return raw[:match.start()].strip(), match.group(1).upper()
    return raw, ""

def exam_type_info(exam_type):
    return {
        "T": ("theory", "Theory"),
        "R": ("revision", "Revision")
    }.get(exam_type, (exam_type.lower(), exam_type))

def parse_xml_file(filepath):
    """Parse a single XML file and return a list of student records."""
    try:
        root = ET.parse(filepath).getroot()
    except Exception as e:
        print(f"  [WARN] Could not parse {filepath.name}: {e}")
        return []
    students = []
    for perf in root.findall(tag("Performance")):
        try:
            mark = int(perf.find(tag("Mark")).text.strip())
            rank = int(perf.find(tag("Rank")).text.strip())
            school = perf.find(tag("School")).text.strip()
            name, gender = parse_student_name(perf.find(tag("StudentName")).text)
            students.append({
                "name": name,
                "school": school,
                "marks": mark,
                "rank": rank,
                "gender": gender
            })
        except Exception as e:
            print(f"  [WARN] Skipping record in {filepath.name}: {e}")
    return students

def parse_filename(filename):
    """Extract (exam_type, year, number) from an XML filename."""
    match = re.fullmatch(r'([A-Z])-(\d{4})-(\d+)', Path(filename).stem)
    return (match.group(1), int(match.group(2)), int(match.group(3))) if match else None

def load_existing_chunk(city, year):
    """
    Load the existing chunk file for a given city and year.
    Returns a dict: {"exams": [...]} or None if the file does not exist.
    """
    chunk_file = OUTPUT_DIR / f"results_{slug(city)}_{year}.js"
    if not chunk_file.exists():
        return None
    # The file contains a variable assignment: window.dekmaChunk_... = {...};
    # We'll read the file and extract the JSON part.
    content = chunk_file.read_text(encoding="utf-8")
    # Find the first '{' and last '}'
    start = content.find('{')
    end = content.rfind('}')
    if start == -1 or end == -1:
        print(f"  [WARN] Could not parse existing chunk {chunk_file}, will overwrite.")
        return None
    json_str = content[start:end+1]
    try:
        data = json.loads(json_str)
        return data
    except json.JSONDecodeError:
        print(f"  [WARN] Invalid JSON in {chunk_file}, will overwrite.")
        return None

def write_chunk(city, year, exams):
    """Write the chunk file for a city/year with the given exams list."""
    chunk_file = OUTPUT_DIR / f"results_{slug(city)}_{year}.js"
    var_name = f"window.dekmaChunk_{slug(city)}_{year}"
    # Sort exams: theory first, then revision, then by number
    exams.sort(key=lambda e: (0 if e['type'] == 'theory' else 1, e['number']))
    data = {"exams": exams}
    json_str = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    chunk_file.write_text(f"{var_name}={json_str};\n", encoding="utf-8")
    print(f"  Wrote {chunk_file} ({len(exams)} exams)")

def build_index():
    """Scan the data folder for chunk files and build the index list."""
    chunks = []
    for f in OUTPUT_DIR.glob("results_*.js"):
        if f.name == "results_index.js":
            continue
        # filename: results_city_year.js
        stem = f.stem  # e.g. "results_galle_2020"
        parts = stem.split('_')
        if len(parts) < 3:
            continue
        # The city slug is everything between "results_" and the last "_" + year
        # e.g. results_galle_2020 -> city_slug = "galle", year = "2020"
        year = parts[-1]
        city_slug = '_'.join(parts[1:-1])
        chunks.append({
            "city": city_slug,
            "year": int(year),
            "file": f.name
        })
    # Sort by city, then year descending
    chunks.sort(key=lambda c: (c['city'], -c['year']))
    return chunks

def main():
    print(f"Reading: {ROOT_FOLDER.resolve()}")
    print(f"Writing chunks to: {OUTPUT_DIR.resolve()}\n")

    if not ROOT_FOLDER.exists():
        print("ERROR: DEKMA RESULTS folder not found. Run xml_downloader_auto.py first.")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # --- First pass: gather all XML files per city/year ---
    city_year_exams = {}  # key: (city, year) -> list of exam objects from XML

    for city in CENTERS:
        city_path = ROOT_FOLDER / city
        if not city_path.exists():
            print(f"[SKIP] {city_path} not found")
            continue
        for year_folder in sorted(city_path.iterdir()):
            if not year_folder.is_dir() or not year_folder.name.isdigit():
                continue
            year = int(year_folder.name)
            print(f"Scanning {city} / {year} ...")
            exams_for_year = []
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
                exams_for_year.append({
                    "id": exam_id,
                    "label": f"{type_label} {number}",
                    "type": type_key,
                    "number": number,
                    "students": students
                })
                print(f"    {exam_id}: {len(students)} students")
            if exams_for_year:
                city_year_exams[(city, year)] = exams_for_year

    if not city_year_exams:
        print("No data found.")
        return

    # --- Second pass: merge with existing chunks and write ---
    for (city, year), new_exams in city_year_exams.items():
        print(f"\nProcessing {city} {year}...")
        existing = load_existing_chunk(city, year)
        if existing and "exams" in existing:
            # Build a set of exam IDs that already exist
            existing_ids = {e["id"] for e in existing["exams"]}
            # Add only those new exams whose ID is not already present
            merged = existing["exams"][:]
            added = 0
            for exam in new_exams:
                if exam["id"] not in existing_ids:
                    merged.append(exam)
                    added += 1
            if added:
                print(f"  Added {added} new exam(s) to existing chunk.")
            else:
                print("  No new exams to add.")
            write_chunk(city, year, merged)
        else:
            # No existing chunk, just write the new exams
            print(f"  Creating new chunk with {len(new_exams)} exam(s).")
            write_chunk(city, year, new_exams)

    # --- Write the index file ---
    chunks = build_index()
    index_file = OUTPUT_DIR / "results_index.js"
    json_str = json.dumps(chunks, ensure_ascii=False, separators=(',', ':'))
    index_file.write_text(f"window.dekmaChunks={json_str};\n", encoding="utf-8")
    print(f"\nWrote index {index_file} ({len(chunks)} chunks)")

    # --- Summary statistics ---
    total_exams = sum(len(yd) for yd in city_year_exams.values())  # FIXED: yd is the list of exams
    total_students = sum(len(e["students"]) for exams in city_year_exams.values() for e in exams)
    print(f"\n{len(city_year_exams)} city‑year folders | {total_exams} exams | {total_students} student records")
    print("Done.")

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
parse_results.py

Reads DEKMA RESULTS/<center>/<year>/*.xml, applies manual overrides from
data/manual_edits.json, and writes chunked data files:
 - data/results_<city>_<year>.js
 - data/results_index.js

Manual edits are preserved and reapplied on every run.
"""

import re
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT_FOLDER = Path("DEKMA RESULTS")
OUTPUT_DIR = Path("data")
MANUAL_EDITS_FILE = OUTPUT_DIR / "manual_edits.json"
VERSION_FILE = OUTPUT_DIR / "version.txt"
EXAM_MANIFEST_FILE = OUTPUT_DIR / "exam_manifest.json"

CENTERS = ["Galle", "Matara", "Hambanthota"]
NS = "http://schemas.datacontract.org/2004/07/DTO"

def slug(s):
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
    match = re.fullmatch(r'([A-Z])-(\d{4})-(\d+)', Path(filename).stem)
    return (match.group(1), int(match.group(2)), int(match.group(3))) if match else None

def load_manual_edits():
    if not MANUAL_EDITS_FILE.exists():
        return {"scoreEdits": [], "studentRenames": []}
    try:
        with open(MANUAL_EDITS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARN] Could not load manual_edits.json: {e}")
        return {"scoreEdits": [], "studentRenames": []}

def recompute_ranks(exam):
    """
    Recompute student ranks based on current marks.
    Tied marks → same rank. Next distinct mark → dense skip
    (matches the admin.html recomputeRanks behaviour exactly).
    This MUST be called after any score edit so ranks stay in sync.
    """
    students = sorted(exam["students"], key=lambda s: s["marks"], reverse=True)
    for i, s in enumerate(students):
        if i > 0 and s["marks"] == students[i - 1]["marks"]:
            s["rank"] = students[i - 1]["rank"]
        else:
            s["rank"] = i + 1

def apply_edits(data_by_city_year, edits):
    """
    Apply student renames and score edits to the in‑memory data.
    data_by_city_year: dict key (city, year) -> list of exam objects
    edits: dict with keys "studentRenames" and "scoreEdits"
    """
    # 1. Apply renames (modify student objects directly)
    for rename in edits.get("studentRenames", []):
        old = (rename["oldName"], rename["oldSchool"])
        new_name = rename["newName"]
        new_school = rename["newSchool"]
        for exams in data_by_city_year.values():
            for exam in exams:
                for s in exam["students"]:
                    if s["name"] == old[0] and s["school"] == old[1]:
                        s["name"] = new_name
                        s["school"] = new_school

    # 2. Apply score edits (after renames, so we look for possibly-renamed students)
    for score_edit in edits.get("scoreEdits", []):
        exam_id = score_edit["examId"]
        edit_city = score_edit.get("city")   # present in edits made after the fix; None for older ones
        student_info = score_edit["student"]
        new_marks = score_edit["newMarks"]
        found = False
        for (city, year), exams in data_by_city_year.items():
            # If the edit recorded which city it belongs to, skip non-matching cities.
            # This prevents applying an edit for e.g. Galle's T-2026-001 to Matara's T-2026-001.
            if edit_city and city != edit_city:
                continue
            for exam in exams:
                if exam["id"] == exam_id:
                    for s in exam["students"]:
                        if s["name"] == student_info["name"] and s["school"] == student_info["school"]:
                            s["marks"] = new_marks
                            found = True
                            break
                    if found:
                        break
            if found:
                break
        if not found:
            city_hint = f" (city={edit_city})" if edit_city else ""
            print(f"  [NOTE] Score edit for exam {exam_id}{city_hint} and student {student_info} "
                  f"could not be applied (exam or student missing).")

def write_chunk(city, year, exams):
    chunk_file = OUTPUT_DIR / f"results_{slug(city)}_{year}.js"
    var_name = f"window.dekmaChunk_{slug(city)}_{year}"
    exams.sort(key=lambda e: (0 if e['type'] == 'theory' else 1, e['number']))
    data = {"exams": exams}
    json_str = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    chunk_file.write_text(f"{var_name}={json_str};\n", encoding="utf-8")
    print(f"  Wrote {chunk_file} ({len(exams)} exams)")

def build_index():
    chunks = []
    for f in OUTPUT_DIR.glob("results_*.js"):
        if f.name == "results_index.js":
            continue
        stem = f.stem
        parts = stem.split('_')
        if len(parts) < 3:
            continue
        year = parts[-1]
        city_slug = '_'.join(parts[1:-1])
        chunks.append({
            "city": city_slug,
            "year": int(year),
            "file": f.name
        })
    chunks.sort(key=lambda c: (c['city'], -c['year']))
    return chunks

def load_exam_manifest():
    """Load the previous-run exam ID manifest from disk."""
    if not EXAM_MANIFEST_FILE.exists():
        return {}
    try:
        with open(EXAM_MANIFEST_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARN] Could not load exam_manifest.json: {e}")
        return {}

def save_exam_manifest(city_year_exams):
    """Persist current exam IDs so the next run can diff against them."""
    manifest = {}
    for (city, year), exams in city_year_exams.items():
        key = f"{slug(city)}_{year}"
        manifest[key] = [e["id"] for e in exams]
    try:
        EXAM_MANIFEST_FILE.write_text(
            json.dumps(manifest, ensure_ascii=False, separators=(',', ':')),
            encoding="utf-8"
        )
    except Exception as e:
        print(f"[WARN] Could not save exam_manifest.json: {e}")

def write_new_exams(city_year_exams, old_manifest):
    """
    Diff current exams against old_manifest and write data/new_exams.js.
    Format: window.dekmaNewExams = {"galle":{"2025":["T-2025-003"]}}
    Empty object means nothing is new.
    """
    new_exams = {}
    for (city, year), exams in city_year_exams.items():
        city_key = slug(city)
        old_ids = set(old_manifest.get(f"{city_key}_{year}", []))
        fresh = [e["id"] for e in exams if e["id"] not in old_ids]
        if fresh:
            new_exams.setdefault(city_key, {})[str(year)] = fresh

    js = ("window.dekmaNewExams="
          + json.dumps(new_exams, ensure_ascii=False, separators=(',', ':'))
          + ";\n")
    (OUTPUT_DIR / "new_exams.js").write_text(js, encoding="utf-8")

    total = sum(len(ids) for city in new_exams.values() for ids in city.values())
    if total:
        print(f"New exams detected: {total} — written to new_exams.js")
    else:
        print("No new exams detected (new_exams.js cleared).")
    return new_exams


def bump_version():
    """Increment data/version.txt so index.html cache-busts data files on next load."""
    try:
        current = int(VERSION_FILE.read_text(encoding="utf-8").strip()) if VERSION_FILE.exists() else 0
        next_ver = current + 1
        VERSION_FILE.write_text(str(next_ver), encoding="utf-8")
        print(f"Bumped version.txt: {current} → {next_ver}")
    except Exception as e:
        print(f"[WARN] Could not bump version.txt: {e}")


def main():
    print(f"Reading: {ROOT_FOLDER.resolve()}")
    print(f"Writing chunks to: {OUTPUT_DIR.resolve()}\n")

    if not ROOT_FOLDER.exists():
        print("ERROR: DEKMA RESULTS folder not found. Run xml_downloader_auto.py first.")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load manual edits (if any)
    edits = load_manual_edits()
    if edits["studentRenames"] or edits["scoreEdits"]:
        print(f"Loaded {len(edits['studentRenames'])} rename(s) and "
              f"{len(edits['scoreEdits'])} score edit(s) from manual_edits.json")

    # Load exam manifest (tracks which exam IDs existed on last run)
    old_manifest = load_exam_manifest()

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

    # Apply manual edits to the in‑memory data
    apply_edits(city_year_exams, edits)

    # --- FIX: Recompute ranks for every exam after edits are applied ---
    # The XML stores the original ranks from DEKMA's server. After a score edit
    # those marks change but ranks would still reflect the old values unless we
    # recalculate them here. This is the root cause of ranks reverting after admin
    # edits: the parser was overwriting admin-computed ranks with stale XML ranks.
    rank_edits_applied = sum(len(edits.get("scoreEdits", [])) > 0 for _ in [1])
    total_recomputed = 0
    for exams in city_year_exams.values():
        for exam in exams:
            recompute_ranks(exam)
            total_recomputed += 1
    print(f"\nRecomputed ranks for {total_recomputed} exam(s) (ensures score edits are reflected).")

    # --- Write the updated chunks ---
    for (city, year), exams in city_year_exams.items():
        print(f"\nWriting {city} {year}...")
        write_chunk(city, year, exams)

    # --- Write the index file ---
    chunks = build_index()
    index_file = OUTPUT_DIR / "results_index.js"
    json_str = json.dumps(chunks, ensure_ascii=False, separators=(',', ':'))
    index_file.write_text(f"window.dekmaChunks={json_str};\n", encoding="utf-8")
    print(f"\nWrote index {index_file} ({len(chunks)} chunks)")

    # --- Diff against previous run → new_exams.js ---
    write_new_exams(city_year_exams, old_manifest)
    # Update manifest so next run diffs against today's state
    save_exam_manifest(city_year_exams)

    # Summary statistics
    total_exams = sum(len(yd) for yd in city_year_exams.values())
    total_students = sum(len(e["students"]) for exams in city_year_exams.values() for e in exams)
    print(f"\n{len(city_year_exams)} city‑year folders | {total_exams} exams | {total_students} student records")
    # Bump version.txt so browsers cache-bust data files on next load
    bump_version()
    print("Done.")

if __name__ == "__main__":
    main()

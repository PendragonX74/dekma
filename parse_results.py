#!/usr/bin/env python3
"""
parse_results.py

Reads DEKMA RESULTS/<center>/<year>/*.xml, applies manual overrides from
data/manual_edits.json, and writes chunked data files:
  data/results_<city>_<year>.js
  data/results_index.js

Three exam types are recognised:
  T-2026-003.xml      → type "theory",         label "Theory 3"
  R-2026-003.xml      → type "revision",        label "Revision 3"
  T-2025-003(M).xml   → type "model_theory",    label "Theory Model 3"
  R-2025-003(M).xml   → type "model_revision",  label "Revision Model 3"

Model papers only appear in years < 2026 (controlled by xml_downloader_auto.py).
Manual edits are preserved and reapplied on every run.
"""

import re
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT_FOLDER        = Path("DEKMA RESULTS")
OUTPUT_DIR         = Path("data")
MANUAL_EDITS_FILE  = OUTPUT_DIR / "manual_edits.json"
VERSION_FILE       = OUTPUT_DIR / "version.txt"
EXAM_MANIFEST_FILE = OUTPUT_DIR / "exam_manifest.json"

CENTERS = ["Galle", "Matara", "Hambanthota"]
NS      = "http://schemas.datacontract.org/2004/07/DTO"

# Sort order for exam types in the output chunks.
# Lower number → appears first in the UI.
TYPE_ORDER = {
    "theory":          0,
    "revision":        1,
    "model_theory":    2,
    "model_revision":  3,
}


def slug(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

def tag(name: str) -> str:
    return f"{{{NS}}}{name}"


# ─── filename / type helpers ──────────────────────────────────────────────────

def parse_filename(filename: str):
    """
    Parse an XML exam filename into (exam_type, year, number, is_model).

    Accepted stems:
      T-2026-003        → ('T', 2026, 3, False)
      R-2025-001(M)     → ('R', 2025, 1, True)

    Returns None for unrecognised names.
    """
    stem  = Path(filename).stem                         # e.g. "T-2025-003(M)"
    match = re.fullmatch(r'([A-Z])-(\d{4})-(\d+)(\(M\))?', stem)
    if not match:
        return None
    return (
        match.group(1),           # exam_type: "T" or "R"
        int(match.group(2)),      # year
        int(match.group(3)),      # number
        match.group(4) is not None,  # is_model
    )


def exam_type_info(exam_type: str, is_model: bool) -> tuple[str, str]:
    """
    Return (type_key, display_label) for use in the JS data chunk.

    Regular:  T → ("theory",         "Theory")
              R → ("revision",        "Revision")
    Model:    T → ("model_theory",    "Theory Model")
              R → ("model_revision",  "Revision Model")
    """
    if is_model:
        return {
            "T": ("model_theory",   "Theory Model"),
            "R": ("model_revision", "Revision Model"),
        }.get(exam_type, (f"model_{exam_type.lower()}", f"Model {exam_type}"))
    return {
        "T": ("theory",   "Theory"),
        "R": ("revision", "Revision"),
    }.get(exam_type, (exam_type.lower(), exam_type))


def make_exam_id(exam_type: str, year: int, number: int, is_model: bool) -> str:
    """
    Canonical exam ID used as a stable key in manual_edits.json.

    Examples:
      T-2026-003      (regular theory)
      TM-2025-003     (theory model)
      RM-2025-001     (revision model)
    """
    type_code = f"{exam_type}M" if is_model else exam_type
    return f"{type_code}-{year}-{number:03d}"


# ─── XML parsing ─────────────────────────────────────────────────────────────

def parse_student_name(raw: str) -> tuple[str, str]:
    raw   = raw.strip()
    match = re.search(r'\(([A-Za-z])\)\s*$', raw)
    if match:
        return raw[:match.start()].strip(), match.group(1).upper()
    return raw, ""


def parse_xml_file(filepath: Path) -> list[dict]:
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
            students.append({
                "name":   name,
                "school": school,
                "marks":  mark,
                "rank":   rank,
                "gender": gender,
            })
        except Exception as e:
            print(f"  [WARN] Skipping record in {filepath.name}: {e}")
    return students


# ─── rank recomputation ───────────────────────────────────────────────────────

def recompute_ranks(exam: dict) -> None:
    """
    Recompute student ranks from current marks (dense skip on ties).
    Must be called after any score edit so the JS data stays consistent
    with whatever admin.html would show.
    """
    students = sorted(exam["students"], key=lambda s: s["marks"], reverse=True)
    for i, s in enumerate(students):
        if i > 0 and s["marks"] == students[i - 1]["marks"]:
            s["rank"] = students[i - 1]["rank"]
        else:
            s["rank"] = i + 1


# ─── manual edits ─────────────────────────────────────────────────────────────

def load_manual_edits() -> dict:
    if not MANUAL_EDITS_FILE.exists():
        return {"scoreEdits": [], "studentRenames": [], "deletions": []}
    try:
        with open(MANUAL_EDITS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARN] Could not load manual_edits.json: {e}")
        return {"scoreEdits": [], "studentRenames": [], "deletions": []}


def apply_edits(data_by_city_year: dict, edits: dict) -> None:
    """
    Apply student renames, score edits, and deletions to the in-memory data.
    data_by_city_year: {(city, year): [exam, …]}
    edits: dict with keys "studentRenames", "scoreEdits", "deletions"
    """
    # 1. Renames — applied first so subsequent edits can find renamed students
    for rename in edits.get("studentRenames", []):
        old_name   = rename["oldName"]
        old_school = rename["oldSchool"]
        new_name   = rename["newName"]
        new_school = rename["newSchool"]
        for exams in data_by_city_year.values():
            for exam in exams:
                for s in exam["students"]:
                    if s["name"] == old_name and s["school"] == old_school:
                        s["name"]   = new_name
                        s["school"] = new_school

    # 2. Deletions — remove entries before score edits to avoid matching ghosts
    for deletion in edits.get("deletions", []):
        if deletion.get("type") != "scoreEntry":
            continue
        exam_id      = deletion["examId"]
        edit_city    = deletion.get("city")
        student_info = deletion["student"]
        for (city, year), exams in data_by_city_year.items():
            if edit_city and city != edit_city:
                continue
            for exam in exams:
                if exam["id"] == exam_id:
                    before = len(exam["students"])
                    exam["students"] = [
                        s for s in exam["students"]
                        if not (s["name"] == student_info["name"]
                                and s["school"] == student_info["school"])
                    ]
                    removed = before - len(exam["students"])
                    if removed:
                        print(f"  [DELETE] Removed {student_info['name']} "
                              f"from {exam_id}")
                    break

    # 3. Score edits — after renames, so we look up the post-rename name
    for score_edit in edits.get("scoreEdits", []):
        exam_id      = score_edit["examId"]
        edit_city    = score_edit.get("city")
        student_info = score_edit["student"]
        new_marks    = score_edit["newMarks"]
        found        = False
        for (city, year), exams in data_by_city_year.items():
            if edit_city and city != edit_city:
                continue
            for exam in exams:
                if exam["id"] == exam_id:
                    for s in exam["students"]:
                        if (s["name"]   == student_info["name"]
                                and s["school"] == student_info["school"]):
                            s["marks"] = new_marks
                            found = True
                            break
                    if found:
                        break
            if found:
                break
        if not found:
            city_hint = f" (city={edit_city})" if edit_city else ""
            print(f"  [NOTE] Score edit for exam {exam_id}{city_hint} / "
                  f"student {student_info} could not be applied "
                  f"(exam or student missing).")


# ─── output writers ───────────────────────────────────────────────────────────

def write_chunk(city: str, year: int, exams: list[dict]) -> None:
    chunk_file = OUTPUT_DIR / f"results_{slug(city)}_{year}.js"
    var_name   = f"window.dekmaChunk_{slug(city)}_{year}"
    exams.sort(key=lambda e: (TYPE_ORDER.get(e["type"], 9), e["number"]))
    json_str = json.dumps({"exams": exams}, ensure_ascii=False, separators=(',', ':'))
    chunk_file.write_text(f"{var_name}={json_str};\n", encoding="utf-8")
    print(f"  Wrote {chunk_file} ({len(exams)} exams)")


def build_index() -> list[dict]:
    chunks = []
    for f in OUTPUT_DIR.glob("results_*.js"):
        if f.name == "results_index.js":
            continue
        parts = f.stem.split('_')        # ["results", …city slug…, "year"]
        if len(parts) < 3:
            continue
        year      = parts[-1]
        city_slug = '_'.join(parts[1:-1])
        # Recover the original city name from CENTERS by matching slug
        original  = next((c for c in CENTERS if slug(c) == city_slug), city_slug)
        chunks.append({
            "city": original,
            "year": int(year),
            "file": f.name,
        })
    chunks.sort(key=lambda c: (slug(c["city"]), -c["year"]))
    return chunks


# ─── exam manifest (for new-exam diffing) ─────────────────────────────────────

def load_exam_manifest() -> dict:
    if not EXAM_MANIFEST_FILE.exists():
        return {}
    try:
        with open(EXAM_MANIFEST_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARN] Could not load exam_manifest.json: {e}")
        return {}


def save_exam_manifest(city_year_exams: dict) -> None:
    manifest = {}
    for (city, year), exams in city_year_exams.items():
        key = f"{slug(city)}_{year}"
        manifest[key] = [e["id"] for e in exams]
    try:
        EXAM_MANIFEST_FILE.write_text(
            json.dumps(manifest, ensure_ascii=False, separators=(',', ':')),
            encoding="utf-8",
        )
    except Exception as e:
        print(f"[WARN] Could not save exam_manifest.json: {e}")


def write_new_exams(city_year_exams: dict, old_manifest: dict) -> dict:
    """
    Diff current exams against the previous manifest and write new_exams.js.
    Format: window.dekmaNewExams = {"galle":{"2025":["TM-2025-003"]}}
    """
    new_exams: dict = {}
    for (city, year), exams in city_year_exams.items():
        city_key = slug(city)
        old_ids  = set(old_manifest.get(f"{city_key}_{year}", []))
        fresh    = [e["id"] for e in exams if e["id"] not in old_ids]
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


def bump_version() -> None:
    """Increment data/version.txt so browsers cache-bust data files on next load."""
    try:
        current  = int(VERSION_FILE.read_text(encoding="utf-8").strip()) \
                   if VERSION_FILE.exists() else 0
        next_ver = current + 1
        VERSION_FILE.write_text(str(next_ver), encoding="utf-8")
        print(f"Bumped version.txt: {current} → {next_ver}")
    except Exception as e:
        print(f"[WARN] Could not bump version.txt: {e}")


# ─── main ─────────────────────────────────────────────────────────────────────

def main():
    print(f"Reading: {ROOT_FOLDER.resolve()}")
    print(f"Writing chunks to: {OUTPUT_DIR.resolve()}\n")

    if not ROOT_FOLDER.exists():
        print("ERROR: 'DEKMA RESULTS' folder not found. "
              "Run xml_downloader_auto.py first.")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load manual edits and the previous exam manifest
    edits        = load_manual_edits()
    old_manifest = load_exam_manifest()

    rename_count = len(edits.get("studentRenames", []))
    edit_count   = len(edits.get("scoreEdits", []))
    del_count    = len(edits.get("deletions", []))
    if rename_count or edit_count or del_count:
        print(f"Loaded manual edits: {rename_count} rename(s), "
              f"{edit_count} score edit(s), {del_count} deletion(s)\n")

    # ── First pass: gather all XML files per (city, year) ────────────────────
    city_year_exams: dict = {}

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
            for xml_file in sorted(
                f for f in year_folder.iterdir() if f.suffix.lower() == ".xml"
            ):
                parsed = parse_filename(xml_file.name)
                if parsed is None:
                    continue
                exam_type, file_year, number, is_model = parsed
                if file_year != year:
                    continue

                type_key, type_label = exam_type_info(exam_type, is_model)
                students = parse_xml_file(xml_file)
                if not students:
                    continue

                exam_id = make_exam_id(exam_type, year, number, is_model)
                exams_for_year.append({
                    "id":       exam_id,
                    "label":    f"{type_label} {number}",
                    "type":     type_key,
                    "number":   number,
                    "students": students,
                })
                print(f"    {exam_id}: {len(students)} students")

            if exams_for_year:
                city_year_exams[(city, year)] = exams_for_year

    if not city_year_exams:
        print("No data found.")
        return

    # ── Apply manual edits ────────────────────────────────────────────────────
    apply_edits(city_year_exams, edits)

    # ── Recompute ranks for every exam so score edits are reflected ───────────
    total_recomputed = 0
    for exams in city_year_exams.values():
        for exam in exams:
            recompute_ranks(exam)
            total_recomputed += 1
    print(f"\nRecomputed ranks for {total_recomputed} exam(s).")

    # ── Write data chunks ─────────────────────────────────────────────────────
    for (city, year), exams in city_year_exams.items():
        print(f"\nWriting {city} {year}...")
        write_chunk(city, year, exams)

    # ── Write results_index.js ────────────────────────────────────────────────
    chunks    = build_index()
    index_js  = OUTPUT_DIR / "results_index.js"
    json_str  = json.dumps(chunks, ensure_ascii=False, separators=(',', ':'))
    index_js.write_text(f"window.dekmaChunks={json_str};\n", encoding="utf-8")
    print(f"\nWrote {index_js} ({len(chunks)} chunks)")

    # ── Diff against previous run → new_exams.js ──────────────────────────────
    write_new_exams(city_year_exams, old_manifest)
    save_exam_manifest(city_year_exams)

    # ── Summary ───────────────────────────────────────────────────────────────
    total_exams    = sum(len(yd) for yd in city_year_exams.values())
    total_students = sum(
        len(e["students"])
        for exams in city_year_exams.values()
        for e in exams
    )
    # Count by type
    type_counts: dict[str, int] = {}
    for exams in city_year_exams.values():
        for e in exams:
            type_counts[e["type"]] = type_counts.get(e["type"], 0) + 1

    print(f"\n{len(city_year_exams)} city-year folders | "
          f"{total_exams} exams | {total_students} student records")
    for tkey, count in sorted(type_counts.items(), key=lambda x: TYPE_ORDER.get(x[0], 9)):
        print(f"  {tkey}: {count}")

    bump_version()
    print("Done.")


if __name__ == "__main__":
    main()

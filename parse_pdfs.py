"""
parse_pdfs.py — Applied Mathematics Results Parser
====================================================
Scans all PDF files in the `results/` folder and generates
`data/results.js` for the website dashboard.

Usage:
  python parse_pdfs.py

Requirements:
  pip install pdfplumber
"""

import pdfplumber
import json
import os
import re
import sys
from pathlib import Path
from collections import Counter


# ──────────────────────────────────────────────
#  EXAM ID PARSER
# ──────────────────────────────────────────────

def parse_exam_id(exam_id: str) -> tuple[str, int, str]:
    """
    R-2026-007  →  ('revision', 7, 'Revision Test 7')
    T-2026-005  →  ('theory',   5, 'Theory Test 5')
    """
    parts = exam_id.split('-')
    if len(parts) >= 3:
        prefix = parts[0].upper()
        try:
            number = int(parts[2])
        except ValueError:
            number = 0

        if prefix == 'R':
            return 'revision', number, f'Revision Test {number}'
        elif prefix == 'T':
            return 'theory', number, f'Theory Test {number}'

    return 'unknown', 0, exam_id


# ──────────────────────────────────────────────
#  ROW PARSER (for table‑based extraction)
# ──────────────────────────────────────────────

def parse_row(row: list) -> dict | None:
    """Parse a single table row into a student dict."""
    if not row or len(row) < 4:
        return None

    r0 = str(row[0]).strip() if row[0] else ''
    r1 = str(row[1]).strip() if row[1] else ''
    r2 = str(row[2]).strip() if row[2] else ''
    r3 = str(row[3]).strip() if row[3] else ''

    # Skip header rows
    if r0.lower() in ('rank', '', 'none'):
        return None

    # Both rank and marks must be numeric
    if not r0.replace('.', '').isdigit():
        return None
    if not r2.replace('.', '').isdigit():
        return None

    try:
        rank  = int(float(r0))
        marks = int(float(r2))
    except ValueError:
        return None

    # Extract gender from name: "Mahith Munasinghe (B)"
    gender_match = re.search(r'\(([BbGg])\)\s*$', r1)
    gender = gender_match.group(1).upper() if gender_match else 'U'
    name   = re.sub(r'\s*\([BbGg]\)\s*$', '', r1).strip()

    # Sanity checks
    if not name or rank < 1 or marks < 0 or marks > 100:
        return None

    return {
        'rank':   rank,
        'name':   name,
        'gender': gender,
        'marks':  marks,
        'school': r3.strip(),
    }


# ──────────────────────────────────────────────
#  TEXT‑BASED ROW PARSER (fallback for untabled PDFs)
# ──────────────────────────────────────────────

def parse_text_line(line: str) -> dict | None:
    """
    Parse a single line of text into a student dict.
    Expected format: "1 Mahith Munasinghe (B) 99 Mahinda College"
    """
    line = line.strip()
    if not line:
        return None

    # Skip page numbers and header lines
    if re.match(r'^\s*Page\s+\d+\s+of\s+\d+', line, re.I):
        return None
    if re.match(r'^\s*Rank\s+Name\s+Marks\s+School', line, re.I):
        return None

    # Regex: rank, name (any characters), marks, school
    m = re.match(r'^\s*(\d+)\s+(.+?)\s+(\d+)\s+(.+?)\s*$', line)
    if not m:
        return None

    rank = int(m.group(1))
    name_part = m.group(2).strip()
    marks = int(m.group(3))
    school = m.group(4).strip()

    # Extract gender from name
    gender_match = re.search(r'\(([BbGg])\)\s*$', name_part)
    gender = gender_match.group(1).upper() if gender_match else 'U'
    name = re.sub(r'\s*\([BbGg]\)\s*$', '', name_part).strip()

    if not name or marks < 0 or marks > 100:
        return None

    return {
        'rank': rank,
        'name': name,
        'gender': gender,
        'marks': marks,
        'school': school,
    }


# ──────────────────────────────────────────────
#  PDF PARSER
# ──────────────────────────────────────────────

def parse_pdf(pdf_path: Path) -> dict | None:
    """Parse a single PDF and return exam data dict."""
    exam_id  = None
    center   = None
    marks_above = 40
    students = []

    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            for page_num, page in enumerate(pdf.pages):

                # ── Extract header from first page ──
                if page_num == 0:
                    text = page.extract_text() or ''
                    # Exam ID (allow spaces, e.g. "R- 2026- 007")
                    m = re.search(r'Exam\s*:\s*([A-Za-z]-?\s*\d+\s*-?\s*\d+)', text, re.I)
                    if m:
                        raw = m.group(1)
                        exam_id = re.sub(r'\s+', '', raw)   # remove spaces
                    else:
                        # fallback to old pattern
                        m = re.search(r'Exam\s*:\s*(\S+)', text)
                        if m:
                            exam_id = m.group(1).strip()

                    m = re.search(r'Centre\s*:\s*(.+?)(?:\n|Marks)', text)
                    if m:
                        center = m.group(1).strip()

                    m = re.search(r'Marks Above\s*:\s*(\d+)', text)
                    if m:
                        marks_above = int(m.group(1))

                # ── First, try table extraction ──
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        student = parse_row(row)
                        if student:
                            students.append(student)

                # ── If tables yielded nothing, fall back to text line parsing ──
                if not students and page_num == 0:   # we only need to try once per page
                    text = page.extract_text() or ''
                    for line in text.split('\n'):
                        student = parse_text_line(line)
                        if student:
                            students.append(student)

    except Exception as e:
        print(f"  ⚠  Error reading {pdf_path.name}: {e}")
        return None

    if not exam_id:
        print(f"  ⚠  Could not determine exam ID from {pdf_path.name}")
        return None

    if not students:
        print(f"  ⚠  No student data found in {pdf_path.name}")
        return None

    exam_type, exam_num, exam_label = parse_exam_id(exam_id)

    return {
        'id':          exam_id,
        'type':        exam_type,
        'number':      exam_num,
        'label':       exam_label,
        'center':      center or 'Galle',
        'marksAbove':  marks_above,
        'students':    students,
    }


# ──────────────────────────────────────────────
#  STATS PRINTER
# ──────────────────────────────────────────────

def print_exam_stats(exam: dict) -> None:
    students = exam['students']
    marks = [s['marks'] for s in students]
    schools = Counter(s['school'] for s in students)
    avg = sum(marks) / len(marks) if marks else 0

    print(f"  → {len(students)} students  |  avg: {avg:.1f}  |  top: {max(marks) if marks else '—'}")
    print(f"  → Top schools: " + ", ".join(f"{k}({v})" for k,v in schools.most_common(5)))


# ──────────────────────────────────────────────
#  MAIN
# ──────────────────────────────────────────────

def main():
    results_dir = Path('results')
    output_dir  = Path('data')

    # ── Check results folder ──
    if not results_dir.exists():
        results_dir.mkdir()
        print("📁  Created 'results/' folder.")
        print("    Place your PDF files there and run this script again.")
        sys.exit(0)

    pdf_files = sorted(results_dir.glob('*.pdf'))
    if not pdf_files:
        print("⚠   No PDF files found in 'results/' folder.")
        print("    Copy your performance report PDFs there and try again.")
        sys.exit(1)

    output_dir.mkdir(exist_ok=True)

    print(f"\n{'='*55}")
    print(f"  Applied Maths Results Parser  —  {len(pdf_files)} PDF(s) found")
    print(f"{'='*55}\n")

    exams = []
    for pdf_path in pdf_files:
        print(f"📄  Parsing: {pdf_path.name}")
        exam = parse_pdf(pdf_path)
        if exam:
            print_exam_stats(exam)
            exams.append(exam)
        print()

    if not exams:
        print("❌  No valid exam data could be extracted.")
        sys.exit(1)

    # Sort: revision tests first (by number), then theory tests
    exams.sort(key=lambda e: (0 if e['type']=='revision' else 1, e['number']))

    # ── Output ──
    payload = {'exams': exams}

    # results.json  (for reference / other tools)
    json_path = output_dir / 'results.json'
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    # results.js  (loaded by the website via <script> tag)
    js_path = output_dir / 'results.js'
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated by parse_pdfs.py — do not edit manually\n')
        f.write(f'window.resultsData = ')
        json.dump(payload, f, ensure_ascii=False)
        f.write(';\n')

    print(f"{'='*55}")
    print(f"✅  Done!  Parsed {len(exams)} exam(s) successfully.")
    print(f"    Output: {js_path}  ({js_path.stat().st_size // 1024} KB)")
    print(f"\n    Open index.html in your browser to view the dashboard.")
    print(f"{'='*55}\n")


if __name__ == '__main__':
    main()
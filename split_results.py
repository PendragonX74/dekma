import json, re, os, pathlib

INPUT  = "data/results.js"
OUTDIR = "data"

def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

def chunk_filename(city, year):
    return f"results_{slug(city)}_{year}.js"

src_path = pathlib.Path(INPUT)
raw = src_path.read_text(encoding='utf-8')

match = re.match(r'^\s*window\.dekmaData\s*=\s*', raw)
json_str = raw[match.end():].rstrip().rstrip(';')
data = json.loads(json_str)

outdir = pathlib.Path(OUTDIR)
manifest = []

for city, years in sorted(data.items()):
    for year, payload in sorted(years.items()):
        fname   = chunk_filename(city, year)
        varname = f"window.dekmaChunk_{slug(city)}_{year}"
        fpath   = outdir / fname
        content = f"{varname}={json.dumps(payload, ensure_ascii=False, separators=(',',':'))};\n"
        fpath.write_text(content, encoding='utf-8')
        print(f"  wrote {fname}  ({fpath.stat().st_size/1024:.1f} KB)")
        manifest.append({"city": city, "year": int(year), "file": fname})

manifest_js = "window.dekmaChunks=" + json.dumps(manifest, separators=(',',':')) + ";\n"
(outdir / "results_index.js").write_text(manifest_js, encoding='utf-8')
print(f"  wrote results_index.js ({len(manifest)} chunks)")
print("\nDone. Now: git add data/ && git commit -m 'split results' && git push")
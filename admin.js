  // ═══════════════════════════════════════════════
  //  GATE  —  SHA-256 password check
  // ═══════════════════════════════════════════════
  const PASS_HASH = '9e1779aad19fe80324cb6d070f47eede2490eb0416921255ed207d852499797c';

  let unlocked = false;
  const gateEl  = document.getElementById('gate');
  const appEl   = document.getElementById('app');
  const gateInp = document.getElementById('gate-input');

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
  }

  gateInp.addEventListener('input', async () => {
    const h = await sha256(gateInp.value);
    if (h === PASS_HASH) {
      unlocked = true;
      gateEl.style.transition = 'opacity .35s';
      gateEl.style.opacity = '0';
      setTimeout(() => {
        gateEl.style.display = 'none';
        appEl.classList.add('unlocked');
        bootAdmin();
      }, 350);
    }
  });

  window.addEventListener('DOMContentLoaded', () => setTimeout(() => gateInp.focus(), 80));

  function lockPanel() {
    unlocked = false;
    appEl.classList.remove('unlocked');
    gateEl.style.opacity = '1';
    gateEl.style.display = 'flex';
    gateInp.value = '';
    setTimeout(() => gateInp.focus(), 60);
  }

  // ═══════════════════════════════════════════════
  //  GITHUB CONFIG
  // ═══════════════════════════════════════════════
  const GH_SESSION_KEY = '__gh_cfg';

  // ── GitHub write queue ──
  let _ghQueue = Promise.resolve();
  function ghEnqueue(fn) {
    const result = _ghQueue.then(() => fn());
    _ghQueue = result.catch(err => {
      console.warn('ghQueue: operation failed, queue continues:', err?.message || err);
    });
    return result;
  }

  function ghHeaders(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };
  }

  async function ghResolveRef(api, headers, branch, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      let ref = branch;
      let refRes = await fetch(`${api}/git/ref/heads/${ref}`, { headers });
      const status = refRes.status;
      if (!refRes.ok) {
        const e = await refRes.json().catch(() => ({}));
        if (status === 401 || status === 403)
          throw new Error('Invalid or expired token. Update your PAT in ⚙ GitHub config.');
        if (status === 404) {
          const infoRes = await fetch(api, { headers });
          if (infoRes.ok) {
            const info = await infoRes.json();
            ref = info.default_branch || ref;
            refRes = await fetch(`${api}/git/ref/heads/${ref}`, { headers });
            if (!refRes.ok) {
              const e2 = await refRes.json().catch(() => ({}));
              throw new Error(`Branch '${ref}' not found: ${e2.message || refRes.status}. Check ⚙ GitHub config.`);
            }
            const saved = loadGhConfig();
            if (saved) { saved.branch = ref; localStorage.setItem(GH_SESSION_KEY, JSON.stringify(saved)); }
          } else {
            throw new Error(`Branch '${ref}' not found. Check owner/repo in ⚙ GitHub config.`);
          }
        } else {
          throw new Error(`GitHub ${status}: ${e.message || 'unknown error'}`);
        }
      }
      const sha = (await refRes.json()).object.sha;
      return { sha, branch: ref };
    }
  }

  async function ghPush(api, headers, branch, filePath, contentB64, commitMsg, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { sha: latestSha, branch: activeBranch } = await ghResolveRef(api, headers, branch);
        const comRes = await fetch(`${api}/git/commits/${latestSha}`, { headers });
        if (!comRes.ok) { const e = await comRes.json().catch(()=>({})); throw new Error('Commit: '+(e.message||comRes.status)); }
        const { tree: { sha: treeSha } } = await comRes.json();
        const blobRes = await fetch(`${api}/git/blobs`, { method:'POST', headers, body:JSON.stringify({ content: contentB64, encoding:'base64' }) });
        if (!blobRes.ok) { const e = await blobRes.json().catch(()=>({})); throw new Error('Blob: '+(e.message||blobRes.status)); }
        const { sha: blobSha } = await blobRes.json();
        const newTreeRes = await fetch(`${api}/git/trees`, { method:'POST', headers, body:JSON.stringify({ base_tree:treeSha, tree:[{ path:filePath, mode:'100644', type:'blob', sha:blobSha }] }) });
        if (!newTreeRes.ok) { const e = await newTreeRes.json().catch(()=>({})); throw new Error('Tree: '+(e.message||newTreeRes.status)); }
        const { sha: newTreeSha } = await newTreeRes.json();
        const newComRes = await fetch(`${api}/git/commits`, { method:'POST', headers, body:JSON.stringify({ message: commitMsg, tree: newTreeSha, parents:[latestSha] }) });
        if (!newComRes.ok) { const e = await newComRes.json().catch(()=>({})); throw new Error('Commit create: '+(e.message||newComRes.status)); }
        const { sha: newComSha } = await newComRes.json();
        const patchRes = await fetch(`${api}/git/refs/heads/${activeBranch}`, { method:'PATCH', headers, body:JSON.stringify({ sha:newComSha }) });
        if (!patchRes.ok) {
          const e = await patchRes.json().catch(()=>({}));
          if (patchRes.status === 422 && attempt < retries) continue;
          throw new Error('Ref: '+(e.message||patchRes.status));
        }
        return true;
      } catch(e) { throw e; }
    }
    throw new Error('Push failed after retries — not a fast-forward.');
  }

  function loadGhConfig() {
    try { return JSON.parse(localStorage.getItem(GH_SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  function openGhModal() {
    const cfg = loadGhConfig() || {};
    document.getElementById('gh-token').value  = cfg.token  || '';
    document.getElementById('gh-owner').value  = cfg.owner  || 'PendragonX74';
    document.getElementById('gh-repo').value   = cfg.repo   || 'dekma';
    document.getElementById('gh-branch').value = cfg.branch || 'main';
    document.getElementById('gh-path').value   = cfg.path   || 'data/results.js';
    document.getElementById('gh-modal').classList.add('open');
    setTimeout(() => document.getElementById('gh-token').focus(), 80);
  }

  function closeGhModal() {
    document.getElementById('gh-modal').classList.remove('open');
  }

  function saveGhConfig() {
    const token  = document.getElementById('gh-token').value.trim();
    const owner  = document.getElementById('gh-owner').value.trim();
    const repo   = document.getElementById('gh-repo').value.trim();
    const branch = document.getElementById('gh-branch').value.trim() || 'main';
    const path   = document.getElementById('gh-path').value.trim() || 'data/results.js';
    if (!token || !owner || !repo) { showToast('Token, owner, and repo are required.', 'error'); return; }
    localStorage.setItem(GH_SESSION_KEY, JSON.stringify({ token, owner, repo, branch, path }));
    closeGhModal();
    updateFileStatus(true, owner + '/' + repo);
    showToast('GitHub config saved.', 'success');
  }

  async function detectBranch() {
    const token = document.getElementById('gh-token').value.trim();
    const owner = document.getElementById('gh-owner').value.trim();
    const repo  = document.getElementById('gh-repo').value.trim();
    if (!token || !owner || !repo) { showToast('Fill in token, owner and repo first.', 'error'); return; }
    const btn = document.getElementById('detect-branch-btn');
    btn.textContent = '…'; btn.disabled = true;
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
      });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || res.status); }
      const { default_branch } = await res.json();
      document.getElementById('gh-branch').value = default_branch;
      showToast('Default branch: ' + default_branch, 'success');
    } catch(e) {
      showToast('Could not detect branch: ' + e.message, 'error');
    } finally { btn.textContent = 'Auto'; btn.disabled = false; }
  }

  document.getElementById('gh-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('gh-modal')) closeGhModal();
  });

  function updateFileStatus(ok, label) {
    const el = document.getElementById('file-status');
    if (ok) {
      el.textContent = '✓ ' + label;
      el.style.background = 'rgba(74,222,128,.1)';
      el.style.borderColor = 'rgba(74,222,128,.3)';
      el.style.color = '#4ade80';
    } else {
      el.textContent = 'NOT CONFIGURED';
      el.style.background = 'rgba(74,74,100,.2)';
      el.style.borderColor = 'var(--border)';
      el.style.color = 'var(--text3)';
    }
  }

  // ═══════════════════════════════════════════════
  //  GITHUB — write chunk
  // ═══════════════════════════════════════════════
  function chunkSlug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''); }

  async function writeChunk(city, year) {
    return ghEnqueue(async () => {
      const cfg = loadGhConfig();
      if (!cfg || !cfg.token || !cfg.owner || !cfg.repo) {
        showToast('GitHub not configured. Tap ⚙ GitHub above.', 'error');
        return false;
      }
      const { token, owner, repo, branch } = cfg;
      const filePath = `data/results_${chunkSlug(city)}_${year}.js`;
      const varName  = `window.dekmaChunk_${chunkSlug(city)}_${year}`;
      const api      = `https://api.github.com/repos/${owner}/${repo}`;
      const headers  = ghHeaders(token);
      const payload  = ADMIN_DATA[city]?.[year];
      if (!payload) { showToast(`No data for ${city} ${year}.`, 'error'); return false; }
      // Encode payload so chunk files are not plain-readable in DevTools
      const jsonStr = JSON.stringify(payload);
      const enc = new TextEncoder();
      const bytes = enc.encode(jsonStr);
      let bstr = '';
      bytes.forEach(b => bstr += String.fromCharCode(b));
      const b64 = btoa(bstr);
      const decoder = `(()=>{const b=atob('${b64}');const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return JSON.parse(new TextDecoder().decode(a));})()`;
      const raw        = `${varName}=${decoder};\n`;
      const contentB64 = btoa(unescape(encodeURIComponent(raw)));
      const ts         = new Date().toISOString().slice(0,16).replace('T',' ');
      try {
        await ghPush(api, headers, branch, filePath, contentB64, `admin: update ${filePath} [${ts}]`);
        return true;
      } catch(e) {
        showToast('GitHub error: ' + e.message, 'error');
        return false;
      }
    });
  }

  async function bumpVersion() {
    return ghEnqueue(async () => {
      const cfg = loadGhConfig();
      if (!cfg || !cfg.token || !cfg.owner || !cfg.repo) return;
      const { token, owner, repo, branch } = cfg;
      const api      = `https://api.github.com/repos/${owner}/${repo}`;
      const headers  = ghHeaders(token);
      const filePath = 'data/version.txt';
      try {
        let sha = null, current = 0;
        const getRes = await fetch(`${api}/contents/${filePath}?ref=${branch}`, { headers });
        if (getRes.ok) {
          const data = await getRes.json();
          sha = data.sha;
          current = parseInt(atob(data.content).trim(), 10) || 0;
        } else if (getRes.status !== 404) { return; }
        const next = current + 1;
        const body = { message: `admin: bump version to ${next}`, content: btoa(String(next)), branch };
        if (sha) body.sha = sha;
        await fetch(`${api}/contents/${filePath}`, { method:'PUT', headers, body:JSON.stringify(body) });
      } catch(e) { console.warn('Version bump failed (non-critical):', e.message); }
    });
  }

  async function writeChunks(pairs) {
    for (const { city, year } of pairs) {
      const ok = await writeChunk(city, year);
      if (!ok) return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════
  //  MANUAL EDITS LOG
  // ═══════════════════════════════════════════════
  async function loadManualEdits() {
    const cfg = loadGhConfig();
    if (!cfg) return { scoreEdits: [], studentRenames: [] };
    const { token, owner, repo, branch } = cfg;
    const filePath = 'data/manual_edits.json';
    const api = `https://api.github.com/repos/${owner}/${repo}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    try {
      const res = await fetch(`${api}/contents/${filePath}?ref=${branch}`, { headers });
      if (res.status === 404) return { scoreEdits: [], studentRenames: [] };
      if (!res.ok) throw new Error(`Failed to fetch manual_edits.json: ${res.status}`);
      const data = await res.json();
      return JSON.parse(atob(data.content));
    } catch(e) {
      showToast('Could not load manual edits: ' + e.message, 'error');
      return { scoreEdits: [], studentRenames: [] };
    }
  }

  async function appendManualEdit(mutateFn) {
    return ghEnqueue(async () => {
      const cfg = loadGhConfig();
      if (!cfg || !cfg.token || !cfg.owner || !cfg.repo) {
        showToast('GitHub not configured.', 'error');
        return false;
      }
      const { token, owner, repo, branch } = cfg;
      const filePath = 'data/manual_edits.json';
      const api      = `https://api.github.com/repos/${owner}/${repo}`;
      const headers  = ghHeaders(token);
      let sha = null;
      let edits = { scoreEdits: [], studentRenames: [] };
      try {
        const getRes = await fetch(`${api}/contents/${filePath}?ref=${branch}`, { headers });
        if (getRes.status === 200) {
          const data = await getRes.json();
          sha   = data.sha;
          edits = JSON.parse(atob(data.content.replace(/\n/g, '')));
        } else if (getRes.status === 401 || getRes.status === 403) {
          throw new Error('Invalid or expired token. Update your PAT in ⚙ GitHub config.');
        } else if (getRes.status !== 404) {
          throw new Error(`Failed to fetch manual_edits.json: ${getRes.status}`);
        }
      } catch(e) {
        if (!e.message.startsWith('Invalid') && !e.message.startsWith('Failed')) {
          edits = { scoreEdits: [], studentRenames: [] };
        } else {
          showToast('Failed to load manual edits: ' + e.message, 'error');
          return false;
        }
      }
      mutateFn(edits);
      const raw        = JSON.stringify(edits, null, 2);
      const contentB64 = btoa(unescape(encodeURIComponent(raw)));
      const body = {
        message: `admin: update manual_edits.json [${new Date().toISOString().slice(0,16).replace('T',' ')}]`,
        content: contentB64, branch
      };
      if (sha) body.sha = sha;
      try {
        const putRes = await fetch(`${api}/contents/${filePath}`, { method:'PUT', headers, body:JSON.stringify(body) });
        if (!putRes.ok) {
          const err = await putRes.json().catch(()=>({}));
          const s = putRes.status;
          if (s === 401 || s === 403) throw new Error('Invalid or expired token. Update your PAT in ⚙ GitHub config.');
          throw new Error(err.message || s);
        }
        return true;
      } catch(e) {
        showToast('Failed to save manual edits: ' + e.message, 'error');
        return false;
      }
    });
  }

  async function saveManualEdits(edits) {
    return appendManualEdit(existing => {
      existing.scoreEdits     = edits.scoreEdits     ?? existing.scoreEdits;
      existing.studentRenames = edits.studentRenames ?? existing.studentRenames;
    });
  }

  async function writeResultsFile() {
    return ghEnqueue(async () => {
      const cfg = loadGhConfig();
      if (!cfg || !cfg.token || !cfg.owner || !cfg.repo) {
        showToast('GitHub not configured. Tap ⚙ GitHub above.', 'error');
        return false;
      }
      const { token, owner, repo, branch, path } = cfg;
      const api     = `https://api.github.com/repos/${owner}/${repo}`;
      const headers = ghHeaders(token);
      const raw     = 'window.dekmaData = ' + JSON.stringify(ADMIN_DATA) + ';\n';
      const contentB64 = btoa(unescape(encodeURIComponent(raw)));
      const ts      = new Date().toISOString().slice(0,16).replace('T',' ');
      try {
        await ghPush(api, headers, branch, path, contentB64, `admin: update results.js [${ts}]`);
        return true;
      } catch(e) {
        showToast('GitHub error: ' + e.message, 'error');
        return false;
      }
    });
  }

  // ═══════════════════════════════════════════════
  //  BOOT
  // ═══════════════════════════════════════════════
  let ADMIN_DATA     = null;
  let currentPanel   = 'home';
  let editingStudent = null;
  let editingGender  = '';
  let _aemGender     = 'U';

  function bootAdmin() {
    ADMIN_DATA = (window.dekmaData && Object.keys(window.dekmaData).length)
      ? JSON.parse(JSON.stringify(window.dekmaData))
      : null;
    openPanel('home');
    if (ADMIN_DATA) {
      populateStuSchoolFilter();
      populateTestCities();
    }
    const cfg = loadGhConfig();
    if (cfg && cfg.owner && cfg.repo) updateFileStatus(true, cfg.owner + '/' + cfg.repo);
  }

  // ── PANEL NAV ──
  function openPanel(name) {
    currentPanel = name;
    document.getElementById('panel-home').style.display = name === 'home' ? 'block' : 'none';
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    if (name !== 'home') {
      const el = document.getElementById('panel-' + name);
      if (el) el.classList.add('active');
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ── DATA HELPERS ──
  function forEachStudent(cb) {
    if (!ADMIN_DATA) return;
    for (const city of Object.keys(ADMIN_DATA))
      for (const year of Object.keys(ADMIN_DATA[city]))
        for (const exam of (ADMIN_DATA[city][year].exams || []))
          for (const s of exam.students)
            cb(s, exam, city, year);
  }

  function getUniqueStudents() {
    const map = {};
    forEachStudent(s => {
      const k = s.name + '\x00' + s.school;
      if (!map[k]) map[k] = { name: s.name, school: s.school, gender: s.gender };
    });
    return Object.values(map).sort((a,b) => a.name.localeCompare(b.name));
  }

  function getSchools() {
    const set = new Set();
    forEachStudent(s => set.add(s.school));
    return [...set].sort();
  }

  function recomputeRanks(exam) {
    const sorted = [...exam.students].sort((a,b) => b.marks - a.marks);
    sorted.forEach((s, i) => {
      s.rank = i > 0 && s.marks === sorted[i-1].marks ? sorted[i-1].rank : i + 1;
    });
  }

  // ── EDIT STUDENT ──
  function populateStuSchoolFilter() {
    const el = document.getElementById('stu-search-school');
    while (el.options.length > 1) el.remove(1);
    getSchools().forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s; el.appendChild(o);
    });
  }

  function searchStudentAdmin() {
    const q   = (document.getElementById('stu-search-q').value || '').toLowerCase().trim();
    const sch = document.getElementById('stu-search-school').value;
    document.getElementById('stu-edit-form').style.display = 'none';
    const empty = document.getElementById('stu-empty');
    const list  = document.getElementById('stu-result-list');
    list.style.display = 'flex';

    if (!q && !sch) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    let students = getUniqueStudents();
    if (q)   students = students.filter(s => s.name.toLowerCase().includes(q));
    if (sch) students = students.filter(s => s.school === sch);

    empty.style.display = 'none';
    if (!students.length) {
      list.innerHTML = `<div style="font-size:11px;color:var(--text3);padding:16px 0">No students found.</div>`;
      return;
    }
    list.innerHTML = students.slice(0, 60).map((s, i) => `
      <div class="student-result-item" onclick="openStudentEdit(${i})">
        <div>
          <div class="sri-name">${esc(s.name)}</div>
          <div class="sri-meta">${esc(s.school)} · ${s.gender === 'B' ? '♂ Boy' : s.gender === 'G' ? '♀ Girl' : '—'}</div>
        </div>
        <div class="sri-arrow">›</div>
      </div>`).join('');
    list._students = students.slice(0, 60);
  }

  function openStudentEdit(idx) {
    const list = document.getElementById('stu-result-list');
    const s = list._students[idx];
    if (!s) return;
    editingStudent = { name: s.name, school: s.school, gender: s.gender };
    editingGender  = s.gender;
    const ini = s.name.split(' ').map(w => w[0]||'').join('').slice(0,2).toUpperCase();
    document.getElementById('sef-avatar').textContent         = ini;
    document.getElementById('sef-display-name').textContent   = s.name;
    document.getElementById('sef-display-school').textContent = s.school;
    document.getElementById('sef-name').value   = s.name;
    document.getElementById('sef-school').value = s.school;
    setGender(s.gender);
    document.getElementById('stu-edit-form').style.display   = 'block';
    document.getElementById('stu-result-list').style.display = 'none';
    document.getElementById('stu-empty').style.display       = 'none';
  }

  function setGender(g, prefix) {
    const norm = (g === 'B' || g === 'G') ? g : 'U';
    if (!prefix) {
      editingGender = norm;
    } else if (prefix === 'aem-') {
      _aemGender = norm;
    }
    const p = prefix || '';
    const gb = document.getElementById(p + 'gb-b');
    const gg = document.getElementById(p + 'gb-g');
    const gu = document.getElementById(p + 'gb-u');
    if (gb) gb.className = 'gender-btn' + (norm === 'B' ? ' active-b' : '');
    if (gg) gg.className = 'gender-btn' + (norm === 'G' ? ' active-g' : '');
    if (gu) gu.className = 'gender-btn' + (norm === 'U' ? ' active-u' : '');
    return norm;
  }

  function cancelStudentEdit() {
    editingStudent = null;
    document.getElementById('stu-edit-form').style.display   = 'none';
    document.getElementById('stu-result-list').style.display = 'flex';
  }

  async function saveStudentEdit() {
    if (!editingStudent || !ADMIN_DATA) return showToast('Nothing to save.', 'error');
    const newName   = document.getElementById('sef-name').value.trim();
    const newSchool = document.getElementById('sef-school').value.trim();
    const newGender = editingGender || 'U';
    if (!newName || !newSchool) return showToast('Name and school cannot be empty.', 'error');

    const origName   = editingStudent.name;
    const origSchool = editingStudent.school;

    const affectedMap = new Map();
    let changed = 0;
    forEachStudent((s, exam, city, year) => {
      if (s.name === origName && s.school === origSchool) {
        s.name   = newName;
        s.school = newSchool;
        s.gender = newGender;
        changed++;
        affectedMap.set(city + '|' + year, { city, year });
      }
    });

    if (!changed) return showToast('No matching records found.', 'error');

    const pairs = [...affectedMap.values()];
    showToast(`Saving ${pairs.length} chunk${pairs.length > 1 ? 's' : ''}…`, '');
    const ok = await writeChunks(pairs);
    if (ok) {
      await appendManualEdit(edits => {
        edits.studentRenames.push({
          oldName: origName, oldSchool: origSchool,
          newName, newSchool, newGender, timestamp: Date.now()
        });
      });
      bumpVersion();
      showToast(`Saved — ${changed} record${changed > 1 ? 's' : ''} updated on GitHub.`, 'success');
      editingStudent = { name: newName, school: newSchool, gender: newGender };
      document.getElementById('sef-display-name').textContent   = newName;
      document.getElementById('sef-display-school').textContent = newSchool;
      document.getElementById('sef-avatar').textContent = newName.split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
    }
  }

  // ── EDIT TEST SCORES ──
  function populateTestCities() {
    const el = document.getElementById('test-sel-city');
    while (el.options.length > 1) el.remove(1);
    if (!ADMIN_DATA) return;
    Object.keys(ADMIN_DATA).sort().forEach(c => {
      const o = document.createElement('option');
      o.value = c; o.textContent = c; el.appendChild(o);
    });
  }

  function populateTestYears() {
    const city = document.getElementById('test-sel-city').value;
    const yr   = document.getElementById('test-sel-year');
    const ex   = document.getElementById('test-sel-exam');
    yr.innerHTML = '<option value="">— Year —</option>';
    ex.innerHTML = '<option value="">— Test —</option>';
    yr.disabled = true; ex.disabled = true;
    if (!city || !ADMIN_DATA[city]) return;
    Object.keys(ADMIN_DATA[city]).sort((a,b) => b - a).forEach(y => {
      const o = document.createElement('option');
      o.value = y; o.textContent = y; yr.appendChild(o);
    });
    yr.disabled = false;
    resetTestSheet();
  }

  function populateTestExams() {
    const city = document.getElementById('test-sel-city').value;
    const year = document.getElementById('test-sel-year').value;
    const ex   = document.getElementById('test-sel-exam');
    ex.innerHTML = '<option value="">— Test —</option>';
    ex.disabled = true;
    if (!city || !year || !ADMIN_DATA[city]?.[year]) return;
    (ADMIN_DATA[city][year].exams || []).forEach(e => {
      const o = document.createElement('option');
      o.value = e.id; o.textContent = e.label; ex.appendChild(o);
    });
    ex.disabled = false;
    resetTestSheet();
  }

  function resetTestSheet() {
    document.getElementById('test-sheet-area').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">▦</div>
        Select a city, year, and test to load the score sheet.
      </div>`;
  }

  let _currentExam = null;

  function loadTestSheet() {
    const city   = document.getElementById('test-sel-city').value;
    const year   = document.getElementById('test-sel-year').value;
    const examId = document.getElementById('test-sel-exam').value;
    if (!city || !year || !examId || !ADMIN_DATA) return resetTestSheet();
    const exam = (ADMIN_DATA[city][year].exams || []).find(e => e.id === examId);
    if (!exam) return resetTestSheet();
    _currentExam = exam;
    renderTestSheet(exam);
  }

  function renderTestSheet(exam) {
    const area = document.getElementById('test-sheet-area');
    area.innerHTML = `
      <div class="sheet-card">
        <div class="sheet-header">
          <div>
            <div class="sheet-title">${esc(exam.label)}</div>
            <div class="sheet-meta">${exam.type} · ${exam.students.length} students</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input class="sheet-search" id="test-search-inp" placeholder="Search student…"
              oninput="filterTestSheet(this.value)" autocomplete="off">
            <button class="btn btn-success" style="padding:8px 14px;font-size:10px" onclick="openAddEntryModal()">+ Add Entry</button>
          </div>
        </div>
        <!-- Desktop table -->
        <div class="sheet-table-wrap">
          <table class="score-tbl">
            <thead><tr>
              <th>Rank</th><th>Name</th><th>School</th><th>G</th><th>Score</th>
            </tr></thead>
            <tbody id="test-tbody"></tbody>
          </table>
        </div>
        <!-- Mobile cards -->
        <div class="score-cards" id="test-cards"></div>
      </div>`;
    filterTestSheet('');
    setTimeout(() => {
      const s = document.getElementById('test-search-inp');
      if (s && window.innerWidth > 600) s.focus();
    }, 50);
  }

  function filterTestSheet(q) {
    const tbody = document.getElementById('test-tbody');
    const cards = document.getElementById('test-cards');
    if ((!tbody && !cards) || !_currentExam) return;

    const allSorted = [..._currentExam.students].sort((a, b) => b.marks - a.marks);
    allSorted.forEach((s, i) => {
      s._displayRank = i > 0 && s.marks === allSorted[i-1].marks
        ? allSorted[i-1]._displayRank : i + 1;
    });

    let students = allSorted;
    if (q) students = students.filter(s => s.name.toLowerCase().includes(q.toLowerCase().trim()));

    const gBadge = s => s.gender === 'B'
      ? `<span style="background:rgba(96,165,250,.12);color:#60a5fa;padding:2px 7px;border-radius:3px;font-size:9px">B</span>`
      : s.gender === 'G'
      ? `<span style="background:rgba(244,114,182,.12);color:#f472b6;padding:2px 7px;border-radius:3px;font-size:9px">G</span>`
      : `<span style="color:var(--text3)">—</span>`;

    // Desktop table rows
    if (tbody) {
      tbody.innerHTML = students.map(s => `<tr>
        <td class="tbl-rank">#${s._displayRank ?? s.rank ?? '—'}</td>
        <td style="font-weight:600">${esc(s.name)}</td>
        <td class="tbl-school">${esc(s.school)}</td>
        <td class="tbl-gender">${gBadge(s)}</td>
        <td>
          <div class="edit-cell">
            <input class="score-inp" type="number" min="0" max="100"
              value="${s.marks}" data-orig="${s.marks}"
              data-name="${esc(s.name)}" data-school="${esc(s.school)}"
              oninput="markScoreDirty(this)">
            <button class="save-btn" disabled onclick="saveScore(this)">SAVE</button>
            <span class="saved-tick">✓</span>
            <button class="del-score-btn" title="Remove from test"
              onclick="promptDeleteScore('${esc(s.name)}','${esc(s.school)}')">✕</button>
          </div>
        </td>
      </tr>`).join('');
    }

    // Mobile score cards
    if (cards) {
      cards.innerHTML = students.map(s => `
        <div class="score-card">
          <div class="sc-left">
            <div class="sc-rank">#${s._displayRank ?? s.rank ?? '—'} · ${esc(s.school)}</div>
            <div class="sc-name">${esc(s.name)}</div>
          </div>
          <div class="sc-right">
            <input class="score-inp" type="number" min="0" max="100"
              value="${s.marks}" data-orig="${s.marks}"
              data-name="${esc(s.name)}" data-school="${esc(s.school)}"
              oninput="markScoreDirty(this)" style="width:64px;font-size:18px;padding:7px 8px">
            <button class="save-btn" disabled onclick="saveScore(this)">✓</button>
            <button class="del-score-btn" title="Remove from test"
              onclick="promptDeleteScore('${esc(s.name)}','${esc(s.school)}')">✕</button>
          </div>
        </div>`).join('');
    }
  }

  function markScoreDirty(inp) {
    const newVal = parseInt(inp.value, 10);
    const orig   = parseInt(inp.dataset.orig, 10);
    const cell   = inp.closest('.edit-cell') || inp.closest('.sc-right');
    const btn    = cell.querySelector('.save-btn');
    btn.disabled = isNaN(newVal) || newVal === orig || newVal < 0 || newVal > 100;
  }

  async function saveScore(btn) {
    const cell   = btn.closest('.edit-cell') || btn.closest('.sc-right');
    const inp    = cell.querySelector('.score-inp, input[type="number"]');
    const tick   = cell.querySelector('.saved-tick');
    const newVal = parseInt(inp.value, 10);
    if (isNaN(newVal) || newVal < 0 || newVal > 100) return showToast('Invalid score.', 'error');

    const origName   = inp.dataset.name;
    const origSchool = inp.dataset.school;

    btn.disabled = true;
    const origTxt = btn.textContent;
    btn.textContent = '…';
    btn.style.color = 'var(--amber)';

    const student = _currentExam.students.find(s => s.name === origName && s.school === origSchool);
    if (!student) {
      btn.textContent = origTxt; btn.style.color = ''; btn.disabled = false;
      return showToast('Student not found in exam data.', 'error');
    }

    const prevMarks = student.marks;
    student.marks = newVal;
    recomputeRanks(_currentExam);

    const city = document.getElementById('test-sel-city').value;
    const year = document.getElementById('test-sel-year').value;
    const ok   = await writeChunk(city, year);

    if (!ok) {
      student.marks = prevMarks;
      recomputeRanks(_currentExam);
      btn.textContent = origTxt; btn.style.color = ''; btn.disabled = false;
      return;
    }

    await appendManualEdit(edits => {
      edits.scoreEdits.push({
        examId: _currentExam.id, city,
        student: { name: origName, school: origSchool },
        newMarks: newVal, timestamp: Date.now()
      });
    });
    bumpVersion();

    inp.dataset.orig = newVal;
    btn.textContent  = origTxt;
    btn.style.color  = '';
    if (tick) { tick.classList.add('visible'); setTimeout(() => tick.classList.remove('visible'), 2400); }

    // Re-render the full table so row order and all rank cells reflect the new scores
    filterTestSheet(document.getElementById('test-search-inp')?.value || '');

    showToast(`${origName}: ${prevMarks} → ${newVal}, saved to GitHub.`, 'success');
  }

  // ═══════════════════════════════════════════════
  //  DANGER MODAL — delete score / wipe profile
  // ═══════════════════════════════════════════════
  let _dangerAction = null;
  let _dangerPhrase = '';

  function openDangerModal({ skull, heading, sub, what, confirmPhrase, btnLabel, action }) {
    _dangerAction  = action;
    _dangerPhrase  = confirmPhrase;
    document.getElementById('danger-skull').textContent        = skull || '☠';
    document.getElementById('danger-heading').textContent      = heading;
    document.getElementById('danger-sub').innerHTML            = sub;
    document.getElementById('danger-what').innerHTML           = what;
    document.getElementById('danger-input-label').textContent  = 'Type  "' + confirmPhrase + '"  to unlock';
    document.getElementById('danger-confirm-input').value      = '';
    document.getElementById('danger-confirm-input').placeholder = confirmPhrase;
    document.getElementById('danger-nuke-btn').textContent     = btnLabel || 'CONFIRM DELETE';
    document.getElementById('danger-nuke-btn').disabled        = true;
    document.getElementById('danger-modal').classList.add('open');
    setTimeout(() => document.getElementById('danger-confirm-input').focus(), 80);
  }

  function closeDangerModal() {
    document.getElementById('danger-modal').classList.remove('open');
    _dangerAction = null;
    _dangerPhrase = '';
  }

  function checkDangerConfirm() {
    const val = document.getElementById('danger-confirm-input').value;
    document.getElementById('danger-nuke-btn').disabled = (val !== _dangerPhrase);
  }

  async function executeDangerAction() {
    if (!_dangerAction) return;
    const action = _dangerAction;   // snapshot before closeDangerModal nulls _dangerAction
    closeDangerModal();
    if (action.type === 'score')   await _execDeleteScore(action);
    else if (action.type === 'profile') await _execWipeProfile(action);
  }

  document.getElementById('danger-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('danger-modal')) closeDangerModal();
  });

  // ── DELETE A SINGLE SCORE ENTRY ──
  function promptDeleteScore(name, school) {
    if (!_currentExam) return;
    const city   = document.getElementById('test-sel-city').value;
    const year   = document.getElementById('test-sel-year').value;
    const phrase = name.split(' ')[0].toUpperCase();
    openDangerModal({
      skull: '🗑',
      heading: 'DELETE TEST ENTRY',
      sub: '<strong>' + esc(name) + '</strong> will be removed from this test.<br>'
         + 'It will appear as if they never sat the exam.<br>'
         + '<code>This cannot be undone.</code>',
      what: '<b>Exam:</b> ' + esc(_currentExam.label) + '<br>'
          + '<b>Student:</b> ' + esc(name) + '<br>'
          + '<b>School:</b> ' + esc(school) + '<br>'
          + '<b>City / Year:</b> ' + esc(city) + ' · ' + esc(year),
      confirmPhrase: phrase,
      btnLabel: '☠ DELETE ENTRY',
      action: { type: 'score', name, school, city, year }
    });
  }

  async function _execDeleteScore({ name, school, city, year }) {
    if (!_currentExam || !ADMIN_DATA) return;
    const before = _currentExam.students.length;
    _currentExam.students = _currentExam.students.filter(
      s => !(s.name === name && s.school === school)
    );
    const removed = before - _currentExam.students.length;
    if (!removed) return showToast('Student not found in exam.', 'error');
    recomputeRanks(_currentExam);

    const ok = await writeChunk(city, year);
    if (!ok) return showToast('GitHub write failed — refresh to resync.', 'error');

    await appendManualEdit(edits => {
      if (!edits.deletions) edits.deletions = [];
      edits.deletions.push({
        type: 'scoreEntry', examId: _currentExam.id, city, year,
        student: { name, school }, timestamp: Date.now()
      });
    });
    bumpVersion();
    renderTestSheet(_currentExam);
    showToast(name + ' removed from ' + _currentExam.label + '. Saved to GitHub.', 'success');
  }

  // ── WIPE ENTIRE PROFILE ──
  function promptWipeProfile() {
    if (!editingStudent) return;
    const { name, school } = editingStudent;
    const phrase = name.toUpperCase();
    let count = 0;
    const affectedExams = [];
    forEachStudent((s, exam, city, year) => {
      if (s.name === name && s.school === school) {
        count++;
        affectedExams.push(city + ' ' + year + ' — ' + exam.label);
      }
    });
    const examList = affectedExams.slice(0, 6).map(e => '• ' + esc(e)).join('<br>')
      + (affectedExams.length > 6 ? '<br><i>…and ' + (affectedExams.length - 6) + ' more</i>' : '');
    openDangerModal({
      skull: '💀',
      heading: 'WIPE PROFILE',
      sub: '<strong>' + esc(name) + '</strong> from <strong>' + esc(school) + '</strong> will be<br>'
         + '<span style="color:var(--red);font-size:11px;letter-spacing:1px">ERASED FROM ALL RECORDS.</span><br>'
         + '<code>Permanent. Cannot be undone.</code>',
      what: '<b>Student:</b> ' + esc(name) + '<br>'
          + '<b>School:</b> ' + esc(school) + '<br>'
          + '<b>Entries to be wiped:</b> ' + count + '<br><br>'
          + '<b>Affected exams:</b><br>' + examList,
      confirmPhrase: phrase,
      btnLabel: '☠ WIPE FROM EXISTENCE',
      action: { type: 'profile', name, school }
    });
  }

  async function _execWipeProfile({ name, school }) {
    if (!ADMIN_DATA) return;
    const affectedMap = new Map();
    let removed = 0;
    for (const city of Object.keys(ADMIN_DATA)) {
      for (const year of Object.keys(ADMIN_DATA[city])) {
        const exams = ADMIN_DATA[city][year].exams || [];
        for (const exam of exams) {
          const before = exam.students.length;
          exam.students = exam.students.filter(s => !(s.name === name && s.school === school));
          const delta = before - exam.students.length;
          if (delta > 0) {
            removed += delta;
            recomputeRanks(exam);
            affectedMap.set(city + '|' + year, { city, year });
          }
        }
      }
    }
    if (!removed) return showToast('No records found to delete.', 'error');

    const pairs = [...affectedMap.values()];
    showToast('Wiping ' + removed + ' entr' + (removed > 1 ? 'ies' : 'y') + ' across ' + pairs.length + ' chunk' + (pairs.length > 1 ? 's' : '') + '…', '');
    const ok = await writeChunks(pairs);
    if (!ok) return showToast('GitHub write failed — refresh to resync.', 'error');

    await appendManualEdit(edits => {
      if (!edits.deletions) edits.deletions = [];
      edits.deletions.push({
        type: 'profileWipe', student: { name, school },
        entriesRemoved: removed, chunksAffected: pairs, timestamp: Date.now()
      });
    });
    bumpVersion();

    editingStudent = null;
    document.getElementById('stu-edit-form').style.display = 'none';
    document.getElementById('stu-empty').style.display     = 'block';
    populateStuSchoolFilter();
    document.getElementById('stu-result-list').innerHTML   = '';

    if (_currentExam) {
      const city = document.getElementById('test-sel-city').value;
      const year = document.getElementById('test-sel-year').value;
      if (city && year && affectedMap.has(city + '|' + year)) renderTestSheet(_currentExam);
    }
    showToast(name + ' wiped — ' + removed + ' entr' + (removed > 1 ? 'ies' : 'y') + ' deleted from GitHub.', 'success');
  }

  // ── TOAST ──
  let _toastTimer;
  function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show' + (type ? ' ' + type : '');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.className = '', 3800);
  }

  // ── UTILS ──
  function esc(s) {
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  // ═══════════════════════════════════════════════
  //  ADD ENTRY TO EXAM
  // ═══════════════════════════════════════════════
  function openAddEntryModal() {
    if (!_currentExam) return;
    document.getElementById('aem-exam-label').textContent = _currentExam.label;
    document.getElementById('aem-name').value   = '';
    document.getElementById('aem-school').value = '';
    document.getElementById('aem-marks').value  = '';
    _aemGender = 'U';
    setGender('U', 'aem-');
    document.getElementById('aem-suggest-list').style.display = 'none';
    document.getElementById('aem-suggest-list').innerHTML = '';
    document.getElementById('add-entry-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('aem-name').focus(), 80);
  }

  function closeAddEntryModal() {
    document.getElementById('add-entry-modal').style.display = 'none';
  }

  document.getElementById('add-entry-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('add-entry-modal')) closeAddEntryModal();
  });

  function aemNameInput() {
    const q = (document.getElementById('aem-name').value || '').toLowerCase().trim();
    const listEl = document.getElementById('aem-suggest-list');
    // restore gender group if user is typing a new name
    document.getElementById('aem-gender-group').style.display = 'block';
    if (!q) { listEl.style.display = 'none'; listEl.innerHTML = ''; return; }
    const students = getUniqueStudents().filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
    if (!students.length) { listEl.style.display = 'none'; return; }
    listEl.innerHTML = students.map((s, i) => `
      <div class="suggest-item" onclick="aemPickStudent(${i})">
        ${esc(s.name)}
        <div class="si-school">${esc(s.school)}</div>
      </div>`).join('');
    listEl._data = students;
    listEl.style.display = 'flex';
    listEl.style.flexDirection = 'column';
  }

  function aemPickStudent(i) {
    const s = document.getElementById('aem-suggest-list')._data[i];
    if (!s) return;
    document.getElementById('aem-name').value   = s.name;
    document.getElementById('aem-school').value = s.school;
    document.getElementById('aem-suggest-list').style.display = 'none';
    _aemGender = s.gender || 'U';
    setGender(_aemGender, 'aem-');
    // hide gender row for existing students — gender is already set
    document.getElementById('aem-gender-group').style.display = 'none';
    document.getElementById('aem-marks').focus();
  }

  async function saveAddEntry() {
    if (!_currentExam || !ADMIN_DATA) return showToast('No exam loaded.', 'error');
    const name   = document.getElementById('aem-name').value.trim();
    const school = document.getElementById('aem-school').value.trim();
    const marks  = parseInt(document.getElementById('aem-marks').value, 10);
    if (!name)             return showToast('Name is required.', 'error');
    if (!school)           return showToast('School is required.', 'error');
    if (isNaN(marks) || marks < 0 || marks > 100) return showToast('Marks must be 0–100.', 'error');

    // Check duplicate in this exam
    const exists = _currentExam.students.find(s => s.name === name && s.school === school);
    if (exists) return showToast(`${name} already has an entry in this exam.`, 'error');

    const gender = _aemGender || 'U';

    // If student exists somewhere, inherit their gender unless we override it
    const known = getUniqueStudents().find(s => s.name === name && s.school === school);
    const finalGender = known ? (known.gender || 'U') : gender;

    const newEntry = { name, school, marks, gender: finalGender, rank: 0 };
    _currentExam.students.push(newEntry);
    recomputeRanks(_currentExam);

    const city = document.getElementById('test-sel-city').value;
    const year = document.getElementById('test-sel-year').value;
    const ok   = await writeChunk(city, year);
    if (!ok) {
      // rollback
      _currentExam.students = _currentExam.students.filter(s => !(s.name === name && s.school === school && s.marks === marks));
      recomputeRanks(_currentExam);
      return;
    }

    await appendManualEdit(edits => {
      if (!edits.addedEntries) edits.addedEntries = [];
      edits.addedEntries.push({
        examId: _currentExam.id, city, year,
        student: { name, school, marks, gender: finalGender },
        isNewStudent: !known,
        timestamp: Date.now()
      });
    });
    bumpVersion();
    closeAddEntryModal();
    renderTestSheet(_currentExam);
    showToast(`${name} added to ${_currentExam.label}.`, 'success');
  }

  // ═══════════════════════════════════════════════
  //  MERGE PANEL
  // ═══════════════════════════════════════════════
  function switchMergeTab(tab) {
    document.getElementById('mtab-ai').className     = 'merge-tab' + (tab === 'ai' ? ' active' : '');
    document.getElementById('mtab-manual').className = 'merge-tab' + (tab === 'manual' ? ' active' : '');
    document.getElementById('merge-ai-tab').style.display     = tab === 'ai'     ? 'block' : 'none';
    document.getElementById('merge-manual-tab').style.display = tab === 'manual' ? 'block' : 'none';
  }

  // ── AI SUGGESTIONS (client-side fuzzy match) ──

  function jaroWinkler(s1, s2) {
    s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
    if (s1 === s2) return 1;
    const len1 = s1.length, len2 = s2.length;
    const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);
    const s1m = new Array(len1).fill(false);
    const s2m = new Array(len2).fill(false);
    let matches = 0, transpositions = 0;
    for (let i = 0; i < len1; i++) {
      const lo = Math.max(0, i - matchDist);
      const hi = Math.min(i + matchDist + 1, len2);
      for (let j = lo; j < hi; j++) {
        if (s2m[j] || s1[i] !== s2[j]) continue;
        s1m[i] = s2m[j] = true; matches++; break;
      }
    }
    if (!matches) return 0;
    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!s1m[i]) continue;
      while (!s2m[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
    const jaro = (matches/len1 + matches/len2 + (matches - transpositions/2)/matches) / 3;
    let prefix = 0;
    for (let i = 0; i < Math.min(4, len1, len2); i++) {
      if (s1[i] === s2[i]) prefix++; else break;
    }
    return jaro + prefix * 0.1 * (1 - jaro);
  }

  // Strip school suffixes commonly appended inside student name strings
  // e.g. "W.D.Pawani Shehara(Sumangala Balika-Panadura)" → "W.D.Pawani Shehara"
  function stripSchoolSuffix(name) {
    return name.replace(/\s*[\(\[（].*?[\)\]）]$/, '').replace(/\s*-\s*\S+\s*$/, '').trim();
  }

  async function runAiMergeSuggestions() {
    const btn = document.getElementById('ai-scan-btn');
    const results = document.getElementById('ai-merge-results');
    btn.disabled = true;
    btn.textContent = '✦ Scanning…';
    results.innerHTML = `<div style="font-size:11px;color:var(--text3)">Analysing names…</div>`;

    const students = getUniqueStudents();
    if (!students.length) {
      results.innerHTML = `<div style="font-size:11px;color:var(--text3)">No student data loaded.</div>`;
      btn.disabled = false; btn.textContent = '✦ Scan for Duplicates'; return;
    }

    // Small yield so the "Analysing…" text actually renders before the loop
    await new Promise(r => setTimeout(r, 30));

    const pairs = [];
    const THRESHOLD = 0.88;

    for (let i = 0; i < students.length; i++) {
      for (let j = i + 1; j < students.length; j++) {
        const a = students[i], b = students[j];
        if (a.name === b.name && a.school === b.school) continue;

        const nameA = a.name, nameB = b.name;
        const coreA = stripSchoolSuffix(nameA);
        const coreB = stripSchoolSuffix(nameB);

        // Direct similarity on raw names
        const simRaw  = jaroWinkler(nameA, nameB);
        // Similarity on stripped cores
        const simCore = jaroWinkler(coreA, coreB);
        // One is a substring prefix of the other (after stripping)
        const prefixMatch = coreA.startsWith(coreB) || coreB.startsWith(coreA);
        // One name contains the other's core
        const containsMatch = nameA.toLowerCase().includes(coreB.toLowerCase()) ||
                              nameB.toLowerCase().includes(coreA.toLowerCase());

        let reason = null;
        if (simRaw >= THRESHOLD) {
          reason = `Names are ${Math.round(simRaw * 100)}% similar`;
        } else if (simCore >= THRESHOLD) {
          reason = `Core names match ${Math.round(simCore * 100)}% — one may have a school suffix embedded`;
        } else if (prefixMatch && coreA.length > 6 && coreB.length > 6) {
          reason = `One name appears to be a shortened form of the other`;
        } else if (containsMatch && (coreA.length > 8 || coreB.length > 8)) {
          reason = `One name contains the other's core name`;
        }

        if (reason) pairs.push({ a, b, reason });
      }
    }

    btn.disabled = false; btn.textContent = '✦ Scan for Duplicates';

    if (!pairs.length) {
      results.innerHTML = `<div style="font-size:11px;color:var(--green);padding:12px 0">✓ No suspicious duplicates found.</div>`;
      return;
    }

    results.innerHTML = `<div style="font-size:8px;letter-spacing:2px;color:var(--text3);text-transform:uppercase;margin-bottom:12px">${pairs.length} suggestion${pairs.length > 1 ? 's' : ''}</div>`
      + pairs.map((p, i) => `
        <div class="merge-suggestion">
          <div class="ms-names">
            <div class="ms-pair">
              <span class="ms-name">${esc(p.a.name)}</span>
              <span class="ms-sep">⇌</span>
              <span class="ms-name">${esc(p.b.name)}</span>
            </div>
            <div class="ms-reason">${esc(p.reason)}</div>
          </div>
          <div class="ms-actions">
            <button class="btn btn-success" style="padding:7px 14px;font-size:10px"
              onclick="openAiMergeConfirm(${i})">Merge</button>
            <button class="btn btn-ghost" style="padding:7px 10px;font-size:10px"
              onclick="dismissSuggestion(this)">✕</button>
          </div>
        </div>`).join('');
    results._pairs = pairs;
  }

  function dismissSuggestion(btn) { btn.closest('.merge-suggestion').remove(); }

  function openAiMergeConfirm(i) {
    const pairs = document.getElementById('ai-merge-results')._pairs;
    if (!pairs) return;
    const { a, b } = pairs[i];
    openMergeConfirm(a, b);
  }

  // ── MANUAL MERGE ──
  let _mmSelected = { a: null, b: null };

  function mmSearch(side) {
    const q = (document.getElementById(`mm-${side}-name`).value || '').toLowerCase().trim();
    const listEl = document.getElementById(`mm-${side}-list`);
    if (!q) { listEl.style.display = 'none'; listEl.innerHTML = ''; return; }
    const students = getUniqueStudents().filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
    if (!students.length) { listEl.style.display = 'none'; return; }
    listEl.innerHTML = students.map((s, i) => `
      <div class="suggest-item" onclick="mmPick('${side}', ${i})">
        ${esc(s.name)}
        <div class="si-school">${esc(s.school)}</div>
      </div>`).join('');
    listEl._data = students;
    listEl.style.display = 'flex';
    listEl.style.flexDirection = 'column';
  }

  function mmPick(side, i) {
    const s = document.getElementById(`mm-${side}-list`)._data[i];
    if (!s) return;
    document.getElementById(`mm-${side}-name`).value = s.name;
    document.getElementById(`mm-${side}-list`).style.display = 'none';
    _mmSelected[side] = s;
    renderMmCard(side, s);
    document.getElementById('mm-merge-btn').disabled = !(_mmSelected.a && _mmSelected.b);
  }

  function getExamCount(name, school) {
    let n = 0;
    forEachStudent(s => { if (s.name === name && s.school === school) n++; });
    return n;
  }

  function renderMmCard(side, s) {
    const el = document.getElementById(`mm-${side}-card`);
    const count = getExamCount(s.name, s.school);
    el.innerHTML = `<div class="mini-profile">
      <div class="mp-name">${esc(s.name)}</div>
      <div class="mp-school">${esc(s.school)}</div>
      <div class="mp-count">${count} exam entr${count !== 1 ? 'ies' : 'y'}</div>
    </div>`;
    el.style.display = 'block';
  }

  function openManualMergeConfirm() {
    if (!_mmSelected.a || !_mmSelected.b) return;
    if (_mmSelected.a.name === _mmSelected.b.name && _mmSelected.a.school === _mmSelected.b.school)
      return showToast('These are the same profile.', 'error');
    openMergeConfirm(_mmSelected.a, _mmSelected.b);
  }

  // ── MERGE CONFIRM MODAL ──
  let _mergeA = null, _mergeB = null, _mergeChosenName = null, _mergeChosenSchool = null;

  function openMergeConfirm(a, b) {
    _mergeA = a; _mergeB = b; _mergeChosenName = a.name; _mergeChosenSchool = a.school;
    document.getElementById('mcm-custom-name').value = '';

    // Profile cards
    const countA = getExamCount(a.name, a.school);
    const countB = getExamCount(b.name, b.school);
    document.getElementById('mcm-cards').innerHTML = `
      <div class="mini-profile" style="border-color:rgba(45,212,191,.3)">
        <div style="font-size:8px;letter-spacing:2px;color:var(--teal);text-transform:uppercase;margin-bottom:6px">Profile A</div>
        <div class="mp-name">${esc(a.name)}</div>
        <div class="mp-school">${esc(a.school)}</div>
        <div class="mp-count">${countA} entr${countA!==1?'ies':'y'}</div>
      </div>
      <div class="mini-profile" style="border-color:rgba(244,114,182,.3)">
        <div style="font-size:8px;letter-spacing:2px;color:var(--pink);text-transform:uppercase;margin-bottom:6px">Profile B</div>
        <div class="mp-name">${esc(b.name)}</div>
        <div class="mp-school">${esc(b.school)}</div>
        <div class="mp-count">${countB} entr${countB!==1?'ies':'y'}</div>
      </div>`;

    // Name options
    const opts = [a, b].filter((s, i, arr) => arr.findIndex(x => x.name === s.name && x.school === s.school) === i);
    document.getElementById('mcm-name-opts').innerHTML = opts.map(s => `
      <div class="name-opt-btn${_mergeChosenName === s.name ? ' selected' : ''}"
        onclick="selectMergeName('${esc(s.name)}','${esc(s.school)}')">
        <span>${esc(s.name)}</span>
        <span class="name-opt-check">${_mergeChosenName === s.name ? '✓' : ''}</span>
      </div>`).join('');

    document.getElementById('merge-confirm-modal').style.display = 'flex';
  }

  function selectMergeName(name, school) {
    _mergeChosenName = name; _mergeChosenSchool = school;
    document.getElementById('mcm-custom-name').value = '';
    document.querySelectorAll('.name-opt-btn').forEach(btn => {
      const bName = btn.querySelector('span:first-child').textContent;
      const isSelected = bName === name;
      btn.className = 'name-opt-btn' + (isSelected ? ' selected' : '');
      btn.querySelector('.name-opt-check').textContent = isSelected ? '✓' : '';
    });
  }

  function closeMergeConfirm() {
    document.getElementById('merge-confirm-modal').style.display = 'none';
    _mergeA = null; _mergeB = null;
  }

  async function executeMerge() {
    if (!_mergeA || !_mergeB || !ADMIN_DATA) return showToast('Nothing to merge.', 'error');

    const customName = document.getElementById('mcm-custom-name').value.trim();
    const finalName  = customName || _mergeChosenName;
    const keepSchool = customName ? _mergeA.school : _mergeChosenSchool;

    if (!finalName) return showToast('Choose or type a name.', 'error');

    // Get gender from A (the "keeper") unless B has one and A doesn't
    const genderA = _mergeA.gender || 'U';
    const genderB = _mergeB.gender || 'U';
    const finalGender = (genderA !== 'U') ? genderA : genderB;

    const affectedMap = new Map();
    let mergedCount = 0;
    let duplicateCount = 0;

    // Step 1: Rename/merge all B records → A identity (check for collision in same exam)
    forEachStudent((s, exam, city, year) => {
      if (s.name === _mergeB.name && s.school === _mergeB.school) {
        // Check if A already exists in this exam
        const collision = exam.students.find(x => x.name === _mergeA.name && x.school === _mergeA.school);
        if (collision) {
          // Keep the better (higher) mark; remove B
          collision.marks = Math.max(collision.marks, s.marks);
          s._mergeDelete = true;
          duplicateCount++;
        } else {
          s.name   = finalName;
          s.school = keepSchool;
          s.gender = finalGender;
          mergedCount++;
        }
        affectedMap.set(city + '|' + year, { city, year });
      }
    });

    // Remove B records that collided
    for (const city of Object.keys(ADMIN_DATA)) {
      for (const year of Object.keys(ADMIN_DATA[city])) {
        for (const exam of (ADMIN_DATA[city][year].exams || [])) {
          const before = exam.students.length;
          exam.students = exam.students.filter(s => !s._mergeDelete);
          if (exam.students.length < before) recomputeRanks(exam);
        }
      }
    }

    // Step 2: Rename all A records to finalName/keepSchool (if they differ)
    if (finalName !== _mergeA.name || keepSchool !== _mergeA.school) {
      forEachStudent((s, exam, city, year) => {
        if (s.name === _mergeA.name && s.school === _mergeA.school) {
          s.name   = finalName;
          s.school = keepSchool;
          s.gender = finalGender;
          affectedMap.set(city + '|' + year, { city, year });
        }
      });
    }

    // Recompute ranks for all affected
    for (const { city, year } of affectedMap.values()) {
      for (const exam of (ADMIN_DATA[city]?.[year]?.exams || [])) recomputeRanks(exam);
    }

    const pairs = [...affectedMap.values()];
    showToast(`Merging across ${pairs.length} chunk${pairs.length > 1 ? 's' : ''}…`, '');
    const ok = await writeChunks(pairs);
    if (!ok) return showToast('GitHub write failed — refresh to resync.', 'error');

    await appendManualEdit(edits => {
      if (!edits.merges) edits.merges = [];
      edits.merges.push({
        profileA: { name: _mergeA.name, school: _mergeA.school },
        profileB: { name: _mergeB.name, school: _mergeB.school },
        finalName, finalSchool: keepSchool,
        mergedCount, duplicateCount,
        timestamp: Date.now()
      });
    });
    bumpVersion();

    const total = mergedCount + duplicateCount;
    closeMergeConfirm();
    showToast(`Merged! ${total} record${total!==1?'s':''} consolidated under "${finalName}".`, 'success');

    // Refresh manual search if open
    populateStuSchoolFilter();
    if (currentPanel === 'student') searchStudentAdmin();
    // Reset manual merge
    _mmSelected = { a: null, b: null };
    ['a','b'].forEach(side => {
      const inp = document.getElementById(`mm-${side}-name`);
      if (inp) inp.value = '';
      const card = document.getElementById(`mm-${side}-card`);
      if (card) { card.style.display = 'none'; card.innerHTML = ''; }
    });
    document.getElementById('mm-merge-btn').disabled = true;
  }

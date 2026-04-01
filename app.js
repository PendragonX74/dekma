
    const GEN_MALE = 'B';
    const GEN_FEMALE = 'G';

    let selectedCity = '';
    let selectedYear = '';

    let splashCity = '';
    let splashYear = '';

    let EXAMS = [];
    let ALL = [];
    let SCHOOLS = [];
    let CHARTS = {};
    let _globalMean = 70;

    let lbPage = 1, lbGender = '', lbSchool = '', lbTestSel = { mode: 'all' }, lbSortField = 'rating', lbSortAsc = false;

    let podiumTestSel = { mode: 'all' }, top10TestSel = { mode: 'all' }, dashTestSel = { mode: 'all' }, top10SortField = 'rank', top10SortAsc = true, _schoolsExpanded = false;

    let stuGender = '', stuSchool = '';

    let schoolSort = 'avg', schoolTestSel = { mode: 'all' }, schoolData = {};

    let avgType = 'all';

    let _globalRankMap = {};

    let _navOrigin = null;

    function getAvailableCities() {
      if (!window.dekmaData) return [];
      return Object.keys(window.dekmaData).sort();
    }

    function getAvailableYears(city) {
      if (!window.dekmaData || !city || !window.dekmaData[city]) return [];
      return Object.keys(window.dekmaData[city]).sort((a, b) => b - a);
    }

    function hasData(city, year) {
      return !!(window.dekmaData && window.dekmaData[city] && window.dekmaData[city][year] && window.dekmaData[city][year].exams && window.dekmaData[city][year].exams.length);
    }

    function toggleLogoDrop(which) {
      const otherId = which === 'year' ? 'city' : 'year';
      const panel = document.getElementById(which + '-drop');
      const otherP = document.getElementById(otherId + '-drop');
      const btn = document.getElementById(which + '-sel-btn');
      const wasOpen = panel.classList.contains('open');

      ['year', 'city'].forEach(w => {
        document.getElementById(w + '-drop').classList.remove('open');
        document.getElementById(w + '-sel-btn').classList.remove('open');
      });
      if (!wasOpen) {
        buildLogoDrop(which);
        const rect = btn.getBoundingClientRect();
        panel.style.left = rect.left + 'px';
        panel.style.top = (rect.bottom + 4) + 'px';
        panel.classList.add('open');
        btn.classList.add('open');
      }
    }

    function buildLogoDrop(which) {
      const panel = document.getElementById(which + '-drop');
      if (which === 'city') {
        const cities = getAvailableCities();
        panel.innerHTML = cities.map(c => `
          <div class="logo-drop-item ${c === selectedCity ? 'selected' : ''}" onclick="switchCity('${esc(c)}')">
            <span>${c}</span>
            <span class="logo-drop-check">✓</span>
          </div>`).join('') || '<div class="logo-drop-item disabled">No data loaded</div>';
      } else {

        const years = getAvailableYears(selectedCity);
        const allYears = new Set();
        getAvailableCities().forEach(c => getAvailableYears(c).forEach(y => allYears.add(y)));
        const sortedAll = [...allYears].sort((a, b) => b - a);
        panel.innerHTML = sortedAll.map(y => {
          const exists = hasData(selectedCity, y);
          return `<div class="logo-drop-item ${y === selectedYear ? 'selected' : ''} ${!exists ? 'disabled' : ''}"
            onclick="${exists ? `switchYear('${y}')` : ''}"
            title="${!exists ? 'No data for ' + selectedCity + ' ' + y : ''}">
            <span>${y}</span>
            <span class="logo-drop-meta">${exists ? '' : 'no data'}</span>
            <span class="logo-drop-check">✓</span>
          </div>`;
        }).join('') || '<div class="logo-drop-item disabled">No data loaded</div>';
      }
    }

    function switchCity(city) {
      closeLogoDrop();
      if (city === selectedCity) return;
      selectedCity = city;

      if (!hasData(selectedCity, selectedYear)) {
        const yrs = getAvailableYears(selectedCity);
        selectedYear = yrs[0] || '';
      }
      saveSelection();
      reloadForSelection();
    }

    function switchYear(year) {
      closeLogoDrop();
      if (year === selectedYear) return;
      selectedYear = year;
      saveSelection();
      reloadForSelection();
    }

    function toggleTopbarSelector(ev) {
      if (ev) ev.stopPropagation();
      const badge = document.getElementById('context-badge');
      const drop = document.getElementById('topbar-drop');
      if (!badge || !drop) return;
      const isOpen = drop.classList.contains('open');
      closeLogoDrop();
      if (!isOpen) {

        const cities = getAvailableCities();
        const allYears = new Set();
        getAvailableCities().forEach(c => getAvailableYears(c).forEach(y => allYears.add(y)));
        const sortedYears = [...allYears].sort((a, b) => b - a);
        drop.innerHTML =
          '<div style="padding:6px 12px 4px;font-family:DM Mono,monospace;font-size:9px;color:var(--text3);letter-spacing:2px;text-transform:uppercase">City</div>' +
          cities.map(c => `<div class="logo-drop-item ${c === selectedCity ? 'selected' : ''}" onclick="switchCity('${esc(c)}')">
            <span>${c}</span><span class="logo-drop-check">✓</span></div>`).join('') +
          '<div style="padding:8px 12px 4px;font-family:DM Mono,monospace;font-size:9px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;border-top:1px solid var(--border);margin-top:4px">Year</div>' +
          sortedYears.map(y => {
            const exists = hasData(selectedCity, y);
            return `<div class="logo-drop-item ${y === selectedYear ? 'selected' : ''} ${!exists ? 'disabled' : ''}" onclick="${exists ? `switchYear('${y}')` : ''}">
              <span>${y}</span><span class="logo-drop-meta">${exists ? '' : 'no data'}</span><span class="logo-drop-check">✓</span></div>`;
          }).join('');
        const rect = badge.getBoundingClientRect();
        const W = Math.min(220, window.innerWidth - 16);
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - W - 8));
        const top = rect.bottom + 6;
        drop.style.cssText = `left:${left}px;top:${top}px;min-width:${W}px`;
        drop.classList.add('open');
        badge.classList.add('open');
      }
    }

    function closeLogoDrop() {
      ['year', 'city'].forEach(w => {
        const d = document.getElementById(w + '-drop');
        const b = document.getElementById(w + '-sel-btn');
        if (d) d.classList.remove('open');
        if (b) b.classList.remove('open');
      });
      const tDrop = document.getElementById('topbar-drop');
      const badge = document.getElementById('context-badge');
      if (tDrop) tDrop.classList.remove('open');
      if (badge) badge.classList.remove('open');
    }

    function saveSelection() {
      try {
        localStorage.setItem('dekma_city', selectedCity);
        localStorage.setItem('dekma_year', selectedYear);
      } catch (e) { }
    }

    function reloadForSelection() {
      _transitionsReady = false;

      const dispCity = selectedCity ? selectedCity.charAt(0).toUpperCase() + selectedCity.slice(1) : '—';
      document.getElementById('logo-year').textContent = selectedYear || '—';
      document.getElementById('logo-city').textContent = dispCity;
      document.getElementById('logo-sub').textContent = 'Applied Maths';
      const badge = document.getElementById('context-badge');
      const badgeText = document.getElementById('context-badge-text');
      if (badgeText) badgeText.textContent = dispCity + ' · ' + selectedYear;
      else badge.textContent = dispCity + ' · ' + selectedYear;
      badge.style.display = 'inline-flex';
      document.title = `DEKMA ${dispCity} ${selectedYear}`;

      lbPage = 1; lbGender = ''; lbTestSel = { mode: 'all' }; lbSortField = 'rating'; lbSortAsc = false; lbSchool = '';
      podiumTestSel = { mode: 'all' }; top10TestSel = { mode: 'all' }; dashTestSel = { mode: 'all' }; top10SortField = 'rank'; top10SortAsc = true;
      stuGender = ''; stuSchool = ''; schoolSort = 'elite'; schoolTestSel = { mode: 'all' }; schoolData = {};
      avgType = 'all'; _schoolsExpanded = false;

      Object.values(CHARTS).forEach(c => { try { c.destroy(); } catch (e) { } });
      CHARTS = {};

      const src = hasData(selectedCity, selectedYear)
        ? window.dekmaData[selectedCity][selectedYear]
        : { exams: [] };
      loadExamData(src);
    }

    function showSplash(destination) {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('app').style.display = 'none';
      const splashEl = document.getElementById('splash');
      splashEl.style.display = 'block';

      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (window.startSplashAnimation) window.startSplashAnimation(destination);
      }));
    }

    function renderSplashYears(years) {
      const noData = splashCity
        ? years.filter(y => !hasData(splashCity, y))
        : [];
      document.getElementById('splash-years').innerHTML = years.map(y => {
        const disabled = splashCity && !hasData(splashCity, y);
        return `<div class="splash-opt ${y === splashYear ? 'selected' : ''} ${disabled ? 'disabled' : ''}"
          onclick="${disabled ? '' : `splashPickYear('${y}')`}"
          style="${disabled ? 'opacity:.3;pointer-events:none;' : ''}">${y}</div>`;
      }).join('') || '<div style="color:var(--text3);font-family:DM Mono,monospace;font-size:11px">Pick a city first</div>';
    }

    function splashPickCity(city) {
      splashCity = city;

      if (splashYear && !hasData(splashCity, splashYear)) splashYear = '';
      document.querySelectorAll('#splash-cities .splash-opt').forEach(el => {
        el.classList.toggle('selected', el.textContent === city);
      });

      const allYears = new Set();
      getAvailableCities().forEach(c => getAvailableYears(c).forEach(y => allYears.add(y)));
      renderSplashYears([...allYears].sort((a, b) => b - a));
      updateSplashBtn();
    }

    function splashPickYear(year) {
      splashYear = year;
      document.querySelectorAll('#splash-years .splash-opt').forEach(el => {
        el.classList.toggle('selected', el.textContent === year);
      });
      updateSplashBtn();
    }

    function updateSplashBtn() {
      const btn = document.getElementById('splash-go-btn');
      const ndEl = document.getElementById('splash-no-data');
      const canGo = splashCity && splashYear && hasData(splashCity, splashYear);
      const hasCombo = splashCity && splashYear;
      const noData = hasCombo && !hasData(splashCity, splashYear);
      btn.classList.toggle('ready', !!canGo);
      ndEl.style.display = noData ? 'block' : 'none';
    }

    function splashGo() {
      if (!splashCity || !splashYear || !hasData(splashCity, splashYear)) return;
      selectedCity = splashCity; selectedYear = splashYear;
      saveSelection();
      const pk = document.getElementById('picker');
      pk.classList.add('p-exit');
      setTimeout(() => {
        pk.style.display = 'none';
        pk.classList.remove('p-exit');
        const app = document.getElementById('app');
        app.style.display = 'flex';
        app.classList.add('app-enter');
        setTimeout(() => app.classList.remove('app-enter'), 700);
        reloadForSelection();
      }, 620);
    }

    function skipSplashAnim() { window._splashSkip && window._splashSkip(); }

    function mkAmbientCanvas(id) {
      const cv = document.getElementById(id);
      if (!cv) return { start(){}, stop(){} };
      const ctx = cv.getContext('2d');
      let W, H, t = 0, raf = null;

      function resize() { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }
      resize();
      window.addEventListener('resize', resize);

      function blob(cx, cy, r, ca, cb, phase) {
        const n = 160;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * Math.PI * 2;
          const w = 1
            + .12 * Math.sin(2*a + t*.85  + phase)
            + .07 * Math.sin(3*a - t*.6   + phase*1.2)
            + .05 * Math.sin(5*a + t*1.1  + phase*.8)
            + .03 * Math.sin(7*a - t*.45  + phase*1.7);
          const px = cx + r*w*Math.cos(a), py = cy + r*w*Math.sin(a);
          i ? ctx.lineTo(px,py) : ctx.moveTo(px,py);
        }
        ctx.closePath();
        const g = ctx.createRadialGradient(cx,cy,0,cx,cy,r*1.15);
        g.addColorStop(0, ca); g.addColorStop(.6, cb); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fill();
      }

      function frame() {
        raf = requestAnimationFrame(frame);
        t += .007;
        ctx.clearRect(0, 0, W, H);
        const cx = W/2, cy = H*.42, p = .5+.5*Math.sin(t*.75);

        const vig = ctx.createRadialGradient(cx,cy,H*.05,cx,cy,H*.82);
        vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,.62)');
        ctx.fillStyle = vig; ctx.fillRect(0,0,W,H);

        const aa = .045 + p*.02;
        blob(cx, cy, W*.2, `rgba(232,152,24,${aa})`, `rgba(210,120,10,${aa*.22})`, 0);

        const ta = .014 + p*.007;
        blob(cx+W*.05, cy-H*.025, W*.13, `rgba(45,212,191,${ta})`, `rgba(20,180,160,${ta*.28})`, 2.2);

        if (t > 2) {
          const ga = Math.min((t-2)/4,1) * .017;
          const gs = 58, ox = cx%gs, oy = cy%gs;
          ctx.strokeStyle = `rgba(232, 160, 32,${ga})`; ctx.lineWidth = .4;
          ctx.beginPath();
          for (let x=ox; x<W; x+=gs){ ctx.moveTo(x,0); ctx.lineTo(x,H); }
          for (let y=oy; y<H; y+=gs){ ctx.moveTo(0,y); ctx.lineTo(W,y); }
          ctx.stroke();
        }
      }

      return {
        start() { if (!raf) frame(); },
        stop()  { if (raf) { cancelAnimationFrame(raf); raf = null; } }
      };
    }

    (function(){
      let amb = null, exitTimer = null, dest = 'picker';
      let _exitCalled = false, _splashWaiting = false;

      function Q(id){ return document.getElementById(id); }

      function runSeq() {

        setTimeout(() => { Q('spl-line-l').style.width='38px'; Q('spl-line-r').style.width='38px'; }, 100);

        setTimeout(() => { Q('spl-etext').style.opacity='1'; }, 280);

        ['sl-D','sl-E','sl-K','sl-M','sl-A'].forEach((id,i) =>
          setTimeout(() => Q(id).classList.add('in'), 420 + i*110)
        );

        setTimeout(() => { Q('spl-rule').style.width='58%'; }, 1050);

        setTimeout(() => { Q('spl-sub').classList.add('in'); }, 1280);

        exitTimer = setTimeout(() => doExit(), 2400);
      }

      function doExit() {
        if (_exitCalled) return;

        if (!window._dekmaBootstrapDone) {
          _splashWaiting = true;
          clearTimeout(exitTimer);
          if (amb) { amb.stop(); amb = null; }
          const waitEl = document.getElementById('spl-wait');
          if (waitEl) {
            waitEl.classList.add('visible');
            requestAnimationFrame(() => requestAnimationFrame(() => waitEl.classList.add('in')));
          }
          return;
        }

        _splashWaiting = false;
        _exitCalled = true;
        clearTimeout(exitTimer);
        if (amb) { amb.stop(); amb = null; }
        const sp = Q('splash');

        const skipBtn = Q('splash-skip');
        if (skipBtn) { skipBtn.style.opacity = '0'; skipBtn.style.pointerEvents = 'none'; }
        sp.classList.add(dest === 'app' ? 's-exit-fade' : 's-exit-up');
        setTimeout(() => {
          sp.style.display = 'none';
          sp.classList.remove('s-exit-fade','s-exit-up');
          _exitCalled = false;
          if (dest === 'app') {
            const app = Q('app');
            app.style.display = 'flex';
            app.classList.add('app-enter');
            setTimeout(() => app.classList.remove('app-enter'), 700);

            if (!window._appPreloaded) reloadForSelection();
          } else {
            showPicker();
          }
        }, 720);
      }

      window._splashSetDest = function(d) { dest = d || 'picker'; };

      window._splashReady = function() {
        if (_splashWaiting) {
          _splashWaiting = false;
          const waitEl = document.getElementById('spl-wait');
          if (waitEl) {
            waitEl.classList.remove('in');
            setTimeout(() => { waitEl.classList.remove('visible'); }, 320);
          }

          setTimeout(doExit, 340);
        }
      };

      window._splashSkip = function() {
        clearTimeout(exitTimer);
        if (_exitCalled) return;

        Q('spl-line-l').style.cssText += ';transition:none;width:38px';
        Q('spl-line-r').style.cssText += ';transition:none;width:38px';
        Q('spl-etext').style.cssText  += ';transition:none;opacity:1';
        ['sl-D','sl-E','sl-K','sl-M','sl-A'].forEach(id => {
          const el = Q(id);
          el.style.transition = 'none';
          el.classList.add('in');
        });
        Q('spl-rule').style.cssText += ';transition:none;width:58%';
        Q('spl-sub').style.cssText  += ';transition:none;opacity:1;transform:translateY(0)';

        doExit();
      };

      window._splashStop = function() {
        if (amb) { amb.stop(); amb = null; }
        clearTimeout(exitTimer);
      };

      window.startSplashAnimation = function(destination) {
        dest = destination || 'picker';

        let n = 0;
        function tick() {
          if (++n < 3) { requestAnimationFrame(tick); return; }
          amb = mkAmbientCanvas('splash-canvas');
          amb.start();
          runSeq();
        }
        requestAnimationFrame(tick);
      };
    })();

    document.addEventListener('DOMContentLoaded', function () {
      if (window._splashEarlyStarted) return;
      window._splashEarlyStarted = true;
      document.getElementById('loading').style.display = 'none';
      var sp = document.getElementById('splash');
      sp.style.display = 'block';

      requestAnimationFrame(function () { requestAnimationFrame(function () {
        if (window.startSplashAnimation) window.startSplashAnimation('picker');
      }); });
    }, { once: true });

    function showPicker() {
      const pk = document.getElementById('picker');
      pk.style.display = 'flex';

      const cities = getAvailableCities();
      document.getElementById('splash-cities').innerHTML = cities.map(c =>
        `<div class="splash-opt${c===splashCity?' selected':''}" onclick="splashPickCity('${esc(c)}')">${c}</div>`
      ).join('') || '<span style="color:var(--text3);font-family:DM Mono,monospace;font-size:11px">No data found</span>';

      const allYears = new Set();
      cities.forEach(c => getAvailableYears(c).forEach(y => allYears.add(y)));
      renderSplashYears([...allYears].sort((a,b)=>b-a));
      updateSplashBtn();

      const amb = mkAmbientCanvas('picker-canvas');
      amb.start();

      requestAnimationFrame(() => requestAnimationFrame(() => {
        setTimeout(() => document.getElementById('picker-logo').classList.add('in'), 50);
        setTimeout(() => document.getElementById('picker-grid').classList.add('in'), 180);
      }));
    }

    function loadData() {
      if (window._splashEarlyStarted) {

        if (!window.dekmaData || !Object.keys(window.dekmaData).length) {

          document.getElementById('splash').style.display = 'none';
          selectedCity = ''; selectedYear = '';
          document.getElementById('app').style.display = 'flex';
          document.getElementById('no-data-msg').style.display = 'block';
          initUIShell();
          return;
        }

        let city = '', year = '';
        try {
          city = localStorage.getItem('dekma_city') || '';
          year = localStorage.getItem('dekma_year') || '';
        } catch(e) {}

        if (city && year && hasData(city, year)) {
          selectedCity = city; selectedYear = year;
          splashCity = city;   splashYear = year;
          if (window._splashSetDest) window._splashSetDest('app');

          setTimeout(() => { reloadForSelection(); window._appPreloaded = true; }, 80);
        } else {
          splashCity = ''; splashYear = '';
          if (window._splashSetDest) window._splashSetDest('picker');
        }

        if (window._splashReady) window._splashReady();
        return;
      }

      document.getElementById('loading').style.display = 'none';

      if (!window.dekmaData || !Object.keys(window.dekmaData).length) {
        selectedCity = ''; selectedYear = '';
        document.getElementById('app').style.display = 'flex';
        document.getElementById('no-data-msg').style.display = 'block';
        initUIShell();
        return;
      }

      let city = '', year = '';
      try {
        city = localStorage.getItem('dekma_city') || '';
        year = localStorage.getItem('dekma_year') || '';
      } catch(e) {}

      if (city && year && hasData(city, year)) {
        selectedCity = city; selectedYear = year;
        splashCity = city;   splashYear = year;
        showSplash('app');
        setTimeout(() => {
          reloadForSelection();
          window._appPreloaded = true;
        }, 80);
      } else {
        splashCity = ''; splashYear = '';
        showSplash('picker');
      }
    }

    function loadExamData(src) {
      EXAMS = (src.exams || []).slice();
      const _LOAD_TYPE_ORDER = { theory: 0, revision: 1, model_theory: 2, model_revision: 3 };
      EXAMS.sort((a, b) => {
        const ao = _LOAD_TYPE_ORDER[a.type] ?? 9, bo = _LOAD_TYPE_ORDER[b.type] ?? 9;
        if (ao !== bo) return ao - bo;
        return (a.number || 0) - (b.number || 0);
      });

      const normSchool = v => (!v || v.trim().toLowerCase() === 'no') ? '' : v.trim();

      ALL = [];
      for (const exam of EXAMS) {
        for (const s of (exam.students || [])) {
          let g = (s.gender || 'U').toUpperCase();
          if (g === 'M') g = 'B';
          if (g === 'F') g = 'G';
          ALL.push({ ...s, school: normSchool(s.school), gender: g, exam_id: exam.id, exam_label: exam.label, exam_type: exam.type });
        }
      }
      SCHOOLS = [...new Set(ALL.map(r => r.school).filter(Boolean))].sort();
      if (ALL.length) {
        _globalMean = ALL.reduce((s, r) => s + r.marks, 0) / ALL.length;
      }

      if (!EXAMS.length) {
        document.getElementById('no-data-msg').style.display = 'block';
      } else {
        document.getElementById('no-data-msg').style.display = 'none';
      }

      initUIShell();
    }

    function initUIShell() {

      if (typeof Chart !== 'undefined' && !Chart.registry.plugins.get('stickyY')) {
        Chart.register({
          id: 'stickyY',
          afterDraw(chart) {
            const outer = chart.canvas.closest('.chart-scroll-outer');
            if (!outer) return;
            const inner = outer.querySelector('.chart-scroll-inner');

            const isScrollable = inner && inner.scrollWidth > inner.clientWidth + 4;
            const isScrolled = inner && inner.scrollLeft > 0;
            let overlay = outer.querySelector('.sticky-y-canvas');
            if (!isScrollable || !isScrolled) {
              if (overlay) overlay.style.display = 'none';

              if (isScrollable && !inner._stickyListenerAttached) {
                inner._stickyListenerAttached = true;
                inner.addEventListener('scroll', () => chart.draw(), { passive: true });
              }
              return;
            }
            const axisW = Math.ceil(chart.chartArea.left) - 1;
            if (axisW <= 0) return;
            const dpr = window.devicePixelRatio || 1;
            const cssH = chart.height;
            if (!overlay) {
              overlay = document.createElement('canvas');
              overlay.className = 'sticky-y-canvas';
              outer.appendChild(overlay);
            }

            if (!inner._stickyListenerAttached) {
              inner._stickyListenerAttached = true;
              inner.addEventListener('scroll', () => chart.draw(), { passive: true });
            }
            overlay.style.display = 'block';
            overlay.style.width = axisW + 'px';
            overlay.style.height = cssH + 'px';
            overlay.width = Math.ceil(axisW * dpr);
            overlay.height = Math.ceil(cssH * dpr);
            const ctx2 = overlay.getContext('2d');
            ctx2.clearRect(0, 0, overlay.width, overlay.height);
            const tmpEl = document.createElement('div');
            tmpEl.style.cssText = 'position:absolute;visibility:hidden;background:var(--bg2)';
            document.body.appendChild(tmpEl);
            const bg = getComputedStyle(tmpEl).backgroundColor || '#111118';
            document.body.removeChild(tmpEl);
            ctx2.fillStyle = bg;
            ctx2.fillRect(0, 0, overlay.width, overlay.height);

            ctx2.drawImage(chart.canvas, 0, 0, Math.ceil(axisW * dpr), chart.canvas.height,
                           0, 0, Math.ceil(axisW * dpr), Math.ceil(cssH * dpr));
          }
        });
      }

      const revExams = EXAMS.filter(e => e.type === 'revision');
      const thyExams = EXAMS.filter(e => e.type === 'theory');
      const defaultExam = revExams.length ? revExams[revExams.length - 1]
        : thyExams.length ? thyExams[thyExams.length - 1] : null;
      if (defaultExam) lbTestSel = { mode: 'custom', ids: new Set([defaultExam.id]) };

      TDD_MULTI['school-test-sel'] = true;
      syncDashFilterBtns();
      populateSelects();
      buildExamStats();
      buildStuRegistry();
      buildTestDropdowns();
      buildGlobalRankMap();
      syncTestsFilterBtns();
      syncAvgFilterBtns();
      renderOverviewStats();
      renderPodium();
      renderTop10();
      renderDistribution();
      renderTopSchoolsBars();
      renderTestsChart();
      renderTestsGrid();
      renderLeaderboard();
      populateStudentFilters();
      searchStudents();
      document.getElementById('sidebar-footer').innerHTML =
        `<div>${EXAMS.length} test${EXAMS.length !== 1 ? 's' : ''} loaded</div>` +
        `<div>${ALL.length.toLocaleString()} entries</div>`;

      window.removeEventListener('hashchange', handleHashChange);
      window.addEventListener('hashchange', handleHashChange);
      handleHashChange();
      setTimeout(() => { _transitionsReady = true; }, 400);
      initMobileSearch();
    }

    function toggleSidebar() {
      const sb = document.getElementById('sidebar');
      const hb = document.getElementById('hamburger');
      const ov = document.getElementById('sidebar-overlay');
      const open = sb.classList.toggle('open');
      hb.classList.toggle('open', open);
      ov.classList.toggle('open', open);
    }
    function closeSidebar() {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('hamburger').classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('open');
    }

    function openMobileSearch() {
      document.getElementById('mobile-search-expand').classList.add('open');
      setTimeout(() => document.getElementById('mobile-search-input')?.focus(), 60);
    }

    function closeMobileSearch() {
      document.getElementById('mobile-search-expand').classList.remove('open');
      const inp = document.getElementById('mobile-search-input');
      if (inp) inp.value = '';
      const res = document.getElementById('mobile-search-results');
      if (res) { res.innerHTML = ''; res.classList.remove('open'); }
    }

    function initMobileSearch() {
      const inp = document.getElementById('mobile-search-input');
      if (!inp) return;
      let timer;
      inp.addEventListener('input', () => {
        clearTimeout(timer);
        const q = inp.value.toLowerCase().trim();
        const res = document.getElementById('mobile-search-results');
        if (!res) return;
        if (q.length < 2) { res.innerHTML = ''; res.classList.remove('open'); return; }
        timer = setTimeout(() => {
          const map = {};
          ALL.forEach(r => {
            if (!r.name.toLowerCase().includes(q)) return;
            const k = r.name + '||' + r.school;
            if (!map[k]) map[k] = { name: r.name, school: r.school, best: r.marks, tests: 0 };
            map[k].best = Math.max(map[k].best, r.marks); map[k].tests++;
          });
          const hits = Object.values(map).slice(0, 10);
          if (!hits.length) { res.innerHTML = ''; res.classList.remove('open'); return; }
          res.innerHTML = hits.map(h => `
            <div style="padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;gap:12px"
              onmouseenter="this.style.background='var(--bg3)'" onmouseleave="this.style.background=''"
              onclick="closeMobileSearch();navToStudent('${_ns(h.name)}','${_ns(h.school)}')">
              <div>
                <div style="font-weight:600;font-size:14px;margin-bottom:2px">${h.name}</div>
                <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text3)">${h.school} · ${h.tests} test${h.tests > 1 ? 's' : ''} · Best ${h.best}</div>
              </div>
              <div style="margin-left:auto;font-family:'DM Mono',monospace;font-size:10px;color:var(--text3)">→</div>
            </div>`).join('');
          res.classList.add('open');
        }, 150);
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileSearch(); });

      document.addEventListener('click', e => {
        if (!e.target.closest('#mobile-search-expand') && !e.target.closest('#mobile-search-results') && !e.target.closest('#mobile-search-btn')) {
          if (document.getElementById('mobile-search-expand')?.classList.contains('open')) closeMobileSearch();
        }
      });
    }

    let _transitionsReady = false;
    let _suppressScrollReset = false;

    function liquidTransition(cb) {
      const content = document.getElementById('main-content');
      if (!content) { cb(); return; }
      content.style.transition = 'opacity .18s ease, filter .18s ease';
      content.style.opacity = '0';
      content.style.filter = 'blur(6px)';
      setTimeout(() => {
        cb();
        content.style.opacity = '1';
        content.style.filter = 'blur(0)';
        setTimeout(() => { content.style.transition = ''; }, 220);
      }, 180);
    }

    const PAGE_TITLES = {
      dashboard: 'DASHBOARD', tests: 'ALL TESTS', leaderboard: 'LEADERBOARD',
      students: 'STUDENT LOOKUP', schools: 'SCHOOL ANALYSIS', analytics: 'ANALYTICS'
    };

    function showPage(page) {
      if (!PAGE_TITLES[page]) return;
      if (_transitionsReady) { liquidTransition(() => _doShowPage(page)); return; }
      _doShowPage(page);
    }

    function tabNav(page) {
      location.hash = page;
    }

    function syncBottomTabs(page) {
      document.querySelectorAll('.tab-item').forEach(t => {
        t.classList.toggle('active', t.id === 'tab-' + page);
      });
    }

    function _doShowPage(page) {
      if (!PAGE_TITLES[page]) return;
      syncBottomTabs(page);
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById('page-' + page).classList.add('active');
      document.querySelectorAll('.nav-item').forEach(n => {
        const onclick = n.getAttribute('onclick');
        if (onclick && onclick.includes("'" + page + "'")) n.classList.add('active');
      });
      document.getElementById('page-title').textContent = PAGE_TITLES[page] || page.toUpperCase();
      if (!_suppressScrollReset) {
        const contentEl = document.getElementById('main-content');
        if (contentEl) contentEl.scrollTop = 0;
        window.scrollTo(0, 0);
      }
      _suppressScrollReset = false;
      if (page === 'students') {

        if (!_navOrigin) {
          _profileStack = [];
          const fb = document.getElementById('stu-filter-bar');
          if (fb) fb.style.display = '';
          const sg = document.getElementById('stu-grid');
          if (sg) sg.style.display = 'grid';
          const sp = document.getElementById('stu-profile');
          if (sp) sp.style.display = 'none';
        }
      }
      if (page === 'analytics') setTimeout(renderAnalytics, 50);
      if (page === 'schools') renderSchools();
      if (page === 'leaderboard') renderLeaderboard();
    }

    function handleHashChange() {
      const page = location.hash.replace('#', '') || 'dashboard';
      showPage(page);
    }

    function populateSelects() {
      buildSchoolDropdown();
      buildStuSchoolDropdown();
    }

    const TYPE_SORT = { theory:0, revision:1, model_theory:2, model_revision:3 };
    function isModelType(t) { return t==='model_theory'||t==='model_revision'; }
    function typeColor(t) {
      if (t==='theory')   return 'var(--teal)';
      if (t==='revision') return '#f97316';
      if (isModelType(t)) return '#818cf8';
      return 'var(--text2)';
    }

    function typeColorCanvas(t) {
      if (t==='theory')   return '#2dd4bf';
      if (t==='revision') return '#f97316';
      if (isModelType(t)) return '#818cf8';
      return '#9090b0';
    }
    function typeColorRgba(t,a) {
      const c={theory:'45,212,191',revision:'249,115,22'};
      return `rgba(${c[t]||(isModelType(t)?'129,140,248':'144,144,176')},${a})`;
    }
    function typeLabel(t) {
      return {theory:'Theory',revision:'Revision',model_theory:'Theory Model',model_revision:'Revision Model'}[t]||t;
    }
    function typeShort(t) {
      return {theory:'THE',revision:'REV',model_theory:'THM',model_revision:'RVM'}[t]||t.slice(0,3).toUpperCase();
    }

    let _thyRankMap = {};
    let _revRankMap = {};
    let _modRankMap = {};

    function buildRankMapFromRows(rows) {
      if (!rows.length) return {};
      const agg = aggregateByStudent(rows);
      agg.sort((a, b) => b.rating - a.rating);
      const map = {};
      let rank = 1;
      agg.forEach((s, i) => {
        if (i > 0 && s.rating !== agg[i - 1].rating) rank = i + 1;
        map[s.name + '\x00' + s.school] = rank;
      });
      return map;
    }

    function buildGlobalRankMap() {
      if (!ALL.length) return;
      _globalRankMap = buildRankMapFromRows(ALL);
      _thyRankMap = buildRankMapFromRows(ALL.filter(r => {
        const e = EXAMS.find(x => x.id === r.exam_id);
        return e && e.type === 'theory';
      }));
      _revRankMap = buildRankMapFromRows(ALL.filter(r => {
        const e = EXAMS.find(x => x.id === r.exam_id);
        return e && e.type === 'revision';
      }));
      _modRankMap = buildRankMapFromRows(ALL.filter(r => {
        const e = EXAMS.find(x => x.id === r.exam_id);
        return e && isModelType(e.type);
      }));
    }
    function globalRank(name, school) { return _globalRankMap[name + '\x00' + school] || '—'; }
    function thyRank(name, school) { return _thyRankMap[name + '\x00' + school] || '—'; }
    function revRank(name, school) { return _revRankMap[name + '\x00' + school] || '—'; }
    function modRank(name, school)  { return _modRankMap[name + '\x00' + school] || '—'; }

    function resolveExamIds(sel) {
      if (!sel || sel.mode === 'all')  return EXAMS.map(e => e.id);
      if (sel.mode === 'theory')       return EXAMS.filter(e => e.type === 'theory').map(e => e.id);
      if (sel.mode === 'revision')     return EXAMS.filter(e => e.type === 'revision').map(e => e.id);
      if (sel.mode === 'model')        return EXAMS.filter(e => isModelType(e.type)).map(e => e.id);
      if (sel.mode === 'custom')       return [...(sel.ids || [])];
      return EXAMS.map(e => e.id);
    }

    function getRowsForSel(sel) {
      const ids = resolveExamIds(sel);
      if (ids.length === EXAMS.length) return [...ALL];
      const set = new Set(ids);
      return ALL.filter(r => set.has(r.exam_id));
    }

    function isAgg(sel) { return resolveExamIds(sel).length !== 1; }

    function selLabel(sel) {
      if (!sel || sel.mode === 'all') return 'All Tests';
      if (sel.mode === 'theory')   return `Theory Only (${EXAMS.filter(e => e.type === 'theory').length})`;
      if (sel.mode === 'revision') return `Revision Only (${EXAMS.filter(e => e.type === 'revision').length})`;
      if (sel.mode === 'model')    return `Model Papers (${EXAMS.filter(e => isModelType(e.type)).length})`;
      if (sel.mode === 'custom') {
        const ids = [...(sel.ids || [])];
        if (ids.length === 0) return 'None Selected';
        if (ids.length === 1) {
          const e = EXAMS.find(x => x.id === ids[0]);
          return e ? e.label : ids[0];
        }
        return `${ids.length} Tests Selected`;
      }
      return 'All Tests';
    }

    function selDotColor(sel) {
      if (!sel || sel.mode === 'all') return 'var(--blue)';
      if (sel.mode === 'theory')       return 'var(--teal)';
      if (sel.mode === 'revision')     return 'var(--amber)';
      if (sel.mode === 'model')        return '#818cf8';
      if (sel.mode === 'custom') {
        const ids = [...(sel.ids || [])];
        if (ids.length === 1) {
          const e = EXAMS.find(x => x.id === ids[0]);
          return typeColor(e?.type);
        }
        return 'var(--blue)';
      }
      return 'var(--blue)';
    }

    const TDD_CONFIGS = {

      'lb-sel': { get: () => lbTestSel, set: (sel) => { lbTestSel = sel; lbPage = 1; renderLeaderboard(); } },
      'school-test-sel': { get: () => schoolTestSel, set: (sel) => { schoolTestSel = sel; renderSchools(); } },
    };

    function buildTestDropdowns() {
      Object.keys(TDD_CONFIGS).forEach(id => buildOneDropdown(id));
      document.addEventListener('click', ev => {
        if (!ev.target.closest('.tdd-wrap') && !ev.target.closest('.tdd-panel') && !ev.target.closest('.school-dd-panel')) { closeAllDropdowns(); closeSchoolDrop(); closeStuSchoolDrop(); }
        if (!ev.target.closest('.logo-selector') && !ev.target.closest('.logo-drop') && !ev.target.closest('.context-badge')) closeLogoDrop();
      });
      window.addEventListener('scroll', (ev) => {
        if (ev.target && typeof ev.target.closest === 'function' && (ev.target.closest('.tdd-panel') || ev.target.closest('.school-dd-panel'))) return;
        closeAllDropdowns(); closeSchoolDrop(); closeStuSchoolDrop();
      }, true);
      window.addEventListener('resize', () => { closeAllDropdowns(); closeLogoDrop(); });
    }

    function buildOneDropdown(cid) {
      const el = document.getElementById(cid);
      if (!el) return;
      const sel = TDD_CONFIGS[cid].get();

      let btn = document.getElementById(cid + '-btn');
      if (!btn) {
        el.innerHTML = `<div class="tdd-btn" id="${cid}-btn" onclick="toggleDropdown('${cid}',event)">
          <div class="tdd-dot" id="${cid}-dot" style="background:${selDotColor(sel)}"></div>
          <span class="tdd-label" id="${cid}-label">${selLabel(sel)}</span>
          <span class="tdd-arrow">▾</span>
        </div>`;
      } else {

        const dot = document.getElementById(cid + '-dot');
        const label = document.getElementById(cid + '-label');
        if (dot) dot.style.background = selDotColor(sel);
        if (label) label.textContent = selLabel(sel);
      }
      let panel = document.getElementById(cid + '-panel');
      if (!panel) { panel = document.createElement('div'); panel.id = cid + '-panel'; panel.className = 'tdd-panel tdd-panel-multi'; document.body.appendChild(panel); }
      rebuildPanelHTML(cid);
    }

    const TDD_MULTI = {};
    const TDD_PRESETS_ONLY = {};

    function isMultiMode(cid) { return !!TDD_MULTI[cid]; }

    function setMultiMode(cid, val) {

      if (!val) {
        const sel = TDD_CONFIGS[cid].get();
        if (sel.mode !== 'custom' || resolveExamIds(sel).length !== 1) {
          const revExams = EXAMS.filter(e => e.type === 'revision');
          const thyExams = EXAMS.filter(e => e.type === 'theory');
          const fallback = revExams.length ? revExams[revExams.length - 1]
            : thyExams.length ? thyExams[thyExams.length - 1]
            : EXAMS[EXAMS.length - 1];
          if (fallback) TDD_CONFIGS[cid].set({ mode: 'custom', ids: new Set([fallback.id]) });
        }
      }
      TDD_MULTI[cid] = val;
      buildOneDropdown(cid);
    }

    function rebuildPanelHTML(cid) {
      const panel = document.getElementById(cid + '-panel');
      if (!panel) return;

      if (TDD_PRESETS_ONLY[cid]) {
        const sel = TDD_CONFIGS[cid].get();
        const thy = EXAMS.filter(e=>e.type==='theory');
        const rev = EXAMS.filter(e=>e.type==='revision');
        const mod = EXAMS.filter(e=>isModelType(e.type));
        const thyCount=thy.length, revCount=rev.length, modCount=mod.length;
        const allActive = sel.mode === 'all' ? 'active' : '';
        const presetActive = (m) => sel.mode === m ? 'active' : '';
        panel.innerHTML = `
          <div class="tdd-presets" style="flex-wrap:wrap;padding:10px 12px;gap:6px;border-bottom:none">
            <button class="tdd-preset ${allActive}" onclick="event.stopPropagation();applyPreset('${cid}','all')">All</button>
            ${thyCount?`<button class="tdd-preset ${presetActive('theory')}" onclick="event.stopPropagation();applyPreset('${cid}','theory')" style="color:var(--teal)${presetActive('theory')==='active'?';border-color:var(--teal)':''}">Theory</button>`:''}
            ${revCount?`<button class="tdd-preset ${presetActive('revision')}" onclick="event.stopPropagation();applyPreset('${cid}','revision')" style="color:#f97316${presetActive('revision')==='active'?';border-color:#f97316':''}">Revision</button>`:''}
            ${modCount?`<button class="tdd-preset ${presetActive('model')}" onclick="event.stopPropagation();applyPreset('${cid}','model')" style="color:#818cf8${presetActive('model')==='active'?';border-color:#818cf8':''}">Model</button>`:''}
          </div>`;
        return;
      }

      const prevScrolls = Array.from(panel.querySelectorAll('.tdd-col-scroll')).map(el => el.scrollTop);
      const sel = TDD_CONFIGS[cid].get();
      const multi = isMultiMode(cid);
      const checked = new Set(resolveExamIds(sel));

      const thy = EXAMS.filter(e=>e.type==='theory').slice().sort((a,b)=>(b.number||0)-(a.number||0));
      const rev = EXAMS.filter(e=>e.type==='revision').slice().sort((a,b)=>(b.number||0)-(a.number||0));
      const mod = EXAMS.filter(e=>isModelType(e.type)).slice().sort((a,b)=>(TYPE_SORT[a.type]||2)-(TYPE_SORT[b.type]||2)||(b.number||0)-(a.number||0));
      const allCount=EXAMS.length;
      const thyCount=thy.length, revCount=rev.length, modCount=mod.length;
      const selCount=resolveExamIds(sel).length;

      const presetActive = (m) => sel.mode === m && m !== 'custom' ? 'active' : '';
      const allActive = sel.mode === 'all' ? 'active' : '';

      const sub = e => {
        const m = deduplicateStudents([...e.students]).map(s => s.marks);
        return `${m.length} · avg ${m.length ? (m.reduce((a, b) => a + b) / m.length).toFixed(1) : '—'}`;
      };

      const opt = (e, col) => {
        const on = checked.has(e.id);
        if (!multi) {
          return `<div class="tdd-option single-mode ${on ? 'selected' : ''}" onclick="event.stopPropagation();soloExam('${cid}','${esc(e.id)}',event,true)">
            <div class="tdd-checkbox ${on ? 'checked' : ''}"></div>
            <div class="tdd-option-dot" style="background:${col}"></div>
            <div class="tdd-option-text"><div class="tdd-option-name">${e.label}</div><div class="tdd-option-sub">${sub(e)}</div></div>
          </div>`;
        }
        return `<div class="tdd-option tdd-cb-row ${on ? 'selected' : ''}" onclick="event.stopPropagation();toggleExamInSel('${cid}','${esc(e.id)}',event)">
          <div class="tdd-checkbox ${on ? 'checked' : ''}"></div>
          <div class="tdd-option-dot" style="background:${col}"></div>
          <div class="tdd-option-text"><div class="tdd-option-name">${e.label}</div><div class="tdd-option-sub">${sub(e)}</div></div>
        </div>`;
      };

      const colToggle = (type, exams) => {
        if (!multi) return '';
        const allOn = exams.every(e => checked.has(e.id));
        return `<span class="tdd-col-toggle" onclick="event.stopPropagation();toggleTypeInSel('${cid}','${type}',event)">${allOn ? 'Deselect all' : 'Select all'}</span>`;
      };

      const footerText = multi
        ? `${selCount === allCount ? 'All ' + allCount : selCount} of ${allCount} test${allCount !== 1 ? 's' : ''} selected`
        : `Tap a test to select · ${allCount} tests`;

      panel.innerHTML = `
        <div class="tdd-presets">
          <button class="tdd-preset ${allActive}" onclick="event.stopPropagation();applyPreset('${cid}','all')">All</button>
          ${thyCount?`<button class="tdd-preset ${presetActive('theory')}" onclick="event.stopPropagation();applyPreset('${cid}','theory')" style="color:var(--teal)${presetActive('theory')?';border-color:var(--teal)':''}">Theory</button>`:''}
          ${revCount?`<button class="tdd-preset ${presetActive('revision')}" onclick="event.stopPropagation();applyPreset('${cid}','revision')" style="color:#f97316${presetActive('revision')?';border-color:#f97316':''}">Revision</button>`:''}
          ${modCount ? `<button class="tdd-preset ${presetActive('model')}" onclick="event.stopPropagation();applyPreset('${cid}','model')" style="color:#818cf8${presetActive('model')?';border-color:#818cf8':''}">Model</button>` : ''}
          <button class="tdd-preset-multi ${multi ? 'active' : ''}" onclick="event.stopPropagation();setMultiMode('${cid}',${!multi})">Multi</button>
        </div>
        <div class="tdd-cols-wrap${modCount ? ' has-model' : ''}">
          <div class="tdd-left-group">
          ${thyCount ? `<div class="tdd-col">
            <div class="tdd-col-head" style="color:var(--teal)">
              <span>Theory (${thyCount})</span>
              ${colToggle('theory', thy)}
            </div>
            <div class="tdd-col-scroll">${thy.map(e => opt(e, '#2dd4bf')).join('')}</div>
          </div>` : ''}
          ${revCount ? `<div class="tdd-col">
            <div class="tdd-col-head" style="color:#f97316">
              <span>Revision (${revCount})</span>
              ${colToggle('revision', rev)}
            </div>
            <div class="tdd-col-scroll">${rev.map(e => opt(e, '#f97316')).join('')}</div>
          </div>` : ''}
          </div>
          ${modCount ? `<div class="tdd-col tdd-model-col"><div class="tdd-col-head" style="color:#818cf8"><span>Model (${modCount})</span>${colToggle('model', mod)}</div><div class="tdd-col-scroll">${mod.map(e=>opt(e,'#818cf8')).join('')}</div></div>` : ''}
        </div>
        <div class="tdd-footer">
          <span class="tdd-footer-count">${footerText}</span>
        </div>`;

      const newScrollEls = panel.querySelectorAll('.tdd-col-scroll');
      prevScrolls.forEach((pos, i) => { if (newScrollEls[i]) newScrollEls[i].scrollTop = pos; });
    }

    function applyPreset(cid, mode) {

      TDD_MULTI[cid] = true;
      TDD_CONFIGS[cid].set({ mode });
      buildOneDropdown(cid);
    }

    function soloExam(cid, examId, ev, closeAfter) {
      if (ev) ev.stopPropagation();
      TDD_MULTI[cid] = false;
      TDD_CONFIGS[cid].set({ mode: 'custom', ids: new Set([examId]) });
      buildOneDropdown(cid);
      if (closeAfter) closeAllDropdowns();
    }

    function toggleExamInSel(cid, examId, ev) {
      if (ev) ev.stopPropagation();
      const sel = TDD_CONFIGS[cid].get();
      const allIds = EXAMS.map(e => e.id);

      let ids = new Set(resolveExamIds(sel));
      if (ids.has(examId)) ids.delete(examId);
      else ids.add(examId);
      const _snap=ids=>{
        if(ids.size===EXAMS.length)return 'all';
        for(const m of['theory','revision']){const g=EXAMS.filter(e=>e.type===m);if(g.length&&ids.size===g.length&&g.every(e=>ids.has(e.id)))return m;}
        const mg=EXAMS.filter(e=>isModelType(e.type));if(mg.length&&ids.size===mg.length&&mg.every(e=>ids.has(e.id)))return 'model';
        return null;
      };
      const snap=_snap(ids);
      TDD_CONFIGS[cid].set(snap?{mode:snap}:{mode:'custom',ids});
      buildOneDropdown(cid);
    }

    function toggleTypeInSel(cid, type, ev) {
      if (ev) ev.stopPropagation();
      const sel=TDD_CONFIGS[cid].get();
      const typeExams=type==='model'?EXAMS.filter(e=>isModelType(e.type)).map(e=>e.id):EXAMS.filter(e=>e.type===type).map(e=>e.id);
      let ids=new Set(resolveExamIds(sel));
      const allOn=typeExams.every(id=>ids.has(id));
      if(allOn)typeExams.forEach(id=>ids.delete(id));else typeExams.forEach(id=>ids.add(id));
      const _snap2=ids=>{
        if(ids.size===EXAMS.length)return 'all';
        for(const m of['theory','revision']){const g=EXAMS.filter(e=>e.type===m);if(g.length&&ids.size===g.length&&g.every(e=>ids.has(e.id)))return m;}
        const mg=EXAMS.filter(e=>isModelType(e.type));if(mg.length&&ids.size===mg.length&&mg.every(e=>ids.has(e.id)))return 'model';
        return null;
      };
      const snap=_snap2(ids);
      TDD_CONFIGS[cid].set(snap?{mode:snap}:{mode:'custom',ids});
      buildOneDropdown(cid);
    }

    function toggleDropdown(cid, ev) {
      if (ev) ev.stopPropagation();
      const btn = document.getElementById(cid + '-btn');
      const panel = document.getElementById(cid + '-panel');
      if (!btn || !panel) return;
      const wasOpen = panel.classList.contains('open');
      closeAllDropdowns();
      if (!wasOpen) {
        const rect = btn.getBoundingClientRect();
        const rev = EXAMS.filter(e => e.type === 'revision').length;
        const thy = EXAMS.filter(e => e.type === 'theory').length;
        const mod = EXAMS.filter(e => isModelType(e.type)).length;
        const colCount = mod > 0 ? 2 : ((thy > 0 ? 1 : 0) + (rev > 0 ? 1 : 0)) || 1;
        const isMobile = window.innerWidth <= 768;
        const rowH = 38, headH = 32, presetsH = 44, footerH = 38;

        let colH;
        if (isMobile) {
          const leftH = (thy > 0 ? Math.min(thy * rowH, 120) + headH : 0) + (rev > 0 ? Math.min(rev * rowH, 120) + headH : 0);
          const rightH = mod > 0 ? Math.min(mod * rowH, 280) + headH : 0;
          colH = Math.min(Math.max(leftH, rightH, 80), window.innerHeight * 0.52);
        } else {
          colH = Math.min(Math.max(rev, thy, mod, 1) * rowH + headH, 300);
        }
        const totalH = presetsH + colH + footerH;

        const colW = isMobile ? window.innerWidth - 16 : Math.min(Math.max(colCount * 190, 320), window.innerWidth - 32);
        const W = colW;
        const spaceB = window.innerHeight - rect.bottom - 8;
        const top = spaceB >= totalH ? rect.bottom + 4 : Math.max(8, rect.top - totalH - 4);

        const left = Math.max(8, Math.min(rect.left, window.innerWidth - W - 8));
        panel.style.cssText = `top:${top}px;left:${left}px;width:${W}px;height:${totalH}px`;
        panel.classList.add('open');
        btn.classList.add('open');
      }
    }

    function closeAllDropdowns() {
      document.querySelectorAll('.tdd-panel.open').forEach(p => p.classList.remove('open'));
      document.querySelectorAll('.tdd-btn.open').forEach(b => b.classList.remove('open'));
    }

    const RANK_CI = 1.28;
    let _examStats = {};
    let _ebParams = { tau_sq: 0.25, sigma_sq: 1.0 };

    function buildExamStats() {
      _examStats = {};
      EXAMS.forEach(e => {
        const m = e.students.map(s => s.marks);
        if (!m.length) return;
        const mean = m.reduce((a, b) => a + b, 0) / m.length;
        const stdev = Math.sqrt(m.reduce((s, v) => s + (v - mean) ** 2, 0) / m.length) || 1;
        _examStats[e.id] = { mean, stdev };
      });
      buildEmpiricalBayesParams();
    }

    function buildEmpiricalBayesParams() {

      const map = {};
      ALL.forEach(r => {
        const key = r.name + '||' + r.school;
        if (!map[key]) map[key] = {};
        const ek = r.exam_id;
        const z = examZ(r.exam_id, r.marks);
        if (!(ek in map[key]) || r.marks > map[key][ek].marks) {
          map[key][ek] = { marks: r.marks, z };
        }
      });
      const groups = Object.values(map)
        .map(em => Object.values(em).map(e => e.z))
        .filter(zs => zs.length >= 3);

      if (groups.length < 3) return;

      let varSum = 0;
      groups.forEach(zs => {
        const mu = zs.reduce((a, b) => a + b, 0) / zs.length;
        varSum += zs.reduce((s, z) => s + (z - mu) ** 2, 0) / zs.length;
      });
      const sigma_sq = Math.max(0.1, varSum / groups.length);

      const means = groups.map(zs => zs.reduce((a, b) => a + b, 0) / zs.length);
      const grandMean = means.reduce((a, b) => a + b, 0) / means.length;
      const obsVar = means.reduce((s, m) => s + (m - grandMean) ** 2, 0) / means.length;
      const avgN = groups.reduce((s, zs) => s + zs.length, 0) / groups.length;
      const tau_sq = Math.max(0.05, obsVar - sigma_sq / avgN);

      _ebParams = { tau_sq, sigma_sq };
    }

    function examZ(examId, mark) {
      const st = _examStats[examId];
      if (!st) return 0;
      return (mark - st.mean) / st.stdev;
    }
    function zToRating(z) { return Math.round(Math.min(100, Math.max(0, 50 + z * 15)) * 100) / 100; }
    function _ns(s) { return String(s).replace(/\\/g, '\\\\').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '\\n'); }

    function computePosterior(zList) {
      const N = zList.length;
      if (N === 0) return { mu_post: 0, sig_post: 1, skillZ: -2, rating: 0, meanRating: 0 };
      const { tau_sq, sigma_sq } = _ebParams;
      const z_mean = zList.reduce((a, b) => a + b, 0) / N;
      const k = sigma_sq / tau_sq;
      const mu_post = z_mean * N / (N + k);
      const sig_post = Math.sqrt(sigma_sq * tau_sq / (N * tau_sq + sigma_sq));
      const skillZ = mu_post - RANK_CI * sig_post;
      return {
        mu_post, sig_post, skillZ,
        rating: zToRating(skillZ),
        meanRating: zToRating(mu_post),
      };
    }

    function deduplicateStudents(arr) {
      const m = {};
      arr.forEach(s => {
        const k = s.name + '\x00' + s.school;
        if (!m[k] || s.marks > m[k].marks) m[k] = s;
      });
      return Object.values(m);
    }

    function deduplicateRows(rows) {

      const examMap = {};
      rows.forEach(r => {
        if (!examMap[r.exam_id] || r.marks > examMap[r.exam_id].marks) {
          examMap[r.exam_id] = r;
        }
      });
      return Object.values(examMap);
    }

    function aggregateByStudent(data) {
      const map = {};
      data.forEach(r => {
        const key = r.name + '||' + r.school;
        if (!map[key]) map[key] = { name: r.name, school: r.school, gender: r.gender, rows: [] };
        map[key].rows.push(r);
      });
      return Object.values(map).map(s => {
        const rows = deduplicateRows(s.rows);
        const mList = rows.map(r => r.marks);
        const zList = rows.map(r => examZ(r.exam_id, r.marks));
        const rawAvg = mList.reduce((a, b) => a + b, 0) / mList.length;
        const z_mean = zList.reduce((a, b) => a + b, 0) / zList.length;
        const N = rows.length;

        const post = computePosterior(zList);

        return {
          name: s.name, school: s.school, gender: s.gender,
          marks: parseFloat(rawAvg.toFixed(1)),
          rating: post.rating, skillZ: post.skillZ,
          best: Math.max(...mList),
          rank: Math.min(...rows.map(r => r.rank)),
          tests: N,
          examList: rows.map(r => ({ label: r.exam_label, marks: r.marks, rank: r.rank, z: examZ(r.exam_id, r.marks) }))
        };
      });
    }

    function getTopByAverage(data, n = 3) {
      return aggregateByStudent(data).sort((a, b) => b.skillZ - a.skillZ).slice(0, n);
    }

    function getRankTier(rank, total) {
      if (rank === 1) return { tier: 1, icon: '<i class="ph ph-medal" style="color:#ffd700"></i>', label: 'Rank #1', tierClass: 'rank-tier-1' };
      if (rank <= 3) return { tier: 1, icon: '<i class="ph ph-trophy" style="color:var(--amber)"></i>', label: 'Top 3', tierClass: 'rank-tier-1' };
      if (rank <= 10) return { tier: 2, icon: '<i class="ph ph-star" style="color:var(--amber)"></i>', label: 'Top 10', tierClass: 'rank-tier-2' };
      if (rank <= 25) return { tier: 2, icon: '🔥', label: 'Top 25', tierClass: 'rank-tier-2' };
      const pct = total > 0 ? (rank / total) * 100 : 100;
      if (pct <= 10) return { tier: 3, icon: '💎', label: 'Top 10%', tierClass: 'rank-tier-3' };
      if (pct <= 25) return { tier: 4, icon: '🌟', label: 'Top 25%', tierClass: 'rank-tier-4' };
      if (pct <= 50) return { tier: 5, icon: '<i class="ph ph-trend-up" style="color:var(--teal)"></i>', label: 'Top Half', tierClass: 'rank-tier-5' };
      return { tier: 6, icon: '<i class="ph ph-chart-bar" style="color:var(--text2)"></i>', label: 'Ranked', tierClass: 'rank-tier-6' };
    }

    function toggleSchoolsExpand() {
      _schoolsExpanded = !_schoolsExpanded;
      const btn = document.getElementById('schools-expand-btn');
      const label = document.getElementById('schools-expand-label');
      btn.classList.toggle('expanded', _schoolsExpanded);
      label.textContent = _schoolsExpanded ? 'Show less' : 'Show more';
      document.querySelectorAll('.schools-bar-hidden').forEach(el => {
        el.classList.toggle('visible-mobile', _schoolsExpanded);
      });
    }

    function renderOverviewStats() {
      if (!EXAMS.length) { document.getElementById('overview-stats').innerHTML = ''; return; }
      const total = ALL.length;
      const unique = new Set(ALL.map(r => r.name + '||' + r.school)).size;
      const avg = total ? (ALL.reduce((s, r) => s + r.marks, 0) / total).toFixed(1) : 0;
      const top = total ? Math.max(...ALL.map(r => r.marks)) : 0;
      const revs=EXAMS.filter(x=>x.type==='revision').length;
      const thys=EXAMS.filter(x=>x.type==='theory').length;
      const mods=EXAMS.filter(x=>isModelType(x.type)).length;
      const testSub=mods?`${thys} theory · ${revs} revision · ${mods} model`:`${thys} theory · ${revs} revision`;
      const cards = [
        { label: 'Tests Loaded', value: EXAMS.length, color: 'amber', sub: testSub },
        { label: 'Total Entries', value: total, color: 'blue', sub: 'across all tests', fmt: true },
        { label: 'Unique Students', value: unique, color: 'teal', sub: 'name + school', fmt: true },
        { label: 'Schools', value: SCHOOLS.length, color: 'pink', sub: 'participating' },
        { label: 'Average Score', value: avg, color: 'amber', sub: 'all tests combined' },
      ];
      document.getElementById('overview-stats').innerHTML = cards.map((c, i) => `
        <div class="stat-card">
          <div class="stat-label">${c.label}</div>
          <div class="stat-value ${c.color}" data-target="${c.value}" style="animation-delay:${i * 60}ms">${c.fmt ? c.value.toLocaleString() : c.value}</div>
          <div class="stat-sub">${c.sub}</div>
        </div>`).join('');
      animateCounters();
    }

    function animateCounters() {
      document.querySelectorAll('.stat-value[data-target]').forEach(el => {
        const target = parseFloat(el.dataset.target);
        if (isNaN(target) || target < 10) return;
        const isFloat = String(target).includes('.');
        const dur = 900, start = performance.now(), from = target * 0.3;
        function step(now) {
          const p = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          const v = from + (target - from) * ease;
          el.textContent = isFloat ? v.toFixed(1) : Math.round(v).toLocaleString();
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = isFloat ? target.toFixed(1) : target.toLocaleString();
        }
        requestAnimationFrame(step);
      });
    }

    function renderPodium() {
      const wrap = document.getElementById('podium-wrap');
      if (!EXAMS.length) { wrap.innerHTML = '<div class="empty"><i class="ph ph-trophy empty-icon" style="font-size:32px;color:var(--text3)"></i><span>No data</span></div>'; return; }
      const sel = podiumTestSel;
      const isAvg = isAgg(sel);
      let top3;
      if (isAvg) {
        top3 = getTopByAverage(getRowsForSel(sel), 3);
      } else {
        const eid = resolveExamIds(sel)[0];
        const exam = EXAMS.find(x => x.id === eid);
        if (!exam) { wrap.innerHTML = '<div class="empty"><i class="ph ph-trophy empty-icon" style="font-size:32px;color:var(--text3)"></i><span>No data</span></div>'; return; }
        top3 = deduplicateStudents([...exam.students]).sort((a, b) => b.marks - a.marks).slice(0, 3);
      }
      if (!top3.length) { wrap.innerHTML = '<div class="empty"><i class="ph ph-trophy empty-icon" style="font-size:32px;color:var(--text3)"></i><span>No data</span></div>'; return; }
      const order = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
      const medals = ['<i class="ph ph-medal" style="color:#C0C0C0"></i>', '<i class="ph ph-medal" style="color:#ffd700"></i>', '<i class="ph ph-medal" style="color:#CD7F32"></i>'];
      const ini = n => (n || '').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
      wrap.innerHTML = `
        <div class="podium">
          ${order.map((s, i) => `
            <div class="podium-slot" onclick="navToStudent('${_ns(s.name)}','${_ns(s.school)}')">
              <div class="podium-avatar">${ini(s.name)}</div>
              <div class="podium-name">${s.name}</div>
              <div class="podium-school">${s.school}</div>
              <div class="podium-marks">${isAvg ? s.marks.toFixed(1) : s.marks}</div>
              ${isAvg ? `<div class="podium-rating-badge">⬡ ${s.rating.toFixed(2)}</div>` : ''}
              <div class="podium-rank">${medals[i]}${isAvg && s.tests ? `<span style="margin-left:5px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:inline-block;vertical-align:middle">${s.tests} tests</span>` : ''}</div>
              <div class="podium-bar"></div>
            </div>`).join('')}
        </div>`;
    }

    function renderDistribution() {
      let data;
      const sel = podiumTestSel;
      if (isAgg(sel)) {
        data = getRowsForSel(sel);
        document.getElementById('dist-label').textContent = selLabel(sel);
      } else {
        const exam = EXAMS.find(x => x.id === resolveExamIds(sel)[0]);
        data = exam ? exam.students : ALL;
        document.getElementById('dist-label').textContent = exam ? exam.label : '';
      }
      const STEP = 5; const bins = {};
      const minScore = data.length ? Math.floor(Math.min(...data.map(r => r.marks)) / STEP) * STEP : 0;
      const startBin = Math.min(minScore, 40);
      for (let i = startBin; i <= 100; i += STEP) bins[i] = 0;
      data.forEach(r => { const b = Math.floor(r.marks / STEP) * STEP; if (b in bins) bins[b]++; else if (b < startBin) bins[startBin]++; });
      const maxV = Math.max(...Object.values(bins));
      const colors = ['#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#f97316', '#fb923c', '#fbbf24', '#f59e0b', '#d97706'];
      let ci = 0;
      document.getElementById('dist-histogram').innerHTML = Object.entries(bins).map(([s, count]) => {
        const pct = maxV > 0 ? count / maxV * 100 : 0;
        const col = colors[ci++ % colors.length];
        return `<div class="hist-bar" style="height:${Math.max(pct, 2)}%;background:${col}20;border:1px solid ${col}40">
          <div class="hist-tooltip">${s}–${+s + STEP - 1}: ${count}</div></div>`;
      }).join('');
      const marks = data.map(r => r.marks);
      if (marks.length) {
        document.getElementById('dist-min').textContent = Math.min(...marks);
        document.getElementById('dist-max').textContent = Math.max(...marks);
      }
    }

    function renderTopSchoolsBars() {

      const mode = dashTestSel.mode;
      const filtered = mode === 'all' ? ALL
        : mode === 'model' ? ALL.filter(r => isModelType(r.exam_type))
        : ALL.filter(r => r.exam_type === mode);

      const schoolMap = {};
      filtered.forEach(r => {
        if (!r.school) return;
        if (!schoolMap[r.school]) schoolMap[r.school] = {};
        const key = r.name;
        if (!schoolMap[r.school][key] || r.marks > schoolMap[r.school][key]) schoolMap[r.school][key] = r.marks;
      });
      const TOP_N = 5;
      const eliteScores = Object.entries(schoolMap).map(([sch, stuMap]) => {
        const sorted = Object.values(stuMap).sort((a, b) => b - a);
        const elite = sorted.slice(0, TOP_N).reduce((a, b) => a + b, 0) / Math.min(TOP_N, sorted.length);
        return [sch, +elite.toFixed(1)];
      }).sort((a, b) => b[1] - a[1]).slice(0, 12);

      const max = eliteScores[0]?.[1] || 1;
      const cols = ['#f59e0b', '#60a5fa', '#2dd4bf', '#f472b6', '#818cf8', '#34d399', '#fb923c', '#a78bfa', '#fb7185', '#38bdf8', '#2dd4bf', '#e879f9'];
      const ALWAYS_SHOW = 5;

      const labelEl = document.getElementById('dash-schools-filter-label');
      if (labelEl) {
        labelEl.textContent = mode === 'all' ? 'All Tests' : mode === 'theory' ? 'Theory' : mode === 'revision' ? 'Revision' : 'Model';
      }

      document.getElementById('top-schools-bar').innerHTML = eliteScores.map(([sch, score], i) => `
        <div class="score-bar${i >= ALWAYS_SHOW ? ' schools-bar-hidden' : ''}">
          <div class="score-bar-label" title="${sch}">${sch}</div>
          <div class="score-bar-track"><div class="score-bar-fill" style="width:${score / max * 100}%;background:${cols[i % cols.length]}"></div></div>
          <div class="score-bar-val">${score}</div>
        </div>`).join('');
      const btn = document.getElementById('schools-expand-btn');
      if (btn) btn.style.display = eliteScores.length > ALWAYS_SHOW ? 'flex' : 'none';
    }

    function renderTestsChart() {
      const ctx = document.getElementById('tests-chart')?.getContext('2d');
      if (!ctx || !EXAMS.length) return;
      if (CHARTS.tests) CHARTS.tests.destroy();

      const CHART_TYPE_ORDER = { theory: 0, revision: 1, model_theory: 2, model_revision: 3 };
      const orderedExams = EXAMS.slice().sort((a, b) => {
        const ao = CHART_TYPE_ORDER[a.type] ?? 9, bo = CHART_TYPE_ORDER[b.type] ?? 9;
        if (ao !== bo) return ao - bo;
        return (a.number || 0) - (b.number || 0);
      });
      const labels = orderedExams.map(e => e.label);
      const avgs = orderedExams.map(e => { const m = e.students.map(s => s.marks); return m.length ? (m.reduce((a, b) => a + b) / m.length).toFixed(1) : 0; });
      const counts = orderedExams.map(e => e.students.length);
      CHARTS.tests = new Chart(ctx, {
        type: 'bar', data: {
          labels, datasets: [
            { label: 'Avg Score', data: avgs, backgroundColor: orderedExams.map(e=>typeColorRgba(e.type,.4)), borderColor: orderedExams.map(e=>typeColor(e.type)), borderWidth: 1, borderRadius: 3, yAxisID: 'y' },
            { label: 'Students', data: counts, borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,.1)', type: 'line', pointRadius: 3, fill: true, tension: .3, yAxisID: 'y1' }
          ]
        }, options: cOpts({ dual: true })
      });
      setChartScrollWidth('tests-chart-wrap', EXAMS.length);
    }

    function setTop10Sort(field) {
      top10SortField = field;
      syncTop10Btns(); renderTop10();
    }
    function syncTop10Btns() {
      document.getElementById('t10-rank-btn')?.classList.toggle('active', top10SortField === 'rank');
      document.getElementById('t10-avg-btn')?.classList.toggle('active', top10SortField === 'avg');

      document.getElementById('t10-rank-btn')?.classList.toggle('t10-seg-opt', true);
      document.getElementById('t10-avg-btn')?.classList.toggle('t10-seg-opt', true);
    }

    function renderTop10() {
      const sel = top10TestSel;
      const isAggr = isAgg(sel);
      let rows;
      if (isAggr) {
        rows = getTopByAverage(getRowsForSel(sel), 200);
        if (top10SortField === 'avg') rows.sort((a, b) => b.marks - a.marks);
        else rows.sort((a, b) => b.rating - a.rating);
      } else {
        const eid = resolveExamIds(sel)[0];
        const exam = EXAMS.find(x => x.id === eid);
        if (!exam) { document.getElementById('top10-table').innerHTML = '<div class="empty"><i class="ph ph-clipboard-text empty-icon" style="font-size:32px;color:var(--text3)"></i><span>No data</span></div>'; return; }
        rows = deduplicateStudents([...exam.students]).sort((a, b) => b.marks - a.marks);
      }
      if (rows.length > 10) {
        const scoreKey = r => isAggr ? (top10SortField === 'avg' ? r.marks : r.rating) : r.marks;
        const boundary = scoreKey(rows[9]);
        rows = rows.filter((r, i) => i < 10 || scoreKey(r) === boundary);
      }
      document.getElementById('top10-table').innerHTML = buildTop10Table(rows, isAggr);
    }

    function buildTop10Table(data, isAll) {
      if (!data.length) return '<div class="empty"><div class="empty-icon">📭</div>No results</div>';
      const scoreKey = r => isAll ? (top10SortField === 'avg' ? r.marks : r.rating) : r.marks;
      const ratingActive = isAll && top10SortField === 'rank';
      const avgActive    = isAll && top10SortField === 'avg';
      const arr = a => `<span class="th-arrow"><i class="ph ${a ? 'ph-caret-down' : 'ph-caret-up-down'}"></i></span>`;

      const sortAttr = isAll ? `data-sort="${top10SortField === 'avg' ? 'avg' : 'rating'}"` : '';
      let h = `<table ${sortAttr}><thead><tr>
        <th style="cursor:pointer;padding-left:16px" onclick="setTop10Sort('rank')" class="${ratingActive ? 'sorted' : ''}">#${isAll ? arr(ratingActive) : ''}</th>
        <th>Name</th>
        ${isAll ? `<th class="col-t10-rating" style="cursor:pointer" onclick="setTop10Sort('rank')" class="${ratingActive ? 'sorted' : ''}">Rating ${arr(ratingActive)}</th>` : ''}
        <th class="col-t10-avg" onclick="setTop10Sort('avg')" style="cursor:pointer" class="${avgActive ? 'sorted' : ''}">${isAll ? 'Avg' : 'Score'} ${arr(avgActive)}</th>
        <th>School</th>
      </tr></thead><tbody>`;
      let tieRank = 1;
      data.forEach((r, i) => {
        if (i > 0 && scoreKey(r) !== scoreKey(data[i - 1])) tieRank = i + 1;
        const medal = tieRank === 1 ? '<i class="ph ph-medal" style="color:#ffd700"></i>' : tieRank === 2 ? '<i class="ph ph-medal" style="color:#C0C0C0"></i>' : tieRank === 3 ? '<i class="ph ph-medal" style="color:#CD7F32"></i>' : '';
        const gold = tieRank <= 3 ? 'class="row-gold"' : '';
        const rankColor = tieRank <= 3 ? 'var(--amber)' : 'var(--text3)';
        const ratingCol = isAll ? (r.rating >= 60 ? 'var(--blue)' : r.rating >= 45 ? 'var(--amber)' : 'var(--pink)') : '';
        h += `<tr ${gold}>
          <td class="td-rank" style="color:${rankColor}">${medal || tieRank}</td>
          <td class="td-name" onclick="navToStudent('${_ns(r.name)}','${_ns(r.school)}')">${r.name}</td>
          ${isAll ? `<td class="td-rating col-t10-rating" style="color:${ratingCol}">${r.rating.toFixed(2)}</td>` : ''}
          <td class="${isAll ? 'td-avg col-t10-avg' : 'td-marks'}">${isAll ? parseFloat(r.marks.toFixed(1)) : r.marks}</td>
          <td class="td-school">${r.school}</td>
        </tr>`;
      });
      return h + '</tbody></table>';
    }

    function syncTestsFilterBtns(){
      const b=document.getElementById('ft-model');
      if(b)b.style.display=EXAMS.some(e=>isModelType(e.type))?'':'none';
    }
    let testsFilter = 'all';
    function filterTests(type, btn) {
      testsFilter = type;
      const typeColors = { theory:'var(--teal)', revision:'var(--amber)', model:'#818cf8' };
      const typeBorders = { theory:'rgba(45,212,191,.3)', revision:'rgba(232, 160, 32,.3)', model:'rgba(129,140,248,.35)' };
      document.querySelectorAll('#page-tests .filter-btn').forEach(b => {
        b.classList.remove('active');

        const bid = b.id?.replace('ft-','');
        if (typeColors[bid]) { b.style.color = typeColors[bid]; b.style.borderColor = typeBorders[bid]; b.style.background = ''; }
        else { b.style.color = ''; b.style.borderColor = ''; b.style.background = ''; }
      });
      btn.classList.add('active');

      if (typeColors[type]) {
        btn.style.color = typeColors[type];
        btn.style.borderColor = typeColors[type];
        btn.style.background = (type==='theory'?'rgba(45,212,191,.12)':type==='revision'?'rgba(249,115,22,.1)':'rgba(129,140,248,.12)');
      }
      renderTestsGrid();
    }

    function renderTestsGrid() {
      const grid = document.getElementById('tests-grid');
      if (!EXAMS.length) { grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📂</div>Run parse_results.py first</div>'; return; }
      const baseList=testsFilter==='all'?EXAMS:testsFilter==='model'?EXAMS.filter(e=>isModelType(e.type)):EXAMS.filter(e=>e.type===testsFilter);

      const GRID_TYPE_ORDER = { model_theory: 0, model_revision: 0, revision: 1, theory: 2 };
      const list = baseList.slice().sort((a, b) => {
        const ao = GRID_TYPE_ORDER[a.type] ?? 9, bo = GRID_TYPE_ORDER[b.type] ?? 9;
        if (ao !== bo) return ao - bo;
        return (b.number || 0) - (a.number || 0);
      });
      grid.innerHTML = list.map(exam => {
        const m = exam.students.map(s => s.marks);
        const avg = m.length ? (m.reduce((a, b) => a + b) / m.length).toFixed(1) : 0;
        const top = m.length ? Math.max(...m) : 0;
        const schools = new Set(exam.students.map(s => s.school)).size;
        return `<div class="test-card ${exam.type}" onclick="openTestModal('${esc(exam.id)}')">
          <div class="test-card-type">${typeLabel(exam.type)}</div>
          <div class="test-card-title">${exam.label}</div>
          <div class="test-card-stats">
            <div class="test-stat"><strong>${exam.students.length}</strong>Students</div>
            <div class="test-stat"><strong>${avg}</strong>Avg</div>
            <div class="test-stat"><strong>${top}</strong>Top</div>
            <div class="test-stat"><strong>${schools}</strong>Schools</div>
          </div></div>`;
      }).join('');
    }

    function openTestModal(id) {
      const exam = EXAMS.find(x => x.id === id);
      if (!exam) return;
      const m = exam.students.map(s => s.marks);
      const avg = (m.reduce((a, b) => a + b, 0) / m.length).toFixed(1);
      const top3 = deduplicateStudents([...exam.students]).sort((a, b) => b.marks - a.marks).slice(0, 3);
      const schools = {};
      exam.students.forEach(s => { schools[s.school] = (schools[s.school] || 0) + 1; });
      const topSch = Object.entries(schools).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const boys = exam.students.filter(s => s.gender === GEN_MALE).length;
      const girls = exam.students.filter(s => s.gender === GEN_FEMALE).length;
      document.getElementById('modal-title').textContent = exam.label;
      document.getElementById('modal-body').innerHTML = `
        <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px">
          <div class="stat-card"><div class="stat-label">Students</div><div class="stat-value amber">${exam.students.length}</div></div>
          <div class="stat-card"><div class="stat-label">Average</div><div class="stat-value teal">${avg}</div></div>
          <div class="stat-card"><div class="stat-label">Top Score</div><div class="stat-value blue">${Math.max(...m)}</div></div>
          <div class="stat-card"><div class="stat-label">Schools</div><div class="stat-value pink">${Object.keys(schools).length}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px">
          <div>
            <div class="card-title" style="margin-bottom:12px">Top 3</div>
            ${top3.map((s, i) => `<div class="score-bar">
              <div class="score-bar-label">${['<i class="ph ph-medal" style="color:#ffd700"></i>', '<i class="ph ph-medal" style="color:#C0C0C0"></i>', '<i class="ph ph-medal" style="color:#CD7F32"></i>'][i]} ${s.name}</div>
              <div class="score-bar-track"><div class="score-bar-fill" style="width:${s.marks}%;background:${['#e8a020', '#60a5fa', '#2dd4bf'][i]}"></div></div>
              <div class="score-bar-val">${s.marks}</div></div>`).join('')}
          </div>
          <div>
            <div class="card-title" style="margin-bottom:12px">Top Schools</div>
            ${topSch.map(([s, c]) => `<div class="score-bar">
              <div class="score-bar-label">${s}</div>
              <div class="score-bar-track"><div class="score-bar-fill" style="width:${c / topSch[0][1] * 100}%;background:var(--amber)"></div></div>
              <div class="score-bar-val">${c}</div></div>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:20px">
          <div class="chip" style="color:var(--male)">Boys: <strong style="margin-left:4px">${boys}</strong></div>
          <div class="chip" style="color:var(--female)">Girls: <strong style="margin-left:4px">${girls}</strong></div>
        </div>
        ${(()=>{

          const STEP = 5;
          const modalMarks = exam.students.map(s => s.marks);
          const minScore = modalMarks.length ? Math.floor(Math.min(...modalMarks) / STEP) * STEP : 0;
          const startBin = Math.min(minScore, 40);
          const modalBins = {};
          for (let i = startBin; i <= 100; i += STEP) modalBins[i] = 0;
          modalMarks.forEach(mk => { const b = Math.floor(mk / STEP) * STEP; if (b in modalBins) modalBins[b]++; else if (b < startBin) modalBins[startBin]++; });
          const modalMaxV = Math.max(...Object.values(modalBins));
          const modalColors = ['#60a5fa','#818cf8','#a78bfa','#c084fc','#e879f9','#f472b6','#fb7185','#f97316','#fb923c','#fbbf24','#f59e0b','#d97706'];
          let mci = 0;
          const histHtml = Object.entries(modalBins).map(([s, count]) => {
            const pct = modalMaxV > 0 ? count / modalMaxV * 100 : 0;
            const col = modalColors[mci++ % modalColors.length];
            return `<div class="hist-bar" style="height:${Math.max(pct,2)}%;background:${col}20;border:1px solid ${col}40"><div class="hist-tooltip">${s}–${+s+STEP-1}: ${count}</div></div>`;
          }).join('');
          return `<div style="margin-bottom:20px">
            <div class="card-title" style="margin-bottom:10px">Score Distribution</div>
            <div class="histogram" style="height:110px">${histHtml}</div>
            <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text3);display:flex;justify-content:space-between;margin-top:4px">
              <span>${Math.min(...modalMarks)}</span><span>score range</span><span>${Math.max(...modalMarks)}</span>
            </div>
          </div>`;
        })()}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title">Top 10</div>
          <button onclick="openLeaderboardForTest('${esc(exam.id)}')" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(232, 160, 32,.12);border:1px solid rgba(232, 160, 32,.35);border-radius:6px;color:var(--amber);font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.8px;cursor:pointer;transition:all .15s;text-transform:uppercase" onmouseenter="this.style.background='rgba(232, 160, 32,.2)'" onmouseleave="this.style.background='rgba(232, 160, 32,.12)'">Full Leaderboard ↗</button>
        </div>
        ${(()=>{
          const sortedS = deduplicateStudents([...exam.students]).sort((a,b)=>b.marks-a.marks);
          const rankMap = {};
          let tRank = 1;
          sortedS.forEach((s,i)=>{ if(i>0&&s.marks!==sortedS[i-1].marks) tRank=i+1; rankMap[s.name+'\x00'+s.school]=tRank; });

          const cutoffRank = rankMap[sortedS[Math.min(9, sortedS.length-1)].name+'\x00'+sortedS[Math.min(9, sortedS.length-1)].school] || 10;
          const top10WithTies = sortedS.filter(s => (rankMap[s.name+'\x00'+s.school] || 999) <= cutoffRank);
          return '<div class="table-wrap">' + buildTable(top10WithTies, { rowHighlight: 0, globalRanks: rankMap, useGlobalRank: true }) + '</div>';
        })()}`;
      openModal();
    }

    function goToLeaderboardFromTop10() {
      lbPage = 1;
      lbSortField = top10SortField === 'avg' ? 'marks' : 'rating';
      lbSortAsc = false;

      lbTestSel = { mode: dashTestSel.mode };
      location.hash = 'leaderboard';

      setTimeout(() => buildOneDropdown('lb-sel'), 80);
    }

    function openLeaderboardForTest(examId) {
      document.getElementById('modal-overlay').classList.remove('open');
      lbPage = 1;
      lbSortField = 'marks';
      lbSortAsc = false;
      location.hash = 'leaderboard';

      setTimeout(() => {
        TDD_CONFIGS['lb-sel'].set({ mode: 'custom', ids: new Set([examId]) });
        const label = document.getElementById('lb-sel-label');
        if (label) {
          const exam = EXAMS.find(x => x.id === examId);
          if (exam) label.textContent = exam.label;
        }
      }, 60);
    }

    function buildStuSchoolDropdown() {
      const wrap = document.getElementById('stu-school-wrap');
      if (!wrap) return;
      wrap.innerHTML = `<div class="tdd-btn" id="stu-school-btn" onclick="toggleStuSchoolDrop(event)">
        <span class="tdd-label" id="stu-school-label" style="min-width:90px">${stuSchool || 'All Schools'}</span>
        <span class="tdd-arrow">▾</span>
      </div>`;
      let panel = document.getElementById('stu-school-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'stu-school-panel';
        panel.className = 'school-dd-panel';
        document.body.appendChild(panel);
      }
    }

    function rebuildStuSchoolPanel(query) {
      const panel = document.getElementById('stu-school-panel');
      if (!panel) return;
      const q = (query || '').toLowerCase();
      const filtered = ['', ...SCHOOLS].filter(s => !q || (s || 'all schools').toLowerCase().includes(q));
      const listHtml = filtered.map(s => `
        <div class="school-dd-item ${stuSchool === s ? 'selected' : ''}" onclick="pickStuSchool('${esc(s)}')">
          <span class="school-dd-item-name">${s || 'All Schools'}</span>
          <span class="school-dd-check">✓</span>
        </div>`).join('') || '<div style="padding:10px 12px;font-family:DM Mono,monospace;font-size:10px;color:var(--text3)">No match</div>';
      let listEl = panel.querySelector('.school-dd-list');
      if (listEl) { listEl.innerHTML = listHtml; return; }
      panel.innerHTML = `
        <div class="school-dd-search">
          <div class="school-dd-search-wrap">
            <input id="stu-school-search" placeholder="Search school…"
              oninput="rebuildStuSchoolPanel(this.value)" autocomplete="off">
          </div>
        </div>
        <div class="school-dd-list">${listHtml}</div>`;
    }

    function toggleStuSchoolDrop(ev) {
      if (ev) ev.stopPropagation();
      const btn = document.getElementById('stu-school-btn');
      const panel = document.getElementById('stu-school-panel');
      if (!btn || !panel) return;
      const wasOpen = panel.classList.contains('open');
      closeAllDropdowns(); closeStuSchoolDrop(); closeSchoolDrop();
      if (!wasOpen) {
        panel.innerHTML = '';
        rebuildStuSchoolPanel('');
        const rect = btn.getBoundingClientRect();
        const W = Math.max(240, rect.width);
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - W - 8));
        const top = (window.innerHeight - rect.bottom - 8) >= 320 ? rect.bottom + 4 : Math.max(8, rect.top - 320 - 4);
        panel.style.cssText = `top:${top}px;left:${left}px;width:${W}px`;
        panel.classList.add('open');
        btn.classList.add('open');
        setTimeout(() => { document.getElementById('stu-school-search')?.focus(); }, 30);
      }
    }

    function closeStuSchoolDrop() {
      document.getElementById('stu-school-panel')?.classList.remove('open');
      document.getElementById('stu-school-btn')?.classList.remove('open');
    }

    function pickStuSchool(school) {
      stuSchool = school;
      const label = document.getElementById('stu-school-label');
      if (label) label.textContent = school || 'All Schools';
      document.querySelectorAll('#stu-school-panel .school-dd-item').forEach(item => {
        item.classList.toggle('selected', item.querySelector('.school-dd-item-name')?.textContent === (school || 'All Schools'));
      });
      searchStudents();
      closeStuSchoolDrop();
    }

    function buildSchoolDropdown() {
      const wrap = document.getElementById('lb-school-wrap');
      if (!wrap) return;
      wrap.innerHTML = `<div class="tdd-btn" id="lb-school-btn" onclick="toggleSchoolDrop(event)">
        <span class="tdd-label" id="lb-school-label" style="min-width:90px">${lbSchool || 'All Schools'}</span>
        <span class="tdd-arrow">▾</span>
      </div>`;
      let panel = document.getElementById('lb-school-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'lb-school-panel';
        panel.className = 'school-dd-panel';
        document.body.appendChild(panel);
      }
    }

    function rebuildSchoolPanel(query) {
      const panel = document.getElementById('lb-school-panel');
      if (!panel) return;
      const q = (query || '').toLowerCase();
      const allSchools = ['', ...SCHOOLS];
      const filtered = allSchools.filter(s => !q || (s || 'all schools').toLowerCase().includes(q));
      const listHtml = filtered.map(s => `
        <div class="school-dd-item ${lbSchool === s ? 'selected' : ''}" onclick="pickSchool('${esc(s)}')">
          <span class="school-dd-item-name">${s || 'All Schools'}</span>
          <span class="school-dd-check">✓</span>
        </div>`).join('') || '<div style="padding:10px 12px;font-family:DM Mono,monospace;font-size:10px;color:var(--text3)">No match</div>';

      let listEl = panel.querySelector('.school-dd-list');
      if (listEl) {
        listEl.innerHTML = listHtml;
        return;
      }

      panel.innerHTML = `
        <div class="school-dd-search">
          <div class="school-dd-search-wrap">
            <input id="lb-school-search" placeholder="Search school…"
              oninput="rebuildSchoolPanel(this.value)" autocomplete="off">
          </div>
        </div>
        <div class="school-dd-list">${listHtml}</div>`;
    }

    function toggleSchoolDrop(ev) {
      if (ev) ev.stopPropagation();
      const btn = document.getElementById('lb-school-btn');
      const panel = document.getElementById('lb-school-panel');
      if (!btn || !panel) return;
      const wasOpen = panel.classList.contains('open');
      closeAllDropdowns();
      closeSchoolDrop();
      if (!wasOpen) {
        panel.innerHTML = '';
        rebuildSchoolPanel('');
        const rect = btn.getBoundingClientRect();
        const W = Math.max(240, rect.width);
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - W - 8));
        const spaceB = window.innerHeight - rect.bottom - 8;
        const top = spaceB >= 320 ? rect.bottom + 4 : Math.max(8, rect.top - 320 - 4);
        panel.style.cssText = `top:${top}px;left:${left}px;width:${W}px`;
        panel.classList.add('open');
        btn.classList.add('open');
        setTimeout(() => { const inp = document.getElementById('lb-school-search'); if (inp) inp.focus(); }, 30);
      }
    }

    function closeSchoolDrop() {
      const panel = document.getElementById('lb-school-panel');
      const btn = document.getElementById('lb-school-btn');
      if (panel) panel.classList.remove('open');
      if (btn) btn.classList.remove('open');
    }

    function pickSchool(school) {
      lbSchool = school;
      const label = document.getElementById('lb-school-label');
      if (label) label.textContent = school || 'All Schools';

      const items = document.querySelectorAll('#lb-school-panel .school-dd-item');
      items.forEach(item => {
        const isSelected = item.querySelector('.school-dd-item-name')?.textContent === (school || 'All Schools');
        item.classList.toggle('selected', isSelected);
      });
      lbPage = 1;
      renderLeaderboard();
      closeSchoolDrop();
    }

    const PER_PAGE = 40;

    function setLbGender(g, btn) {
      lbGender = g;
      document.querySelectorAll('#lb-g-all,#lb-g-b,#lb-g-g').forEach(b => { b.classList.remove('active'); b.classList.add('t10-seg-opt'); });
      btn.classList.add('active');
      lbPage = 1; renderLeaderboard();
    }

    function setSort(field) {
      if (lbSortField === field) {
        lbSortAsc = !lbSortAsc;
      } else {
        lbSortField = field;

        lbSortAsc = false;
      }
      lbPage = 1; renderLeaderboard();
    }

    function renderLeaderboard() {
      const schF = lbSchool;
      const nameF = (document.getElementById('lb-name')?.value || '').toLowerCase();
      const sel = lbTestSel;
      const isAll = isAgg(sel);

      let singleExamGlobalRanks = {};
      if (!isAll) {
        const eid = resolveExamIds(sel)[0];
        const exam = EXAMS.find(x => x.id === eid);
        if (exam) {
          const uniq = deduplicateStudents([...exam.students]).sort((a, b) => b.marks - a.marks);
          let seRank = 1;
          uniq.forEach((s, i) => {
            if (i > 0 && s.marks !== uniq[i - 1].marks) seRank = i + 1;
            singleExamGlobalRanks[s.name + '\x00' + s.school] = seRank;
          });
        }
      }

      let raw = getRowsForSel(sel);
      if (schF) raw = raw.filter(r => r.school === schF);
      if (lbGender) raw = raw.filter(r => r.gender === lbGender);
      if (nameF) raw = raw.filter(r => r.name.toLowerCase().includes(nameF));

      let data;
      if (isAll) {
        data = aggregateByStudent(raw);
      } else {
        const dedupMap = {};
        raw.forEach(r => {
          const k = r.name + '\x00' + r.school;
          if (!dedupMap[k] || r.marks > dedupMap[k].marks) dedupMap[k] = r;
        });
        data = Object.values(dedupMap);
      }
      const _sf0 = isAll && (lbSortField === 'rank' || lbSortField === 'marks' || lbSortField === 'avg' || lbSortField === 'rating' || lbSortField === 'best' || lbSortField === 'name') ? lbSortField : (isAll ? 'rating' : lbSortField);
      const sf = (!isAll && _sf0 === 'rating') ? 'marks' : _sf0;
      data = [...data].sort((a, b) => {
        let v;
        if (sf === 'rating') v = (b.rating || 0) - (a.rating || 0);
        else if (sf === 'marks' || sf === 'avg') v = b.marks - a.marks;
        else if (sf === 'rank') v = (a.rank || 9999) - (b.rank || 9999);
        else if (sf === 'best') v = ((b.best || b.marks) - (a.best || a.marks));
        else v = (a[sf] || '').toString().localeCompare((b[sf] || '').toString());
        return lbSortAsc ? -v : v;
      });

      let displayRankMap = singleExamGlobalRanks;
      if (isAll) {
        const sortedForRank = [...aggregateByStudent(getRowsForSel(sel))].sort((a, b) => b.rating - a.rating);
        displayRankMap = {};
        let rk = 1;
        sortedForRank.forEach((s, i) => {
          if (i > 0 && s.rating !== sortedForRank[i - 1].rating) rk = i + 1;
          displayRankMap[s.name + '\x00' + s.school] = rk;
        });
      }

      const total = data.length, pages = Math.ceil(total / PER_PAGE) || 1;
      lbPage = Math.min(lbPage, pages);
      const slice = data.slice((lbPage - 1) * PER_PAGE, lbPage * PER_PAGE);
      const examLabel = isAll ? selLabel(sel) : (EXAMS.find(x => x.id === resolveExamIds(sel)[0])?.label || '');
      document.getElementById('lb-count').textContent = `${total.toLocaleString()} ${isAll ? 'students' : 'entries'}`;
      document.getElementById('lb-title').textContent = examLabel;
      document.getElementById('lb-table').innerHTML = buildTable(slice, { showExam: false, isAgg: isAll, rowHighlight: 3, globalRanks: displayRankMap, useGlobalRank: true });

      const pag = document.getElementById('lb-pager');
      if (pages <= 1) { pag.innerHTML = ''; return; }

      const spread = window.innerWidth < 480 ? 1 : 2;
      const pageNums = [];
      for (let p = Math.max(1, lbPage - spread); p <= Math.min(pages, lbPage + spread); p++) pageNums.push(p);
      let h = `<div class="pagination">`;
      h += `<div class="page-btns">`;
      h += `<button class="page-btn" onclick="lbPage=1;renderLeaderboard()" ${lbPage === 1 ? 'disabled' : ''}>«</button>`;
      h += `<button class="page-btn" onclick="lbPage--;renderLeaderboard()" ${lbPage <= 1 ? 'disabled' : ''}>‹</button>`;
      pageNums.forEach(p => h += `<button class="page-btn ${p === lbPage ? 'active' : ''}" onclick="lbPage=${p};renderLeaderboard()">${p}</button>`);
      h += `<button class="page-btn" onclick="lbPage++;renderLeaderboard()" ${lbPage >= pages ? 'disabled' : ''}>›</button>`;
      h += `<button class="page-btn" onclick="lbPage=${pages};renderLeaderboard()" ${lbPage === pages ? 'disabled' : ''}>»</button>`;
      h += `</div><div class="page-info">${lbPage} / ${pages}</div>`;
      pag.innerHTML = h + '</div>';
    }

    function buildTable(data, opts = {}) {
      if (!data.length) return '<div class="empty"><div class="empty-icon">📭</div>No results</div>';
      const { rowHighlight = 0, showExam = false, isAgg = false, isAvg = false, globalRanks = {}, useGlobalRank = false } = opts;

      const arr = active => `<span class="th-arrow"><i class="ph ${active ? (lbSortAsc ? 'ph-caret-up' : 'ph-caret-down') : 'ph-caret-up-down'}"></i></span>`;
      const sh = (f, lbl) => {
        const active = lbSortField === f;
        return `<th onclick="setSort('${f}')" class="${active ? 'sorted' : ''}">${lbl} ${arr(active)}</th>`;
      };
      let h = `<table><thead><tr>
        <th class="sorted-rank" style="padding-left:16px"># Rank</th>
        ${sh('name', 'Name')}
        ${isAgg ? sh('rating', 'Rating ⬡') : (isAvg ? sh('marks', 'Avg') : sh('marks', 'Marks'))}
        ${isAgg ? sh('marks', 'Avg') + `<th class="col-best" onclick="setSort('best')" class="${lbSortField==='best'?'sorted':''}">Best ${arr(lbSortField==='best')}</th>` + '<th class="col-tests">Tests</th>' : ''}
        ${sh('school', 'School')}
        <th class="col-gender">Gender</th>
        ${showExam ? '<th>Test</th>' : ''}
      </tr></thead><tbody>`;

      data.forEach((r, i) => {
        const gRankKey = r.name + '\x00' + r.school;
        const gRankVal = useGlobalRank ? (globalRanks[gRankKey] || (isAgg ? globalRank(r.name, r.school) : (r.rank || '—'))) : (i + 1);
        const numRank = typeof gRankVal === 'number' ? gRankVal : parseInt(gRankVal);
        const isTop3 = rowHighlight > 0 && numRank >= 1 && numRank <= 3;
        const medal = isTop3 ? (numRank === 1 ? '<i class="ph ph-medal" style="color:#ffd700"></i>' : numRank === 2 ? '<i class="ph ph-medal" style="color:#C0C0C0"></i>' : '<i class="ph ph-medal" style="color:#CD7F32"></i>') : '';
        const gold = isTop3 ? 'class="row-gold"' : '';
        const gBadge = r.gender === GEN_MALE ? `<span class="badge badge-b">Boy</span>` : r.gender === GEN_FEMALE ? `<span class="badge badge-g">Girl</span>` : '';
        const ratingCol = (r.rating || 0) >= 60 ? 'var(--blue)' : (r.rating || 0) >= 45 ? 'var(--amber)' : 'var(--pink)';
        h += `<tr ${gold}>
          <td class="td-rank" style="color:${isTop3 ? 'var(--amber)' : 'var(--text3)'};font-weight:${isTop3 ? 'bold' : 'normal'}">${medal || '#' + gRankVal}</td>
          <td class="td-name" onclick="navToStudent('${_ns(r.name)}','${_ns(r.school)}')">${r.name}</td>
          ${isAgg
            ? `<td class="td-rating" style="color:${ratingCol}">${r.rating.toFixed(2)}<span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text3);margin-left:3px">pts</span></td>
               <td class="td-avg">${r.marks}</td>
               <td class="td-marks col-best">${r.best}</td>
               <td class="td-school col-tests">${r.tests}</td>`
            : `<td class="${isAvg ? 'td-avg' : 'td-marks'}">${r.marks}</td>`}
          <td class="td-school">${r.school}</td>
          <td class="col-gender">${gBadge}</td>
          ${showExam ? `<td class="td-school">${r.exam_label || ''}</td>` : ''}
        </tr>`;
      });
      return h + '</tbody></table>';
    }

    function populateStudentFilters() {
      buildStuSchoolDropdown();
    }

    function setStuGender(g, btn) {
      stuGender = g;
      document.querySelectorAll('#stu-g-all,#stu-g-b,#stu-g-g').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      searchStudents();
    }

    let STU_REGISTRY = [];
    function buildStuRegistry() {
      const map = {};
      ALL.forEach(r => {
        const key = r.name + '\x00' + r.school;
        if (!map[key]) map[key] = { name: r.name, school: r.school, gender: r.gender, examMap: {} };

        const ek = r.exam_id;
        if (!map[key].examMap[ek] || r.marks > map[key].examMap[ek].marks) {
          map[key].examMap[ek] = { exam_id: r.exam_id, exam_label: r.exam_label, exam_type: r.exam_type, marks: r.marks, rank: r.rank };
        }
      });
      STU_REGISTRY = Object.values(map).map(s => ({ name: s.name, school: s.school, gender: s.gender, apps: Object.values(s.examMap) }));
    }

    function searchStudents() {
      const q = (document.getElementById('stu-search')?.value || '').toLowerCase().trim();
      const sch = stuSchool;
      document.getElementById('stu-grid').style.display = 'grid';
      document.getElementById('stu-profile').style.display = 'none';
      const fb = document.getElementById('stu-filter-bar');
      if (fb) fb.style.display = '';
      if (!q && !sch && !stuGender) {
        document.getElementById('stu-grid').innerHTML = '<div class="empty" style="grid-column:1/-1"><i class="ph ph-magnifying-glass empty-icon" style="font-size:32px;color:var(--text3)"></i><span>Type a name or pick a school</span></div>';
        return;
      }
      let students = STU_REGISTRY.map((s, i) => ({ ...s, idx: i }));
      if (q) students = students.filter(s => s.name.toLowerCase().includes(q));
      if (sch) students = students.filter(s => s.school === sch);
      if (stuGender) students = students.filter(s => s.gender === stuGender);
      students.sort((a, b) => a.name.localeCompare(b.name));
      const grid = document.getElementById('stu-grid');
      if (!students.length) { grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-icon">😞</div>No students found</div>'; return; }
      grid.innerHTML = students.slice(0, 60).map((s, cardIdx) => {
        const best = Math.max(...s.apps.map(a => a.marks));
        const avg = (s.apps.reduce((x, a) => x + a.marks, 0) / s.apps.length).toFixed(1);
        const ini = s.name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
        const gc = s.gender === GEN_MALE ? 'var(--male)' : s.gender === GEN_FEMALE ? 'var(--female)' : 'var(--text3)';
        const gRank = globalRank(s.name, s.school);
        const rankStr = typeof gRank === 'number' ? `#${gRank}` : '—';
        return `<div class="card" style="cursor:pointer;animation:cardIn .4s ease-out ${cardIdx * 30}ms both;position:relative"
          onclick="openStudentProfile(${s.idx})"
          onmouseenter="this.style.borderColor='var(--border2)';this.style.transform='translateY(-3px)'"
          onmouseleave="this.style.borderColor='var(--border)';this.style.transform=''">
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
              <div style="width:42px;height:42px;border-radius:50%;background:${gc}22;border:1.5px solid ${gc};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:18px;color:${gc}">${ini}</div>
              <div>
                <div style="font-weight:600;font-size:15px">${s.name}</div>
                <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text3)">${s.school}</div>
              </div>
              ${typeof gRank === 'number' ? `<div style="margin-left:auto;font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--amber)">${rankStr}</div>` : ''}
            </div>
            <div style="display:flex;gap:14px;align-items:center">
              <div class="test-stat"><strong style="color:var(--amber)">${best}</strong>Best</div>
              <div class="test-stat"><strong style="color:var(--teal)">${avg}</strong>Avg</div>
              <div class="test-stat"><strong>${s.apps.length}</strong>Tests</div>
              ${s.gender !== 'U' ? `<div class="test-stat"><i class="ph ${s.gender === GEN_MALE ? 'ph-gender-male' : 'ph-gender-female'}" style="color:${s.gender === GEN_MALE ? 'var(--male)' : 'var(--female)'}"></i></div>` : ''}
              <button style="margin-left:auto;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);cursor:pointer;letter-spacing:.5px;transition:all .15s"
                onclick="event.stopPropagation();toggleCompare(${s.idx})" id="cmp-btn-${s.idx}"
                onmouseenter="this.style.borderColor='var(--amber)';this.style.color='var(--amber)'"
                onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text3)'">+ Compare</button>
            </div>
          </div></div>`;
      }).join('');
      if (students.length > 60) grid.innerHTML += `<div class="empty" style="grid-column:1/-1;padding:16px">Showing 60 of ${students.length}  - refine your search</div>`;
    }

    function goBackFromProfile() {

      if (_profileStack.length > 0) {
        const prev = _profileStack.pop();
        openStudentProfile(prev.idx);
        return;
      }
      if (_navOrigin && _navOrigin.page !== 'students') {

        const origin = _navOrigin;
        _navOrigin = null;
        _suppressScrollReset = true;
        location.hash = origin.page;
        setTimeout(() => {
          window.scrollTo({ top: origin.scrollY, behavior: 'instant' });
        }, 220);
      } else {

        _navOrigin = null;
        document.getElementById('stu-filter-bar').style.display = '';
        document.getElementById('stu-grid').style.display = 'grid';
        document.getElementById('stu-profile').style.display = 'none';
      }
    }

    let _profileStack = [];

    function navToStudent(name, school) {
      document.getElementById('search-results').classList.remove('visible');
      document.getElementById('global-search').value = '';
      const idx = STU_REGISTRY.findIndex(s => s.name === name && s.school === school);
      if (idx < 0) return;

      const currentPage = location.hash.replace('#', '') || 'dashboard';
      const pageLabelMap = { dashboard: 'Dashboard', leaderboard: 'Leaderboard', tests: 'Tests', schools: 'Schools', analytics: 'Analytics', students: 'Student Search' };

      if (currentPage === 'students' && document.getElementById('stu-profile').style.display !== 'none') {

        _profileStack.push({ idx: _currentProfileIdx, scrollY: window.scrollY || document.documentElement.scrollTop });
        openStudentProfile(idx);
      } else {

        _profileStack = [];
        _navOrigin = {
          page: currentPage,
          scrollY: window.scrollY || document.documentElement.scrollTop,
          label: pageLabelMap[currentPage] || currentPage
        };
        if (currentPage !== 'students') {
          location.hash = 'students';
          setTimeout(() => { openStudentProfile(idx); }, 80);
        } else {
          openStudentProfile(idx);
        }
      }
    }

    let _currentProfileIdx = -1;

    function openStudentProfile(idxOrName, _legacySchool) {
      const fb = document.getElementById('stu-filter-bar');
      if (fb) fb.style.display = 'none';

      let stuData, apps, resolvedIdx;
      if (typeof idxOrName === 'number') {
        resolvedIdx = idxOrName;
        stuData = STU_REGISTRY[idxOrName];
        if (!stuData) return;
        apps = [...stuData.apps];
      } else {
        resolvedIdx = STU_REGISTRY.findIndex(s => s.name === idxOrName && s.school === _legacySchool);
        if (resolvedIdx < 0) return;
        stuData = STU_REGISTRY[resolvedIdx];
        apps = [...stuData.apps];
      }
      _currentProfileIdx = resolvedIdx;

      apps.sort((a, b) => {
        if(a.exam_type===b.exam_type)return a.exam_id.localeCompare(b.exam_id);
        return(TYPE_SORT[a.exam_type]??9)-(TYPE_SORT[b.exam_type]??9);
      });

      const marks = apps.map(a => a.marks);
      const best = Math.max(...marks);
      const worst = Math.min(...marks);
      const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
      const avgStr = avg.toFixed(1);
      const bestRank = Math.min(...apps.map(a => a.rank));
      const revApps=apps.filter(a=>a.exam_type==='revision');
      const thyApps=apps.filter(a=>a.exam_type==='theory');
      const modApps=apps.filter(a=>isModelType(a.exam_type));
      const revAvg=revApps.length?revApps.reduce((s,a)=>s+a.marks,0)/revApps.length:null;
      const thyAvg=thyApps.length?thyApps.reduce((s,a)=>s+a.marks,0)/thyApps.length:null;
      const modAvg=modApps.length?modApps.reduce((s,a)=>s+a.marks,0)/modApps.length:null;

      const zList = apps.map(a => examZ(a.exam_id, a.marks));
      const post = computePosterior(zList);
      const rating = post.rating;
      const meanRating = post.meanRating;

      const gRank = globalRank(stuData.name, stuData.school);
      const tRank=thyApps.length?thyRank(stuData.name,stuData.school):null;
      const rRank=revApps.length?revRank(stuData.name,stuData.school):null;
      const mRank=modApps.length?modRank(stuData.name,stuData.school):null;
      const totalStudents=Object.keys(_globalRankMap).length;
      const totalThy=Object.keys(_thyRankMap).length;
      const totalRev=Object.keys(_revRankMap).length;
      const totalMod=Object.keys(_modRankMap).length;
      const rankTierInfo = typeof gRank === 'number' ? getRankTier(gRank, totalStudents) : null;

      const stdDev = marks.length > 1 ? Math.sqrt(marks.reduce((s, m) => s + (m - avg) ** 2, 0) / marks.length) : 0;
      const consistency = marks.length > 1 ? Math.max(0, Math.round(100 - (stdDev / avg) * 100)) : 100;

      let trend = 0, trendLabel = 'Stable', trendColor = 'var(--text3)';
      if (marks.length >= 2) {
        const n = marks.length, xMean = (n - 1) / 2;
        const num = marks.reduce((s, m, i) => s + (i - xMean) * m, 0);
        const den = marks.reduce((s, _, i) => s + (i - xMean) ** 2, 0);
        trend = den ? num / den : 0;
        if (trend > 1.5) { trendLabel = '↗ Rising'; trendColor = '#2dd4bf'; }
        else if (trend > 0.3) { trendLabel = '↗ Improving'; trendColor = 'var(--teal)'; }
        else if (trend < -1.5) { trendLabel = '↘ Declining'; trendColor = 'var(--pink)'; }
        else if (trend < -0.3) { trendLabel = '↘ Slipping'; trendColor = '#fb923c'; }
        else { trendLabel = '→ Steady'; trendColor = 'var(--blue)'; }
      }

      const aboveAvgCount = apps.filter(a => {
        const exam = EXAMS.find(e => e.id === a.exam_id);
        if (!exam) return false;
        const cAvg = exam.students.reduce((s, st) => s + st.marks, 0) / exam.students.length;
        return a.marks > cAvg;
      }).length;
      const aboveAvgPct = apps.length ? Math.round(aboveAvgCount / apps.length * 100) : 0;

      const bestExamEntry = apps.find(a => a.marks === best);
      const bestExam = EXAMS.find(e => e.id === bestExamEntry?.exam_id);
      let classPercentile = null;
      if (bestExam) {

        const examStudents = deduplicateStudents([...bestExam.students]);
        const total = examStudents.length;
        const lower = examStudents.filter(s => s.marks < best).length;
        const atSame = examStudents.filter(s => s.marks === best).length;

        classPercentile = Math.round((lower + atSame * 0.5) / total * 100);
      }

      const schoolMates = aggregateByStudent(ALL.filter(r => r.school === stuData.school && r.name !== stuData.name));
      const rival = schoolMates.map(s => ({ ...s, diff: Math.abs(s.marks - avg) })).sort((a, b) => a.diff - b.diff)[0];

      const revTheoryGap = revAvg && thyAvg ? revAvg - thyAvg : null;

      const name = stuData.name, school = stuData.school;
      const ini = name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
      const gc = stuData.gender === GEN_MALE ? 'var(--male)' : stuData.gender === GEN_FEMALE ? 'var(--female)' : 'var(--text3)';

      let rankBadgeHTML = '';
      if (rankTierInfo && typeof gRank === 'number') {

        const tRankHTML = (tRank && typeof tRank === 'number' && totalThy > 1) ? `
          <div class="type-rank-chip" style="border-color:rgba(45,212,191,.3);background:rgba(45,212,191,.06)">
            <span style="color:var(--teal);font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;opacity:.7">Theory</span>
            <span style="color:var(--teal);font-family:'Bebas Neue',sans-serif;font-size:22px;line-height:1">#${tRank}</span>
            <span style="color:var(--teal);font-family:'DM Mono',monospace;font-size:9px;opacity:.5">of ${totalThy}</span>
          </div>` : '';
        const rRankHTML = (rRank && typeof rRank === 'number' && totalRev > 1) ? `
          <div class="type-rank-chip" style="border-color:rgba(232, 160, 32,.3);background:rgba(232, 160, 32,.06)">
            <span style="color:var(--amber);font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;opacity:.7">Revision</span>
            <span style="color:var(--amber);font-family:'Bebas Neue',sans-serif;font-size:22px;line-height:1">#${rRank}</span>
            <span style="color:var(--amber);font-family:'DM Mono',monospace;font-size:9px;opacity:.5">of ${totalRev}</span>
          </div>` : '';
        const mRankHTML=(mRank&&typeof mRank==='number'&&totalMod>1)?`
          <div class="type-rank-chip" style="border-color:rgba(129,140,248,.3);background:rgba(129,140,248,.06)">
            <span style="color:#818cf8;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;opacity:.7">Model</span>
            <span style="color:#818cf8;font-family:'Bebas Neue',sans-serif;font-size:22px;line-height:1">#${mRank}</span>
            <span style="color:#818cf8;font-family:'DM Mono',monospace;font-size:9px;opacity:.5">of ${totalMod}</span>
          </div>`:'';

        rankBadgeHTML = `
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">
            <div class="global-rank-badge ${rankTierInfo.tierClass}" style="margin-bottom:0">
              <div class="rank-icon">${rankTierInfo.icon}</div>
              <div>
                <div class="rank-num">#${gRank}</div>
                <div class="rank-label">Overall Rank</div>
                <div class="rank-tier">${rankTierInfo.label}</div>
              </div>
              <div style="margin-left:auto;text-align:right">
                <div style="font-family:'DM Mono',monospace;font-size:9px;opacity:.6">of ${totalStudents.toLocaleString()}</div>
                <div style="font-family:'DM Mono',monospace;font-size:9px;opacity:.6;margin-top:2px">${totalStudents > 0 ? Math.round((1 - gRank / totalStudents) * 100) + 'th pct' : '—'}</div>
              </div>
            </div>
            <div style="display:flex;gap:10px;flex-shrink:0">
              ${tRankHTML}${rRankHTML}${mRankHTML}
            </div>
          </div>`;
      }

      document.getElementById('stu-grid').style.display = 'none';
      const pv = document.getElementById('stu-profile');
      pv.style.display = 'block';

      window.scrollTo({ top: 0, behavior: 'instant' });
      const contentEl = document.getElementById('main-content');
      if (contentEl) contentEl.scrollTop = 0;

      setTimeout(() => {
        const btn = document.getElementById('profile-back-btn');
        if (btn) {
          if (_profileStack.length > 0) {
            const prevStu = STU_REGISTRY[_profileStack[_profileStack.length - 1].idx];
            btn.textContent = prevStu ? `← ${prevStu.name.split(' ')[0]}` : '← Back';
          } else if (_navOrigin) {
            btn.textContent = _navOrigin.page === 'students' ? '← Back to Search' : `← Back to ${_navOrigin.label}`;
          } else {
            btn.textContent = '← Back';
          }
        }
        const cmpBtn = document.getElementById('cmp-btn-profile');
        if (cmpBtn) {
          if (_compareSet.has(_currentProfileIdx)) {
            cmpBtn.textContent = '✓ In Compare'; cmpBtn.style.background = 'rgba(232, 160, 32,.12)'; cmpBtn.style.borderColor = 'var(--amber)'; cmpBtn.style.color = 'var(--amber)';
          } else {
            cmpBtn.textContent = '+ Compare'; cmpBtn.style.background = ''; cmpBtn.style.borderColor = ''; cmpBtn.style.color = '';
          }
        }
      }, 10);

      pv.innerHTML = `
        <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px">
          <button onclick="goBackFromProfile()" class="filter-btn" id="profile-back-btn">← Back</button>
          <button class="filter-btn" id="cmp-btn-profile" onclick="toggleCompareFromProfile()"
            style="margin-left:auto">+ Compare</button>
        </div>
        ${rankBadgeHTML}
        <div class="student-header">
          <div class="student-avatar" style="border-color:${gc};color:${gc}">${ini}</div>
          <div style="flex:1">
            <div class="student-name">${name}</div>
            <div class="student-school">${school}</div>
            <div class="student-pills" style="margin-top:10px">
              <div class="pill gold">Best: ${best}</div>
              <div class="pill teal">Avg: ${avgStr}</div>
              <div class="pill" style="background:rgba(45,212,191,.1);border-color:#2dd4bf;color:#2dd4bf" title="Rank rating: conservative lower-bound estimate. Skill estimate: ${meanRating}">Rating: ${rating.toFixed(2)}<span style="opacity:.5;font-size:9px;margin-left:4px">/ ${meanRating.toFixed(2)}</span></div>
              <button class="info-btn" style="margin-top:2px" onclick="showInfoPopover(this,'rating')" title="About the rating"><i class="ph ph-info" style="font-size:13px;line-height:1"></i></button>
              <div class="pill">Worst: ${worst}</div>
              <div class="pill">Best Rank: #${bestRank}</div>
              <div class="pill">${apps.length} test${apps.length > 1 ? 's' : ''}</div>
              ${stuData.gender !== 'U' ? `<div class="pill">${stuData.gender === GEN_MALE ? 'Boy' : 'Girl'}</div>` : ''}
            </div>
          </div>
        </div>
         <div class="insight-grid">
           <div class="insight-card amber" style="animation-delay:.05s">
             <div class="insight-label">Consistency</div>
             <div class="insight-value amber">${consistency}<span style="font-size:14px">%</span></div>
             <div class="insight-sub">Std dev: ${stdDev.toFixed(1)} marks</div>
           </div>
           <div class="insight-card teal" style="animation-delay:.1s">
             <div class="insight-label">Trend</div>
             <div class="insight-value" style="color:${trendColor};font-size:22px">${trendLabel}</div>
             <div class="insight-sub">Slope: ${trend >= 0 ? '+' : ''}${trend.toFixed(2)}/test</div>
           </div>
           <div class="insight-card blue" style="animation-delay:.15s">
             <div class="insight-label">Above Class Avg</div>
             <div class="insight-value blue">${aboveAvgPct}<span style="font-size:14px">%</span></div>
             <div class="insight-sub">${aboveAvgCount} of ${apps.length} tests</div>
           </div>
           ${classPercentile !== null ? `<div class="insight-card pink" style="animation-delay:.2s"><div class="insight-label">Best Percentile</div><div class="insight-value pink">${classPercentile}<span style="font-size:14px">th</span></div><div class="insight-sub">In ${bestExamEntry?.exam_label || ''}</div></div>` : ''}
           ${revAvg!==null?`<div class="insight-card amber" style="animation-delay:.25s"><div class="insight-label">Revision Avg</div><div class="insight-value amber">${revAvg.toFixed(1)}</div><div class="insight-sub">${revApps.length} test${revApps.length>1?'s':''}</div></div>`:''}
           ${thyAvg!==null?`<div class="insight-card teal" style="animation-delay:.3s"><div class="insight-label">Theory Avg</div><div class="insight-value teal">${thyAvg.toFixed(1)}</div><div class="insight-sub">${thyApps.length} test${thyApps.length>1?'s':''}</div></div>`:''}
           ${modAvg!==null?`<div class="insight-card" style="border-color:rgba(129,140,248,.4);background:rgba(129,140,248,.06);animation-delay:.35s"><div class="insight-label" style="color:#818cf8">Model Avg</div><div class="insight-value" style="color:#818cf8;font-size:26px">${modAvg.toFixed(1)}</div><div class="insight-sub">${modApps.length} test${modApps.length>1?'s':''}</div></div>`:''}
           ${(() => {
             const thyBooks = apps.filter(a => a.exam_type === 'theory' && a.rank <= 50).length;
             const revBooks = apps.filter(a => a.exam_type === 'revision' && a.rank <= 30).length;
             const modBooks = apps.filter(a => (a.exam_type === 'model_theory' || a.exam_type === 'model_revision') && a.rank <= 30).length;
             const total = thyBooks + revBooks + modBooks;
             if (!total) return '';
             const thyChip = thyBooks ? '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(45,212,191,.1);border:1px solid rgba(45,212,191,.25);border-radius:3px;padding:1px 5px"><span style=\"font-family:\'DM Mono\',monospace;font-size:8px;color:var(--teal);opacity:.7;letter-spacing:.5px\">THE</span><span style=\"font-family:\'DM Mono\',monospace;font-size:9px;color:var(--teal);font-weight:500\">' + thyBooks + '</span></span>' : '';
             const revChip = revBooks ? '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(232, 160, 32,.1);border:1px solid rgba(232, 160, 32,.25);border-radius:3px;padding:1px 5px"><span style=\"font-family:\'DM Mono\',monospace;font-size:8px;color:var(--amber);opacity:.7;letter-spacing:.5px\">REV</span><span style=\"font-family:\'DM Mono\',monospace;font-size:9px;color:var(--amber);font-weight:500\">' + revBooks + '</span></span>' : '';
             const modChip = modBooks ? '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(129,140,248,.1);border:1px solid rgba(129,140,248,.25);border-radius:3px;padding:1px 5px"><span style=\"font-family:\'DM Mono\',monospace;font-size:8px;color:#818cf8;opacity:.7;letter-spacing:.5px\">MOD</span><span style=\"font-family:\'DM Mono\',monospace;font-size:9px;color:#818cf8;font-weight:500\">' + modBooks + '</span></span>' : '';
             return '<div class="insight-card" style="border-color:rgba(232, 160, 32,.55);background:linear-gradient(135deg,rgba(232, 160, 32,.09),rgba(245,192,96,.04));animation-delay:.35s">'
               + '<div class="insight-label" style="color:var(--amber2);letter-spacing:1.5px">BOOKS EARNED</div>'
               + '<div style=\"font-family:\'Bebas Neue\',sans-serif;font-size:28px;color:var(--amber);line-height:1;margin-bottom:6px\">' + total + '</div>'
               + '<div style="display:flex;gap:5px;flex-wrap:wrap">' + thyChip + revChip + modChip + '</div>'
               + '</div>';
           })()}
         </div>
        <div class="card" style="margin-bottom:20px">
          <div class="card-header" style="flex-wrap:nowrap;align-items:center;gap:8px;border-bottom:none;padding-bottom:12px">
            <div class="card-title" style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><i class="ph ph-trend-up" style="color:var(--teal)"></i> Performance Timeline</div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
              <div class="stu-tl-btns">
                ${['all','theory','revision','model'].map(t=>{
                  const disabled=t!=='all'&&(t==='theory'?thyApps.length===0:t==='revision'?revApps.length===0:modApps.length===0);
                  const lbl=t==='all'?'All':t==='theory'?'Theory':t==='revision'?'Revision':'Model';
                  const short=t==='all'?'All':t==='theory'?'Thy':t==='revision'?'Rev':'Mod';
                  return `<button id="stu-tl-${t}" onclick="${disabled?'':'setStuTimelineFilter(\''+stuData.name+'\',\''+stuData.school+'\',\''+t+'\')'}" style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;padding:2px 9px;border-radius:3px;cursor:${disabled?'not-allowed':'pointer'};border:1px solid ${t==='all'?'var(--border2)':'transparent'};background:${t==='all'?'var(--bg3)':'transparent'};color:${t==='all'?'var(--text)':typeColor(t)};opacity:${disabled?'0.3':'1'}"><span class="btn-lbl-full">${lbl}</span><span class="btn-lbl-short">${short}</span></button>`;
                }).join('')}
              </div>
              <button class="chart-fullscreen-btn-hdr" onclick="openChartFs('stu-chart-wrap',_stuChartMode==='rank'?'Rank Trend':'Score Timeline')" title="Full view"><i class="ph ph-arrows-out"></i></button>
            </div>
          </div>
          <div style="padding:0 20px 16px;display:flex;gap:0;border-bottom:1px solid var(--border)">
            <div style="flex:1;display:flex;border:1px solid var(--border);border-radius:4px;overflow:hidden">
              <button id="stu-cm-score" onclick="setStuChartMode('${esc(stuData.name)}','${esc(stuData.school)}','score')"
                style="flex:1;background:var(--bg3);border:none;border-right:1px solid var(--border);padding:4px 0;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;color:var(--text);cursor:pointer;transition:all .15s;outline:none">Score</button>
              <button id="stu-cm-rank" onclick="setStuChartMode('${esc(stuData.name)}','${esc(stuData.school)}','rank')"
                style="flex:1;background:transparent;border:none;padding:4px 0;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;color:var(--text3);cursor:pointer;transition:all .15s;outline:none">Rank</button>
            </div>
          </div>
          <div class="card-body"><div class="chart-scroll-outer"><div class="chart-scroll-inner"><div style="height:240px;position:relative" id="stu-chart-wrap"><canvas id="stu-chart"></canvas></div></div></div></div>
        </div>

        <div class="two-col" style="margin-bottom:24px">
          <div class="card">
            <div class="card-header" style="flex-wrap:nowrap;align-items:center;gap:8px">
              <div class="card-title" style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><i class="ph ph-clipboard-text" style="color:var(--text2)"></i> Test History</div>
              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                <div class="stu-th-btns">
                  ${['all','theory','revision','model'].map(t=>{
                    const disabled=t!=='all'&&(t==='theory'?thyApps.length===0:t==='revision'?revApps.length===0:modApps.length===0);
                    const lbl=t==='all'?'All':t==='theory'?'Theory':t==='revision'?'Revision':'Model';
                    const short=t==='all'?'All':t==='theory'?'Thy':t==='revision'?'Rev':'Mod';
                    return `<button id="stu-th-${t}" onclick="${disabled?'':'setStuHistoryFilter(\''+stuData.name+'\',\''+stuData.school+'\',\''+t+'\')'}" style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;padding:2px 9px;border-radius:3px;cursor:${disabled?'not-allowed':'pointer'};border:1px solid ${t==='all'?'var(--border2)':'transparent'};background:${t==='all'?'var(--bg3)':'transparent'};color:${t==='all'?'var(--text)':typeColor(t)};opacity:${disabled?'0.3':'1'}"><span class="btn-lbl-full">${lbl}</span><span class="btn-lbl-short">${short}</span></button>`;
                  }).join('')}
                </div>
                <button class="info-btn" onclick="showInfoPopover(this,'test-history')" title="How this works" style="margin-left:2px"><i class="ph ph-info" style="font-size:13px;line-height:1"></i></button>
              </div>
            </div>
            <div class="table-wrap" id="stu-history-table"><table>
              <thead><tr><th>Test</th><th>Type</th><th>Marks</th><th>Rank</th><th>vs Class</th><th title="How exceptional relative to class spread">Impact</th></tr></thead>
              <tbody>
              ${apps.map(a => {
        const exam = EXAMS.find(e => e.id === a.exam_id);
        const cAvg = exam ? (exam.students.reduce((s, st) => s + st.marks, 0) / exam.students.length).toFixed(1) : null;
        const diff = cAvg ? (a.marks - cAvg).toFixed(1) : null;
        const diffCol = diff > 0 ? '#2dd4bf' : diff < 0 ? 'var(--pink)' : 'var(--text3)';
        const z = examZ(a.exam_id, a.marks);
        const zStr = (z >= 0 ? '+' : '') + z.toFixed(2) + 'σ';
        const zCol = z >= 1.5 ? '#2dd4bf' : z >= 0.5 ? 'var(--teal)' : z >= -0.5 ? 'var(--text2)' : z >= -1.5 ? '#fb923c' : 'var(--pink)';
        const zLabel = z >= 2 ? '★ exceptional' : z >= 1 ? '+ above avg' : z >= -0.5 ? '· average' : z >= -1.5 ? '− below avg' : '− below avg';
        return `<tr data-etype="${a.exam_type}">
                  <td class="td-school">${a.exam_label}</td>
                  <td><span style="font-family:'DM Mono',monospace;font-size:9px;padding:2px 6px;border-radius:3px;background:${typeColorRgba(a.exam_type,.15)};color:${typeColor(a.exam_type)}">${typeShort(a.exam_type)}</span></td>
                  <td class="td-marks">${a.marks}</td>
                  <td class="td-rank">#${a.rank}</td>
                  <td style="font-family:'DM Mono',monospace;font-size:11px;color:${diffCol}">${diff !== null ? (diff > 0 ? '+' : '') + diff : '—'}</td>
                  <td style="font-family:'DM Mono',monospace;font-size:10px;color:${zCol}" title="${zLabel}">${zStr}</td>
                </tr>`;
      }).join('')}
              </tbody>
            </table></div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title"><i class="ph ph-buildings" style="color:var(--blue)"></i> vs School Peers</div></div>
            <div class="card-body">
              ${rival ? `<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text3);margin-bottom:12px">Top classmates by average score</div>
              ${schoolMates.slice(0, 8).map((s, i) => {
        const w = Math.max(...schoolMates.slice(0, 8).map(x => x.marks), avg);
        const col = i === 0 ? 'var(--amber)' : i === 1 ? 'var(--blue)' : 'var(--text3)';
        return `<div class="score-bar">
                  <div class="score-bar-label" style="width:130px;cursor:pointer;transition:color .15s"
                    onclick="navToStudent('${_ns(s.name)}','${_ns(s.school)}')"
                    onmouseenter="this.style.color='var(--amber)'" onmouseleave="this.style.color=''">${s.name.split(' ')[0]}</div>
                  <div class="score-bar-track"><div class="score-bar-fill" style="width:${s.marks / w * 100}%;background:${col}"></div></div>
                  <div class="score-bar-val">${s.marks}</div>
                </div>`;
      }).join('')}
              <div class="score-bar" style="background:rgba(232, 160, 32,.05);border-radius:4px;margin-top:4px">
                <div class="score-bar-label" style="width:130px;color:var(--amber);font-weight:600">${name.split(' ')[0]} (you)</div>
                <div class="score-bar-track"><div class="score-bar-fill" style="width:${avg / Math.max(...schoolMates.slice(0, 8).map(x => x.marks), avg) * 100}%;background:var(--amber)"></div></div>
                <div class="score-bar-val" style="color:var(--amber)">${avgStr}</div>
              </div>` : '<div class="empty" style="padding:24px"><i class="ph ph-buildings empty-icon" style="font-size:32px;color:var(--text3)"></i><span>No classmates found</span></div>'}
            </div>
          </div>
        </div>`;

      _stuTlFilter='all'; _stuThFilter='all'; _stuChartMode='score';
      setTimeout(()=>_renderStuChart(apps,best), 60);
    }

    function schoolBayesK() { return _ebParams.sigma_sq / _ebParams.tau_sq; }

    function buildSchoolStats(data) {
      const map = {};
      data.forEach(r => {
        if (!r.school) return;
        if (!map[r.school]) map[r.school] = { stuMap: {}, boys: 0, girls: 0, entries: [] };
        const d = map[r.school];
        const key = r.name + '\x00' + (r.gender || 'U');
        if (!d.stuMap[key]) d.stuMap[key] = { name: r.name, gender: r.gender, marks: [] };
        d.stuMap[key].marks.push(r.marks);
        if (r.gender === GEN_MALE) d.boys++;
        if (r.gender === GEN_FEMALE) d.girls++;
        d.entries.push(r);
      });
      const result = {};
      Object.entries(map).forEach(([school, d]) => {
        const stuList = Object.values(d.stuMap);
        const uniqueCount = stuList.length;
        const stuAvgs = stuList.map(s => s.marks.reduce((a, b) => a + b, 0) / s.marks.length);
        const rawAvg = stuAvgs.reduce((a, b) => a + b, 0) / uniqueCount;
        const bayesAvg = (stuAvgs.reduce((a, b) => a + b, 0) + schoolBayesK() * _globalMean) / (uniqueCount + schoolBayesK());
        const topN = Math.max(3, Math.ceil(uniqueCount * 0.1));
        const sortedAvgs = [...stuAvgs].sort((a, b) => b - a);
        const eliteScore = sortedAvgs.slice(0, topN).reduce((a, b) => a + b, 0) / Math.min(topN, sortedAvgs.length);
        const topStudents = stuList.map(s => ({ name: s.name, gender: s.gender, avg: s.marks.reduce((a, b) => a + b, 0) / s.marks.length, tests: s.marks.length })).sort((a, b) => b.avg - a.avg);
        result[school] = { uniqueCount, totalEntries: d.entries.length, rawAvg: +rawAvg.toFixed(1), bayesAvg: +bayesAvg.toFixed(1), eliteScore: +eliteScore.toFixed(1), boys: d.boys, girls: d.girls, entries: d.entries, topStudents, eliteTopN: Math.min(topN, stuList.length) };
      });
      return result;
    }

    function setSchoolSort(s, btn) {
      schoolSort = s;
      document.querySelectorAll('#ss-count,#ss-avg,#ss-top').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSchools();
    }

    function renderSchools() {
      const data = getRowsForSel(schoolTestSel);
      schoolData = buildSchoolStats(data);
      const q = (document.getElementById('school-search-inp')?.value || '').toLowerCase().trim();
      let schools = Object.entries(schoolData).map(([name, d]) => ({ name, ...d }));
      if (q) schools = schools.filter(s => s.name.toLowerCase().includes(q));
      if (schoolSort === 'count') schools.sort((a, b) => b.totalEntries - a.totalEntries);
      else if (schoolSort === 'avg') schools.sort((a, b) => b.bayesAvg - a.bayesAvg);
      else schools.sort((a, b) => b.eliteScore - a.eliteScore);
      const maxVal = schoolSort === 'count' ? Math.max(...schools.map(s => s.totalEntries), 1) : schoolSort === 'avg' ? Math.max(...schools.map(s => s.bayesAvg), 1) : Math.max(...schools.map(s => s.eliteScore), 1);
      const barVal = s => schoolSort === 'count' ? s.totalEntries : schoolSort === 'avg' ? s.bayesAvg : s.eliteScore;
      const dispVal = s => schoolSort === 'count' ? s.totalEntries : schoolSort === 'avg' ? s.bayesAvg : s.eliteScore;
      const dispTip = schoolSort === 'count' ? 'Total exam entries' : schoolSort === 'avg' ? 'Bayesian-adj avg' : `Elite Score`;
      document.getElementById('school-list').innerHTML = schools.map((s, i) => `
        <div class="school-row" onclick="showSchoolDetail('${esc(s.name)}')" style="animation:rowFadeIn .3s ease-out ${i * 18}ms both">
          <div class="school-rank-num">${i + 1}</div>
          <div class="school-name">${s.name}<span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-left:6px">${s.uniqueCount} stu</span></div>
          <div class="school-bar-wrap"><div class="score-bar-track"><div class="score-bar-fill" style="width:${barVal(s) / maxVal * 100}%;background:var(--amber)"></div></div></div>
          <div class="school-count" title="Total exam entries" style="font-size:10px">${s.totalEntries}</div>
          <div class="school-avg" title="${dispTip}">${dispVal(s)}</div>
        </div>`).join('');
    }

    function showSchoolDetail(schoolName) {
      const d = schoolData[schoolName];
      if (!d) return;
      const byExam = {};
      d.entries.forEach(r => {
        if (!byExam[r.exam_id]) byExam[r.exam_id] = { label: r.exam_label, type: r.exam_type, marks: [] };
        byExam[r.exam_id].marks.push(r.marks);
      });
      const examRows = Object.values(byExam).map(ex => ({ label: ex.label, type: ex.type, avg: +(ex.marks.reduce((a, b) => a + b, 0) / ex.marks.length).toFixed(1), count: ex.marks.length })).sort((a, b) => a.type === b.type ? 0 : a.type === 'theory' ? -1 : 1);
      const detailHTML = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
          <div class="insight-card amber" style="padding:12px"><div class="insight-label">Unique Students</div><div class="insight-value amber" style="font-size:26px">${d.uniqueCount}</div><div class="insight-sub">${d.totalEntries} total entries</div></div>
          <div class="insight-card teal" style="padding:12px"><div class="insight-label">Adj. Avg Score</div><div class="insight-value teal" style="font-size:26px">${d.bayesAvg}</div><div class="insight-sub">raw avg ${d.rawAvg}</div></div>
          <div class="insight-card" style="padding:12px;border-color:rgba(96,165,250,.3)"><div class="insight-label">Elite Score (top-${d.eliteTopN})</div><div class="insight-value" style="font-size:26px;color:var(--blue)">${d.eliteScore}</div><div class="insight-sub">avg of top-${d.eliteTopN}</div></div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          <div class="chip" style="color:var(--male)">Boys: ${d.boys}</div>
          <div class="chip" style="color:var(--female)">Girls: ${d.girls}</div>
        </div>
        <div style="margin-bottom:8px;font-family:'DM Mono',monospace;font-size:10px;color:var(--text3)">TOP STUDENTS  - personal average</div>
        ${d.topStudents.slice(0, 8).map((s, i) => `
          <div class="score-bar">
            <div class="score-bar-label" style="width:140px;cursor:pointer;transition:color .15s"
              onclick="${window.innerWidth <= 768 ? 'closeSchoolDrawer();' : ''}navToStudent('${_ns(s.name)}','${esc(schoolName)}')"
              onmouseenter="this.style.color='var(--amber)'" onmouseleave="this.style.color=''">${['<i class="ph ph-medal" style="color:#ffd700"></i>', '<i class="ph ph-medal" style="color:#C0C0C0"></i>', '<i class="ph ph-medal" style="color:#CD7F32"></i>', '4.', '5.', '6.', '7.', '8.'][i]} ${s.name}<span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-left:4px">(${s.tests}t)</span></div>
            <div class="score-bar-track"><div class="score-bar-fill" style="width:${s.avg}%;background:${i < d.eliteTopN ? '#60a5fa' : 'var(--text3)'}"></div></div>
            <div class="score-bar-val" style="color:${i < d.eliteTopN ? 'var(--blue)' : 'var(--text3)'}">${s.avg.toFixed(1)}</div>
          </div>`).join('')}
        ${examRows.length > 1 ? `
          <div style="margin-top:16px;margin-bottom:8px;font-family:'DM Mono',monospace;font-size:10px;color:var(--text3)">PER-TEST AVERAGES</div>
          ${examRows.map(ex => `<div class="score-bar">
            <div class="score-bar-label">${ex.label}</div>
            <div class="score-bar-track"><div class="score-bar-fill" style="width:${ex.avg}%;background:${typeColor(ex.type)}"></div></div>
            <div class="score-bar-val">${ex.avg}</div>
          </div>`).join('')}` : ''}`;

      if (window.innerWidth <= 768) {
        openSchoolDrawer(schoolName, detailHTML);
      } else {
        document.getElementById('school-detail-title').textContent = schoolName;
        document.getElementById('school-detail').innerHTML = detailHTML;
      }
    }

    function filteredExams(){
      if(avgType==='all') return EXAMS;
      if(avgType==='model') return EXAMS.filter(e=>isModelType(e.type));
      return EXAMS.filter(e=>e.type===avgType);
    }
    function filteredAll(){
      const ids=new Set(filteredExams().map(e=>e.id));
      return ALL.filter(r=>ids.has(r.exam_id));
    }
    function syncDashFilterBtns() {
      const b = document.getElementById('db-mod');
      if (b) b.style.display = EXAMS.some(e => isModelType(e.type)) ? '' : 'none';
    }

    function setDashFilter(type, btn) {
      dashTestSel = { mode: type };
      podiumTestSel = { mode: type };
      top10TestSel = { mode: type };
      const typeColors = { theory: 'var(--teal)', revision: 'var(--amber)', model: '#818cf8' };
      const typeBorders = { theory: 'rgba(45,212,191,.3)', revision: 'rgba(232,160,32,.3)', model: 'rgba(129,140,248,.35)' };
      document.querySelectorAll('#dash-filter-bar .filter-btn').forEach(b => {
        b.classList.remove('active');
        const bid = b.id?.replace('db-', '');
        if (typeColors[bid]) { b.style.color = typeColors[bid]; b.style.borderColor = typeBorders[bid]; b.style.background = ''; }
        else { b.style.color = ''; b.style.borderColor = ''; b.style.background = ''; }
      });
      btn.classList.add('active');
      if (typeColors[type]) {
        btn.style.color = typeColors[type];
        btn.style.borderColor = typeColors[type];
        btn.style.background = type === 'theory' ? 'rgba(45,212,191,.12)' : type === 'revision' ? 'rgba(249,115,22,.1)' : 'rgba(129,140,248,.12)';
      }
      top10SortField = 'rank'; top10SortAsc = true;
      renderPodium(); renderDistribution(); renderTop10(); syncTop10Btns(); renderTopSchoolsBars();
    }

    function syncAvgFilterBtns(){
      const b=document.getElementById('at-mod');
      if(b)b.style.display=EXAMS.some(e=>isModelType(e.type))?'':'none';
    }
    function setAvgType(t, btn) {
      avgType = t;
      document.querySelectorAll('#at-all,#at-rev,#at-thy,#at-mod').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      renderAnalytics();
    }

    function renderAnalytics() {
      if (!EXAMS.length) return;
      renderGenderChart(); renderBandsChart(); renderTestSummaryList();
      renderAvgChart(); renderSchoolAvgChart(); renderParticipantChart();
      renderGenderTrendChart(); renderSpreadChart();
    }

    function renderGenderChart() {
      const ctx = document.getElementById('gender-chart')?.getContext('2d');
      if (!ctx) return;
      if (CHARTS.gender) CHARTS.gender.destroy();
      const data = filteredAll();
      const m = data.filter(r => r.gender === GEN_MALE).length;
      const f = data.filter(r => r.gender === GEN_FEMALE).length;
      const u = data.filter(r => r.gender !== GEN_MALE && r.gender !== GEN_FEMALE).length;
      const datasets = [{ data: [m, f], backgroundColor: ['rgba(96,165,250,.7)', 'rgba(244,114,182,.7)'], borderColor: ['#60a5fa', '#f472b6'], borderWidth: 1 }];
      const labels = ['Boys', 'Girls'];
      if (u > 0) { datasets[0].data.push(u); datasets[0].backgroundColor.push('rgba(90,90,120,.5)'); datasets[0].borderColor.push('#444'); labels.push('Unknown'); }
      CHARTS.gender = new Chart(ctx, { type: 'doughnut', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#9090b0', font: { family: 'DM Mono', size: 11 } } } } } });
    }

    function renderBandsChart() {
      const ctx = document.getElementById('bands-chart')?.getContext('2d');
      if (!ctx) return;
      if (CHARTS.bands) CHARTS.bands.destroy();
      const bands = { '90–100': 0, '80–89': 0, '70–79': 0, '60–69': 0, '50–59': 0, '40–49': 0, '<40': 0 };
      filteredAll().forEach(r => {
        if (r.marks >= 90) bands['90–100']++;
        else if (r.marks >= 80) bands['80–89']++;
        else if (r.marks >= 70) bands['70–79']++;
        else if (r.marks >= 60) bands['60–69']++;
        else if (r.marks >= 50) bands['50–59']++;
        else if (r.marks >= 40) bands['40–49']++;
        else bands['<40']++;
      });
      CHARTS.bands = new Chart(ctx, { type: 'bar', data: { labels: Object.keys(bands), datasets: [{ data: Object.values(bands), backgroundColor: ['rgba(45,212,191,.75)', 'rgba(96,165,250,.65)', 'rgba(45,212,191,.65)', 'rgba(244,114,182,.55)', 'rgba(167,139,250,.55)', 'rgba(90,90,120,.45)', 'rgba(239,68,68,.55)'], borderRadius: 4 }] }, options: { ...cOpts(), plugins: { legend: { display: false } } } });
    }

    function renderTestSummaryList() {
      document.getElementById('test-summary-list').innerHTML = filteredExams().map(e => {
        const m = e.students.map(s => s.marks);
        const avg = (m.reduce((a, b) => a + b) / m.length).toFixed(1);
        const col = typeColor(e.type);
        return `<div class="score-bar"><div class="score-bar-label">${e.label}</div><div class="score-bar-track"><div class="score-bar-fill" style="width:${avg}%;background:${col}"></div></div><div class="score-bar-val">${avg}</div></div>`;
      }).join('');
    }

    function setChartScrollWidth(wrapId, dataLen) {
      const wrap = document.getElementById(wrapId);
      if (!wrap) return;

      const THRESHOLD = 30;
      const MIN_PX = 24;
      const inner = wrap.parentElement;
      const containerW = inner ? inner.clientWidth || inner.parentElement?.clientWidth || 600 : 600;
      if (dataLen > THRESHOLD) {
        const minW = dataLen * MIN_PX;
        wrap.style.minWidth = minW > containerW ? minW + 'px' : '';
      } else {
        wrap.style.minWidth = '';
      }
    }

    function renderAvgChart() {
      const ctx = document.getElementById('avg-chart')?.getContext('2d');
      if (!ctx) return;
      if (CHARTS.avg) CHARTS.avg.destroy();
      const filtered = filteredExams();
      if (!filtered.length) return;
      CHARTS.avg = new Chart(ctx, {
        type: 'line', data: {
          labels: filtered.map(e => e.label), datasets: [
            { label: 'Average Score', data: filtered.map(e => (e.students.reduce((s, r) => s + r.marks, 0) / e.students.length).toFixed(1)), borderColor: '#e8a020', backgroundColor: 'rgba(232, 160, 32,.1)', fill: true, tension: .35, pointRadius: 5, pointBackgroundColor: '#e8a020' },
            { label: 'Top Score', data: filtered.map(e => Math.max(...e.students.map(s => s.marks))), borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,.05)', fill: false, tension: .35, pointRadius: 3, borderDash: [5, 3] },
            { label: 'Median', data: filtered.map(e => { const s = [...e.students].sort((a, b) => a.marks - b.marks); return s[Math.floor(s.length / 2)]?.marks || 0; }), borderColor: '#2dd4bf', backgroundColor: 'rgba(45,212,191,.05)', fill: false, tension: .35, pointRadius: 3, borderDash: [3, 3] }
          ]
        }, options: cOpts({ ylabel: 'Score' })
      });
      setChartScrollWidth('avg-chart-wrap', filtered.length);
    }

    function renderSchoolAvgChart() {
      const ctx = document.getElementById('school-avg-chart')?.getContext('2d');
      if (!ctx) return;
      if (CHARTS.schAvg) CHARTS.schAvg.destroy();
      const stats = buildSchoolStats(filteredAll());
      const sorted = Object.entries(stats).map(([s, v]) => ({ s, avg: v.bayesAvg })).sort((a, b) => b.avg - a.avg).slice(0, 10);
      CHARTS.schAvg = new Chart(ctx, { type: 'bar', data: { labels: sorted.map(x => x.s.length > 20 ? x.s.slice(0, 18) + '…' : x.s), datasets: [{ label: 'Adj. Avg Score', data: sorted.map(x => x.avg.toFixed(1)), backgroundColor: 'rgba(96,165,250,.4)', borderColor: '#60a5fa', borderWidth: 1, borderRadius: 4 }] }, options: { ...cOpts({ ylabel: 'Adj Avg' }), indexAxis: 'y', plugins: { legend: { display: false } } } });
    }

    function renderParticipantChart() {
      const ctx = document.getElementById('participant-chart')?.getContext('2d');
      if (!ctx || !EXAMS.length) return;
      if (CHARTS.part) CHARTS.part.destroy();
      const fe = filteredExams();
      CHARTS.part = new Chart(ctx, {
        type: 'bar', data: {
          labels: fe.map(e => e.label), datasets: [
            { label: 'Boys', data: fe.map(e => e.students.filter(s => s.gender === GEN_MALE).length), backgroundColor: 'rgba(96,165,250,.5)', borderRadius: 4 },
            { label: 'Girls', data: fe.map(e => e.students.filter(s => s.gender === GEN_FEMALE).length), backgroundColor: 'rgba(244,114,182,.5)', borderRadius: 4 },
          ]
        }, options: { ...cOpts({ ylabel: 'Students' }), plugins: { legend: { labels: { color: '#9090b0', font: { family: 'DM Mono', size: 11 } } } }, scales: { x: { stacked: true, ticks: { color: '#5a5a78', font: { family: 'DM Mono', size: 9 } }, grid: { color: 'rgba(255,255,255,.04)' } }, y: { stacked: true, ticks: { color: '#5a5a78', font: { family: 'DM Mono', size: 9 } }, grid: { color: 'rgba(255,255,255,.04)' } } } }
      });
      setChartScrollWidth('participant-chart-wrap', fe.length);
    }

    function renderGenderTrendChart() {
      const ctx = document.getElementById('gender-trend-chart')?.getContext('2d');
      if (!ctx || !EXAMS.length) return;
      if (CHARTS.genTrend) CHARTS.genTrend.destroy();
      const fe = filteredExams();
      CHARTS.genTrend = new Chart(ctx, {
        type: 'line', data: {
          labels: fe.map(e => e.label), datasets: [
            { label: 'Boys Avg', data: fe.map(e => { const b = e.students.filter(s => s.gender === GEN_MALE); return b.length ? (b.reduce((a, x) => a + x.marks, 0) / b.length).toFixed(1) : null; }), borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,.1)', fill: true, tension: .35, pointRadius: 4 },
            { label: 'Girls Avg', data: fe.map(e => { const g = e.students.filter(s => s.gender === GEN_FEMALE); return g.length ? (g.reduce((a, x) => a + x.marks, 0) / g.length).toFixed(1) : null; }), borderColor: '#f472b6', backgroundColor: 'rgba(244,114,182,.1)', fill: true, tension: .35, pointRadius: 4 }
          ]
        }, options: cOpts({ ylabel: 'Avg Score' })
      });
      setChartScrollWidth('gender-trend-chart-wrap', fe.length);
    }

    function renderSpreadChart() {
      const ctx = document.getElementById('spread-chart')?.getContext('2d');
      if (!ctx || !EXAMS.length) return;
      if (CHARTS.spread) CHARTS.spread.destroy();
      const fe = filteredExams();
      CHARTS.spread = new Chart(ctx, {
        type: 'line', data: {
          labels: fe.map(e => e.label), datasets: [
            { label: 'Max', data: fe.map(e => Math.max(...e.students.map(s => s.marks))), borderColor: '#60a5fa', fill: false, tension: .3, pointRadius: 3, borderDash: [5, 3] },
            { label: 'Avg', data: fe.map(e => (e.students.reduce((a, b) => a + b.marks, 0) / e.students.length).toFixed(1)), borderColor: '#2dd4bf', backgroundColor: 'rgba(45,212,191,.08)', fill: '+1', tension: .3, pointRadius: 3 },
            { label: 'Min', data: fe.map(e => Math.min(...e.students.map(s => s.marks))), borderColor: '#818cf8', fill: false, tension: .3, pointRadius: 3, borderDash: [5, 3] }
          ]
        }, options: cOpts({ ylabel: 'Score' })
      });
      setChartScrollWidth('spread-chart-wrap', fe.length);
    }

    let searchTimer;
    document.getElementById('global-search').addEventListener('input', function () {
      clearTimeout(searchTimer);
      const q = this.value.toLowerCase().trim();
      const res = document.getElementById('search-results');
      if (q.length < 2) { res.classList.remove('visible'); return; }
      searchTimer = setTimeout(() => {
        const map = {};
        ALL.forEach(r => {
          if (!r.name.toLowerCase().includes(q)) return;
          const k = r.name + '||' + r.school;
          if (!map[k]) map[k] = { name: r.name, school: r.school, gender: r.gender, best: r.marks, tests: 0 };
          map[k].best = Math.max(map[k].best, r.marks); map[k].tests++;
        });
        const hits = Object.values(map).slice(0, 8);
        if (!hits.length) { res.classList.remove('visible'); return; }
        res.innerHTML = hits.map(h => `
          <div class="search-item" onclick="navToStudent('${_ns(h.name)}','${_ns(h.school)}')">
            <div class="search-name">${h.name}</div>
            <div class="search-meta">${h.school} · Best: ${h.best} · ${h.tests} test${h.tests > 1 ? 's' : ''}</div>
          </div>`).join('');
        res.classList.add('visible');
      }, 200);
    });
    document.addEventListener('click', ev => {
      if (!ev.target.closest('.search-wrap')) document.getElementById('search-results').classList.remove('visible');
    });
    document.addEventListener('keydown', ev => {
      if (ev.key === '/' && document.activeElement.tagName !== 'INPUT') { ev.preventDefault(); document.getElementById('global-search').focus(); }
      if (ev.key === 'Escape') { document.getElementById('global-search').blur(); document.getElementById('search-results').classList.remove('visible'); closeSidebar(); }
    });

    function openModal() { document.getElementById('modal-overlay').classList.add('open'); }
    function closeModal(ev) { if (!ev || ev.target === document.getElementById('modal-overlay')) { document.getElementById('modal-overlay').classList.remove('open'); } }

    function cOpts({ dual = false, ylabel = '' } = {}) {
      const base = {
        responsive: true, maintainAspectRatio: false,
        elements: { point: { hitRadius: 18 } },
        plugins: { legend: { labels: { color: '#9090b0', font: { family: 'DM Mono', size: 11 } } } },
        scales: {
          x: { ticks: { color: '#5a5a78', font: { family: 'DM Mono', size: 9 }, maxRotation: 35 }, grid: { color: 'rgba(255,255,255,.04)' } },
          y: { ticks: { color: '#5a5a78', font: { family: 'DM Mono', size: 9 } }, grid: { color: 'rgba(255,255,255,.04)' }, title: ylabel ? { display: true, text: ylabel, color: '#5a5a78', font: { family: 'DM Mono', size: 9 } } : {} }
        }
      };
      if (dual) base.scales.y1 = { position: 'right', ticks: { color: '#5a5a78', font: { family: 'DM Mono', size: 9 } }, grid: { display: false } };
      return base;
    }

    function esc(s) {
      return (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    let _compareSet = new Set();

    function _syncCmpBtn(idx, active) {
      const btn = document.getElementById('cmp-btn-' + idx);
      if (btn) { btn.textContent = active ? '✓ Added' : '+ Compare'; btn.style.background = active ? 'rgba(232, 160, 32,.08)' : ''; btn.style.borderColor = active ? 'var(--amber)' : ''; btn.style.color = active ? 'var(--amber)' : ''; }
      if (_currentProfileIdx === idx) {
        const pb = document.getElementById('cmp-btn-profile');
        if (pb) { pb.textContent = active ? '✓ In Compare' : '+ Compare'; pb.style.background = active ? 'rgba(232, 160, 32,.08)' : ''; pb.style.borderColor = active ? 'var(--amber)' : ''; pb.style.color = active ? 'var(--amber)' : ''; }
      }
    }

    function toggleCompare(idx) {
      if (_compareSet.has(idx)) {
        _compareSet.delete(idx);
        _syncCmpBtn(idx, false);
      } else {
        if (_compareSet.size >= 4) { alert('Compare up to 4 students at a time.'); return; }
        _compareSet.add(idx);
        _syncCmpBtn(idx, true);
      }
      renderCompareFab();
    }

    function toggleCompareFromProfile() {
      if (_currentProfileIdx < 0) return;
      toggleCompare(_currentProfileIdx);
    }

    function _dismissTray(then) {
      const tray = document.getElementById('compare-tray');
      if (!tray) { if (then) then(); return; }
      tray.style.transition = 'transform .28s cubic-bezier(.4,0,.6,1), opacity .22s';
      tray.style.transform = 'translateX(-50%) translateY(120%)';
      tray.style.opacity = '0';
      tray.style.pointerEvents = 'none';
      setTimeout(() => { tray.remove(); if (then) then(); }, 300);
    }

    function renderCompareFab() {
      let tray = document.getElementById('compare-tray');
      if (_compareSet.size === 0) { _dismissTray(); return; }

      const isMobile = window.innerWidth <= 768;
      const bottomOffset = isMobile ? 'calc(68px + max(6px, env(safe-area-inset-bottom)) + 8px)' : '24px';

      if (!tray) {
        tray = document.createElement('div');
        tray.id = 'compare-tray';
        tray.style.cssText = `position:fixed;left:50%;transform:translateX(-50%) translateY(120%);bottom:${bottomOffset};z-index:600;transition:transform .35s cubic-bezier(.34,1.56,.64,1),opacity .25s;opacity:0;pointer-events:none`;
        document.body.appendChild(tray);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          tray.style.transform = 'translateX(-50%) translateY(0)';
          tray.style.opacity = '1';
          tray.style.pointerEvents = 'all';
        }));
      }
      tray.style.bottom = bottomOffset;

      const colors = ['var(--amber)', 'var(--teal)', 'var(--blue)', '#c084fc'];
      const students = [..._compareSet].map((idx, ci) => {
        const s = STU_REGISTRY[idx];
        const ini = s.name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
        return { idx, s, ini, col: colors[ci] };
      });

      const slots = Array.from({ length: 4 }, (_, i) => {
        const stu = students[i];
        if (!stu) return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><div style="width:40px;height:40px;border-radius:50%;border:1.5px dashed rgba(90,90,120,.35);display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:9px;color:rgba(90,90,120,.45)">${i + 1}</div><div style="height:12px"></div></div>`;
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
          <div style="position:relative;cursor:pointer" title="Remove ${stu.s.name}" onclick="toggleCompare(${stu.idx})">
            <div style="width:40px;height:40px;border-radius:50%;background:${stu.col}18;border:1.5px solid ${stu.col};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:16px;color:${stu.col}">
              ${stu.ini}
            </div>
            <div style="position:absolute;top:-2px;right:-2px;width:13px;height:13px;border-radius:50%;background:var(--bg2);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:7px;color:var(--text3)">✕</div>
          </div>
          <div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--text3);white-space:nowrap;max-width:44px;overflow:hidden;text-overflow:ellipsis;text-align:center">${stu.s.name.split(' ')[0]}</div>
        </div>`;
      }).join('');

      const canCompare = _compareSet.size >= 2;
      tray.innerHTML = `
        <div style="background:rgba(10,10,16,0.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,.07);border-radius:18px;padding:14px 16px 12px;box-shadow:0 16px 56px rgba(0,0,0,.75);display:flex;align-items:center;gap:14px">
          <div style="display:flex;align-items:flex-end;gap:10px">${slots}</div>
          <div style="width:1px;height:36px;background:rgba(255,255,255,.06)"></div>
          <div style="display:flex;flex-direction:column;gap:5px">
            <button onclick="openCompareModal()" ${canCompare ? '' : 'disabled'}
              style="background:none;border:1px solid ${canCompare ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.07)'};border-radius:8px;padding:7px 14px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.5px;color:${canCompare ? 'var(--text)' : 'rgba(255,255,255,.2)'};cursor:${canCompare ? 'pointer' : 'default'};white-space:nowrap;transition:border-color .15s,color .15s"
              ${canCompare ? `onmouseenter="this.style.borderColor='var(--amber)';this.style.color='var(--amber)'" onmouseleave="this.style.borderColor='rgba(255,255,255,.18)';this.style.color='var(--text)'"` : ''}>
              ${canCompare ? `Compare ${_compareSet.size}` : `Need ${2 - _compareSet.size} more`}
            </button>
            <button onclick="clearCompare()"
              style="background:none;border:none;padding:4px 14px;font-family:'DM Mono',monospace;font-size:9px;color:rgba(255,255,255,.25);cursor:pointer;letter-spacing:.5px;transition:color .15s;text-align:left"
              onmouseenter="this.style.color='#f87171'" onmouseleave="this.style.color='rgba(255,255,255,.25)'">
              Clear all
            </button>
          </div>
        </div>`;
    }

    function toggleExportDrop(ev) {
      if (ev) ev.stopPropagation();
      const p = document.getElementById('export-dd-panel');
      if (!p) return;
      const isOpen = p.style.display === 'block';
      p.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        const close = (e) => { if (!e.target.closest('#export-dd-wrap')) { p.style.display = 'none'; document.removeEventListener('click', close); } };
        setTimeout(() => document.addEventListener('click', close), 0);
      }
    }
    function closeExportDrop() { const p = document.getElementById('export-dd-panel'); if (p) p.style.display = 'none'; }

    function clearCompare() {
      _compareSet.forEach(idx => _syncCmpBtn(idx, false));
      const pb = document.getElementById('cmp-btn-profile');
      if (pb) { pb.textContent = '+ Compare'; pb.style.background = ''; pb.style.borderColor = ''; pb.style.color = ''; }
      _compareSet.clear();
      renderCompareFab();
    }

    function openCompareModal() {
      if (_compareSet.size < 2) return;
      _dismissTray(() => { _buildCompareModal(); });
    }

    function _buildCompareModal() {
      const students = [..._compareSet].map(i => {
        const s = STU_REGISTRY[i];
        const zList = s.apps.map(a => examZ(a.exam_id, a.marks));
        const post = computePosterior(zList);
        const marks = s.apps.map(a => a.marks);
        const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
        const best = Math.max(...marks);
        const worst = Math.min(...marks);
        const stdDev = marks.length > 1 ? Math.sqrt(marks.reduce((s, m) => s + (m - avg) ** 2, 0) / marks.length) : 0;
        const consistency = Math.max(0, Math.round(100 - (stdDev / avg) * 100));
        const gRank = globalRank(s.name, s.school);
        return { ...s, avg: +avg.toFixed(1), best, worst, consistency, rating: post.rating, gRank, tests: s.apps.length };
      });

      const COLS = ['Rating', 'Avg Score', 'Best', 'Worst', 'Consistency', 'Tests', 'Rank'];
      const vals = s => [s.rating, s.avg, s.best, s.worst, s.consistency + '%', s.tests, typeof s.gRank === 'number' ? '#' + s.gRank : '—'];
      const bestOf = (i) => {
        const v = students.map(s => parseFloat(vals(s)[i]));
        if (v.some(isNaN)) return null;
        return i === 3 || i === 6 ? Math.min(...v) : Math.max(...v);
      };

      const colors = ['#e8a020', '#2dd4bf', '#60a5fa', '#f472b6'];
      const colorVars = ['var(--amber)', 'var(--teal)', 'var(--blue)', 'var(--pink)'];
      const ini = n => n.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

      let html = `<div style="display:grid;grid-template-columns:repeat(${students.length},1fr);gap:16px;margin-bottom:24px">`;
      students.forEach((s, ci) => {
        const gc = s.gender === GEN_MALE ? 'var(--male)' : s.gender === GEN_FEMALE ? 'var(--female)' : colorVars[ci];
        html += `<div style="text-align:center;padding:16px;background:var(--bg3);border-radius:12px;border:1px solid ${colorVars[ci]}44">
          <div style="width:52px;height:52px;border-radius:50%;background:${colorVars[ci]}22;border:2px solid ${colorVars[ci]};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:22px;color:${colorVars[ci]};margin:0 auto 10px">${ini(s.name)}</div>
          <div style="font-weight:600;font-size:15px;margin-bottom:4px">${s.name}</div>
          <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">${s.school}</div>
        </div>`;
      });
      html += '</div>';

      html += '<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">';
      COLS.forEach((col, i) => {
        const best = bestOf(i);
        html += `<div style="display:grid;grid-template-columns:110px repeat(${students.length},1fr);border-bottom:1px solid var(--border);${i === COLS.length - 1 ? 'border-bottom:none' : ''}">
          <div style="padding:10px 14px;font-family:'DM Mono',monospace;font-size:10px;color:var(--text3);letter-spacing:.5px;background:var(--bg3);display:flex;align-items:center">${col}</div>`;
        students.forEach((s, ci) => {
          const v = vals(s)[i];
          const num = parseFloat(v);
          const isBest = best !== null && num === best;
          html += `<div style="padding:10px 14px;font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;color:${isBest ? colorVars[ci] : 'var(--text2)'};display:flex;align-items:center;justify-content:center;background:${isBest ? colors[ci] + '0d' : ''}">${v}</div>`;
        });
        html += '</div>';
      });
      html += '</div>';

      const sharedExams = EXAMS.filter(e => students.every(s => s.apps.some(a => a.exam_id === e.id)));
      if (sharedExams.length) {

        const chartExams = sharedExams.length > 12 ? sharedExams.slice(-12) : sharedExams;
        const hasMore = sharedExams.length > chartExams.length;
        html += `<div style="margin-top:24px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text3);letter-spacing:1px">HEAD TO HEAD  - ${sharedExams.length} Shared Test${sharedExams.length>1?'s':''}</div>
            ${hasMore?`<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3)">Chart shows most recent ${chartExams.length}</div>`:''}
          </div>
          <div style="height:220px;position:relative"><canvas id="compare-chart"></canvas></div>
        </div>`;

        const showAll = sharedExams.length <= 8;
        const visibleExams = showAll ? sharedExams : sharedExams.slice(-8);
        html += `<div style="margin-top:20px">
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text3);letter-spacing:1px;margin-bottom:10px">PER-TEST BREAKDOWN${!showAll?` (${sharedExams.length-8} earlier tests hidden)`:''}</div>
          <div style="display:flex;flex-direction:column;gap:6px">
          ${visibleExams.map(e => {
            const maxMark = Math.max(...students.map(s => s.apps.find(a => a.exam_id === e.id)?.marks ?? 0));
            return `<div style="background:var(--bg3);border-radius:6px;padding:8px 12px">
              <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text3);margin-bottom:6px;letter-spacing:.5px">${e.label}</div>
              ${students.map((s, ci) => {
                const mark = s.apps.find(a => a.exam_id === e.id)?.marks ?? null;
                if (mark === null) return '';
                const pct = maxMark > 0 ? mark / maxMark * 100 : 0;
                return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
                  <div style="width:72px;font-size:12px;color:${colorVars[ci]};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name.split(' ')[0]}</div>
                  <div style="flex:1;height:4px;background:var(--bg2);border-radius:2px"><div style="width:${pct}%;height:100%;background:${colors[ci]};border-radius:2px"></div></div>
                  <div style="width:28px;font-family:'DM Mono',monospace;font-size:11px;color:${colorVars[ci]};text-align:right">${mark}</div>
                </div>`;
              }).join('')}
            </div>`;
          }).join('')}
          </div>
        </div>`;
      }

      document.getElementById('compare-body').innerHTML = html;
      document.getElementById('compare-overlay').classList.add('open');

      if (sharedExams.length) {
        const chartExams = sharedExams.length > 12 ? sharedExams.slice(-12) : sharedExams;
        setTimeout(() => {
          const ctx = document.getElementById('compare-chart')?.getContext('2d');
          if (!ctx) return;
          new Chart(ctx, {
            type: 'line',
            data: {
              labels: chartExams.map(e => e.label),
              datasets: students.map((s, ci) => ({
                label: s.name.split(' ')[0],
                data: chartExams.map(e => s.apps.find(a => a.exam_id === e.id)?.marks ?? null),
                borderColor: colors[ci], backgroundColor: colors[ci] + '18',
                borderWidth: 2, pointRadius: 5, fill: false, tension: .3
              }))
            },
            options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { labels: { color: '#9090b0', font: { family: 'DM Mono', size: 11 } } } },
              scales: {
                x: { ticks: { color: '#5a5a78', font: { family: 'DM Mono', size: 9 }, maxRotation: 30 }, grid: { color: 'rgba(255,255,255,.04)' } },
                y: { ticks: { color: '#5a5a78', font: { family: 'DM Mono', size: 9 } }, grid: { color: 'rgba(255,255,255,.04)' } }
              }
            }
          });
        }, 50);
      }
    }

    function closeCompare(ev) {
      if (!ev || ev.target === document.getElementById('compare-overlay')) {
        document.getElementById('compare-overlay').classList.remove('open');
        renderCompareFab();
      }
    }

    function _getLbData() {
      const sel = lbTestSel;
      const isAll = isAgg(sel);
      let raw = getRowsForSel(sel);
      if (lbSchool) raw = raw.filter(r => r.school === lbSchool);
      if (lbGender) raw = raw.filter(r => r.gender === lbGender);
      const nameF = (document.getElementById('lb-name')?.value || '').toLowerCase();
      if (nameF) raw = raw.filter(r => r.name.toLowerCase().includes(nameF));
      let data = isAll ? aggregateByStudent(raw) : (() => {
        const dm = {};
        raw.forEach(r => { const k = r.name + '\x00' + r.school; if (!dm[k] || r.marks > dm[k].marks) dm[k] = r; });
        return Object.values(dm);
      })();
      data.sort((a, b) => isAll ? (b.rating - a.rating) : (b.marks - a.marks));

      let rank = 1;
      data.forEach((r, i) => {
        if (i > 0) {
          const prev = isAll ? data[i-1].rating : data[i-1].marks;
          const cur  = isAll ? r.rating         : r.marks;
          if (cur < prev) rank = i + 1;
        }
        r._exportRank = rank;
      });
      return { data, isAll };
    }

    function exportLeaderboardCSV() {
      const { data, isAll } = _getLbData();
      const label = document.getElementById('lb-title')?.textContent || 'Leaderboard';
      const headers = isAll
        ? ['Rank', 'Name', 'School', 'Gender', 'Rating', 'Avg Score', 'Best', 'Tests']
        : ['Rank', 'Name', 'School', 'Gender', 'Score'];
      const rows = data.map(r => isAll
        ? [r._exportRank, r.name, r.school, r.gender === 'B' ? 'M' : r.gender === 'G' ? 'F' : '', r.rating.toFixed(2), r.marks, r.best, r.tests]
        : [r._exportRank, r.name, r.school, r.gender === 'B' ? 'M' : r.gender === 'G' ? 'F' : '', r.marks]);
      const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `DEKMA_${selectedCity}_${selectedYear}_${label.replace(/\s+/g, '_')}.csv`;
      a.click();
    }

    function exportLeaderboardPDF() {
      const { data, isAll } = _getLbData();
      const label = document.getElementById('lb-title')?.textContent || 'Leaderboard';
      const city = (selectedCity || '').charAt(0).toUpperCase() + (selectedCity || '').slice(1);
      const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      let attempts = 0;
      function tryGenerate() {
        const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!jsPDF) {
          if (++attempts < 15) { setTimeout(tryGenerate, 200); return; }
          alert('PDF library not yet loaded  - please try again in a moment.'); return;
        }
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();
        const DARK  = [13, 13, 24];
        const AMBER = [200, 130, 10];
        const AMB2  = [255, 200, 80];
        const MID   = [80, 80, 110];
        const LIGHT = [245, 245, 250];
        const WHITE = [255, 255, 255];

        doc.setFillColor(...DARK); doc.rect(0, 0, W, 28, 'F');
        doc.setFillColor(...AMBER); doc.rect(0, 0, 4, 28, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...WHITE);
        doc.text('DEKMA', 10, 12);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...AMB2);
        doc.text('APPLIED MATHEMATICS RESULTS', 10, 18);
        doc.setTextColor(...WHITE); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text(`${city} \u00b7 ${selectedYear}`, W - 10, 10, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(200, 200, 220);
        doc.text(label, W - 10, 16, { align: 'right' });
        doc.text(dateStr, W - 10, 22, { align: 'right' });

        doc.setFillColor(...LIGHT); doc.roundedRect(10, 32, 55, 9, 2, 2, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...DARK);
        doc.text(`${data.length} students`, 37.5, 38, { align: 'center' });

        const scoreColIdx = 4;
        const head = isAll
          ? [['#', 'Name', 'School', 'G', 'Rating', 'Avg', 'Best', 'Tests']]
          : [['#', 'Name', 'School', 'G', 'Score']];
        const body = data.map(r => isAll
          ? [r._exportRank, r.name, r.school || '\u2014', r.gender === 'B' ? 'M' : r.gender === 'G' ? 'F' : '\u2014', r.rating.toFixed(2), r.marks, r.best, r.tests]
          : [r._exportRank, r.name, r.school || '\u2014', r.gender === 'B' ? 'M' : r.gender === 'G' ? 'F' : '\u2014', r.marks]);
        const colStyles = isAll
          ? { 0:{cellWidth:10,halign:'right'}, 1:{cellWidth:40}, 2:{cellWidth:46}, 3:{cellWidth:8,halign:'center'}, 4:{cellWidth:20,halign:'right'}, 5:{cellWidth:16,halign:'right'}, 6:{cellWidth:16,halign:'right'}, 7:{cellWidth:14,halign:'center'} }
          : { 0:{cellWidth:12,halign:'right'}, 1:{cellWidth:58}, 2:{cellWidth:74}, 3:{cellWidth:10,halign:'center'}, 4:{cellWidth:24,halign:'right'} };
        doc.autoTable({
          head, body, startY: 44, margin: { left: 10, right: 10 },
          styles: { font:'helvetica', fontSize:8, cellPadding:2.4, textColor:DARK, lineColor:[225,225,232], lineWidth:0.2 },
          headStyles: { fillColor:DARK, textColor:WHITE, fontSize:7, fontStyle:'bold', halign:'left', cellPadding:{top:3.5,bottom:3.5,left:2.4,right:2.4} },
          columnStyles: colStyles,
          alternateRowStyles: { fillColor:[250,250,253] },
          didParseCell(d) {
            if (d.section !== 'body') return;
            const rank = parseInt(body[d.row.index]?.[0]);
            const v = parseFloat(d.cell.raw);
            if (rank <= 3) d.cell.styles.fillColor = [255,251,235];
            if (d.column.index === scoreColIdx) {
              if (!isNaN(v) && v >= 80) { d.cell.styles.textColor = AMBER; d.cell.styles.fontStyle = 'bold'; }
              if (rank <= 3) d.cell.styles.fontStyle = 'bold';
            }
            if (d.column.index === 0) {
              d.cell.styles.textColor = rank <= 3 ? AMBER : MID;
              if (rank <= 3) d.cell.styles.fontStyle = 'bold';
            }
          },
          didDrawPage() {
            const pg = doc.internal.getCurrentPageInfo().pageNumber;
            const total = doc.internal.getNumberOfPages();
            doc.setDrawColor(220); doc.setLineWidth(0.2); doc.line(10, H-10, W-10, H-10);
            doc.setFontSize(7); doc.setTextColor(170);
            doc.text('DEKMA Results Portal', 10, H-7);
            doc.text(`${city} ${selectedYear} \u2014 ${label}`, W/2, H-7, { align:'center' });
            doc.text(`Page ${pg} / ${total}`, W-10, H-7, { align:'right' });
          }
        });
        doc.save(`DEKMA_${city}_${selectedYear}_${label.replace(/\s+/g,'_')}.pdf`);
      }
      tryGenerate();
    }

    const INFO_CONTENT = {
      'test-history': {
        title: 'Impact Score (σ)',
        html: `
          <p style="margin-bottom:10px"><strong>Impact</strong> measures performance relative to the difficulty of a specific testa lower score on a harder test may reflect stronger performance than a higher score on an easier one.</p>
          <p style="margin-bottom:8px">Formula: <strong>(score − class mean) ÷ class standard deviation</strong></p>
          <div class="info-sep"></div>
          <div class="info-row"><span class="info-key">+2σ 🔥</span><span class="info-val">Exceptional  - top ~2% of that test</span></div>
          <div class="info-row"><span class="info-key">+1σ ✦</span><span class="info-val">Above average</span></div>
          <div class="info-row"><span class="info-key">0σ ·</span><span class="info-val">Around class mean</span></div>
          <div class="info-row"><span class="info-key">−1σ ▼</span><span class="info-val">Below average for that test</span></div>
        `
      },
      'rating': {
        title: 'About the Rating',
        html: `
          <p style="margin-bottom:10px">The <strong>Rating</strong> is a conservative estimate of a student's skill level. It's designed to be a fair cross-test ranking that penalises inconsistency.</p>
          <div class="info-sep"></div>
          <p style="margin-bottom:8px"><strong>How it's calculated:</strong></p>
          <div class="info-row"><span class="info-key">Mean Rating</span><span class="info-val">The average of all difficulty-adjusted scores (z-scores rescaled to a 0–100 range) across every test taken.</span></div>
          <div class="info-row"><span class="info-key">Rating</span><span class="info-val">A <em>lower-bound</em> estimate the mean minus a fraction of the standard deviation. This rewards consistency and prevents one great test from inflating the rating.</span></div>
          <div class="info-sep"></div>
          <p style="margin-bottom:8px">The two numbers shown are:<br><strong>Rating / Mean Rating</strong></p>
          <p style="color:var(--text3);font-size:11px">A student with Rating 82 / 88 has a skill mean of 88 but a conservative floor of 82 they occasionally underperform. A student with 85 / 86 is very consistent.</p>
          <p style="color:var(--text3);font-size:11px;margin-top:8px">Rating is used for the Overall Rank and the Leaderboard "All Tests" view.</p>
        `
      },
      'rank-tiers': {
        title: 'Rank Tiers Explained',
        html: `
          <p style="margin-bottom:10px">The <strong>Overall Rank</strong> is calculated by sorting all unique students by their Rating (difficulty-adjusted score). The tier label shows where you stand in the entire cohort.</p>
          <div class="info-sep"></div>
          <div class="info-row"><span class="info-key" style="color:#ffd700"><i class="ph ph-star" style="color:#ffd700"></i> Elite</span><span class="info-val">Top 1% - exceptional across all tests.</span></div>
          <div class="info-row"><span class="info-key" style="color:var(--amber)"><i class="ph ph-trophy" style="color:var(--amber)"></i> Gold</span><span class="info-val">Top 5% - consistently high performance.</span></div>
          <div class="info-row"><span class="info-key" style="color:var(--teal)"><i class="ph ph-medal" style="color:#C0C0C0"></i> Silver</span><span class="info-val">Top 15% - well above average.</span></div>
          <div class="info-row"><span class="info-key" style="color:var(--blue)"><i class="ph ph-medal" style="color:#CD7F32"></i> Bronze</span><span class="info-val">Top 30% - above average performer.</span></div>
          <div class="info-row"><span class="info-key" style="color:#e8a020">◈ Rising</span><span class="info-val">Top 55% - above the midpoint.</span></div>
          <div class="info-row"><span class="info-key">· Standard</span><span class="info-val">Remaining participants.</span></div>
          <div class="info-sep"></div>
          <p style="color:var(--text3);font-size:11px">The <strong>Theory</strong> and <strong>Revision</strong> rank chips show separate rankings using only the respective test type useful for identifying type specialists.</p>
          <p style="color:var(--text3);font-size:11px;margin-top:6px">The percentile (e.g. "93rd pct") shows what fraction of students this person outperforms.</p>
        `
      },
      'school-ranking': {
        title: 'Bayesian-Adjusted Average',
        html: `
          <p style="margin-bottom:10px">A school with very few students may show an inflated raw average that does not reflect true performance. The Bayesian adjustment pulls each school's average toward the global mean, weighted by sample size. The fewer the students, the greater the correction.</p>
          <p style="color:var(--text3);font-size:11px">Formula: <strong>(sum of scores + k × global_mean) ÷ (n + k)</strong> where k is calibrated from the data spread.</p>
        `
      }
    };

    let _activeInfoTarget = null;

    function showInfoPopover(btn, key) {
      const pop = document.getElementById('info-popover');
      const content = INFO_CONTENT[key];
      if (!content) return;
      if (_activeInfoTarget === btn && pop.classList.contains('open')) { closeInfoPopover(); return; }
      _activeInfoTarget = btn;
      pop.innerHTML = `<div class="info-popover-title">${content.title}</div><div class="info-popover-body">${content.html}</div>`;
      pop.style.cssText = 'left:-9999px;top:-9999px;max-width:320px;max-height:none;overflow-y:visible;display:block';
      pop.classList.add('open');
      const rect = btn.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight, m = 10;
      const pw = Math.min(320, vw - m * 2);
      const ph = Math.min(pop.offsetHeight, vh - m * 2);
      let left = rect.left;
      if (left + pw > vw - m) left = vw - pw - m;
      if (left < m) left = m;
      let top, useScroll = false;
      const spaceBelow = vh - rect.bottom - m, spaceAbove = rect.top - m;
      if (spaceBelow >= ph) top = rect.bottom + 6;
      else if (spaceAbove >= ph) top = rect.top - ph - 6;
      else { top = rect.bottom + 6; if (top + ph > vh - m) top = m; useScroll = true; }
      pop.style.cssText = `left:${left}px;top:${top}px;max-width:${pw}px;max-height:${ph}px;overflow-y:${useScroll ? 'auto' : 'visible'}`;
    }

    function closeInfoPopover() {
      document.getElementById('info-popover')?.classList.remove('open');
      _activeInfoTarget = null;
    }

    document.addEventListener('click', e => {
      if (!e.target.closest('.info-btn') && !e.target.closest('#info-popover')) closeInfoPopover();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeInfoPopover(); }, true);
    window.addEventListener('scroll', closeInfoPopover, { passive: true, capture: true });

    function openSchoolDrawer(title, html) {
      document.getElementById('school-drawer-title').textContent = title;
      document.getElementById('school-drawer-body').innerHTML = html;
      document.getElementById('school-drawer-overlay').classList.add('open');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.getElementById('school-drawer').classList.add('open');
      }));
      document.body.style.overflow = 'hidden';
      const drawer = document.getElementById('school-drawer');
      let _ty = 0, _startY = 0, _dragging = false;
      function onTouchStart(e) {
        const body = document.getElementById('school-drawer-body');
        if (!e.target.closest('.school-drawer-handle, .school-drawer-header') && body.scrollTop > 0) return;
        _startY = e.touches[0].clientY; _dragging = true; _ty = 0;
        drawer.style.transition = 'none';
      }
      function onTouchMove(e) {
        if (!_dragging) return;
        _ty = Math.max(0, e.touches[0].clientY - _startY);
        drawer.style.transform = `translateY(${_ty}px)`;
      }
      function onTouchEnd() {
        if (!_dragging) return;
        _dragging = false; drawer.style.transition = ''; drawer.style.transform = '';
        if (_ty > 80) closeSchoolDrawer(); else drawer.style.transform = 'translateY(0)';
      }
      drawer._swipeTouchStart = onTouchStart;
      drawer._swipeTouchMove = onTouchMove;
      drawer._swipeTouchEnd  = onTouchEnd;
      drawer.addEventListener('touchstart', onTouchStart, { passive: true });
      drawer.addEventListener('touchmove',  onTouchMove,  { passive: true });
      drawer.addEventListener('touchend',   onTouchEnd);
    }

    function closeSchoolDrawer() {
      const drawer = document.getElementById('school-drawer');
      drawer.classList.remove('open');
      document.getElementById('school-drawer-overlay').classList.remove('open');
      document.body.style.overflow = '';
      if (drawer._swipeTouchStart) {
        drawer.removeEventListener('touchstart', drawer._swipeTouchStart);
        drawer.removeEventListener('touchmove',  drawer._swipeTouchMove);
        drawer.removeEventListener('touchend',   drawer._swipeTouchEnd);
        delete drawer._swipeTouchStart; delete drawer._swipeTouchMove; delete drawer._swipeTouchEnd;
      }
    }

    let _stuTlFilter='all', _stuThFilter='all', _stuChartMode='score';

    function _syncStuBtns(prefix, active) {
      ['all','theory','revision','model'].forEach(t=>{
        const b=document.getElementById(prefix+t);
        if(!b)return;
        const isActive=t===active;
        b.style.background=isActive?(t==='all'?'var(--bg3)':typeColor(t)+'22'):'transparent';
        b.style.borderColor=isActive?(t==='all'?'var(--border2)':typeColor(t)):(t==='all'?'var(--border2)':'transparent');
        b.style.color=isActive?(t==='all'?'var(--text)':typeColor(t)):(t==='all'?'var(--text2)':typeColor(t));
        b.style.opacity=isActive?'1':'0.55';
      });

    }
    function setStuTimelineFilter(name, school, filter) {
      _stuTlFilter=filter;
      _syncStuBtns('stu-tl-',filter);
      const all=ALL.filter(r=>r.name===name&&r.school===school)
        .sort((a,b)=>a.exam_type===b.exam_type?a.exam_id.localeCompare(b.exam_id):(TYPE_SORT[a.exam_type]??9)-(TYPE_SORT[b.exam_type]??9));
      const fa=filter==='all'?all:filter==='model'?all.filter(a=>isModelType(a.exam_type)):all.filter(a=>a.exam_type===filter);
      if(!fa.length)return;
      if(_stuChartMode==='rank') _renderStuRankChart(fa);
      else _renderStuChart(fa,Math.max(...fa.map(a=>a.marks)));
    }
    function setStuChartMode(name, school, mode) {
      _stuChartMode = mode;
      const sBtn = document.getElementById('stu-cm-score');
      const rBtn = document.getElementById('stu-cm-rank');
      if (sBtn) {
        sBtn.style.background   = mode==='score' ? 'var(--bg3)' : 'transparent';
        sBtn.style.color        = mode==='score' ? 'var(--text)' : 'var(--text3)';
      }
      if (rBtn) {
        rBtn.style.background   = mode==='rank' ? 'rgba(232,160,32,.12)' : 'transparent';
        rBtn.style.color        = mode==='rank' ? 'var(--amber)' : 'var(--text3)';
        rBtn.style.borderLeft   = mode==='rank' ? '1px solid rgba(232,160,32,.35)' : '1px solid transparent';
      }
      const all=ALL.filter(r=>r.name===name&&r.school===school)
        .sort((a,b)=>a.exam_type===b.exam_type?a.exam_id.localeCompare(b.exam_id):(TYPE_SORT[a.exam_type]??9)-(TYPE_SORT[b.exam_type]??9));
      const fa=_stuTlFilter==='all'?all:_stuTlFilter==='model'?all.filter(a=>isModelType(a.exam_type)):all.filter(a=>a.exam_type===_stuTlFilter);
      if(!fa.length)return;
      if(mode==='rank') _renderStuRankChart(fa);
      else _renderStuChart(fa,Math.max(...fa.map(a=>a.marks)));
    }
    function _renderStuRankChart(sortedApps) {
      const ctx=document.getElementById('stu-chart')?.getContext('2d');
      setChartScrollWidth('stu-chart-wrap', sortedApps.length);
      if(!ctx)return;
      if(CHARTS.stuChart)CHARTS.stuChart.destroy();
      const ranks=sortedApps.map(a=>a.rank);
      const bestRank=Math.min(...ranks);
      const worstRank=Math.max(...ranks);
      const ptColors=sortedApps.map(a=>typeColorCanvas(a.exam_type));
      const dynRadius=ctx2=>{const w=ctx2.chart.width||300;const base=w<320?2:w<500?3:5;return sortedApps[ctx2.dataIndex]?.rank===bestRank?base+3:base;};
      const dynHover=ctx2=>{const w=ctx2.chart.width||300;return w<500?6:9;};
      const pad=Math.max(5,Math.ceil((worstRank-bestRank)*0.25)+2);
      CHARTS.stuChart=new Chart(ctx,{
        type:'line',
        data:{
          labels:sortedApps.map(a=>a.exam_label),
          datasets:[{
            label:'Rank',data:ranks,
            borderColor:'rgba(232,160,32,.55)',
            backgroundColor:ctx2=>{const c=ctx2.chart.ctx,area=ctx2.chart.chartArea;if(!area)return 'rgba(232,160,32,.06)';const g=c.createLinearGradient(0,area.top,0,area.bottom);g.addColorStop(0,'rgba(232,160,32,.01)');g.addColorStop(1,'rgba(232,160,32,.14)');return g;},
            borderWidth:2,fill:'end',tension:.35,
            pointBackgroundColor:ptColors,pointBorderColor:ptColors,pointBorderWidth:2,pointRadius:dynRadius,pointHoverRadius:dynHover,
          }]
        },
        options:{
          responsive:true,maintainAspectRatio:false,elements:{point:{hitRadius:18}},
          plugins:{
            legend:{display:false},
            tooltip:{
              backgroundColor:'rgba(17,17,24,.95)',borderColor:'rgba(255,255,255,.1)',borderWidth:1,
              titleFont:{family:'DM Mono',size:11},bodyFont:{family:'DM Mono',size:11},
              callbacks:{label:c=>{const a=sortedApps[c.dataIndex];return a?`▸ ${typeLabel(a.exam_type)} · Rank #${c.parsed.y}`:'';}}
            }
          },
          scales:{
            x:{ticks:{color:'#5a5a78',font:{family:'DM Mono',size:9},maxRotation:30},grid:{color:'rgba(255,255,255,.03)'}},
            y:{
              reverse:true,
              suggestedMin:Math.max(1,bestRank-pad),
              suggestedMax:worstRank+pad,
              ticks:{color:'#5a5a78',font:{family:'DM Mono',size:9},callback:v=>Number.isInteger(v)&&v>=1?`#${v}`:''},
              grid:{color:'rgba(255,255,255,.04)'}
            }
          }
        }
      });
    }
    function setStuHistoryFilter(name, school, filter) {
      _stuThFilter=filter;
      _syncStuBtns('stu-th-',filter);
      const wrap=document.getElementById('stu-history-table');
      if(!wrap)return;
      wrap.querySelectorAll('tbody tr').forEach(row=>{
        const t=row.dataset.etype||'';
        row.style.display=(filter==='all'||(filter==='model'?isModelType(t):t===filter))?'':'none';
      });
    }
    function _renderStuChart(sortedApps, best) {
      const ctx=document.getElementById('stu-chart')?.getContext('2d');
      setChartScrollWidth('stu-chart-wrap', sortedApps.length);
      if(!ctx)return;
      if(CHARTS.stuChart)CHARTS.stuChart.destroy();
      const sortedMarks=sortedApps.map(a=>a.marks);
      const ptColors=sortedApps.map(a=>typeColorCanvas(a.exam_type));
      const thyCount=sortedApps.filter(a=>a.exam_type==='theory').length;
      const allReg=sortedApps.every(a=>a.exam_type==='theory'||a.exam_type==='revision');
      const dynRadius=ctx=>{const w=ctx.chart.width||300;const base=w<320?2:w<500?3:5;return sortedApps[ctx.dataIndex]?.marks===best?base+3:base;};
      const dynHover=ctx=>{const w=ctx.chart.width||300;return w<500?6:9;};
      const datasets=[{
        label:'Score',data:sortedMarks,borderColor:'rgba(96,165,250,.45)',
        backgroundColor:ctx2=>{const c=ctx2.chart.ctx,area=ctx2.chart.chartArea;if(!area)return 'rgba(96,165,250,.06)';const g=c.createLinearGradient(0,area.top,0,area.bottom);g.addColorStop(0,'rgba(96,165,250,.12)');g.addColorStop(1,'rgba(96,165,250,.01)');return g;},
        borderWidth:2,fill:true,tension:.35,
        pointBackgroundColor:ptColors,pointBorderColor:ptColors,pointBorderWidth:2,pointRadius:dynRadius,pointHoverRadius:dynHover,
      }];
      const classAvgs=sortedApps.map(a=>{const e=EXAMS.find(x=>x.id===a.exam_id);return e?+(e.students.reduce((s,st)=>s+st.marks,0)/e.students.length).toFixed(1):null;});
      datasets.push({label:'Class Avg',data:classAvgs,borderColor:'rgba(255,255,255,.18)',backgroundColor:'transparent',borderWidth:1,borderDash:[5,4],pointRadius:0,fill:false,tension:.3});
      CHARTS.stuChart=new Chart(ctx,{
        type:'line',data:{labels:sortedApps.map(a=>a.exam_label),datasets},
        options:{
          responsive:true,maintainAspectRatio:false,elements:{point:{hitRadius:18}},
          plugins:{legend:{display:false},tooltip:{
            backgroundColor:'rgba(17,17,24,.95)',borderColor:'rgba(255,255,255,.1)',borderWidth:1,
            titleFont:{family:'DM Mono',size:11},bodyFont:{family:'DM Mono',size:11},
            callbacks:{label:c=>{if(c.datasetIndex===0){const a=sortedApps[c.dataIndex];return a?`▸ ${typeLabel(a.exam_type)} · ${c.parsed.y} pts`:'';}return `Class avg · ${c.parsed.y}`;}}
          }},
          scales:{
            x:{ticks:{color:'#5a5a78',font:{family:'DM Mono',size:9},maxRotation:30},grid:{color:'rgba(255,255,255,.03)'},
              afterDrawTickLabels(ax){
                if(!allReg||thyCount===0||thyCount>=sortedApps.length)return;
                const chart=ax.chart,meta=chart.getDatasetMeta(0);if(!meta.data[thyCount-1])return;
                const xA=meta.data[thyCount-1].x,xB=meta.data[thyCount]?.x,x=xA+(xB?xB-xA:0)/2;
                const ctx3=chart.ctx;ctx3.save();ctx3.beginPath();ctx3.strokeStyle='rgba(255,255,255,.12)';ctx3.lineWidth=1;ctx3.setLineDash([4,4]);
                ctx3.moveTo(x,chart.chartArea.top);ctx3.lineTo(x,chart.chartArea.bottom);ctx3.stroke();
                ctx3.fillStyle='#5a5a78';ctx3.font='8px DM Mono,monospace';ctx3.fillText('← Theory   Revision →',x-60,chart.chartArea.top+12);ctx3.restore();
              }
            },
            y:{min:Math.max(0,Math.min(...sortedMarks,...classAvgs.filter(v=>v!==null))-14),max:Math.min(105,Math.max(...sortedMarks,...classAvgs.filter(v=>v!==null))+12),ticks:{color:'#5a5a78',font:{family:'DM Mono',size:9}},grid:{color:'rgba(255,255,255,.04)'}}
          }
        }
      });
    }

    let _fsChart = null;

    function openChartFs(wrapId, title) {
      const wrap = document.getElementById(wrapId);
      if (!wrap) return;
      const srcCanvas = wrap.querySelector('canvas');
      if (!srcCanvas) return;
      const srcChart = Object.values(CHARTS).find(c => c.canvas === srcCanvas);
      const overlay = document.getElementById('chart-fs-overlay');
      const body = document.getElementById('chart-fs-body');
      const titleEl = document.getElementById('chart-fs-title');
      if (!overlay || !body) return;
      titleEl.textContent = title || '';
      body.innerHTML = '<canvas id="chart-fs-canvas" style="width:100%;height:100%"></canvas>';
      body.style.height = '';
      if (srcChart) {
        const cfg = JSON.parse(JSON.stringify({ type: srcChart.config.type, data: srcChart.config.data, options: { ...srcChart.config.options, animation: false } }));
        if (_fsChart) { try { _fsChart.destroy(); } catch(e){} }
        _fsChart = new Chart(document.getElementById('chart-fs-canvas').getContext('2d'), cfg);
      }
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeChartFs(ev) {
      if (ev && ev.target !== document.getElementById('chart-fs-overlay')) return;
      _doCloseFs();
    }
    function closeChartFsBtn() { _doCloseFs(); }
    function _doCloseFs() {
      document.getElementById('chart-fs-overlay')?.classList.remove('open');
      document.body.style.overflow = '';
      if (_fsChart) { try { _fsChart.destroy(); } catch(e){} _fsChart = null; }
    }

    document.addEventListener('mousedown', e => {
      const inner = e.target.closest('.chart-scroll-inner');
      if (!inner) return;
      inner._dragStartX = e.pageX;
      inner._dragScrollLeft = inner.scrollLeft;
      inner._dragging = true;
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      document.querySelectorAll('.chart-scroll-inner._dragging, .chart-scroll-inner').forEach(inner => {
        if (!inner._dragging) return;
        const dx = e.pageX - inner._dragStartX;
        inner.scrollLeft = inner._dragScrollLeft - dx;
      });
    });
    document.addEventListener('mouseup', () => {
      document.querySelectorAll('.chart-scroll-inner').forEach(el => el._dragging = false);
    });

    const PAGE_KEYS = { '1':'dashboard','2':'leaderboard','3':'tests','4':'students','5':'schools','6':'analytics' };

    function toggleKbdPanel(e) {
      if (e) e.stopPropagation();
      const panel = document.getElementById('kbd-panel');
      const btn = document.getElementById('kbd-hint-btn');
      const isOpen = panel.classList.contains('open');
      if (isOpen) { panel.classList.remove('open'); btn.classList.remove('active'); return; }
      const rect = btn.getBoundingClientRect();
      panel.style.cssText = `right:${window.innerWidth - rect.right}px;top:${rect.bottom + 6}px`;
      panel.classList.add('open');
      btn.classList.add('active');
    }

    function closeKbdPanel() {
      document.getElementById('kbd-panel')?.classList.remove('open');
      document.getElementById('kbd-hint-btn')?.classList.remove('active');
    }

    document.addEventListener('click', e => {
      if (!e.target.closest('#kbd-hint-btn') && !e.target.closest('#kbd-panel')) closeKbdPanel();
    });

    document.addEventListener('keydown', e => {
      const tag = document.activeElement?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;

      if (e.key === 'Escape') {
        closeKbdPanel();
        closeInfoPopover();
        closeSchoolDrawer();

        const mo = document.getElementById('modal-overlay');
        if (mo?.classList.contains('open')) { closeModal(); return; }
        const co = document.getElementById('compare-overlay');
        if (co?.classList.contains('open')) { closeCompare(); return; }

        const sp = document.getElementById('stu-profile');
        if (sp && sp.style.display !== 'none') { goBackFromProfile(); }
        return;
      }

      if (inInput) return;

      if (e.key === '/') {
        e.preventDefault();
        const si = document.getElementById('global-search');
        if (si) { si.focus(); si.select(); }
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        const btn = document.getElementById('kbd-hint-btn');
        if (btn) toggleKbdPanel({ stopPropagation: () => {} });
        return;
      }

      if (PAGE_KEYS[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        location.hash = PAGE_KEYS[e.key];
      }
    });

    (function () {

      function _dk() {
        try { return atob('ZmFpb3Nh').split('').reverse().join(''); } catch(e) { return ''; }
      }

      const KONAMI_KEY = _dk();
      const CTRL_NEEDED = 3;
      let ctrlCount = 0, ctrlTimer = null;
      let seqBuf = '', seqActive = false;

      document.addEventListener('keydown', e => {
        if (e.key === 'Control' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          ctrlCount++;
          clearTimeout(ctrlTimer);
          ctrlTimer = setTimeout(() => { ctrlCount = 0; }, 1200);
          if (ctrlCount >= CTRL_NEEDED) {
            ctrlCount = 0;
            seqBuf = '';
            seqActive = true;
          }
          return;
        }
        if (seqActive && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          if (e.key === 'Escape') { seqActive = false; seqBuf = ''; return; }
          if (e.key.length === 1) {
            seqBuf += e.key.toLowerCase();
            if (seqBuf.length > KONAMI_KEY.length) seqBuf = seqBuf.slice(-KONAMI_KEY.length);
            if (seqBuf === KONAMI_KEY) {
              seqActive = false; seqBuf = '';
              sessionStorage.setItem('__adm', Date.now().toString());
              window.location.href = 'admin.html';
            }
          }
        }
      });

      const BADGE_HOLD_MS = 800;
      const SEQ_KEY       = _dk();
      const SEQ_EXPIRE_MS = 30000;

      let _badgeHoldTimer = null;
      let _mobileSeqArmed = false;
      let _mobileSeqExpiry = 0;
      let _mobileSeqBuf = '';
      let _longPressTriggered = false;
      let _gestureAttached = false;
      let _pStartX = 0, _pStartY = 0;

      function _armMobileSeq() {
        _mobileSeqArmed = true;
        _mobileSeqExpiry = Date.now() + SEQ_EXPIRE_MS;
        _mobileSeqBuf = '';
        _longPressTriggered = true;
        setTimeout(function () { _mobileSeqArmed = false; _mobileSeqBuf = ''; }, SEQ_EXPIRE_MS);
      }

      function _cancelBadgeTimer() {
        clearTimeout(_badgeHoldTimer);
        _badgeHoldTimer = null;
      }

      function _attachGesture() {
        if (_gestureAttached) return;
        var badge = document.getElementById('context-badge');
        if (!badge) return;
        _gestureAttached = true;

        badge.addEventListener('contextmenu', function (e) { e.preventDefault(); });

        badge.addEventListener('pointerdown', function (e) {
          _longPressTriggered = false;
          _cancelBadgeTimer();
          _pStartX = e.clientX;
          _pStartY = e.clientY;
          _badgeHoldTimer = setTimeout(_armMobileSeq, BADGE_HOLD_MS);
        });

        badge.addEventListener('pointerup', function () { _cancelBadgeTimer(); });
        badge.addEventListener('pointercancel', function () { _cancelBadgeTimer(); });

        badge.addEventListener('pointermove', function (e) {
          if (!_badgeHoldTimer) return;
          var dx = e.clientX - _pStartX, dy = e.clientY - _pStartY;
          if (dx * dx + dy * dy > 100) _cancelBadgeTimer();
        });

        badge.addEventListener('click', function (e) {
          if (_longPressTriggered) {
            _longPressTriggered = false;
            e.stopImmediatePropagation();
            e.preventDefault();
          }
        }, true);

        document.addEventListener('input', function (e) {
          var inp = document.getElementById('mobile-search-input');
          if (!inp || e.target !== inp) return;
          if (!_mobileSeqArmed || Date.now() > _mobileSeqExpiry) return;
          _mobileSeqBuf = inp.value.toLowerCase().replace(/[^a-z]/g, '');
          if (_mobileSeqBuf.endsWith(SEQ_KEY)) {
            _mobileSeqArmed = false;
            _mobileSeqBuf = '';
            closeMobileSearch();
            sessionStorage.setItem('__adm', Date.now().toString());
            window.location.href = 'admin.html';
          }
        }, true);
      }

      document.addEventListener('DOMContentLoaded', function () {
        _attachGesture();
        setTimeout(_attachGesture, 1500);
      });
    })();

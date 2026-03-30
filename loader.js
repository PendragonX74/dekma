    (function () {
      'use strict';

      function loadScript(src) {
        return new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = src;
          s.onload = resolve;
          s.onerror = function () { reject(new Error('Failed to load: ' + src)); };
          document.head.appendChild(s);
        });
      }

      function slug(s) {
        return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      }

      function mergeChunks() {
        window.dekmaData = window.dekmaData || {};
        (window.dekmaChunks || []).forEach(function (c) {
          var key = 'dekmaChunk_' + slug(c.city) + '_' + c.year;
          if (window[key]) {
            if (!window.dekmaData[c.city]) window.dekmaData[c.city] = {};
            window.dekmaData[c.city][c.year] = window[key];
          }
        });
      }

      async function bootstrap() {

        var version = '0';
        try {
          var res = await fetch('data/version.txt?_=' + Date.now());
          if (res.ok) version = (await res.text()).trim();
        } catch (e) {
          console.warn('Could not load version.txt, using fallback.', e);
        }

        try {
          await loadScript('data/results_index.js?v=' + version);
        } catch (e) {
          console.warn('Could not load results_index.js', e);
        }

        var chunks = window.dekmaChunks || [];
        await Promise.all(chunks.map(function (c) {
          return loadScript('data/' + c.file + '?v=' + version).catch(function (e) {
            console.warn('Failed to load chunk:', c.file, e);
          });
        }));

        mergeChunks();
        window._dataVersion = version;

        window._dekmaBootstrapDone = true;
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function () { loadData(); });
        } else {
          loadData();
        }
      }

      bootstrap();
    })();

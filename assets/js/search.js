/* SignalNest client-side search over a pre-built static index. */
(function () {
  'use strict';

  var form = document.getElementById('site-search-form');
  var input = document.getElementById('q');
  var results = document.getElementById('search-results');
  var status = document.getElementById('search-status');
  if (!form || !input || !results || !status) return;

  var index = null;
  var loading = null;

  function load() {
    if (index) return Promise.resolve(index);
    if (loading) return loading;
    loading = fetch('/data/search-index.json', { credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        index = Array.isArray(data.items) ? data.items : [];
        return index;
      })
      .catch(function () {
        loading = null;
        throw new Error('index-unavailable');
      });
    return loading;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function highlight(text, terms) {
    var safe = escapeHtml(text);
    if (!terms.length) return safe;
    var pattern = terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
    if (!pattern) return safe;
    return safe.replace(new RegExp('(' + pattern + ')', 'gi'), '<mark>$1</mark>');
  }

  function score(item, terms) {
    var title = (item.title || '').toLowerCase();
    var description = (item.description || '').toLowerCase();
    var category = (item.categoryName || '').toLowerCase();
    var body = (item.body || '').toLowerCase();
    var total = 0;
    var matchedAll = true;
    terms.forEach(function (term) {
      var hit = 0;
      if (title.indexOf(term) !== -1) hit += 12;
      if (title.indexOf(term) === 0) hit += 8;
      if (description.indexOf(term) !== -1) hit += 5;
      if (category.indexOf(term) !== -1) hit += 4;
      if (body.indexOf(term) !== -1) hit += 2;
      if (!hit) matchedAll = false;
      total += hit;
    });
    return matchedAll ? total : 0;
  }

  function snippet(item, terms) {
    var source = item.description || item.body || '';
    if (!terms.length) return source.slice(0, 190);
    var lower = source.toLowerCase();
    var position = -1;
    for (var i = 0; i < terms.length; i += 1) {
      var found = lower.indexOf(terms[i]);
      if (found !== -1 && (position === -1 || found < position)) position = found;
    }
    if (position === -1) return source.slice(0, 190);
    var start = Math.max(0, position - 70);
    return (start > 0 ? '…' : '') + source.slice(start, start + 190) + (source.length > start + 190 ? '…' : '');
  }

  function render(items, terms, query) {
    results.innerHTML = '';
    if (!items.length) {
      status.textContent = query ? 'No articles matched “' + query + '”.' : '';
      if (query) {
        results.innerHTML = '<div class="empty"><h2>No results</h2><p>Nothing matched that query. Try a shorter phrase, or browse by category.</p></div>';
      }
      return;
    }
    status.textContent = items.length + ' result' + (items.length === 1 ? '' : 's') + ' for “' + query + '”';
    var html = items.map(function (item) {
      return '<article class="result">' +
        '<h2 class="result__title"><a href="/articles/' + encodeURIComponent(item.slug) + '">' + highlight(item.title, terms) + '</a></h2>' +
        '<p class="result__excerpt">' + highlight(snippet(item, terms), terms) + '</p>' +
        '<div class="meta"><span class="meta__item">' + escapeHtml(item.categoryName) + '</span>' +
        '<span class="meta__item meta__dot">' + escapeHtml(item.publishedLabel || '') + '</span>' +
        '<span class="meta__item meta__dot">' + (item.readingTime || 1) + ' min read</span></div>' +
        '</article>';
    }).join('');
    results.innerHTML = html;
  }

  function run(query) {
    var trimmed = (query || '').trim();
    if (trimmed.length < 2) {
      results.innerHTML = '';
      status.textContent = 'Type at least two characters to search the archive.';
      return;
    }
    status.textContent = 'Searching…';
    load().then(function (items) {
      var terms = trimmed.toLowerCase().split(/\s+/).filter(function (t) { return t.length > 1; });
      var scored = items
        .map(function (item) { return { item: item, score: score(item, terms) }; })
        .filter(function (entry) { return entry.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .map(function (entry) { return entry.item; });
      render(scored, terms, trimmed);
    }).catch(function () {
      status.textContent = 'Search is temporarily unavailable.';
      results.innerHTML = '<div class="notice notice--warn">The search index could not be loaded. Please refresh, or browse the <a href="/">homepage</a>.</div>';
    });
  }

  var timer = null;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    var value = input.value;
    timer = setTimeout(function () {
      var url = new URL(window.location.href);
      if (value.trim()) url.searchParams.set('q', value.trim());
      else url.searchParams.delete('q');
      window.history.replaceState({}, '', url);
      run(value);
    }, 220);
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearTimeout(timer);
    var url = new URL(window.location.href);
    if (input.value.trim()) url.searchParams.set('q', input.value.trim());
    window.history.replaceState({}, '', url);
    run(input.value);
    input.blur();
  });

  var initial = new URLSearchParams(window.location.search).get('q');
  if (initial) {
    input.value = initial;
    run(initial);
  }

  // Quick topics buttons
  document.querySelectorAll('[data-quick-search]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var query = btn.getAttribute('data-quick-search');
      input.value = query;
      var url = new URL(window.location.href);
      url.searchParams.set('q', query);
      window.history.replaceState({}, '', url);
      run(query);
      input.focus();
    });
  });
})();

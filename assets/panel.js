/*
 * The author's tools: not for visitors. assets/look.js loads this file, with
 * assets/panel.css, only when the address has ?panel=1 (panel open) or
 * ?panel=0 (panel closed). Rolling the die keeps that part of the address.
 *
 * The panel lists every look, group by group, and each choice goes in the
 * address, so a combination can be tried, opened again or shared.
 *
 * Favourites: the heart next to the die keeps the look on screen. The list
 * lives in this browser (localStorage, also read by assets/galleria.js), and
 * the panel shows it, opens it and copies it. On the local preview server
 * every change is also requested as favourites.log?..., a file that does not
 * exist: the request only leaves a line in the server's log, so whoever runs
 * the server can read the list without copying it.
 */
(function () {
  'use strict';

  var look = window.Look;
  if (!look) return;

  var html = document.documentElement;
  var open = look.query.panel === '1';
  var FAVOURITES = 'favourite-looks';
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  // This page's look, written as an address: the key of a favourite.
  var current = look.parts().join('&');

  /* The address of the current look, with some choices changed. */
  function address(changes) {
    return '?' + look.parts(changes).concat(['panel=' + (open ? '1' : '0')]).join('&');
  }

  function favourites() {
    try {
      var list = JSON.parse(localStorage.getItem(FAVOURITES) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (ignored) {
      return [];
    }
  }

  function keep(list) {
    try { localStorage.setItem(FAVOURITES, JSON.stringify(list)); } catch (ignored) { /* no storage */ }
  }

  /* Leaves a line in the local server's log. */
  function tell(action, key) {
    if (local) new Image().src = look.root + 'favourites.log?' + action + '&' + key;
  }

  /* A favourite's choices, as { palette: 'notte', ... }. */
  function choices(key) {
    var out = {};
    key.split('&').forEach(function (part) {
      var pair = part.split('=');
      if (pair[0]) out[pair[0]] = pair[1];
    });
    return out;
  }

  /* What a favourite is called in the lists: what the eye notices first. */
  function describe(key) {
    var c = choices(key);
    var first = function (k) { return look.groups.filter(function (g) { return g.key === k; })[0].names[0]; };
    return [c.palette || first('palette'), c.model || first('model'), c.style || first('style')].join(' · ');
  }

  var changed = [];

  function toggleFavourite(key) {
    var list = favourites();
    var at = list.indexOf(key);
    if (at >= 0) {
      list.splice(at, 1);
      tell('remove', key);
    } else {
      list.push(key);
      tell('add', key);
    }
    keep(list);
    changed.forEach(function (redraw) { redraw(); });
  }

  /* The heart next to the die. */
  function heart() {
    var bar = document.querySelector('.bar');
    if (!bar) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'favourite';
    function paint() {
      var saved = favourites().indexOf(current) >= 0;
      button.textContent = saved ? '♥ Salvata' : '♡ Salva';
      button.setAttribute('aria-pressed', saved ? 'true' : 'false');
      button.title = saved ? 'Togli questo aspetto dalle preferite' : 'Tieni questo aspetto tra le preferite';
    }
    button.addEventListener('click', function () { toggleFavourite(current); });
    changed.push(paint);
    paint();
    var dice = bar.querySelector('.dice');
    bar.insertBefore(button, dice ? dice.nextSibling : bar.firstChild);
  }

  function build() {
    heart();

    var panel = document.createElement('aside');
    panel.className = 'preview-panel' + (open ? ' open' : '');
    panel.setAttribute('aria-label', 'Varianti');
    html.classList.toggle('preview-open', open);

    var head = document.createElement('div');
    head.className = 'preview-head';
    panel.appendChild(head);

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = 'Varianti';
    head.appendChild(toggle);

    var lucky = document.createElement('button');
    lucky.type = 'button';
    lucky.className = 'preview-more';
    lucky.textContent = 'A caso';
    head.appendChild(lucky);

    var reset = document.createElement('a');
    reset.textContent = 'Azzera';
    head.appendChild(reset);

    var all = document.createElement('a');
    all.textContent = 'Galleria';
    head.appendChild(all);

    var saved = document.createElement('div');
    saved.className = 'preview-favourites';
    panel.appendChild(saved);

    var rows = document.createElement('div');
    rows.className = 'preview-rows';
    panel.appendChild(rows);

    /* The favourites, at the top of the panel. */
    function fillFavourites() {
      var list = favourites();
      saved.textContent = '';
      var label = document.createElement('span');
      label.textContent = list.length ? 'Preferite · ' + list.length : 'Preferite: premi ♡ Salva accanto al dado';
      saved.appendChild(label);
      if (!list.length) return;

      var chips = document.createElement('span');
      chips.className = 'preview-chips';
      list.forEach(function (key, i) {
        var item = document.createElement('span');
        item.className = 'preview-fav';
        var link = document.createElement('a');
        link.href = '?' + key + '&panel=' + (open ? '1' : '0');
        link.textContent = (i + 1) + ' · ' + describe(key);
        if (key === current) link.setAttribute('aria-current', 'true');
        item.appendChild(link);
        var drop = document.createElement('button');
        drop.type = 'button';
        drop.textContent = '×';
        drop.setAttribute('aria-label', 'Togli la preferita ' + (i + 1));
        drop.addEventListener('click', function () { toggleFavourite(key); });
        item.appendChild(drop);
        chips.appendChild(item);
      });
      saved.appendChild(chips);

      var copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'preview-copy';
      copy.textContent = 'Copia elenco';
      copy.addEventListener('click', function () {
        var text = favourites().map(function (key, i) {
          return (i + 1) + '. ' + look.root + '?' + key;
        }).join('\n');
        var done = function () { copy.textContent = 'Copiato'; };
        var fallback = function () {
          // Without the clipboard, the list is shown selected, ready to copy by hand.
          var area = document.createElement('textarea');
          area.className = 'preview-list';
          area.value = text;
          area.rows = Math.min(8, favourites().length + 1);
          saved.appendChild(area);
          area.select();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
        else fallback();
      });
      saved.appendChild(copy);
    }
    changed.push(fillFavourites);

    function fill() {
      var defaults = {};
      rows.textContent = '';
      look.groups.forEach(function (group) {
        defaults[group.key] = group.names[0];
        var row = document.createElement('p');
        var label = document.createElement('span');
        label.textContent = group.label;
        row.appendChild(label);
        var chips = document.createElement('span');
        chips.className = 'preview-chips';
        row.appendChild(chips);
        group.names.forEach(function (name) {
          var change = {};
          change[group.key] = name;
          var link = document.createElement('a');
          link.href = address(change);
          link.textContent = name;
          if (group.key === 'palette') link.setAttribute('data-palette', name);
          if (name === look.chosen[group.key]) link.setAttribute('aria-current', 'true');
          chips.appendChild(link);
        });
        rows.appendChild(row);
      });
      reset.href = address(defaults);
      all.href = look.root + 'galleria.html?' + look.parts().join('&');
      // The language link keeps the panel as it is now.
      Array.prototype.forEach.call(document.querySelectorAll('a[data-lang-switch]'), function (link) {
        var pieces = link.getAttribute('href').split('#');
        link.setAttribute('href', pieces[0].split('?')[0] + address() + (pieces[1] ? '#' + pieces[1] : ''));
      });
      fillFavourites();
    }

    toggle.addEventListener('click', function () {
      open = !open;
      panel.classList.toggle('open', open);
      html.classList.toggle('preview-open', open);
      fill();
    });

    lucky.addEventListener('click', function () {
      location.href = location.pathname + address(look.random());
    });

    // Every choice reloads the page: the list stays where it was scrolled to.
    rows.addEventListener('click', function () {
      try { sessionStorage.setItem('panel-scroll', rows.scrollTop); } catch (ignored) { /* no storage */ }
    });

    fill();
    document.body.appendChild(panel);
    try { rows.scrollTop = +sessionStorage.getItem('panel-scroll') || 0; } catch (ignored) { /* no storage */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();

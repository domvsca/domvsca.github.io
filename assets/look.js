/*
 * The look of the page: palette, texture, scene, shape, style, motion,
 * typeface, layout.
 *
 * Every visit gets a different combination, drawn at random, and the button
 * with the die draws another. An address that names a look
 * (?palette=bosco&model=cubo) shows that one, so a combination can be opened
 * again or shared; the language link carries the current one to the other
 * page.
 *
 * This file is loaded in the <head>, before the page is drawn, so the look is
 * there from the first frame. Without scripts the page keeps the look written
 * in its markup and in site.css, which is the first name of each group below.
 *
 * Where each look lives: colours in palettes.css (written by
 * tools/make-palettes.js), the rest of the styling in looks.css, shapes and
 * their styles in shapes.js, motion in element.js.
 */
(function () {
  'use strict';

  var GROUPS = [
    { key: 'palette', label: 'Palette', names: ['notte', 'bosco', 'terracotta', 'prugna', 'lilla', 'cielo', 'menta', 'seppia', 'carta', 'primari', 'ghiaccio', 'cobalto', 'senape', 'pomodoro', 'inchiostro', 'petrolio', 'turchese', 'fucsia', 'oro'] },
    { key: 'bg', label: 'Trama', names: ['liscio', 'punti', 'sfuma', 'griglia', 'millimetrata', 'isometrica', 'esagoni', 'righe', 'tratteggio', 'grana', 'onde', 'rete', 'stelle', 'aurora'] },
    { key: 'scene', label: 'Scena', names: ['semplice', 'palco', 'riflettore', 'accento', 'doppio', 'taglio', 'orizzonte', 'sole', 'alone', 'arco', 'figura', 'cornice'] },
    { key: 'model', label: 'Forma', names: ['icosaedro', 'diamante', 'torre', 'tetraedro', 'ottaedro', 'cubo', 'lanterna', 'cupola', 'elica', 'stella', 'tensegrity', 'piramide', 'cubottaedro', 'geode'] },
    { key: 'style', label: 'Stile', names: ['filo', 'facce', 'vetro', 'disegno', 'costellazione', 'magneti', 'tubi', 'origami', 'schizzo', 'neon'] },
    { key: 'motion', label: 'Moto', names: ['quieto', 'vivo', 'giro', 'pendolo', 'brezza', 'segue'] },
    { key: 'mode', label: 'Vincolo', names: ['appeso', 'libero', 'pesante'] },
    { key: 'enter', label: 'Ingresso', names: ['giro', 'monta', 'cala', 'nessuno'] },
    { key: 'font', label: 'Carattere', names: ['serif', 'corsivo', 'inciso', 'sans', 'leggero', 'manifesto', 'mono'] },
    { key: 'layout', label: 'Impaginazione', names: ['fianco', 'specchio', 'centro', 'grande', 'quinta', 'pieno'] }
  ];

  // The shapes' names on the English page.
  var ENGLISH = {
    icosaedro: 'icosahedron', diamante: 'diamond', torre: 'tower', tetraedro: 'tetrahedron',
    ottaedro: 'octahedron', cubo: 'cube', lanterna: 'lantern', cupola: 'dome', elica: 'helix',
    stella: 'star', tensegrity: 'tensegrity', piramide: 'pyramid', cubottaedro: 'cuboctahedron',
    geode: 'geodesic sphere'
  };

  var html = document.documentElement;
  var script = document.currentScript;
  // The address of the site's first page, whichever page this is.
  var root = script ? script.src.replace(/assets\/look\.js.*$/, '') : '';

  var query = {};
  location.search.replace(/[?&]([a-z]+)=([a-z0-9.]*)/g, function (all, key, value) {
    query[key] = value;
  });

  /*
   * Changes the few choices that do not work together. Only a look drawn at
   * random goes through here: one named in the address is shown as asked.
   */
  function settle(look) {
    // The two-tone ground suits a drawing that stays on its own side.
    var onItsSide = look.mode === 'appeso' && (look.layout === 'fianco' || look.layout === 'pieno');
    if (look.scene === 'doppio' && !onItsSide) look.scene = 'palco';
    // Something must move at first, or nothing says the drawing is alive.
    if (look.enter === 'nessuno' && look.motion === 'quieto' && look.mode !== 'pesante') look.enter = 'monta';
    // The two filtered styles cost too much on the shape with the most pieces.
    if (look.model === 'geode' && (look.style === 'neon' || look.style === 'schizzo')) look.style = 'facce';
    // Behind the text only a light drawing leaves it readable.
    if (look.layout === 'quinta' && ['filo', 'vetro', 'disegno', 'costellazione', 'schizzo'].indexOf(look.style) < 0) look.style = 'filo';
    // A frame and a caption need the drawing in its own place, at its own size.
    if (look.scene === 'figura' && (look.layout === 'quinta' || look.layout === 'grande')) look.layout = 'fianco';
    return look;
  }

  function atRandom() {
    // The palette and the shape are what the eye meets first: never the same twice running.
    var last = {};
    try { last = JSON.parse(sessionStorage.getItem('look') || '{}'); } catch (ignored) { /* no storage */ }
    var look = {};
    GROUPS.forEach(function (group) {
      var names = group.names.filter(function (name) { return name !== last[group.key]; });
      look[group.key] = names[Math.floor(Math.random() * names.length)];
    });
    settle(look);
    try { sessionStorage.setItem('look', JSON.stringify({ palette: look.palette, model: look.model })); } catch (ignored) { /* no storage */ }
    return look;
  }

  function fromAddress() {
    var look = {};
    GROUPS.forEach(function (group) {
      look[group.key] = group.names.indexOf(query[group.key]) >= 0 ? query[group.key] : group.names[0];
    });
    return look;
  }

  // The gallery, the small pages it shows, and any address that names a look
  // get what they ask for. Everything else gets a roll of the die.
  var gallery = html.hasAttribute('data-gallery');
  var embedded = query.embed === '1';
  var named = gallery || embedded || GROUPS.some(function (group) { return query[group.key] !== undefined; });
  var chosen = named ? fromAddress() : atRandom();

  /*
   * The look as "key=value" pieces of an address, with some choices changed.
   * The palette is always there, so the address always names a look.
   */
  function parts(changes) {
    var out = [];
    GROUPS.forEach(function (group) {
      var value = changes && changes[group.key] !== undefined ? changes[group.key] : chosen[group.key];
      if (value !== group.names[0] || group.key === 'palette') out.push(group.key + '=' + value);
    });
    return out;
  }

  // Set before the page is drawn, so there is no flash of another look.
  // The gallery page itself only takes the colours and the texture.
  (gallery ? ['palette', 'bg'] : ['palette', 'bg', 'scene', 'font', 'layout']).forEach(function (key) {
    var first = GROUPS.filter(function (group) { return group.key === key; })[0].names[0];
    if (chosen[key] !== first) html.setAttribute('data-' + key, chosen[key]);
  });

  window.Look = { chosen: chosen, groups: GROUPS, parts: parts, random: atRandom, root: root, query: query };
  if (gallery) return;
  // The author's panel stands at the side: the page makes room for it at once.
  if (query.panel === '1') html.classList.add('preview-open');

  // The drawing in the markup is the first shape in the first style, hanging.
  // Any other is drawn in its place once the page is read; until then the
  // drawing is hidden, so the wrong one never shows.
  var redraw = chosen.mode !== 'appeso' || chosen.model !== 'icosaedro' || chosen.style !== 'filo';
  function show() {
    html.classList.remove('look-pending');
  }
  if (redraw) {
    html.classList.add('look-pending');
    // If the shapes never arrive, the drawing in the markup is shown after all.
    setTimeout(show, 3000);
  }

  function draw() {
    var shapes = window.RodsAndNodesPose;
    var figure = document.querySelector('figure.element');
    if (!shapes || !figure) return;
    var free = chosen.mode !== 'appeso';
    var shape = shapes.buildShape(chosen.model);
    if (redraw) figure.innerHTML = shapes.render(shape, { style: chosen.style, thread: !free });
    if (chosen.motion !== 'quieto') figure.setAttribute('data-idle', chosen.motion);
    if (free) figure.setAttribute('data-free', chosen.mode === 'pesante' ? 'fall' : 'on');
    if (chosen.enter !== 'giro') figure.setAttribute('data-enter', chosen.enter === 'nessuno' ? 'none' : chosen.enter);
    // The caption of the "figura" scene, in the language of the page.
    var italian = html.lang === 'it';
    var name = italian ? chosen.model : ENGLISH[chosen.model] || chosen.model;
    figure.setAttribute('data-caption', 'Fig. 1. ' + name.charAt(0).toUpperCase() + name.slice(1) + ', ' +
      shape.nodes.length + (italian ? ' nodi e ' : ' nodes and ') +
      shape.rods.length + (italian ? ' aste' : ' rods'));
  }

  /* What the author's panel adds to an address, when it is in use. */
  function panelPart() {
    return query.panel !== undefined ? ['panel=' + query.panel] : [];
  }

  /* The other language shows the same look. */
  function carry() {
    Array.prototype.forEach.call(document.querySelectorAll('a[data-lang-switch]'), function (link) {
      var pieces = link.getAttribute('href').split('#');
      link.setAttribute('href', pieces[0].split('?')[0] + '?' + parts().concat(panelPart()).join('&') + (pieces[1] ? '#' + pieces[1] : ''));
    });
  }

  /* The button with the die: another look, drawn at random. */
  function dice() {
    var bar = document.querySelector('.bar');
    if (!bar || embedded) return;
    var italian = html.lang === 'it';
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'dice';
    button.title = italian ? 'Cambia aspetto: a ogni lancio è diverso' : 'Change the look: every roll is different';
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<rect class="die" x="3.5" y="3.5" width="17" height="17" rx="4.2"/>' +
      '<circle class="pip" cx="8.3" cy="8.3" r="1.5"/><circle class="pip" cx="15.7" cy="8.3" r="1.5"/>' +
      '<circle class="pip" cx="12" cy="12" r="1.5"/>' +
      '<circle class="pip" cx="8.3" cy="15.7" r="1.5"/><circle class="pip" cx="15.7" cy="15.7" r="1.5"/></svg>' +
      '<span>' + (italian ? 'Rimescola' : 'Shuffle') + '</span>';
    button.addEventListener('click', function () {
      button.classList.add('rolling');
      // A plain address draws a new look when it is loaded.
      var plain = location.pathname + (panelPart().length ? '?' + panelPart()[0] : '');
      if (plain === location.pathname + location.search) {
        history.replaceState(null, '', plain);
        location.reload();
      } else {
        location.assign(plain);
      }
    });
    bar.insertBefore(button, bar.firstChild);
    bar.classList.add('with-dice');
  }

  // Registered here, in the <head>: it runs before element.js looks for the
  // drawing, which waits for the same moment.
  document.addEventListener('DOMContentLoaded', function () {
    try {
      draw();
    } finally {
      show();
    }
    carry();
    dice();
  });

  // The author's panel: only when the address asks for it (?panel=1).
  if (query.panel !== undefined && !embedded) {
    var sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = root + 'assets/panel.css';
    document.head.appendChild(sheet);
    var panel = document.createElement('script');
    panel.src = root + 'assets/panel.js';
    document.head.appendChild(panel);
  }
})();

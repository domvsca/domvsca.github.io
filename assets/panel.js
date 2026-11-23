/*
 * The author's panel: not for visitors. assets/look.js loads it, with
 * assets/panel.css, only when the address has ?panel=1.
 *
 * It lists every look, group by group, and each choice goes in the address,
 * so a combination can be tried, opened again or shared.
 */
(function () {
  'use strict';

  var look = window.Look;
  if (!look) return;

  var html = document.documentElement;
  var open = look.query.panel === '1';

  /* The address of the current look, with some choices changed. */
  function address(changes) {
    return '?' + look.parts(changes).concat(['panel=' + (open ? '1' : '0')]).join('&');
  }

  function build() {
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

    var rows = document.createElement('div');
    rows.className = 'preview-rows';
    panel.appendChild(rows);

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

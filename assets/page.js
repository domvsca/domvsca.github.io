/*
 * Keeps the language links pointing at the section being read, so switching
 * language does not send the reader back to the top. Without this script the
 * links still work: they open the other page from its start.
 */
(function () {
  'use strict';

  var links = document.querySelectorAll('a[data-lang-switch]');
  var sections = document.querySelectorAll('[data-section]');
  if (!links.length || !sections.length || !('IntersectionObserver' in window)) return;

  var watcher = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var hash = entry.target.id === 'top' ? '' : '#' + entry.target.id;
      Array.prototype.forEach.call(links, function (link) {
        link.setAttribute('href', link.getAttribute('href').split('#')[0] + hash);
      });
    });
  }, { rootMargin: '-45% 0px -45% 0px' });

  Array.prototype.forEach.call(sections, function (section) {
    watcher.observe(section);
  });
})();

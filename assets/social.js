/* ÆTHER social links — THE one place to change them.
 * Same file lives in both repos: AETHER-Site/assets/social.js and AETHER-Shop/assets/social.js.
 * Edit one, copy it to the other. Also update "sameAs" in AETHER-Site/index.html (SEO).
 * Renders icons into every <footer> and any element with [data-social]. Icons: Font Awesome 6.5 (already on every page).
 */
(function () {
  var LINKS = [
    { name: 'Instagram', icon: 'fa-instagram',   url: 'https://www.instagram.com/a2aether' },
    { name: 'Facebook',  icon: 'fa-facebook-f',  url: 'https://www.facebook.com/profile.php?id=61595552717280' },
    { name: 'X',         icon: 'fa-x-twitter',   url: 'https://x.com/a2aether' },
    { name: 'Threads',   icon: 'fa-threads',     url: 'https://www.threads.com/@a2aether' },
    { name: 'Reddit',    icon: 'fa-reddit-alien', url: 'https://www.reddit.com/user/a2aether' }
  ];

  var CSS =
    '.ae-social{display:flex;justify-content:center;flex-wrap:wrap;gap:1.25rem;margin-top:1.1rem}' +
    '.ae-social a{color:#9A7D2E;opacity:.65;font-size:1.05rem;line-height:1;text-decoration:none;transition:opacity .2s,transform .2s}' +
    '.ae-social a:hover,.ae-social a:focus-visible{opacity:1;transform:translateY(-1px)}' +
    '.ae-social a:focus-visible{outline:1px solid #9A7D2E;outline-offset:4px;border-radius:2px}';

  function build() {
    var nav = document.createElement('nav');
    nav.className = 'ae-social';
    nav.setAttribute('aria-label', 'ÆTHER on social media');
    LINKS.forEach(function (l) {
      var a = document.createElement('a');
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener me';
      a.title = l.name;
      a.setAttribute('aria-label', 'ÆTHER on ' + l.name);
      var i = document.createElement('i');
      i.className = 'fa-brands ' + l.icon;
      i.setAttribute('aria-hidden', 'true');
      a.appendChild(i);
      nav.appendChild(a);
    });
    return nav;
  }

  function render() {
    if (!document.getElementById('ae-social-css')) {
      var s = document.createElement('style');
      s.id = 'ae-social-css';
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    var targets = document.querySelectorAll('footer, [data-social]');
    for (var k = 0; k < targets.length; k++) {
      if (!targets[k].querySelector('.ae-social')) targets[k].appendChild(build());
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();

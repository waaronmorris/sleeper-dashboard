export default {
  root: "src",
  title: "Sleeper Analytics Pro",
  description: "Analytics for competitive Sleeper fantasy football leagues: standings, parity, drafts, trades and history.",
  base: "/sleeper-dashboard/", // GitHub Pages base path
  sidebar: false,
  header: false,
  footer: false,
  toc: false,
  pages: [
    {name: "Dashboard", path: "/"},
    {name: "League", path: "/league"},
    {name: "Players", path: "/players"},
    {name: "Matchups", path: "/matchups"},
    {name: "All-Play", path: "/allplay"},
    {name: "Power Rankings", path: "/power-rankings"},
    {name: "Draft Overview", path: "/draft-overview"},
    {name: "Draft Retro", path: "/draft-retro"},
    {name: "Trade Retro", path: "/trade-retro"},
    {name: "Trade Analysis", path: "/trade-analysis"},
    {name: "Trade Finder", path: "/trade-finder"},
    {name: "Ring of Honor", path: "/ring-of-honor"},
    {name: "Atrocity", path: "/atrocity"},
    {name: "Next Season", path: "/next-season"}
  ],
  theme: "dark",
  style: "observablehq.css",
  head: `
    <link rel="icon" type="image/svg+xml" href="./static/favicon.svg">
    <link rel="alternate icon" href="./static/favicon.svg">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <meta name="theme-color" content="#0b0e13">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,300..700,0..100;1,9..144,300..700,0..100&family=IBM+Plex+Mono:wght@400;500&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
    <script type="module">
      // Ledger shell: header, drawer navigation, footer.
      document.addEventListener('DOMContentLoaded', function () {
        const groups = [
          { label: 'Season', links: [
            ['./', 'Dashboard'], ['./league', 'League'], ['./matchups', 'Matchups'],
            ['./allplay', 'All-Play'], ['./power-rankings', 'Power Rankings'], ['./players', 'Players']
          ]},
          { label: 'Draft', links: [
            ['./draft-overview', 'Draft Overview'], ['./draft-retro', 'Draft Retro'], ['./next-season', 'Next Season']
          ]},
          { label: 'Trades', links: [
            ['./trade-analysis', 'Trade Analysis'], ['./trade-finder', 'Trade Finder'], ['./trade-retro', 'Trade Retro']
          ]},
          { label: 'History', links: [
            ['./ring-of-honor', 'Ring of Honor'], ['./atrocity', 'Atrocity']
          ]}
        ];

        const norm = p => p.replace('/sleeper-dashboard', '').replace(/\\/index\\.html$/, '').replace(/\\/$/, '') || '/';
        const current = norm(window.location.pathname);
        const isActive = href => norm(new URL(href, window.location.href).pathname) === current;
        const currentName = groups.flatMap(g => g.links).find(([href]) => isActive(href))?.[1] || '';

        const header = document.createElement('header');
        header.className = 'shell-header';
        header.innerHTML = \`
          <a class="shell-brand" href="./">Sleeper <em>Analytics</em> Pro</a>
          <span class="shell-crumb">\${currentName}</span>
          <span id="shell-season"></span>
          <button class="shell-menu" aria-label="Open menu" aria-expanded="false" aria-controls="shell-nav">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12"/></svg> <span>Menu</span>
          </button>
        \`;

        const nav = document.createElement('nav');
        nav.className = 'shell-nav';
        nav.id = 'shell-nav';
        nav.setAttribute('aria-label', 'Site');
        nav.innerHTML = \`
          <div class="shell-nav__head">
            <span class="shell-brand">Sleeper <em>Analytics</em> Pro</span>
            <button class="shell-nav__close" aria-label="Close menu">×</button>
          </div>
          \${groups.map(g => \`
            <div class="shell-nav__group">
              <div class="shell-nav__label">\${g.label}</div>
              \${g.links.map(([href, name]) => \`<a href="\${href}" class="\${isActive(href) ? 'active' : ''}">\${name}</a>\`).join('')}
            </div>\`).join('')}
          <div class="shell-nav__foot">Data: Sleeper · KeepTradeCut</div>
        \`;

        const overlay = document.createElement('div');
        overlay.className = 'shell-overlay';

        const footer = document.createElement('footer');
        footer.className = 'shell-footer';
        footer.innerHTML = \`
          <span>Sleeper Analytics Pro</span>
          <span>Enjoying the analytics? <a href="https://buymeacoffee.com/waaronmorris" target="_blank" rel="noopener noreferrer">Buy me a coffee</a></span>
        \`;

        document.body.insertBefore(header, document.body.firstChild);
        document.body.appendChild(nav);
        document.body.appendChild(overlay);
        document.body.appendChild(footer);

        const toggle = header.querySelector('.shell-menu');
        const close = nav.querySelector('.shell-nav__close');
        let lastFocus = null;
        function open() {
          lastFocus = document.activeElement;
          nav.classList.add('active'); overlay.classList.add('active');
          toggle.setAttribute('aria-expanded', 'true');
          document.body.style.overflow = 'hidden';
          (nav.querySelector('a.active') || nav.querySelector('a'))?.focus();
        }
        function shut() {
          nav.classList.remove('active'); overlay.classList.remove('active');
          toggle.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
          lastFocus?.focus?.();
        }
        toggle.addEventListener('click', () => nav.classList.contains('active') ? shut() : open());
        close.addEventListener('click', shut);
        overlay.addEventListener('click', shut);
        nav.querySelectorAll('a').forEach(a => a.addEventListener('click', shut));
        document.addEventListener('keydown', e => { if (e.key === 'Escape') shut(); });
      });
    </script>
  `
};

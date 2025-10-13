export default {
  root: "src",
  title: "Sleeper Analytics Pro",
  description: "Professional-grade fantasy football analytics platform for competitive Sleeper leagues. Track performance, analyze lineups, and discover winning insights.",
  base: "/sleeper-dashboard/", // GitHub Pages base path
  sidebar: false, // Disable default sidebar
  header: false, // Disable default header so we can create custom one
  pages: [
    {name: "Dashboard", path: "/"},
    {name: "League", path: "/league"},
    {name: "Players", path: "/players"},
    {name: "Matchups", path: "/matchups"},
    {name: "All-Play", path: "/allplay"},
    {name: "Trades", path: "/trades"},
    {name: "Draft Overview", path: "/draft-overview"},
    {name: "Draft Retro", path: "/draft-retro"},
    {name: "Trade Retro", path: "/trade-retro"},
    {name: "Ring of Honor", path: "/ring-of-honor"},
    {name: "Atrocity", path: "/atrocity"}
  ],
  theme: "dark",
  style: "observablehq.css",
  head: `
    <link rel="icon" type="image/svg+xml" href="./static/favicon.svg">
    <link rel="alternate icon" href="./static/favicon.svg">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <meta name="theme-color" content="#0a0e14">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <style>
      :root {
        /* Override Observable defaults with professional color system */
        --theme-foreground: #f8fafc !important;
        --theme-background: #0a0e14 !important;
        --theme-background-alt: #1a1f29 !important;
        --theme-foreground-alt: #cbd5e1 !important;
        --theme-foreground-muted: #94a3b8 !important;
        --theme-accent: #22c55e !important;
        --theme-accent-dark: #16a34a !important;
        --theme-foreground-faint: rgba(255, 255, 255, 0.08) !important;
      }

      /* Ensure professional dark background */
      html, body {
        background: #0a0e14 !important;
        color: #f8fafc !important;
        min-height: 100vh;
        overflow-x: hidden;
      }

      /* Hide Observable's default sidebars and TOC */
      #observablehq-sidebar,
      #observablehq-toc,
      aside {
        display: none !important;
      }

      /* Ensure main content uses full width */
      #observablehq-center {
        margin-left: 0 !important;
        margin-right: 0 !important;
        max-width: 100% !important;
      }

      /* SIDEBAR HAMBURGER NAVIGATION */

      /* Custom Header */
      .custom-header {
        background: rgba(10, 14, 20, 0.98) !important;
        backdrop-filter: blur(16px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
        border-bottom: 1px solid rgba(34, 197, 94, 0.2) !important;
        box-shadow: 0 2px 16px rgba(0, 0, 0, 0.4) !important;
        position: sticky !important;
        top: 0 !important;
        z-index: 1000 !important;
        padding: 0.75rem 1rem !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
      }

      /* Hamburger Menu Button */
      .menu-toggle {
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-around !important;
        width: 2rem !important;
        height: 2rem !important;
        background: transparent !important;
        border: none !important;
        cursor: pointer !important;
        padding: 0.25rem !important;
        z-index: 1001 !important;
        position: relative !important;
      }

      .menu-toggle span {
        width: 100% !important;
        height: 3px !important;
        background: #22c55e !important;
        border-radius: 10px !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        transform-origin: center !important;
      }

      .menu-toggle:hover span {
        background: #4ade80 !important;
      }

      .menu-toggle.active span:nth-child(1) {
        transform: rotate(45deg) translate(0.4rem, 0.4rem) !important;
      }

      .menu-toggle.active span:nth-child(2) {
        opacity: 0 !important;
        transform: translateX(-100%) !important;
      }

      .menu-toggle.active span:nth-child(3) {
        transform: rotate(-45deg) translate(0.4rem, -0.4rem) !important;
      }

      /* Brand Title */
      .custom-header h1 {
        background: linear-gradient(135deg, #f8fafc 0%, #4ade80 100%) !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
        font-weight: 800 !important;
        letter-spacing: -0.02em !important;
        font-size: 1.25rem !important;
        margin: 0 !important;
        padding: 0 !important;
        flex: 1 !important;
        text-align: center !important;
      }

      .custom-header h1 a {
        background: linear-gradient(135deg, #f8fafc 0%, #4ade80 100%) !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
        text-decoration: none !important;
      }

      /* Custom Footer */
      .custom-footer {
        margin-top: 4rem !important;
        padding: 2rem 1rem !important;
        background: rgba(26, 31, 41, 0.6) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
      }

      .footer-content {
        max-width: 800px !important;
        margin: 0 auto !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 1.5rem !important;
        flex-wrap: wrap !important;
      }

      .footer-text {
        color: #94a3b8 !important;
        font-size: 0.9375rem !important;
        font-weight: 500 !important;
      }

      /* Buy Me a Coffee Button */
      .bmc-button {
        display: inline-block !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        border-radius: 0.5rem !important;
        overflow: hidden !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
      }

      .bmc-button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 4px 12px rgba(251, 176, 52, 0.3) !important;
      }

      .bmc-button img {
        height: 40px !important;
        width: auto !important;
        display: block !important;
        border: 0 !important;
      }

      /* Responsive adjustments */
      @media (max-width: 640px) {
        .custom-footer {
          padding: 1.5rem 1rem !important;
        }

        .footer-content {
          flex-direction: column !important;
          gap: 1rem !important;
        }

        .bmc-button img {
          height: 36px !important;
        }
      }

      /* Sidebar Navigation */
      .sidebar-nav {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        height: 100vh !important;
        width: 280px !important;
        background: rgba(20, 25, 34, 0.98) !important;
        backdrop-filter: blur(20px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
        border-right: 1px solid rgba(34, 197, 94, 0.2) !important;
        box-shadow: 2px 0 24px rgba(0, 0, 0, 0.5) !important;
        transform: translateX(-100%) !important;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        z-index: 10000 !important;
        display: flex !important;
        flex-direction: column !important;
        padding: 5rem 0 2rem 0 !important;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
      }

      .sidebar-nav.active {
        transform: translateX(0) !important;
      }

      /* Nav Header */
      .nav-header {
        color: #94a3b8 !important;
        font-size: 0.75rem !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.1em !important;
        padding: 0 1.5rem 1rem 1.5rem !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        margin-bottom: 0.5rem !important;
      }

      /* Sidebar Overlay */
      .sidebar-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(0, 0, 0, 0.6) !important;
        backdrop-filter: blur(4px) !important;
        -webkit-backdrop-filter: blur(4px) !important;
        opacity: 0 !important;
        visibility: hidden !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        z-index: 9999 !important;
      }

      .sidebar-overlay.active {
        opacity: 1 !important;
        visibility: visible !important;
      }

      /* Navigation Links */
      .nav-link {
        color: #cbd5e1 !important;
        background: transparent !important;
        border: none !important;
        border-left: 3px solid transparent !important;
        padding: 1rem 1.5rem !important;
        font-size: 1rem !important;
        font-weight: 600 !important;
        text-decoration: none !important;
        display: block !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        position: relative !important;
      }

      .nav-link:hover {
        color: #22c55e !important;
        background: rgba(34, 197, 94, 0.08) !important;
        border-left-color: #22c55e !important;
        padding-left: 2rem !important;
      }

      /* Active/Current Page */
      .nav-link.active {
        color: #22c55e !important;
        background: rgba(34, 197, 94, 0.15) !important;
        border-left-color: #22c55e !important;
        font-weight: 700 !important;
        box-shadow: inset 0 0 20px rgba(34, 197, 94, 0.1) !important;
      }

      /* Tablet and Desktop */
      @media (min-width: 768px) {
        .custom-header h1 {
          font-size: 1.5rem !important;
        }

        .sidebar-nav {
          width: 320px !important;
        }

        .nav-link {
          font-size: 1.0625rem !important;
          padding: 1.125rem 2rem !important;
        }

        .nav-link:hover {
          padding-left: 2.5rem !important;
        }
      }

      @media (min-width: 1024px) {
        .custom-header h1 {
          font-size: 1.75rem !important;
        }
      }
    </style>
    <script type="module">
      // Create Custom Header and Hamburger Menu
      document.addEventListener('DOMContentLoaded', function() {
        // Create custom header
        const customHeader = document.createElement('header');
        customHeader.id = 'custom-header';
        customHeader.className = 'custom-header';

        // Create header content
        customHeader.innerHTML = \`
          <button class="menu-toggle" aria-label="Toggle menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <h1><a href="./">Sleeper Analytics Pro</a></h1>
        \`;

        // Create footer with Buy Me a Coffee
        const footer = document.createElement('footer');
        footer.className = 'custom-footer';
        footer.innerHTML = \`
          <div class="footer-content">
            <div class="footer-text">
              <span>Enjoying the analytics?</span>
            </div>
            <a href="https://buymeacoffee.com/waaronmorris" target="_blank" rel="noopener noreferrer" class="bmc-button">
              <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" />
            </a>
          </div>
        \`;

        // Append footer to body
        document.body.appendChild(footer);

        // Create navigation sidebar
        const nav = document.createElement('nav');
        nav.className = 'sidebar-nav';
        nav.innerHTML = \`
          <div class="nav-header">MENU</div>
          <a href="./" class="nav-link">Dashboard</a>
          <a href="./league" class="nav-link">League</a>
          <a href="./players" class="nav-link">Players</a>
          <a href="./matchups" class="nav-link">Matchups</a>
          <a href="./allplay" class="nav-link">All-Play</a>
          <a href="./trades" class="nav-link">Trades</a>
          <a href="./draft-overview" class="nav-link">Draft Overview</a>
          <a href="./draft-retro" class="nav-link">Draft Retro</a>
          <a href="./trade-retro" class="nav-link">Trade Retro</a>
          <a href="./ring-of-honor" class="nav-link">Ring of Honor</a>
          <a href="./atrocity" class="nav-link">Atrocity</a>
        \`;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';

        // Insert into DOM
        document.body.insertBefore(customHeader, document.body.firstChild);
        document.body.appendChild(nav);
        document.body.appendChild(overlay);

        // Get elements
        const menuToggle = customHeader.querySelector('.menu-toggle');

        // Highlight current page
        const currentPath = window.location.pathname.replace('/sleeper-dashboard', '').replace(/\\/index\\.html$/, '');
        nav.querySelectorAll('.nav-link').forEach(link => {
          const linkPath = new URL(link.href).pathname.replace('/sleeper-dashboard', '').replace(/\\/index\\.html$/, '');
          if (linkPath === currentPath || (currentPath === '/' && linkPath === './')) {
            link.classList.add('active');
          }
        });

        // Toggle function
        function toggleMenu() {
          menuToggle.classList.toggle('active');
          nav.classList.toggle('active');
          overlay.classList.toggle('active');
          document.body.style.overflow = overlay.classList.contains('active') ? 'hidden' : '';
        }

        // Close function
        function closeMenu() {
          menuToggle.classList.remove('active');
          nav.classList.remove('active');
          overlay.classList.remove('active');
          document.body.style.overflow = '';
        }

        // Event listeners
        menuToggle.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', closeMenu);

        // Close menu on navigation
        nav.querySelectorAll('.nav-link').forEach(link => {
          link.addEventListener('click', closeMenu);
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') closeMenu();
        });
      });
    </script>
  `
};

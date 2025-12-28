/**
 * Tab System for Observable Framework
 * Creates a tabbed interface with pill or underline styles
 */

/**
 * Creates a tabbed interface for Observable Framework
 * @param {Object} tabs - Object with tab names as keys and content generator functions as values
 * @param {Object} options - Configuration options
 * @returns {HTMLElement} - The tabbed interface element
 */
export function createTabs(tabs, options = {}) {
  const {
    defaultTab = Object.keys(tabs)[0],
    tabStyle = "pills" // "pills" or "underline"
  } = options;

  const tabNames = Object.keys(tabs);

  const container = document.createElement("div");
  container.className = "tabs-container";

  // Create tab navigation
  const nav = document.createElement("nav");
  nav.className = `tabs-nav tabs-nav--${tabStyle}`;
  nav.setAttribute("role", "tablist");

  // Create tab buttons
  tabNames.forEach((name) => {
    const button = document.createElement("button");
    button.className = "tab-btn";
    button.setAttribute("role", "tab");
    button.setAttribute("data-tab", name);
    button.textContent = name;
    button.addEventListener("click", () => switchTab(name));
    if (name === defaultTab) button.classList.add("active");
    nav.appendChild(button);
  });

  // Create content panels
  const contentContainer = document.createElement("div");
  contentContainer.className = "tabs-content";

  tabNames.forEach(name => {
    const panel = document.createElement("div");
    panel.className = "tab-panel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("data-tab-panel", name);
    panel.style.display = name === defaultTab ? "block" : "none";

    // Handle content - can be HTMLElement, string, or function
    const content = tabs[name];
    if (typeof content === "function") {
      const result = content();
      if (result instanceof HTMLElement || result instanceof DocumentFragment) {
        panel.appendChild(result);
      } else if (typeof result === "string") {
        panel.innerHTML = result;
      } else if (result && result.outerHTML) {
        panel.innerHTML = result.outerHTML;
      }
    } else if (content instanceof HTMLElement) {
      panel.appendChild(content);
    } else if (typeof content === "string") {
      panel.innerHTML = content;
    }

    contentContainer.appendChild(panel);
  });

  function switchTab(tabName) {
    // Update buttons
    nav.querySelectorAll(".tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    // Update panels
    contentContainer.querySelectorAll(".tab-panel").forEach(panel => {
      panel.style.display = panel.dataset.tabPanel === tabName ? "block" : "none";
    });
  }

  container.appendChild(nav);
  container.appendChild(contentContainer);

  return container;
}

/**
 * Creates section controls for expanding/collapsing all details elements
 * @returns {HTMLElement}
 */
export function createSectionControls() {
  const container = document.createElement("div");
  container.className = "section-controls";

  const expandBtn = document.createElement("button");
  expandBtn.className = "section-toggle-btn";
  expandBtn.textContent = "Expand All";
  expandBtn.addEventListener("click", () => {
    document.querySelectorAll("details.section-collapse").forEach(d => d.open = true);
  });

  const collapseBtn = document.createElement("button");
  collapseBtn.className = "section-toggle-btn";
  collapseBtn.textContent = "Collapse All";
  collapseBtn.addEventListener("click", () => {
    document.querySelectorAll("details.section-collapse").forEach(d => d.open = false);
  });

  container.appendChild(expandBtn);
  container.appendChild(collapseBtn);

  return container;
}

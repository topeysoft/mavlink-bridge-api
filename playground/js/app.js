/**
 * Main Application Entry Point
 * Initializes and coordinates all playground modules
 */

import { DeviceConnection } from './device-connection.js';
import { ApiExplorer } from './api-explorer.js';
import { WebSocketConsole } from './websocket-console.js';
import { QuickActions } from './quick-actions.js';
import { config } from './config-loader.js';

class PlaygroundApp {
  constructor() {
    this.config = config;
    this.deviceConnection = null;
    this.apiExplorer = null;
    this.websocketConsole = null;
    this.quickActions = null;

    this.currentView = 'apiExplorer';
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('🎮 Initializing MAVLinkBridge API Playground...');

    // Load configuration first
    await this.config.load();

    // Setup API port handling
    this.setupApiPort();

    // Initialize modules with configuration
    this.deviceConnection = new DeviceConnection(this.config);
    this.apiExplorer = new ApiExplorer(this.deviceConnection, this.config);
    this.websocketConsole = new WebSocketConsole(
      this.deviceConnection,
      this.config,
    );
    this.quickActions = new QuickActions(this.deviceConnection, this.config);

    // Initialize modules
    this.deviceConnection.init();
    await this.apiExplorer.init();
    this.websocketConsole.init();
    this.quickActions.init();

    // Setup navigation
    this.setupNavigation();

    // Show default view
    this.showView('apiExplorer');

    console.log('✅ Playground initialized');
  }

  /**
   * Setup API port handling
   */
  setupApiPort() {
    const apiPortInput = document.getElementById('apiPort');
    if (!apiPortInput) return;

    // Load saved port or use default
    const savedPort = localStorage.getItem('apiPort');
    if (savedPort) {
      apiPortInput.value = savedPort;
    } else {
      // Set default port to 80
      apiPortInput.value = '80';
      localStorage.setItem('apiPort', '80');
    }

    // Save port on change
    apiPortInput.addEventListener('change', (e) => {
      const port = parseInt(e.target.value);
      if (port >= 1 && port <= 65535) {
        localStorage.setItem('apiPort', port.toString());
        console.log(`✅ API port set to ${port}`);
      } else {
        alert('Port must be between 1 and 65535');
        e.target.value = localStorage.getItem('apiPort') || '80';
      }
    });
  }

  /**
   * Setup navigation between views
   */
  setupNavigation() {
    // Sidebar navigation
    document.querySelectorAll('.nav-list a').forEach((link) => {
      link.addEventListener('click', (e) => {
        const category = link.getAttribute('data-category');
        const view = link.getAttribute('data-view');
        const href = link.getAttribute('href');

        // Allow external links and links with target="_blank" to work normally
        if (href && !href.startsWith('#') && !category && !view) {
          // This is an external link, don't prevent default
          return;
        }

        e.preventDefault();

        if (category) {
          this.showView('apiExplorer');
          this.scrollToCategory(category);
        } else if (view) {
          this.showView(view);
        }

        // Update active state
        document
          .querySelectorAll('.nav-list a')
          .forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
      });
    });
  }

  /**
   * Show a specific view
   */
  showView(viewName) {
    // Hide all panels
    document.querySelectorAll('.content-panel').forEach((panel) => {
      panel.classList.remove('active');
    });

    // Map view names to panel IDs
    const viewMap = {
      apiExplorer: 'apiExplorer',
      websocket: 'websocketConsole',
      'quick-actions': 'quickActions',
      history: 'requestHistory',
    };

    // Show selected panel
    const panelId = viewMap[viewName];
    if (panelId) {
      const panel = document.getElementById(panelId);
      if (panel) {
        panel.classList.add('active');
        this.currentView = viewName;
      }
    }
  }

  /**
   * Scroll to a category in API Explorer
   */
  scrollToCategory(category) {
    // Find the category section
    const sections = document.querySelectorAll('.endpoint-section h3');
    for (const section of sections) {
      if (section.textContent.toLowerCase().includes(category.toLowerCase())) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new PlaygroundApp();
    app.init();
  });
} else {
  const app = new PlaygroundApp();
  app.init();
}

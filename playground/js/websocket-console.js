/**
 * WebSocket Console
 * Real-time event monitoring and visualization
 */

export class WebSocketConsole {
  constructor(deviceConnection) {
    this.deviceConnection = deviceConnection;
    this.events = [];
    this.isPaused = false;
    this.autoScroll = true;
    this.filters = {
      search: '',
      eventType: '',
    };
    this.eventCounts = new Map();
    this.subscriptions = new Map(); // Track which events are subscribed
    this.eventHandlers = new Map(); // Store event handlers for cleanup
    this.startTime = Date.now();
    this.maxEvents = 1000;
    this.currentClient = null;
  }

  /**
   * Initialize WebSocket console
   */
  init() {
    this.loadSubscriptionPreferences();
    this.setupEventListeners();
    this.startEventRateCalculation();
    this.populateEventTypeFilter();
    this.renderSubscriptionList();
  }

  /**
   * Setup UI event listeners
   */
  setupEventListeners() {
    // Clear button
    document.getElementById('clearEventsBtn').addEventListener('click', () => {
      this.clearEvents();
    });

    // Pause button
    const pauseBtn = document.getElementById('pauseEventsBtn');
    pauseBtn.addEventListener('click', () => {
      this.togglePause();
      pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
    });

    // Auto-scroll checkbox
    document
      .getElementById('autoScrollCheck')
      .addEventListener('change', (e) => {
        this.autoScroll = e.target.checked;
      });

    // Filter inputs
    document.getElementById('eventFilter').addEventListener('input', (e) => {
      this.filters.search = e.target.value.toLowerCase();
      this.renderEvents();
    });

    document
      .getElementById('eventTypeFilter')
      .addEventListener('change', (e) => {
        this.filters.eventType = e.target.value;
        this.renderEvents();
      });

    // Subscription buttons
    document.getElementById('subscribeAllBtn').addEventListener('click', () => {
      this.subscribeAll();
    });

    document.getElementById('unsubscribeAllBtn').addEventListener('click', () => {
      this.unsubscribeAll();
    });

    // Listen for device connection
    this.deviceConnection.onConnect((client) => {
      this.currentClient = client;
      this.subscribeToEvents(client);
    });

    this.deviceConnection.onDisconnect(() => {
      this.currentClient = null;
      this.clearEvents();
    });
  }

  /**
   * Get list of all available event types
   */
  getAvailableEventTypes() {
    return [
      'status',
      'config.changed',
      'error',
      'log',
      'rtcm.data',
      'rtcm.data.received',
      'rtcm.state.change',
      'wifi.connecting',
      'wifi.connected',
      'wifi.disconnected',
      'wifi.signal.update',
      'wifi.ap.mode.started',
      'wifi.ap.mode.stopped',
      'wifi.scan.completed',
      'usb.connected',
      'usb.disconnected',
      'uart.connected',
      'uart.disconnected',
      'interface.switched',
      'mavlink.message',
      'communication.stats',
      'health.update',
      'memory.event',
      'task.event',
      'mission.current',
      'mission.item.reached',
      'mission.ack',
      'mission.count',
      'mission.progress',
      'task.created',
      'task.updated',
      'task.deleted',
      'task.execution.started',
      'task.execution.progress',
      'task.execution.paused',
      'task.execution.resumed',
      'task.execution.completed',
      'task.execution.failed',
      'task.execution.cancelled',
      'zone.created',
      'zone.updated',
      'zone.deleted',
      'mission.created',
      'mission.updated',
      'mission.deleted',
    ];
  }

  /**
   * Subscribe to WebSocket events based on subscription preferences
   */
  subscribeToEvents(client) {
    if (!client || !client.ws) {
      console.error('No WebSocket client available');
      return;
    }

    const wsClient = client.ws;

    // Subscribe only to selected events
    this.getAvailableEventTypes().forEach((eventType) => {
      if (this.subscriptions.get(eventType)) {
        this.subscribeToEvent(eventType, wsClient);
      }
    });

    const subscribedCount = Array.from(this.subscriptions.values()).filter(Boolean).length;
    console.log(`Subscribed to ${subscribedCount} WebSocket events`);
  }

  /**
   * Subscribe to a single event type
   */
  subscribeToEvent(eventType, wsClient = null) {
    const client = wsClient || this.currentClient?.ws;
    if (!client) return;

    // Remove existing handler if any
    this.unsubscribeFromEvent(eventType, client);

    // Create new handler
    const handler = (payload) => {
      this.handleEvent(eventType, payload);
    };

    // Store handler for cleanup
    this.eventHandlers.set(eventType, handler);

    // Subscribe to event
    client.on(eventType, handler);
  }

  /**
   * Unsubscribe from a single event type
   */
  unsubscribeFromEvent(eventType, wsClient = null) {
    const client = wsClient || this.currentClient?.ws;
    if (!client) return;

    const handler = this.eventHandlers.get(eventType);
    if (handler) {
      client.off(eventType, handler);
      this.eventHandlers.delete(eventType);
    }
  }

  /**
   * Subscribe to all available events
   */
  subscribeAll() {
    this.getAvailableEventTypes().forEach((eventType) => {
      this.subscriptions.set(eventType, true);
      if (this.currentClient?.ws) {
        this.subscribeToEvent(eventType);
      }
    });

    this.saveSubscriptionPreferences();
    this.renderSubscriptionList();
    this.updateSubscriptionCount();
  }

  /**
   * Unsubscribe from all events
   */
  unsubscribeAll() {
    this.getAvailableEventTypes().forEach((eventType) => {
      this.subscriptions.set(eventType, false);
      if (this.currentClient?.ws) {
        this.unsubscribeFromEvent(eventType);
      }
    });

    this.saveSubscriptionPreferences();
    this.renderSubscriptionList();
    this.updateSubscriptionCount();
  }

  /**
   * Toggle subscription for a specific event type
   */
  toggleSubscription(eventType) {
    const isSubscribed = this.subscriptions.get(eventType) || false;
    this.subscriptions.set(eventType, !isSubscribed);

    if (this.currentClient?.ws) {
      if (!isSubscribed) {
        this.subscribeToEvent(eventType);
      } else {
        this.unsubscribeFromEvent(eventType);
      }
    }

    this.saveSubscriptionPreferences();
    this.renderSubscriptionList();
    this.updateSubscriptionCount();
  }

  /**
   * Load subscription preferences from localStorage
   */
  loadSubscriptionPreferences() {
    const saved = localStorage.getItem('ws-subscriptions');
    if (saved) {
      try {
        const prefs = JSON.parse(saved);
        Object.entries(prefs).forEach(([eventType, isSubscribed]) => {
          this.subscriptions.set(eventType, isSubscribed);
        });
      } catch (error) {
        console.error('Failed to load subscription preferences:', error);
      }
    }

    // Default: subscribe to common events if no preferences saved
    if (this.subscriptions.size === 0) {
      const defaultSubscriptions = [
        'status',
        'error',
        'health.update',
        'wifi.connected',
        'wifi.disconnected',
        'mavlink.message',
      ];

      defaultSubscriptions.forEach(eventType => {
        this.subscriptions.set(eventType, true);
      });

      this.getAvailableEventTypes().forEach(eventType => {
        if (!this.subscriptions.has(eventType)) {
          this.subscriptions.set(eventType, false);
        }
      });
    }
  }

  /**
   * Save subscription preferences to localStorage
   */
  saveSubscriptionPreferences() {
    const prefs = {};
    this.subscriptions.forEach((isSubscribed, eventType) => {
      prefs[eventType] = isSubscribed;
    });
    localStorage.setItem('ws-subscriptions', JSON.stringify(prefs));
  }

  /**
   * Render subscription list UI
   */
  renderSubscriptionList() {
    const container = document.getElementById('subscriptionList');
    container.innerHTML = '';

    const eventTypes = this.getAvailableEventTypes();
    const sortedEventTypes = eventTypes.sort();

    sortedEventTypes.forEach(eventType => {
      const isSubscribed = this.subscriptions.get(eventType) || false;

      const item = document.createElement('label');
      item.className = 'subscription-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isSubscribed;
      checkbox.addEventListener('change', () => {
        this.toggleSubscription(eventType);
      });

      const label = document.createElement('span');
      label.textContent = eventType;
      label.className = 'subscription-label';

      const count = this.eventCounts.get(eventType) || 0;
      const badge = document.createElement('span');
      badge.className = 'subscription-badge';
      badge.textContent = count;
      badge.id = `badge-${eventType}`;

      item.appendChild(checkbox);
      item.appendChild(label);
      item.appendChild(badge);
      container.appendChild(item);
    });

    this.updateSubscriptionCount();
  }

  /**
   * Update subscription count display
   */
  updateSubscriptionCount() {
    const subscribedCount = Array.from(this.subscriptions.values()).filter(Boolean).length;
    const countElement = document.getElementById('subscriptionCount');
    if (countElement) {
      countElement.textContent = subscribedCount;
    }
  }

  /**
   * Handle incoming event
   */
  handleEvent(eventType, payload) {
    if (this.isPaused) return;

    const event = {
      type: eventType,
      payload,
      timestamp: new Date(),
      id: `${eventType}-${Date.now()}-${Math.random()}`,
    };

    this.events.unshift(event);

    // Limit stored events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    // Update event count
    const count = this.eventCounts.get(eventType) || 0;
    this.eventCounts.set(eventType, count + 1);

    // Update badge for this event type
    const badge = document.getElementById(`badge-${eventType}`);
    if (badge) {
      badge.textContent = count + 1;
    }

    // Update UI
    this.updateStats();
    this.renderNewEvent(event);

    // Auto-scroll if enabled
    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }

  /**
   * Populate event type filter dropdown
   */
  populateEventTypeFilter() {
    const eventTypes = [
      'status',
      'config.changed',
      'error',
      'log',
      'rtcm.data',
      'rtcm.state.change',
      'wifi.connected',
      'wifi.disconnected',
      'wifi.signal.update',
      'wifi.scan.completed',
      'interface.switched',
      'mavlink.message',
      'communication.stats',
      'health.update',
      'memory.event',
      'task.event',
      'mission.current',
      'mission.item.reached',
      'task.created',
      'task.updated',
      'task.execution.started',
      'task.execution.progress',
      'task.execution.completed',
    ];

    const select = document.getElementById('eventTypeFilter');
    eventTypes.forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      select.appendChild(option);
    });
  }

  /**
   * Render all events (with filters applied)
   */
  renderEvents() {
    const container = document.getElementById('eventsList');
    container.innerHTML = '';

    const filtered = this.events.filter((event) => this.matchesFilters(event));

    filtered.forEach((event) => {
      const element = this.createEventElement(event);
      container.appendChild(element);
    });
  }

  /**
   * Render a single new event
   */
  renderNewEvent(event) {
    if (!this.matchesFilters(event)) return;

    const container = document.getElementById('eventsList');
    const element = this.createEventElement(event);
    container.insertBefore(element, container.firstChild);
  }

  /**
   * Create event DOM element
   */
  createEventElement(event) {
    const div = document.createElement('div');
    div.className = 'event-item';
    div.setAttribute('data-event-id', event.id);

    const timeStr = event.timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });

    div.innerHTML = `
            <div class="event-header">
                <span class="event-type">${event.type}</span>
                <span class="event-timestamp">${timeStr}</span>
            </div>
            <div class="event-payload">
                <pre><code class="language-json">${JSON.stringify(
                  event.payload,
                  null,
                  2,
                )}</code></pre>
            </div>
        `;

    // Toggle expansion on click
    div.addEventListener('click', () => {
      div.classList.toggle('expanded');
      if (div.classList.contains('expanded')) {
        const code = div.querySelector('code');
        hljs.highlightElement(code);
      }
    });

    return div;
  }

  /**
   * Check if event matches current filters
   */
  matchesFilters(event) {
    // Event type filter
    if (this.filters.eventType && event.type !== this.filters.eventType) {
      return false;
    }

    // Search filter
    if (this.filters.search) {
      const searchStr = this.filters.search;
      const eventStr = JSON.stringify(event).toLowerCase();
      if (!eventStr.includes(searchStr)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update statistics display
   */
  updateStats() {
    document.getElementById('eventCount').textContent = this.events.length;
  }

  /**
   * Start event rate calculation
   */
  startEventRateCalculation() {
    let lastCount = 0;

    setInterval(() => {
      const currentCount = this.events.length;
      const rate = currentCount - lastCount;
      lastCount = currentCount;

      document.getElementById('eventRate').textContent = rate;
    }, 1000);
  }

  /**
   * Clear all events
   */
  clearEvents() {
    this.events = [];
    this.eventCounts.clear();
    this.startTime = Date.now();

    document.getElementById('eventsList').innerHTML = '';
    this.updateStats();
  }

  /**
   * Toggle pause state
   */
  togglePause() {
    this.isPaused = !this.isPaused;
  }

  /**
   * Scroll to bottom of events list
   */
  scrollToBottom() {
    const container = document.getElementById('eventsList');
    container.scrollTop = container.scrollHeight;
  }
}

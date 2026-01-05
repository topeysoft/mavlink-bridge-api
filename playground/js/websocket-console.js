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
    this.startTime = Date.now();
    this.maxEvents = 1000;
  }

  /**
   * Initialize WebSocket console
   */
  init() {
    this.setupEventListeners();
    this.startEventRateCalculation();
    this.populateEventTypeFilter();
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

    // Listen for device connection
    this.deviceConnection.onConnect((client) => {
      this.subscribeToEvents(client);
    });

    this.deviceConnection.onDisconnect(() => {
      this.clearEvents();
    });
  }

  /**
   * Subscribe to all WebSocket events
   */
  subscribeToEvents(client) {
    if (!client || !client.wsClient) {
      console.error('No WebSocket client available');
      return;
    }

    const wsClient = client.wsClient;

    // List of all event types from EventTypes.ts
    const eventTypes = [
      'status',
      'config_changed',
      'error',
      'log',
      'rtcm_data',
      'rtcm_data_received',
      'rtcm_state_change',
      'wifi_connecting',
      'wifi_connected',
      'wifi_disconnected',
      'wifi_signal_update',
      'wifi_ap_mode_started',
      'wifi_ap_mode_stopped',
      'wifi_scan_completed',
      'usb_connected',
      'usb_disconnected',
      'uart_connected',
      'uart_disconnected',
      'interface_switched',
      'mavlink_message',
      'communication_stats',
      'health_update',
      'memory_event',
      'task_event',
      'mission_current',
      'mission_item_reached',
      'mission_ack',
      'mission_count',
      'mission_progress',
      'task_created',
      'task_updated',
      'task_deleted',
      'task_execution_started',
      'task_execution_progress',
      'task_execution_paused',
      'task_execution_resumed',
      'task_execution_completed',
      'task_execution_failed',
      'task_execution_cancelled',
    ];

    // Subscribe to all events
    eventTypes.forEach((eventType) => {
      wsClient.on(eventType, (payload) => {
        this.handleEvent(eventType, payload);
      });
    });

    console.log('Subscribed to all WebSocket events');
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
      'config_changed',
      'error',
      'log',
      'rtcm_data',
      'rtcm_state_change',
      'wifi_connected',
      'wifi_disconnected',
      'wifi_signal_update',
      'wifi_scan_completed',
      'interface_switched',
      'mavlink_message',
      'communication_stats',
      'health_update',
      'memory_event',
      'task_event',
      'mission_current',
      'mission_item_reached',
      'task_created',
      'task_updated',
      'task_execution_started',
      'task_execution_progress',
      'task_execution_completed',
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

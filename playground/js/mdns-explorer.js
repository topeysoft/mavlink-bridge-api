/**
 * mDNS Service Explorer
 * Discover and explore mDNS services on the local network
 */

class MDNSExplorer {
  constructor() {
    this.services = [];
    this.filteredServices = [];
    this.autoRefresh = false;
    this.refreshInterval = null;
    this.scanInProgress = false;
    this.dataCapture = new DataCaptureManager();

    this.initElements();
    this.attachEventListeners();
  }

  initElements() {
    this.scanBtn = document.getElementById('scanBtn');
    this.autoRefreshBtn = document.getElementById('autoRefreshBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.filterInput = document.getElementById('filterInput');
    this.apiPortInput = document.getElementById('apiPortMdns');
    this.servicesContainer = document.getElementById('servicesContainer');
    this.totalServicesEl = document.getElementById('totalServices');
    this.httpServicesEl = document.getElementById('httpServices');
    this.yardRoverDevicesEl = document.getElementById('yardRoverDevices');
    this.lastScanEl = document.getElementById('lastScan');

    // Load saved API port
    const savedPort = localStorage.getItem('apiPort');
    if (savedPort && this.apiPortInput) {
      this.apiPortInput.value = savedPort;
    }
  }

  attachEventListeners() {
    this.scanBtn.addEventListener('click', () => this.scanNetwork());
    this.autoRefreshBtn.addEventListener('click', () =>
      this.toggleAutoRefresh(),
    );
    this.clearBtn.addEventListener('click', () => this.clearResults());
    this.filterInput.addEventListener('input', (e) =>
      this.filterServices(e.target.value),
    );

    // Handle API port changes
    if (this.apiPortInput) {
      this.apiPortInput.addEventListener('change', (e) => {
        const port = parseInt(e.target.value);
        if (port >= 1 && port <= 65535) {
          localStorage.setItem('apiPort', port.toString());
          this.showToast(`API port set to ${port}`, 'success');
        } else {
          this.showToast('Port must be between 1 and 65535', 'error');
          e.target.value = localStorage.getItem('apiPort') || '80';
        }
      });
    }
  }

  async scanNetwork() {
    if (this.scanInProgress) {
      this.showToast('Scan already in progress', 'error');
      return;
    }

    this.scanInProgress = true;
    this.scanBtn.disabled = true;
    this.showLoading();

    try {
      // mDNS scan is provided by the playground server (not the device)
      const apiUrl = `/api/mdns/scan`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.services = data.services || [];
      this.filteredServices = [...this.services];

      this.updateStats();
      this.renderServices();
      this.updateLastScan();

      this.showToast(`Found ${this.services.length} service(s)`, 'success');
    } catch (error) {
      console.error('Scan error:', error);
      this.showToast(
        'Failed to scan network. Make sure the server supports mDNS.',
        'error',
      );
      this.showEmptyState();
    } finally {
      this.scanInProgress = false;
      this.scanBtn.disabled = false;
    }
  }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;

    if (this.autoRefresh) {
      this.autoRefreshBtn.innerHTML =
        '<span>🔄</span><span>Auto Refresh: ON</span>';
      this.autoRefreshBtn.style.background = '#48bb78';
      this.refreshInterval = setInterval(() => this.scanNetwork(), 10000); // 10 seconds
      this.showToast('Auto refresh enabled (10s)', 'success');
    } else {
      this.autoRefreshBtn.innerHTML =
        '<span>🔄</span><span>Auto Refresh: OFF</span>';
      this.autoRefreshBtn.style.background = '#48bb78';
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
      this.showToast('Auto refresh disabled', 'success');
    }
  }

  clearResults() {
    this.services = [];
    this.filteredServices = [];
    this.filterInput.value = '';
    this.updateStats();
    this.showEmptyState();
    this.showToast('Results cleared', 'success');
  }

  filterServices(query) {
    const lowerQuery = query.toLowerCase();

    this.filteredServices = this.services.filter((service) => {
      return (
        service.name?.toLowerCase().includes(lowerQuery) ||
        service.type?.toLowerCase().includes(lowerQuery) ||
        service.host?.toLowerCase().includes(lowerQuery) ||
        service.addresses?.some((addr) =>
          addr.toLowerCase().includes(lowerQuery),
        ) ||
        service.txt?.some((txt) => txt.toLowerCase().includes(lowerQuery))
      );
    });

    this.renderServices();
  }

  updateStats() {
    this.totalServicesEl.textContent = this.services.length;

    const httpServices = this.services.filter(
      (s) => s.type?.includes('_http') || s.port === 80 || s.port === 443,
    ).length;
    this.httpServicesEl.textContent = httpServices;

    const yardRoverDevices = this.services.filter(
      (s) =>
        s.name?.toLowerCase().includes('yardrover') ||
        s.txt?.some((t) => t.toLowerCase().includes('yardrover')),
    ).length;
    this.yardRoverDevicesEl.textContent = yardRoverDevices;
  }

  updateLastScan() {
    const now = new Date();
    this.lastScanEl.textContent = now.toLocaleTimeString();
  }

  renderServices() {
    if (this.filteredServices.length === 0) {
      if (this.services.length === 0) {
        this.showEmptyState();
      } else {
        this.servicesContainer.innerHTML = `
          <div class="empty-state">
            <h2>No matching services</h2>
            <p>Try a different filter</p>
          </div>
        `;
      }
      return;
    }

    const servicesHtml = this.filteredServices
      .map((service) => this.renderServiceCard(service))
      .join('');
    this.servicesContainer.innerHTML = `<div class="services-grid">${servicesHtml}</div>`;

    // Attach event listeners to action buttons
    this.attachServiceActions();
  }

  renderServiceCard(service) {
    const badge = this.getServiceBadge(service);
    const addresses = service.addresses || [];
    const txtRecords = service.txt || [];

    return `
      <div class="service-card" data-service="${service.name}">
        <div class="service-header">
          <div>
            <h3 class="service-name">${this.escapeHtml(
              service.name || 'Unknown',
            )}</h3>
            <div class="service-type">${this.escapeHtml(
              service.type || 'unknown',
            )}</div>
          </div>
          <span class="service-badge badge-${badge.type}">${badge.label}</span>
        </div>

        <div class="service-details">
          <div class="detail-row">
            <span class="detail-label">Host:</span>
            <span class="detail-value">${this.escapeHtml(
              service.host || 'N/A',
            )}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Port:</span>
            <span class="detail-value">${service.port || 'N/A'}</span>
          </div>
          ${
            addresses.length > 0
              ? `
            <div class="detail-row">
              <span class="detail-label">Addresses:</span>
              <span class="detail-value">${addresses
                .map((addr) => this.escapeHtml(addr))
                .join(', ')}</span>
            </div>
          `
              : ''
          }
        </div>

        ${
          txtRecords.length > 0
            ? `
          <div class="txt-records">
            <h4>TXT Records:</h4>
            ${txtRecords
              .map(
                (txt) =>
                  `<div class="txt-record">${this.escapeHtml(txt)}</div>`,
              )
              .join('')}
          </div>
        `
            : ''
        }

        <div class="service-actions">
          ${
            this.isHttpService(service)
              ? `
            <button class="btn btn-primary btn-small open-browser" data-url="${this.getServiceUrl(
              service,
            )}">
              🌐 Open in Browser
            </button>
          `
              : ''
          }
          <button class="btn btn-secondary btn-small copy-info" data-service="${this.escapeHtml(
            JSON.stringify(service),
          )}">
            📋 Copy Info
          </button>
          <button class="btn btn-secondary btn-small monitor-data"
            data-service="${this.escapeHtml(service.name)}"
            data-host="${this.escapeHtml(service.addresses?.[0] || service.host)}"
            data-port="${service.port}">
            📊 Monitor Data
          </button>
        </div>

        <!-- Data Capture Panel (initially hidden) -->
        <div class="data-capture-panel" id="capture-${this.escapeHtml(
          service.name,
        )}">
          <div class="capture-header">
            <h4>
              <span id="monitor-badge-${this.escapeHtml(service.name)}"></span>
              Data Monitor
            </h4>
            <div class="capture-controls">
              <button class="btn btn-danger btn-icon stop-monitor" data-service="${this.escapeHtml(
                service.name,
              )}">⏹</button>
              <button class="btn btn-secondary btn-icon pause-capture" data-service="${this.escapeHtml(
                service.name,
              )}">⏸</button>
              <button class="btn btn-secondary btn-icon clear-capture" data-service="${this.escapeHtml(
                service.name,
              )}">🗑️</button>
              <button class="btn btn-primary btn-icon export-capture" data-service="${this.escapeHtml(
                service.name,
              )}">💾</button>
            </div>
          </div>

          <!-- Protocol Selector -->
          <div class="protocol-selector">
            <button class="protocol-btn selected" data-protocol="tcp" data-service="${this.escapeHtml(
              service.name,
            )}">TCP</button>
            <button class="protocol-btn" data-protocol="udp" data-service="${this.escapeHtml(
              service.name,
            )}">UDP</button>
            <button class="protocol-btn" data-protocol="http" data-service="${this.escapeHtml(
              service.name,
            )}">HTTP</button>
          </div>

          <!-- Stats -->
          <div class="capture-stats">
            <div class="capture-stat">
              <div class="capture-stat-label">Packets</div>
              <div class="capture-stat-value" id="packets-${this.escapeHtml(
                service.name,
              )}">0</div>
            </div>
            <div class="capture-stat">
              <div class="capture-stat-label">Bytes</div>
              <div class="capture-stat-value" id="bytes-${this.escapeHtml(
                service.name,
              )}">0</div>
            </div>
            <div class="capture-stat">
              <div class="capture-stat-label">Rate</div>
              <div class="capture-stat-value" id="rate-${this.escapeHtml(
                service.name,
              )}">0 B/s</div>
            </div>
            <div class="capture-stat">
              <div class="capture-stat-label">Uptime</div>
              <div class="capture-stat-value" id="uptime-${this.escapeHtml(
                service.name,
              )}">0s</div>
            </div>
          </div>

          <!-- Data Viewer -->
          <div class="data-viewer">
            <div class="data-viewer-tabs">
              <button class="data-viewer-tab active" data-tab="stream" data-service="${this.escapeHtml(
                service.name,
              )}">Stream</button>
              <button class="data-viewer-tab" data-tab="hexdump" data-service="${this.escapeHtml(
                service.name,
              )}">Hexdump</button>
              <button class="data-viewer-tab" data-tab="text" data-service="${this.escapeHtml(
                service.name,
              )}">Text</button>
              <button class="data-viewer-tab" data-tab="json" data-service="${this.escapeHtml(
                service.name,
              )}">JSON</button>
            </div>
            <div class="data-viewer-content" id="viewer-${this.escapeHtml(
              service.name,
            )}">
              <div style="color: #718096; text-align: center; padding: 2rem;">
                Click "Monitor Data" to start capturing...
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getServiceBadge(service) {
    if (this.isHttpService(service)) {
      return { type: 'http', label: 'HTTP' };
    } else if (
      service.name?.toLowerCase().includes('yardrover') ||
      service.txt?.some((t) => t.toLowerCase().includes('yardrover'))
    ) {
      return { type: 'yardrover', label: 'YardRover' };
    }
    return { type: 'other', label: 'Other' };
  }

  isHttpService(service) {
    return (
      service.type?.includes('_http') ||
      service.port === 80 ||
      service.port === 443
    );
  }

  getServiceUrl(service) {
    const protocol = service.port === 443 ? 'https' : 'http';
    const address = service.addresses?.[0] || service.host;
    const port =
      service.port === 80 || service.port === 443 ? '' : `:${service.port}`;
    return `${protocol}://${address}${port}`;
  }

  attachServiceActions() {
    // Open in browser
    document.querySelectorAll('.open-browser').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const url = e.target.closest('.open-browser').dataset.url;
        window.open(url, '_blank');
        this.showToast('Opening in new tab...', 'success');
      });
    });

    // Copy info
    document.querySelectorAll('.copy-info').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const serviceData = JSON.parse(
          e.target.closest('.copy-info').dataset.service,
        );
        const text = JSON.stringify(serviceData, null, 2);
        navigator.clipboard
          .writeText(text)
          .then(() => {
            this.showToast('Service info copied to clipboard', 'success');
          })
          .catch(() => {
            this.showToast('Failed to copy to clipboard', 'error');
          });
      });
    });

    // Monitor data
    document.querySelectorAll('.monitor-data').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const button = e.target.closest('.monitor-data');
        const serviceName = button.dataset.service;
        const host = button.dataset.host;
        const port = button.dataset.port;

        const panel = document.getElementById(`capture-${serviceName}`);
        if (panel) {
          panel.classList.toggle('active');
          if (panel.classList.contains('active')) {
            // Get selected protocol
            const protocolBtn = panel.querySelector('.protocol-btn.selected');
            const protocol = protocolBtn?.dataset.protocol || 'tcp';
            this.dataCapture.startMonitoring(serviceName, host, port, protocol);
          }
        }
      });
    });

    // Stop monitor
    document.querySelectorAll('.stop-monitor').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const serviceName = e.target.closest('.stop-monitor').dataset.service;
        this.dataCapture.stopMonitoring(serviceName);
        const panel = document.getElementById(`capture-${serviceName}`);
        if (panel) panel.classList.remove('active');
        this.showToast('Monitoring stopped', 'success');
      });
    });

    // Pause capture
    document.querySelectorAll('.pause-capture').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const button = e.target.closest('.pause-capture');
        const serviceName = button.dataset.service;
        const monitor = this.dataCapture.monitors.get(serviceName);
        if (monitor) {
          monitor.paused = !monitor.paused;
          button.textContent = monitor.paused ? '▶️' : '⏸';
          this.showToast(
            monitor.paused ? 'Capture paused' : 'Capture resumed',
            'success',
          );
        }
      });
    });

    // Clear capture
    document.querySelectorAll('.clear-capture').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const serviceName = e.target.closest('.clear-capture').dataset.service;
        const monitor = this.dataCapture.monitors.get(serviceName);
        if (monitor) {
          monitor.packets = [];
          this.dataCapture.updateViewer(serviceName);
          this.showToast('Capture cleared', 'success');
        }
      });
    });

    // Export capture
    document.querySelectorAll('.export-capture').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const serviceName = e.target.closest('.export-capture').dataset.service;
        this.dataCapture.exportCapture(serviceName);
      });
    });

    // Protocol selector
    document.querySelectorAll('.protocol-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const button = e.target.closest('.protocol-btn');
        const serviceName = button.dataset.service;
        const protocol = button.dataset.protocol;

        // Update UI
        document
          .querySelectorAll(
            `.protocol-btn[data-service="${serviceName}"]`,
          )
          .forEach((b) => b.classList.remove('selected'));
        button.classList.add('selected');

        // Restart monitoring if active
        const monitor = this.dataCapture.monitors.get(serviceName);
        if (monitor && monitor.ws && monitor.ws.readyState === WebSocket.OPEN) {
          const host = monitor.host;
          const port = monitor.port;
          this.dataCapture.stopMonitoring(serviceName);
          setTimeout(() => {
            this.dataCapture.startMonitoring(serviceName, host, port, protocol);
          }, 500);
        }
      });
    });

    // Data viewer tabs
    document.querySelectorAll('.data-viewer-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const button = e.target.closest('.data-viewer-tab');
        const serviceName = button.dataset.service;
        const tab = button.dataset.tab;

        // Update active tab
        document
          .querySelectorAll(`.data-viewer-tab[data-service="${serviceName}"]`)
          .forEach((b) => b.classList.remove('active'));
        button.classList.add('active');

        // Update viewer
        const monitor = this.dataCapture.monitors.get(serviceName);
        if (monitor) {
          monitor.viewMode = tab;
          this.dataCapture.updateViewer(serviceName);
        }
      });
    });
  }

  showLoading() {
    this.servicesContainer.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Scanning network for mDNS services...</p>
      </div>
    `;
  }

  showEmptyState() {
    this.servicesContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <h2>No services discovered</h2>
        <p>Click "Scan Network" to discover mDNS services on your local network</p>
      </div>
    `;
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Data Capture Manager
 * Handles WebSocket connections and data monitoring for services
 */
class DataCaptureManager {
  constructor() {
    this.monitors = new Map();
    this.wsUrl = `ws://${window.location.hostname}:${window.location.port}`;
  }

  startMonitoring(serviceName, host, port, protocol = 'tcp') {
    // Stop existing monitor if any
    if (this.monitors.has(serviceName)) {
      this.stopMonitoring(serviceName);
    }

    // Create WebSocket connection
    const ws = new WebSocket(this.wsUrl);

    const monitor = {
      serviceName,
      host,
      port,
      protocol,
      ws,
      packets: [],
      stats: {
        packetsReceived: 0,
        bytesReceived: 0,
        startTime: Date.now(),
      },
      paused: false,
      viewMode: 'stream',
    };

    ws.onopen = () => {
      console.log(`WebSocket connected for ${serviceName}`);
      // Subscribe to service data
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          serviceKey: serviceName,
          host,
          port,
          protocol,
        }),
      );

      // Update badge
      this.updateMonitorBadge(serviceName, true);
    };

    ws.onmessage = (event) => {
      if (monitor.paused) return;

      const message = JSON.parse(event.data);

      if (message.type === 'data') {
        // Decode base64 data
        const data = atob(message.data);

        monitor.packets.push({
          timestamp: message.timestamp,
          length: message.length,
          data: data,
          raw: message.data,
        });

        // Update stats
        if (message.stats) {
          monitor.stats = message.stats;
        }

        // Limit packet history (keep last 1000 packets)
        if (monitor.packets.length > 1000) {
          monitor.packets.shift();
        }

        // Update UI
        this.updateStats(serviceName, monitor.stats);
        this.updateViewer(serviceName);
      } else if (message.type === 'error') {
        console.error(`Monitor error for ${serviceName}:`, message.message);
        this.updateMonitorBadge(serviceName, false, message.message);
      } else if (message.type === 'disconnected') {
        console.log(`Monitor disconnected for ${serviceName}`);
        this.updateMonitorBadge(serviceName, false, 'Disconnected');
      }
    };

    ws.onerror = (error) => {
      console.error(`WebSocket error for ${serviceName}:`, error);
      this.updateMonitorBadge(serviceName, false, 'Connection error');
    };

    ws.onclose = () => {
      console.log(`WebSocket closed for ${serviceName}`);
      this.updateMonitorBadge(serviceName, false);
    };

    this.monitors.set(serviceName, monitor);
  }

  stopMonitoring(serviceName) {
    const monitor = this.monitors.get(serviceName);
    if (monitor) {
      if (monitor.ws && monitor.ws.readyState === WebSocket.OPEN) {
        monitor.ws.send(
          JSON.stringify({
            type: 'unsubscribe',
            serviceKey: serviceName,
          }),
        );
        monitor.ws.close();
      }
      this.monitors.delete(serviceName);
      this.updateMonitorBadge(serviceName, false);
    }
  }

  updateMonitorBadge(serviceName, active, errorMsg = null) {
    const badgeEl = document.getElementById(`monitor-badge-${serviceName}`);
    if (badgeEl) {
      if (active) {
        badgeEl.innerHTML =
          '<span class="monitoring-badge">🔴 LIVE</span>';
      } else if (errorMsg) {
        badgeEl.innerHTML = `<span style="color: #f56565; font-size: 0.75rem;">${errorMsg}</span>`;
      } else {
        badgeEl.innerHTML = '';
      }
    }
  }

  updateStats(serviceName, stats) {
    const packetsEl = document.getElementById(`packets-${serviceName}`);
    const bytesEl = document.getElementById(`bytes-${serviceName}`);
    const rateEl = document.getElementById(`rate-${serviceName}`);
    const uptimeEl = document.getElementById(`uptime-${serviceName}`);

    if (packetsEl) packetsEl.textContent = stats.packetsReceived || 0;
    if (bytesEl) bytesEl.textContent = this.formatBytes(stats.bytesReceived || 0);

    // Calculate rate
    const uptime = (Date.now() - stats.startTime) / 1000;
    const rate = uptime > 0 ? (stats.bytesReceived || 0) / uptime : 0;
    if (rateEl) rateEl.textContent = `${this.formatBytes(rate)}/s`;

    if (uptimeEl) uptimeEl.textContent = `${Math.floor(uptime)}s`;
  }

  updateViewer(serviceName) {
    const monitor = this.monitors.get(serviceName);
    if (!monitor) return;

    const viewerEl = document.getElementById(`viewer-${serviceName}`);
    if (!viewerEl) return;

    const mode = monitor.viewMode || 'stream';

    if (monitor.packets.length === 0) {
      viewerEl.innerHTML = `
        <div style="color: #718096; text-align: center; padding: 2rem;">
          No data captured yet...
        </div>
      `;
      return;
    }

    let html = '';

    switch (mode) {
      case 'stream':
        html = this.renderStream(monitor.packets);
        break;
      case 'hexdump':
        html = this.renderHexdump(monitor.packets);
        break;
      case 'text':
        html = this.renderText(monitor.packets);
        break;
      case 'json':
        html = this.renderJSON(monitor.packets);
        break;
    }

    viewerEl.innerHTML = html;
    // Auto-scroll to bottom
    viewerEl.scrollTop = viewerEl.scrollHeight;
  }

  renderStream(packets) {
    return packets
      .slice(-50)
      .map((packet) => {
        const time = new Date(packet.timestamp).toLocaleTimeString();
        return `
        <div class="data-packet">
          <div class="packet-meta">
            <span>${time}</span>
            <span>${packet.length} bytes</span>
          </div>
          <div class="packet-data">${this.escapeHtml(packet.data.substring(0, 200))}${packet.data.length > 200 ? '...' : ''}</div>
        </div>
      `;
      })
      .join('');
  }

  renderHexdump(packets) {
    if (packets.length === 0) return '';

    // Combine last few packets for hexdump
    const lastPacket = packets[packets.length - 1];
    const data = lastPacket.data;

    let html = '<div class="hexdump">';
    for (let i = 0; i < data.length; i += 16) {
      const chunk = data.substring(i, i + 16);
      const offset = i.toString(16).padStart(8, '0');

      const hexBytes = [];
      const asciiChars = [];

      for (let j = 0; j < chunk.length; j++) {
        const byte = chunk.charCodeAt(j);
        hexBytes.push(byte.toString(16).padStart(2, '0'));
        asciiChars.push(byte >= 32 && byte <= 126 ? chunk[j] : '.');
      }

      html += `
        <div class="hexdump-row">
          <span class="hexdump-offset">${offset}</span>
          <span class="hexdump-bytes">${hexBytes.join(' ')}</span>
          <span class="hexdump-ascii">${asciiChars.join('')}</span>
        </div>
      `;
    }
    html += '</div>';

    return html;
  }

  renderText(packets) {
    return `<div style="white-space: pre-wrap; font-family: 'Courier New', monospace;">${this.escapeHtml(
      packets
        .slice(-50)
        .map((p) => p.data)
        .join('\n'),
    )}</div>`;
  }

  renderJSON(packets) {
    try {
      // Try to parse packets as JSON
      const jsonData = packets.slice(-10).map((packet) => {
        try {
          return JSON.parse(packet.data);
        } catch {
          return { raw: packet.data };
        }
      });

      return `<pre>${this.escapeHtml(JSON.stringify(jsonData, null, 2))}</pre>`;
    } catch (error) {
      return `<div style="color: #f56565;">Invalid JSON data</div>`;
    }
  }

  exportCapture(serviceName) {
    const monitor = this.monitors.get(serviceName);
    if (!monitor || monitor.packets.length === 0) {
      alert('No data to export');
      return;
    }

    // Create export data
    const exportData = {
      service: serviceName,
      host: monitor.host,
      port: monitor.port,
      protocol: monitor.protocol,
      stats: monitor.stats,
      packets: monitor.packets.map((p) => ({
        timestamp: p.timestamp,
        length: p.length,
        data: p.raw, // Base64 encoded
      })),
    };

    // Download as JSON
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serviceName}-capture-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the explorer
document.addEventListener('DOMContentLoaded', () => {
  new MDNSExplorer();
});

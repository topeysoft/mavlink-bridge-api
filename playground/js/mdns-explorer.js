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

    this.initElements();
    this.attachEventListeners();
  }

  initElements() {
    this.scanBtn = document.getElementById('scanBtn');
    this.autoRefreshBtn = document.getElementById('autoRefreshBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.filterInput = document.getElementById('filterInput');
    this.servicesContainer = document.getElementById('servicesContainer');
    this.totalServicesEl = document.getElementById('totalServices');
    this.httpServicesEl = document.getElementById('httpServices');
    this.yardRoverDevicesEl = document.getElementById('yardRoverDevices');
    this.lastScanEl = document.getElementById('lastScan');
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
      const response = await fetch('/api/mdns/scan');

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

// Initialize the explorer
document.addEventListener('DOMContentLoaded', () => {
  new MDNSExplorer();
});

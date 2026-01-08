/**
 * API Explorer
 * Dynamically generates API documentation and testing interface from OpenAPI spec
 */

export class ApiExplorer {
  constructor(deviceConnection, config) {
    this.deviceConnection = deviceConnection;
    this.config = config;
    this.spec = null;
    this.endpoints = [];
    this.expandedEndpoints = new Set();
    this.requestHistory = [];
  }

  /**
   * Initialize API Explorer
   */
  async init() {
    this.setupEventListeners();
    await this.loadOpenApiSpec();
    this.renderEndpoints();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    document.getElementById('expandAllBtn').addEventListener('click', () => {
      this.expandAll();
    });

    document.getElementById('collapseAllBtn').addEventListener('click', () => {
      this.collapseAll();
    });
  }

  /**
   * Load OpenAPI specification
   */
  async loadOpenApiSpec() {
    try {
      console.log('Fetching OpenAPI spec from ./api-spec.yaml...');
      const response = await fetch('./api-spec.yaml');
      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const yamlText = await response.text();
      console.log('YAML text length:', yamlText.length);
      console.log('First 100 chars:', yamlText.substring(0, 100));

      if (typeof jsyaml === 'undefined') {
        throw new Error('js-yaml library not loaded');
      }

      this.spec = jsyaml.load(yamlText);
      console.log('Loaded OpenAPI spec:', this.spec);
      console.log(
        'Number of paths:',
        Object.keys(this.spec.paths || {}).length,
      );
    } catch (error) {
      console.error('Failed to load OpenAPI spec:', error);
      this.showError('Failed to load API specification: ' + error.message);
    }
  }

  /**
   * Render API endpoints
   */
  renderEndpoints() {
    console.log('renderEndpoints called, spec:', this.spec);

    if (!this.spec || !this.spec.paths) {
      console.error('No spec or paths found!', {
        hasSpec: !!this.spec,
        hasPaths: !!(this.spec && this.spec.paths),
      });
      return;
    }

    const container = document.getElementById('apiEndpoints');
    if (!container) {
      console.error('apiEndpoints container not found!');
      return;
    }

    console.log('Clearing container and grouping endpoints...');
    container.innerHTML = '';

    // Group endpoints by tags
    const grouped = this.groupEndpointsByTag();
    console.log(
      'Grouped endpoints:',
      Object.keys(grouped),
      'Total groups:',
      Object.keys(grouped).length,
    );

    // Render each group
    Object.entries(grouped).forEach(([tag, endpoints]) => {
      console.log(
        `Rendering section: ${tag} with ${endpoints.length} endpoints`,
      );
      const section = this.createSection(tag, endpoints);
      container.appendChild(section);
    });

    console.log('Render complete!');
  }

  /**
   * Group endpoints by tags
   */
  groupEndpointsByTag() {
    const grouped = {};

    Object.entries(this.spec.paths).forEach(([path, pathItem]) => {
      Object.entries(pathItem).forEach(([method, operation]) => {
        if (method === 'parameters') return; // Skip parameters

        const tag = operation.tags?.[0] || 'Other';

        if (!grouped[tag]) {
          grouped[tag] = [];
        }

        grouped[tag].push({
          path,
          method: method.toUpperCase(),
          operation,
        });
      });
    });

    return grouped;
  }

  /**
   * Create section for a tag group
   */
  createSection(tag, endpoints) {
    const section = document.createElement('div');
    section.className = 'endpoint-section';

    const header = document.createElement('h3');
    header.textContent = tag;
    header.style.marginBottom = '1rem';
    header.style.fontSize = '1.25rem';
    header.style.color = 'var(--primary-color)';

    section.appendChild(header);

    endpoints.forEach((endpoint) => {
      const card = this.createEndpointCard(endpoint);
      section.appendChild(card);
    });

    return section;
  }

  /**
   * Create endpoint card
   */
  createEndpointCard(endpoint) {
    const { path, method, operation } = endpoint;
    const endpointId = `${method}-${path}`.replace(/[^a-zA-Z0-9]/g, '-');

    const card = document.createElement('div');
    card.className = 'endpoint-card';
    card.setAttribute('data-endpoint-id', endpointId);

    // Header
    const header = document.createElement('div');
    header.className = 'endpoint-header';
    header.innerHTML = `
            <span class="method-badge ${method.toLowerCase()}">${method}</span>
            <span class="endpoint-path">${path}</span>
            <span class="endpoint-description">${operation.summary || ''}</span>
        `;

    header.addEventListener('click', () => {
      this.toggleEndpoint(card, endpointId);
    });

    // Body
    const body = document.createElement('div');
    body.className = 'endpoint-body';
    body.innerHTML = this.createEndpointBody(endpoint);

    card.appendChild(header);
    card.appendChild(body);

    // Setup execute button
    setTimeout(() => {
      const executeBtn = card.querySelector('.execute-btn');
      if (executeBtn) {
        executeBtn.addEventListener('click', () => {
          this.executeRequest(endpoint, card);
        });
      }
    }, 0);

    return card;
  }

  /**
   * Create endpoint body content
   */
  createEndpointBody(endpoint) {
    const { path, method, operation } = endpoint;
    let html = '';

    // Description
    if (operation.description) {
      html += `
                <div class="endpoint-section">
                    <p style="color: var(--text-secondary);">${operation.description}</p>
                </div>
            `;
    }

    // Parameters
    if (operation.parameters && operation.parameters.length > 0) {
      html += `
                <div class="endpoint-section">
                    <h4>Parameters</h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 1px solid var(--border-color);">
                                <th style="padding: 0.5rem;">Name</th>
                                <th style="padding: 0.5rem;">In</th>
                                <th style="padding: 0.5rem;">Type</th>
                                <th style="padding: 0.5rem;">Required</th>
                                <th style="padding: 0.5rem;">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${operation.parameters
                              .map(
                                (param) => `
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <td style="padding: 0.5rem; font-family: monospace;">${
                                      param.name
                                    }</td>
                                    <td style="padding: 0.5rem;">${
                                      param.in
                                    }</td>
                                    <td style="padding: 0.5rem;">${
                                      param.schema?.type || 'string'
                                    }</td>
                                    <td style="padding: 0.5rem;">${
                                      param.required ? '✓' : ''
                                    }</td>
                                    <td style="padding: 0.5rem; color: var(--text-secondary);">${
                                      param.description || ''
                                    }</td>
                                </tr>
                            `,
                              )
                              .join('')}
                        </tbody>
                    </table>
                </div>
            `;
    }

    // Request Body
    if (operation.requestBody) {
      const schema =
        operation.requestBody.content?.['application/json']?.schema;
      const example = this.generateExample(schema);

      html += `
                <div class="endpoint-section">
                    <h4>Request Body</h4>
                    <div class="request-body-editor">
                        <textarea 
                            class="request-body-input" 
                            placeholder="Enter JSON request body..."
                        >${JSON.stringify(example, null, 2)}</textarea>
                    </div>
                </div>
            `;
    }

    // Execute section
    html += `
            <div class="execute-section">
                <button class="btn btn-primary execute-btn">
                    ▶️ Execute
                </button>
                <span class="request-status"></span>
            </div>
        `;

    // Response section
    html += `
            <div class="endpoint-section response-section" style="display: none;">
                <h4>Response</h4>
                <div class="response-viewer">
                    <pre><code class="language-json"></code></pre>
                </div>
            </div>
        `;

    return html;
  }

  /**
   * Generate example from schema
   */
  generateExample(schema) {
    if (!schema) return {};

    if (schema.$ref) {
      // Handle references
      const refPath = schema.$ref.replace('#/components/schemas/', '');
      schema = this.spec.components?.schemas?.[refPath];
      if (!schema) return {};
    }

    if (schema.example) {
      return schema.example;
    }

    if (schema.type === 'object' && schema.properties) {
      const example = {};
      Object.entries(schema.properties).forEach(([key, prop]) => {
        example[key] = this.generateExampleValue(prop);
      });
      return example;
    }

    return this.generateExampleValue(schema);
  }

  /**
   * Generate example value from schema property
   */
  generateExampleValue(prop) {
    if (prop.example !== undefined) return prop.example;
    if (prop.default !== undefined) return prop.default;

    switch (prop.type) {
      case 'string':
        return prop.enum ? prop.enum[0] : 'string';
      case 'number':
      case 'integer':
        return 0;
      case 'boolean':
        return false;
      case 'array':
        return [];
      case 'object':
        return {};
      default:
        return null;
    }
  }

  /**
   * Toggle endpoint expansion
   */
  toggleEndpoint(card, endpointId) {
    if (this.expandedEndpoints.has(endpointId)) {
      card.classList.remove('expanded');
      this.expandedEndpoints.delete(endpointId);
    } else {
      card.classList.add('expanded');
      this.expandedEndpoints.add(endpointId);
    }
  }

  /**
   * Expand all endpoints
   */
  expandAll() {
    document.querySelectorAll('.endpoint-card').forEach((card) => {
      const endpointId = card.getAttribute('data-endpoint-id');
      card.classList.add('expanded');
      this.expandedEndpoints.add(endpointId);
    });
  }

  /**
   * Collapse all endpoints
   */
  collapseAll() {
    document.querySelectorAll('.endpoint-card').forEach((card) => {
      card.classList.remove('expanded');
    });
    this.expandedEndpoints.clear();
  }

  /**
   * Execute API request
   */
  async executeRequest(endpoint, card) {
    const client = this.deviceConnection.getClient();
    if (!client) {
      alert('Please connect to a device first');
      return;
    }

    const { path, method, operation } = endpoint;
    const statusEl = card.querySelector('.request-status');
    const responseSection = card.querySelector('.response-section');
    const responseCode = responseSection.querySelector('code');

    // Get request body if present
    let body = null;
    const bodyInput = card.querySelector('.request-body-input');
    if (bodyInput) {
      try {
        const bodyText = bodyInput.value.trim();
        if (bodyText) {
          body = JSON.parse(bodyText);
        }
      } catch (error) {
        statusEl.textContent = '❌ Invalid JSON';
        statusEl.style.color = 'var(--danger-color)';
        return;
      }
    }

    // Show loading
    statusEl.textContent = '⏳ Sending...';
    statusEl.style.color = 'var(--warning-color)';

    const startTime = Date.now();

    try {
      // Get HTTP client from the main client
      const httpClient = client.httpClient || client;

      // Execute request
      let response;
      const fullPath = path; // OpenAPI paths are already formatted

      switch (method) {
        case 'GET':
          response = await httpClient.get(fullPath);
          break;
        case 'POST':
          response = await httpClient.post(fullPath, body);
          break;
        case 'PUT':
          response = await httpClient.put(fullPath, body);
          break;
        case 'PATCH':
          response = await httpClient.patch(fullPath, body);
          break;
        case 'DELETE':
          response = await httpClient.delete(fullPath);
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      const duration = Date.now() - startTime;

      // Show success
      statusEl.textContent = `✅ Success (${duration}ms)`;
      statusEl.style.color = 'var(--success-color)';

      // Display response
      responseCode.textContent = JSON.stringify(response, null, 2);
      hljs.highlightElement(responseCode);
      responseSection.style.display = 'block';

      // Add to history
      this.addToHistory({
        method,
        path,
        body,
        response,
        status: 'success',
        duration,
        timestamp: new Date(),
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      // Show error
      statusEl.textContent = `❌ Error: ${error.message}`;
      statusEl.style.color = 'var(--danger-color)';

      // Display error response
      responseCode.textContent = JSON.stringify(
        {
          error: error.message,
          stack: error.stack,
        },
        null,
        2,
      );
      hljs.highlightElement(responseCode);
      responseSection.style.display = 'block';

      // Add to history
      this.addToHistory({
        method,
        path,
        body,
        response: { error: error.message },
        status: 'error',
        duration,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Add request to history
   */
  addToHistory(request) {
    this.requestHistory.unshift(request);

    // Keep only last 50 requests
    if (this.requestHistory.length > 50) {
      this.requestHistory = this.requestHistory.slice(0, 50);
    }

    // Save to localStorage
    try {
      localStorage.setItem(
        'requestHistory',
        JSON.stringify(this.requestHistory),
      );
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const container = document.getElementById('apiEndpoints');
    container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--danger-color);">
                <p>${message}</p>
            </div>
        `;
  }
}

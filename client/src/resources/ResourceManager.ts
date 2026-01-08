/**
 * ResourceManager - Base class for syncing resources with ESP32 and IndexedDB
 */

import { HttpClient } from '../core/HttpClient';
import { WebSocketClient } from '../core/WebSocketClient';
import { EventType } from '../core/EventTypes';
import type {
  ResourceType,
  ResourceMetadata,
  ResourceListResponse,
  SyncStatus,
  ResourceData,
  ResourceStorageConfig
} from './ResourceTypes';

export abstract class ResourceManager<T extends ResourceData> {
  protected httpClient: HttpClient;
  protected wsClient: WebSocketClient | null = null;
  protected config: ResourceStorageConfig;
  protected db: IDBDatabase | null = null;
  protected syncStatus: SyncStatus = {
    status: 'offline',
    lastSync: 0,
    pendingChanges: 0
  };
  protected syncInterval: number | null = null;

  constructor(
    httpClient: HttpClient,
    config: Partial<ResourceStorageConfig> = {}
  ) {
    this.httpClient = httpClient;
    this.config = {
      dbName: 'yardrover-resources',
      dbVersion: 2,  // Incremented to force migration for existing databases
      storeName: this.getStoreName(),
      syncInterval: 0,  // Disabled by default
      conflictResolution: 'server-wins',
      ...config
    };
  }

  /**
   * Initialize the manager - must be called before use
   */
  async initialize(): Promise<void> {
    await this.initIndexedDB();

    if (this.config.syncInterval && this.config.syncInterval > 0) {
      this.startAutoSync();
    }
  }

  /**
   * Connect to WebSocket for real-time sync
   */
  connectWebSocket(wsClient: WebSocketClient): void {
    this.wsClient = wsClient;
    this.registerWebSocketHandlers();
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this.wsClient) {
      this.unregisterWebSocketHandlers();
      this.wsClient = null;
    }
  }

  /**
   * Sync with server - fetch latest changes
   */
  async sync(): Promise<void> {
    this.syncStatus.status = 'syncing';

    try {
      const lastSync = await this.getLastSyncTimestamp();
      const response = await this.fetchResourceList(lastSync);

      // Update local cache with server data
      for (const meta of this.extractMetadataFromResponse(response)) {
        const data = await this.fetchResourceFromServer(meta.id);
        if (data) {
          await this.saveToCache(data);
        }
      }

      // Handle deletions
      if (response.deleted) {
        for (const id of response.deleted) {
          await this.deleteFromCache(id);
        }
      }

      await this.setLastSyncTimestamp(response.version);
      this.syncStatus.status = 'synced';
      this.syncStatus.lastSync = Date.now();
      this.syncStatus.pendingChanges = 0;
    } catch (error) {
      this.syncStatus.status = 'error';
      this.syncStatus.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * Get all resources from cache
   */
  async getAll(): Promise<T[]> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readonly');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        // Filter out sync metadata from results
        const results = request.result.filter((item: any) => item.id !== '__sync_metadata__');
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get resource by ID from cache
   */
  async getById(id: string): Promise<T | null> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readonly');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Create new resource (optimistic update)
   */
  async create(data: T): Promise<T> {
    // Save to cache immediately (optimistic)
    await this.saveToCache(data);
    this.syncStatus.pendingChanges++;

    try {
      // Send to server
      await this.createOnServer(data);
      this.syncStatus.pendingChanges--;
      return data;
    } catch (error) {
      // Rollback on error
      await this.deleteFromCache(data.id);
      this.syncStatus.pendingChanges--;
      throw error;
    }
  }

  /**
   * Update existing resource (optimistic update)
   */
  async update(id: string, updates: Partial<T>): Promise<T> {
    // Get current data
    const current = await this.getById(id);
    if (!current) {
      throw new Error(`Resource ${id} not found`);
    }

    // Apply updates
    const updated = { ...current, ...updates, lastModified: new Date().toISOString() } as T;

    // Save to cache (optimistic)
    await this.saveToCache(updated);
    this.syncStatus.pendingChanges++;

    try {
      // Send to server
      await this.updateOnServer(id, updated);
      this.syncStatus.pendingChanges--;
      return updated;
    } catch (error) {
      // Rollback on error
      await this.saveToCache(current);
      this.syncStatus.pendingChanges--;
      throw error;
    }
  }

  /**
   * Delete resource (optimistic update)
   */
  async delete(id: string): Promise<void> {
    // Get current data for rollback
    const current = await this.getById(id);

    // Delete from cache (optimistic)
    await this.deleteFromCache(id);
    this.syncStatus.pendingChanges++;

    try {
      // Send to server
      await this.deleteOnServer(id);
      this.syncStatus.pendingChanges--;
    } catch (error) {
      // Rollback on error
      if (current) {
        await this.saveToCache(current);
      }
      this.syncStatus.pendingChanges--;
      throw error;
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Close the manager and clean up
   */
  async close(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.disconnectWebSocket();

    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Protected abstract methods to be implemented by subclasses

  protected abstract getStoreName(): string;
  protected abstract getResourceType(): ResourceType;
  protected abstract getApiPath(): string;
  protected abstract getWebSocketEventTypes(): {
    created: EventType;
    updated: EventType;
    deleted: EventType;
  };

  // Protected helper methods

  protected async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create all known stores to prevent version conflicts
        // when multiple managers try to open the same database
        const requiredStores = ['zones', 'missions'];

        for (const storeName of requiredStores) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      };
    });
  }

  protected async saveToCache(data: T): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite');
      const store = transaction.objectStore(this.config.storeName);

      // Clone data to ensure it's serializable for IndexedDB
      // This removes any Proxy objects or other non-cloneable structures
      const clonedData = JSON.parse(JSON.stringify(data));

      const request = store.put(clonedData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  protected async deleteFromCache(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  protected async fetchResourceList(since: number = 0): Promise<ResourceListResponse> {
    const path = `${this.getApiPath()}?since=${since}`;
    const response = await this.httpClient.get(path);
    return response as ResourceListResponse;
  }

  protected async fetchResourceFromServer(id: string): Promise<T | null> {
    try {
      const path = `${this.getApiPath()}/${id}`;
      const response = await this.httpClient.get(path);
      return response as T;
    } catch (error) {
      return null;
    }
  }

  protected async createOnServer(data: T): Promise<void> {
    await this.httpClient.post(this.getApiPath(), data);
  }

  protected async updateOnServer(id: string, data: T): Promise<void> {
    await this.httpClient.put(`${this.getApiPath()}/${id}`, data);
  }

  protected async deleteOnServer(id: string): Promise<void> {
    await this.httpClient.delete(`${this.getApiPath()}/${id}`);
  }

  protected abstract extractMetadataFromResponse(response: ResourceListResponse): ResourceMetadata[];

  protected async getLastSyncTimestamp(): Promise<number> {
    if (!this.db) return 0;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readonly');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.get('__sync_metadata__');

      request.onsuccess = () => {
        const meta = request.result;
        resolve(meta?.lastSync || 0);
      };
      request.onerror = () => resolve(0);
    });
  }

  protected async setLastSyncTimestamp(timestamp: number): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.config.storeName], 'readwrite');
      const store = transaction.objectStore(this.config.storeName);
      const request = store.put({ id: '__sync_metadata__', lastSync: timestamp });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  protected registerWebSocketHandlers(): void {
    if (!this.wsClient) return;

    const events = this.getWebSocketEventTypes();

    this.wsClient.on(events.created, this.handleResourceCreated.bind(this));
    this.wsClient.on(events.updated, this.handleResourceUpdated.bind(this));
    this.wsClient.on(events.deleted, this.handleResourceDeleted.bind(this));
  }

  protected unregisterWebSocketHandlers(): void {
    if (!this.wsClient) return;

    const events = this.getWebSocketEventTypes();

    this.wsClient.off(events.created, this.handleResourceCreated.bind(this));
    this.wsClient.off(events.updated, this.handleResourceUpdated.bind(this));
    this.wsClient.off(events.deleted, this.handleResourceDeleted.bind(this));
  }

  protected async handleResourceCreated(payload: any): Promise<void> {
    if (payload.data) {
      await this.saveToCache(payload.data as T);
    }
  }

  protected async handleResourceUpdated(payload: any): Promise<void> {
    if (payload.data) {
      await this.saveToCache(payload.data as T);
    }
  }

  protected async handleResourceDeleted(payload: any): Promise<void> {
    if (payload.id) {
      await this.deleteFromCache(payload.id);
    }
  }

  protected startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    if (this.config.syncInterval && this.config.syncInterval > 0) {
      this.syncInterval = window.setInterval(() => {
        this.sync().catch(console.error);
      }, this.config.syncInterval);
    }
  }
}

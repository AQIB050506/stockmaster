// Offline Storage Manager using IndexedDB
class OfflineManager {
  constructor() {
    this.db = null;
    this.dbName = 'StockMasterDB';
    this.dbVersion = 1;
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.pendingSyncCount = 0;
    
    this.init();
    this.setupNetworkListeners();
  }

  async init() {
    try {
      this.db = await this.openDB();
      console.log('[OfflineManager] Initialized');
      this.updatePendingCount();
    } catch (error) {
      console.error('[OfflineManager] Initialization error:', error);
    }
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('pendingTransactions')) {
          const transactionStore = db.createObjectStore('pendingTransactions', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          transactionStore.createIndex('timestamp', 'timestamp', { unique: false });
          transactionStore.createIndex('endpoint', 'endpoint', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('offlineData')) {
          const dataStore = db.createObjectStore('offlineData', { keyPath: 'key' });
        }
      };
    });
  }

  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('[OfflineManager] Network online');
      this.isOnline = true;
      this.updateOnlineStatus(true);
      this.syncPendingTransactions();
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineManager] Network offline');
      this.isOnline = false;
      this.updateOnlineStatus(false);
    });
  }

  updateOnlineStatus(isOnline) {
    const statusIndicator = document.getElementById('offlineStatus');
    if (statusIndicator) {
      if (isOnline) {
        statusIndicator.innerHTML = '<span style="color: #10b981;">● Online</span>';
        statusIndicator.style.display = 'none';
      } else {
        statusIndicator.innerHTML = '<span style="color: #ef4444;">● Offline</span>';
        statusIndicator.style.display = 'block';
      }
    }
  }

  // Store pending transaction
  async storePendingTransaction(endpoint, method, body, timestamp = Date.now()) {
    try {
      if (!this.db) {
        this.db = await this.openDB();
      }

      const transaction = this.db.transaction(['pendingTransactions'], 'readwrite');
      const store = transaction.objectStore('pendingTransactions');
      
      const pendingItem = {
        endpoint,
        method,
        body,
        timestamp,
        retryCount: 0,
        lastRetry: null
      };

      await store.add(pendingItem);
      await this.updatePendingCount();
      
      console.log('[OfflineManager] Stored pending transaction:', endpoint);
      return pendingItem.id;
    } catch (error) {
      console.error('[OfflineManager] Error storing pending transaction:', error);
      throw error;
    }
  }

  // Get all pending transactions
  async getPendingTransactions() {
    try {
      if (!this.db) {
        this.db = await this.openDB();
      }

      const transaction = this.db.transaction(['pendingTransactions'], 'readonly');
      const store = transaction.objectStore('pendingTransactions');
      const index = store.index('timestamp');
      
      return new Promise((resolve, reject) => {
        const request = index.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[OfflineManager] Error getting pending transactions:', error);
      return [];
    }
  }

  // Remove pending transaction after successful sync
  async removePendingTransaction(id) {
    try {
      if (!this.db) {
        this.db = await this.openDB();
      }

      const transaction = this.db.transaction(['pendingTransactions'], 'readwrite');
      const store = transaction.objectStore('pendingTransactions');
      
      await store.delete(id);
      await this.updatePendingCount();
      
      console.log('[OfflineManager] Removed pending transaction:', id);
    } catch (error) {
      console.error('[OfflineManager] Error removing pending transaction:', error);
    }
  }

  // Sync pending transactions
  async syncPendingTransactions() {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    const pending = await this.getPendingTransactions();

    if (pending.length === 0) {
      this.syncInProgress = false;
      return;
    }

    console.log(`[OfflineManager] Syncing ${pending.length} pending transactions`);

    let successCount = 0;
    let failCount = 0;

    for (const item of pending) {
      try {
        // Check if max retries exceeded
        if (item.retryCount >= 5) {
          console.warn('[OfflineManager] Max retries exceeded for:', item.endpoint);
          await this.removePendingTransaction(item.id);
          failCount++;
          continue;
        }

        // Make the API call
        const response = await fetch(`/api${item.endpoint}`, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: item.body ? JSON.stringify(item.body) : null
        });

        if (response.ok) {
          // Success - remove from pending
          await this.removePendingTransaction(item.id);
          successCount++;
          console.log('[OfflineManager] Synced transaction:', item.endpoint);
        } else {
          // Failed - increment retry count
          await this.incrementRetryCount(item.id);
          failCount++;
          console.warn('[OfflineManager] Sync failed for:', item.endpoint);
        }
      } catch (error) {
        console.error('[OfflineManager] Sync error:', error);
        await this.incrementRetryCount(item.id);
        failCount++;
      }
    }

    this.syncInProgress = false;
    this.pendingSyncCount = pending.length - successCount;

    if (successCount > 0) {
      this.showSyncNotification(`Synced ${successCount} transaction(s)`, 'success');
      // Refresh relevant pages
      if (typeof loadDashboard === 'function') loadDashboard();
      if (typeof loadReceipts === 'function') loadReceipts();
    }

    if (failCount > 0 && this.pendingSyncCount > 0) {
      this.showSyncNotification(`${this.pendingSyncCount} transaction(s) pending sync`, 'warning');
    }
  }

  // Increment retry count
  async incrementRetryCount(id) {
    try {
      if (!this.db) {
        this.db = await this.openDB();
      }

      const transaction = this.db.transaction(['pendingTransactions'], 'readwrite');
      const store = transaction.objectStore('pendingTransactions');
      const request = store.get(id);

      request.onsuccess = () => {
        const item = request.result;
        if (item) {
          item.retryCount = (item.retryCount || 0) + 1;
          item.lastRetry = Date.now();
          store.put(item);
        }
      };
    } catch (error) {
      console.error('[OfflineManager] Error incrementing retry count:', error);
    }
  }

  // Update pending count display
  async updatePendingCount() {
    try {
      const pending = await this.getPendingTransactions();
      this.pendingSyncCount = pending.length;

      const countElement = document.getElementById('pendingSyncCount');
      if (countElement) {
        if (this.pendingSyncCount > 0) {
          countElement.textContent = this.pendingSyncCount;
          countElement.style.display = 'inline-block';
        } else {
          countElement.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('[OfflineManager] Error updating pending count:', error);
    }
  }

  // Store offline data (for caching)
  async storeOfflineData(key, data) {
    try {
      if (!this.db) {
        this.db = await this.openDB();
      }

      const transaction = this.db.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      
      await store.put({ key, data, timestamp: Date.now() });
    } catch (error) {
      console.error('[OfflineManager] Error storing offline data:', error);
    }
  }

  // Get offline data
  async getOfflineData(key) {
    try {
      if (!this.db) {
        this.db = await this.openDB();
      }

      const transaction = this.db.transaction(['offlineData'], 'readonly');
      const store = transaction.objectStore('offlineData');
      const request = store.get(key);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          resolve(request.result ? request.result.data : null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[OfflineManager] Error getting offline data:', error);
      return null;
    }
  }

  // Show sync notification
  showSyncNotification(message, type = 'info') {
    // Create or update notification element
    let notification = document.getElementById('syncNotification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'syncNotification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        max-width: 300px;
        animation: slideIn 0.3s ease;
      `;
      document.body.appendChild(notification);
    }

    const colors = {
      success: { bg: '#10b981', text: 'white' },
      warning: { bg: '#f59e0b', text: 'white' },
      error: { bg: '#ef4444', text: 'white' },
      info: { bg: '#3b82f6', text: 'white' }
    };

    const color = colors[type] || colors.info;
    notification.style.background = color.bg;
    notification.style.color = color.text;
    notification.textContent = message;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (notification) {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
          if (notification && notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, 3000);
  }

  // Manual sync trigger
  async manualSync() {
    if (!this.isOnline) {
      this.showSyncNotification('Cannot sync while offline', 'error');
      return;
    }

    this.showSyncNotification('Syncing...', 'info');
    await this.syncPendingTransactions();
  }
}

// Create global instance
const offlineManager = new OfflineManager();

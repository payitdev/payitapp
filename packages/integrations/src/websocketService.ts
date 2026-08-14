/**
 * WebSocket Service for Real-Time Status Tracking
 * 
 * Provides real-time updates for Ondo action status via WebSocket
 * Replaces HTTP polling for better UX and reduced API load
 */

type WebSocketMessage = {
  type: 'action_update' | 'error' | 'heartbeat';
  data?: any;
  error?: string;
};

type ActionUpdateCallback = (update: {
  actionId: string;
  status: string;
  phase?: string;
  timestamp: number;
}) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 5000;
  private maxReconnectAttempts: number = 10;
  private reconnectAttempts: number = 0;
  private isConnected: boolean = false;
  private callbacks: Map<string, ActionUpdateCallback[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Connect to Pods WebSocket endpoint
   */
  connect(podsApiKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Connect to Pods WebSocket endpoint
        // Note: Actual WebSocket endpoint needs to be confirmed with Pods documentation
        const wsUrl = `wss://api.pods.finance/ws?api_key=${podsApiKey}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('🔌 WebSocket connected to Pods');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('🔌 WebSocket disconnected');
          this.isConnected = false;
          this.stopHeartbeat();
          this.attemptReconnect(podsApiKey);
        };

      } catch (error) {
        console.error('❌ Failed to connect to WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Subscribe to updates for a specific action
   */
  subscribeToAction(actionId: string, callback: ActionUpdateCallback) {
    if (!this.callbacks.has(actionId)) {
      this.callbacks.set(actionId, []);
    }
    this.callbacks.get(actionId)!.push(callback);

    // Send subscription message to server
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        actionId,
      }));
    }
  }

  /**
   * Unsubscribe from action updates
   */
  unsubscribeFromAction(actionId: string, callback: ActionUpdateCallback) {
    const callbacks = this.callbacks.get(actionId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }

    // Send unsubscribe message to server
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        actionId,
      }));
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string) {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      switch (message.type) {
        case 'action_update':
          if (message.data && message.data.actionId) {
            const callbacks = this.callbacks.get(message.data.actionId);
            if (callbacks) {
              callbacks.forEach(callback => {
                callback({
                  actionId: message.data.actionId,
                  status: message.data.status,
                  phase: message.data.suw?.phase,
                  timestamp: Date.now(),
                });
              });
            }
          }
          break;

        case 'error':
          console.error('WebSocket error from server:', message.error);
          break;

        case 'heartbeat':
          // Heartbeat received, connection is alive
          break;

        default:
          console.warn('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Attempt to reconnect to WebSocket
   */
  private attemptReconnect(podsApiKey: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect(podsApiKey).catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, this.reconnectInterval);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.callbacks.clear();
  }

  /**
   * Check if connected
   */
  isConnectionAlive(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

/**
 * Get or create WebSocket service instance
 */
export function getWebSocketService(): WebSocketService {
  if (!webSocketService) {
    webSocketService = new WebSocketService();
  }
  return webSocketService;
}

/**
 * Initialize WebSocket connection with Pods API key
 */
export async function initializeWebSocket(podsApiKey: string): Promise<void> {
  const service = getWebSocketService();
  if (!service.isConnectionAlive()) {
    await service.connect(podsApiKey);
  }
}

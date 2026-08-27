import { ModelResponse, ModelStructuredResponse, ModelStreamResponse } from './types';

export type ModelEventType = 
  | 'MODEL_REQUEST_STARTED'
  | 'MODEL_REQUEST_COMPLETED'
  | 'MODEL_REQUEST_FAILED'
  | 'MODEL_FALLBACK_TRIGGERED';

export interface ModelEvent {
  type: ModelEventType;
  timestamp: number;
  provider: string;
  payload?: any;
  error?: any;
}

type EventCallback = (event: ModelEvent) => void | Promise<void>;

/**
 * Simple event emitter for model gateway telemetry.
 */
export class ModelEventEmitter {
  private listeners: Record<string, EventCallback[]> = {};

  on(eventType: ModelEventType, callback: EventCallback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);
  }

  /**
   * Emits an event to all registered listeners without blocking the main execution flow.
   * Errors in listeners are caught and logged to prevent application crashes.
   * 
   * @param event - The event object to emit
   */
  async emit(event: ModelEvent) {
    const callbacks = this.listeners[event.type] || [];
    callbacks.forEach(cb => {
      try {
        const result = cb(event);
        if (result instanceof Promise) {
          result.catch(err => console.error(`Error in event listener for ${event.type}:`, err));
        }
      } catch (err) {
        console.error(`Error in event listener for ${event.type}:`, err);
      }
    });
  }
}

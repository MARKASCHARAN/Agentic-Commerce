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

export class ModelEventEmitter {
  private listeners: Record<string, EventCallback[]> = {};

  on(eventType: ModelEventType, callback: EventCallback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);
  }

  async emit(event: ModelEvent) {
    const callbacks = this.listeners[event.type] || [];
    // We intentionally don't await all callbacks to avoid blocking the main flow,
    // but for persistence we might want to catch errors.
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

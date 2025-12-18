
type Callback = (data?: any) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, Set<Callback>> = new Map();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  on(event: string, callback: Callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Callback) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}

export const events = EventBus.getInstance();

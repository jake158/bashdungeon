type EventCallback<T extends unknown[] = unknown[]> = (...args: T) => void;

export class EventEmitter {
    private listeners: Record<string, EventCallback[]>;

    constructor() {
        this.listeners = {};
    }

    on<T extends unknown[]>(event: string, callback: EventCallback<T>): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback as EventCallback);
    }

    emit<T extends unknown[]>(event: string, ...args: T): void {
        if (this.listeners[event]) {
            this.listeners[event].forEach((callback) => callback(...args));
        }
    }
}

import { EventEmitter } from "./event-emitter";


export class Process extends EventEmitter {
    #terminationPromise;
    #terminateCallback;

    constructor(name, func, args) {
        super();
        this.name = name;
        this.func = func;
        this.args = args;
        this.status = 'inactive';
        this.#terminationPromise = null;
        this.#terminateCallback = null;
    }

    async run() {
        this.status = 'running';
        this.emit('start', this.name);

        this.#terminationPromise = new Promise((resolve) => {
            this.#terminateCallback = resolve;
        });

        const result = await Promise.race([
            this.func(...this.args),
            this.#terminationPromise
        ]);

        if (this.status !== 'terminated') {
            this.terminate();
        }
        return result;
    }

    terminate() {
        if (this.status === 'terminated') return;

        this.status = 'terminated';
        this.emit('end', this.name);

        if (this.#terminateCallback) {
            this.#terminateCallback();
        }
    }
}

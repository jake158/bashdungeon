

function EventEmitter() {
    const events = {};

    const on = (event, listener) => {
        if (!events[event]) {
            events[event] = [];
        }
        events[event].push(listener);
    };

    const emit = (event, ...args) => {
        if (events[event]) {
            events[event].forEach(listener => listener(...args));
        }
        console.log(`Event ${event} emitted`);
    };

    return {
        on,
        emit
    };
}


export { EventEmitter };

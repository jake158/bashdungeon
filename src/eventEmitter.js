

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
    };

    return {
        on,
        emit
    };
}


export { EventEmitter };

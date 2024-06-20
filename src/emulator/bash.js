import { CommandRegistry } from './commands.js';


function BashEmulator(eventEmitter) {
    const commandRegistry = CommandRegistry();
    const history = [];
    let historyIndex = 0;


    const pushToHistory = (command) => {
        history.push(command);
        historyIndex = history.length;
    };

    const parseCommand = (input) => {
        return input.trim().split(/\s+/);
    };

    const execute = (input) => {
        // Return on whitespace
        if (!/\S/.test(input)) {
            return '';
        }
        const [commandName, ...args] = parseCommand(input);
        const command = commandRegistry.get(commandName);
        pushToHistory(input);

        if (command) {
            eventEmitter.emit(commandName);
            return command(args);
        } else {
            return `${input}: command not found`;
        }
    };

    const historyUp = () => {
        // TODO: Bash remembers what was in buffer
        // E.g. type "test", press UpArrow, DownArrow
        // Result is "test"
        // TODO 2: Bash does not return duplicate history entries
        if (historyIndex > 0) {
            historyIndex--;
            return history[historyIndex];
        } else {
            return '';
        }
    };

    const historyDown = () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            return history[historyIndex];
        } else {
            return ''
        }
    };

    const autocomplete = (input) => {
        // TODO: Implement
        return input;
    };

    return {
        execute,
        historyUp,
        historyDown,
        autocomplete
    };
}


export { BashEmulator };

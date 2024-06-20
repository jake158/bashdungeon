import { CommandRegistry } from './commands.js';


function BashEmulator(eventEmitter) {
    const commandRegistry = CommandRegistry();

    const parseCommand = (input) => {
        return input.trim().split(/\s+/);
    };

    const execute = (input) => {
        const [commandName, ...args] = parseCommand(input);
        const command = commandRegistry.get(commandName);

        if (command) {
            eventEmitter.emit(commandName);
            return command(args);
        } else {
            return `${input}: command not found`;
        }
    };

    return { execute };
}


export { BashEmulator };

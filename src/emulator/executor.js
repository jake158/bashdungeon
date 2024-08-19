import { FileSystem } from './filesystem/file-system.js';
import { CommandExecutor } from './commands/command-executor.js';


export class Executor {
    #fileSystem;
    #commandExecutor;

    constructor(colorize) {
        this.colorize = colorize;
        this.#fileSystem = new FileSystem();
        this.#commandExecutor = new CommandExecutor(this.#fileSystem, colorize);
    }

    setCommand(name, callback) {
        this.#commandExecutor.set(name, callback);
    }

    executeCommand(fullCommand, stdin = '') {
        const [commandName, ...args] = fullCommand.trim().split(/\s+/);
        const commandFunc = this.#commandExecutor.get(commandName);

        if (commandFunc) {
            return commandFunc(stdin, args);
        } else {
            return { stdin: '', stdout: '', stderr: `${commandName}: command not found` };
        }
    }

    getPrompt() {
        const userAtHost = 'wizard@dungeon';
        const displayDirectory = this.#fileSystem.currentDirectory.replace(this.#fileSystem.homeDirectory, '~');
        return `${this.colorize(userAtHost, 'bold', 'green')}:${this.colorize(displayDirectory, 'bold', 'blue')}$ `;
    }
}
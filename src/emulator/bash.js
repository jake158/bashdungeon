import { EventEmitter } from "./event-emitter.js";
import { FileSystem } from './filesystem/file-system.js';
import { CommandExecutor } from './commands/command-executor.js';


export class BashEmulator extends EventEmitter {
    #fileSystem;
    #commandExecutor;
    #history;
    #historyIndex;

    constructor(clearTerminal = () => '', colorize = (text) => text, terminalCols = null) {
        super();
        this.colorize = colorize;
        this.#fileSystem = new FileSystem();
        this.#commandExecutor = new CommandExecutor(this.#fileSystem, colorize, terminalCols);
        this.#history = [];
        this.#historyIndex = 0;

        this.#commandExecutor.setCommand('clear', clearTerminal);
        this.#commandExecutor.setCommand('history', () => this.#history.map((line, index) => ` ${index + 1}  ${line}`).join('\n'));

        this.#commandExecutor.on('command', (commandName, stdin, args) => this.emit('command', commandName, stdin, args));
    }

    /**
     * @param {number} newCols
     */
    set terminalCols(newCols) {
        this.#commandExecutor.terminalCols = Math.round(newCols);
    }

    #pushToHistory(command) {
        this.#historyIndex = this.#history.length;
        if (command !== this.#history[this.#history.length - 1]) {
            this.#history.push(command);
            this.#historyIndex = this.#history.length;
        }
    }

    async #handleCommandSubstitution(input) {
        // TODO: This regex does not support nested command substitution
        // E.g. $(ls $(pwd)) => $(ls $(pwd)
        const commandSubsRegex = /\$\(([^)]+)\)|`([^`]+)`/g;
        let errors = [];
        let match;

        while ((match = commandSubsRegex.exec(input)) !== null) {
            const fullMatch = match[0];
            const innerCommand = match[1] || match[2];
            const result = await this.#parseAndExecute(innerCommand, true);
            input = input.replace(fullMatch, result.stdout.join(' '));
            errors = [...errors, ...result.stderr];
        }
        return { expandedInput: input, errorsDuringSubstitution: errors };
    }

    async #parseAndExecute(input, allInPipe = false) {
        const { expandedInput, errorsDuringSubstitution } = await this.#handleCommandSubstitution(input);

        const regex = /\|\||\||&&|&>|&|;|<>|<|2>>|2>|>>/g;
        const commands = expandedInput.split(regex).map(cmd => cmd.trim()).filter(Boolean);
        const operators = expandedInput.match(regex) || [];
        operators.unshift(';');

        let result = { stdin: '', stdout: '', stderr: '' };
        const stdout = [];
        const stderr = errorsDuringSubstitution;

        pipeline:
        for (let i = 0; i < commands.length; i++) {
            const inPipe = allInPipe || i !== commands.length - 1;
            switch (operators[i]) {
                case ';':
                    result = await this.#commandExecutor.executeCommand(commands[i], '', inPipe);
                    break;
                case '||':
                    if (!result.stderr) { break pipeline; }
                    result = await this.#commandExecutor.executeCommand(commands[i], '', inPipe);
                    break;
                case '&&':
                    if (result.stderr) { break pipeline; }
                    result = await this.#commandExecutor.executeCommand(commands[i], '', inPipe);
                    break;
                case '|':
                    stdout.pop();
                    result = await this.#commandExecutor.executeCommand(commands[i], result.stdout, inPipe);
                    break;
                case '2>':
                    stderr.pop();
                    result = await this.#commandExecutor.executeCommand(commands[i], result.stderr, inPipe);
                    break;
                default:
                    outputStream.push(`${operators[i]}: operator not implemented`);
                    break pipeline;
            }
            stderr.push(result.stderr);
            stdout.push(result.stdout);
        }
        return {
            stderr: stderr.filter(Boolean),
            stdout: stdout.filter(Boolean),
            outputStream: [...stderr, ...stdout].filter(Boolean)
        };
    }

    async execute(input) {
        if (!/\S/.test(input)) {
            return '';
        }
        this.#pushToHistory(input);
        const { outputStream } = await this.#parseAndExecute(input);
        return outputStream.join('\n');
    }

    historyUp() {
        if (this.#historyIndex > 0) {
            this.#historyIndex--;
            return this.#history[this.#historyIndex];
        } else {
            return '';
        }
    }

    historyDown() {
        if (this.#historyIndex < this.#history.length - 1) {
            this.#historyIndex++;
            return this.#history[this.#historyIndex];
        } else {
            return '';
        }
    }

    tabComplete(input) {
        // TODO: Implement
        return input;
    }

    getPrompt(colorized = true) {
        const userAtHost = this.#fileSystem.user + '@dungeon';
        const displayDirectory = this.#fileSystem.currentDirectory.replace(this.#fileSystem.homeDirectory, '~');
        return colorized
            ? `${this.colorize(userAtHost, 'bold', 'green')}:${this.colorize(displayDirectory, 'bold', 'blue')}$ `
            : `${userAtHost}:${displayDirectory}`;
    }
}

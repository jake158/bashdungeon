import { CommandExecutor } from './commands/command-executor';
import { EventEmitter } from './event-emitter';
import { FileSystem } from './filesystem/file-system';

export type ColorizeFunction = (text: string, ...styles: string[]) => string;

export class BashEmulator extends EventEmitter {
    #fileSystem: FileSystem;
    #commandExecutor: CommandExecutor;
    #history: string[];
    #historyIndex: number;
    colorize: ColorizeFunction;

    constructor(
        clearTerminal: () => string = () => '',
        colorize: ColorizeFunction = (text) => text,
        terminalCols: number | null = null
    ) {
        super();
        this.colorize = colorize;
        this.#fileSystem = new FileSystem();
        this.#commandExecutor = new CommandExecutor(this.#fileSystem, colorize, terminalCols);
        this.#history = [];
        this.#historyIndex = 0;

        this.#commandExecutor.setCommand('clear', clearTerminal);
        this.#commandExecutor.setCommand('history', () =>
            this.#history.map((line, index) => ` ${index + 1}  ${line}`).join('\n')
        );

        this.#commandExecutor.on('command', (commandName: string, stdin: string, args: string[]) =>
            this.emit('command', commandName, stdin, args)
        );
    }

    set terminalCols(newCols: number) {
        this.#commandExecutor.terminalCols = Math.round(newCols);
    }

    #pushToHistory(command: string): void {
        this.#historyIndex = this.#history.length;
        if (command !== this.#history[this.#history.length - 1]) {
            this.#history.push(command);
            this.#historyIndex = this.#history.length;
        }
    }

    #splitCommand(command: string): { commands: string[]; operators: string[] } {
        const regex = /\|\||\||&&|&>|&|;|<>|<|2>>|2>|>>/g;
        return {
            commands: command.split(regex).map((cmd) => cmd.trim()),
            operators: command.match(regex) || [],
        };
    }

    async #handleCommandSubstitution(
        input: string
    ): Promise<{ expandedInput: string; errorsDuringSubstitution: string[] }> {
        // TODO: This regex does not support nested command substitution
        // E.g. $(ls $(pwd)) => $(ls $(pwd)
        const commandSubsRegex = /\$\(([^)]+)\)|`([^`]+)`/g;
        let errors: string[] = [];
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

    async #parseAndExecute(
        input: string,
        allInPipe: boolean = false
    ): Promise<{ stderr: string[]; stdout: string[]; outputStream: string[] }> {
        const { expandedInput, errorsDuringSubstitution } = await this.#handleCommandSubstitution(input);
        const { commands, operators } = this.#splitCommand(expandedInput);
        operators.unshift(';');

        let result = { stdin: '', stdout: '', stderr: '' };
        const stdout: string[] = [];
        const stderr: string[] = errorsDuringSubstitution;

        pipeline: for (let i = 0; i < commands.length; i++) {
            const inPipe = allInPipe || i !== commands.length - 1;
            switch (operators[i]) {
                case ';':
                    result = await this.#commandExecutor.executeCommand(commands[i], '', inPipe);
                    break;
                case '||':
                    if (!result.stderr) {
                        break pipeline;
                    }
                    result = await this.#commandExecutor.executeCommand(commands[i], '', inPipe);
                    break;
                case '&&':
                    if (result.stderr) {
                        break pipeline;
                    }
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
                    stderr.push(`${operators[i]}: operator not implemented`);
                    break pipeline;
            }
            stderr.push(result.stderr);
            stdout.push(result.stdout);
        }
        return {
            stderr: stderr.filter(Boolean),
            stdout: stdout.filter(Boolean),
            outputStream: [...stderr, ...stdout].filter(Boolean),
        };
    }

    async execute(input: string): Promise<string> {
        if (!/\S/.test(input)) {
            return '';
        }
        this.#pushToHistory(input);
        const { outputStream } = await this.#parseAndExecute(input);
        return outputStream.join('\n');
    }

    historyUp(): string {
        if (this.#historyIndex > 0) {
            this.#historyIndex--;
            return this.#history[this.#historyIndex];
        } else {
            return '';
        }
    }

    historyDown(): string {
        if (this.#historyIndex < this.#history.length - 1) {
            this.#historyIndex++;
            return this.#history[this.#historyIndex];
        } else {
            return '';
        }
    }

    getTabCompletions(input: string): {
        completions: string[];
        completedCommand: string;
        formattedCompletions: string;
    } {
        // TODO: Add completion control for different commands
        // E.g. man + tab should not give file completions
        const { commands } = this.#splitCommand(input);
        const currentCommand = commands.pop() || '';
        const commandArgs = this.#commandExecutor.splitIntoArgs(currentCommand);

        const endsWithSpace = input.endsWith(' ');
        let argToComplete: string;
        let completions: string[];
        let completedCommand = input;

        if (commandArgs.length <= 1 && !(commandArgs.length === 1 && endsWithSpace)) {
            argToComplete = commandArgs.shift() || '';
            argToComplete = argToComplete.replace(/['"]+/g, '');
            completions = this.#commandExecutor.getCommandsStartingWith(argToComplete);
        } else {
            argToComplete = endsWithSpace ? '' : commandArgs.pop() || '';
            argToComplete = argToComplete.replace(/['"]+/g, '');
            completions = this.#fileSystem.getFilesStartingWith(argToComplete);
        }

        const n = input.lastIndexOf(argToComplete);
        if (n !== -1 && completions.length === 1) {
            completedCommand = input.substring(0, n) + completions[0];
        }
        return {
            completions,
            completedCommand,
            formattedCompletions: this.#commandExecutor.formatColumns(completions),
        };
    }

    getPrompt(colorized: boolean = true): string {
        const userAtHost = this.#fileSystem.user + '@dungeon';
        const displayDirectory = this.#fileSystem.currentDirectory.replace(this.#fileSystem.homeDirectory, '~');
        return colorized
            ? `${this.colorize(userAtHost, 'bold', 'green')}:${this.colorize(displayDirectory, 'bold', 'blue')}$ `
            : `${userAtHost}:${displayDirectory}`;
    }
}

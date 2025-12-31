import { EventEmitter } from '../event-emitter';
import type { FileSystem } from '../filesystem/file-system';
import { FILESYSTEM_COMMANDS } from './definitions/filesystem-commands';
import { OTHER_COMMANDS } from './definitions/other-commands';
import { TEXT_COMMANDS } from './definitions/text-commands';
import { getFlags } from './get-flags';
import { Man } from './man/man';

type ColorizeFunction = (text: string, ...styles: string[]) => string;
type FlagType = 'regular' | 'argument';

export type CommandResult = { stdin: string; stdout: string; stderr: string };
type CommandFunction = (stdin: string, args: string[], inPipe: boolean) => CommandResult;
export type CommandInfo = { multipleArgsMode: boolean; inPipe?: boolean; baseCase?: boolean };
type CommandImplementation<TArgs = unknown> = (
    stdin: string,
    args: TArgs,
    flagMap: Map<string, string[]>,
    options: CommandInfo
) => string;
export type CommandSettings = {
    flags?: Record<string, FlagType>;
    callForEachArg?: boolean;
    destinationArgLocations?: (string | number)[];
    sortArgs?: ((a: string, b: string) => number) | null;
};
export type CommandDefinition<TArgs = unknown> = [CommandImplementation<TArgs>, CommandSettings?];
export type CommandDefinitions = Record<string, CommandDefinition<unknown>>;

export class CommandExecutor extends EventEmitter {
    #commands: Record<string, CommandFunction>;
    fileSystem: FileSystem;
    colorize: ColorizeFunction;
    terminalCols: number | null;
    env: Record<string, string>;
    commandDefinitions: CommandDefinitions;
    man: Man;

    constructor(
        fileSystem: FileSystem,
        colorize: ColorizeFunction = (text) => text,
        terminalCols: number | null = null
    ) {
        super();
        this.fileSystem = fileSystem;
        this.colorize = colorize;
        this.terminalCols = terminalCols;

        this.env = {
            SHELL: '/bin/bash',
            LANGUAGE: 'en_US',
            USER: fileSystem.user,
            HOME: fileSystem.homeDirectory,
        };
        this.commandDefinitions = {
            ...FILESYSTEM_COMMANDS,
            ...TEXT_COMMANDS,
            ...OTHER_COMMANDS,
        };

        this.man = new Man(this.commandDefinitions, colorize);
        this.#commands = this.#initializeCommands(this.commandDefinitions);
    }

    #popDestinationArg(
        positionalArgs: string[],
        flagMap: Map<string, string[]>,
        destinationArgs: (string | number)[]
    ): string | string[] | null {
        let dest: string | string[] | null = null;
        for (let destArg of destinationArgs) {
            if (typeof destArg === 'string' && flagMap.has(destArg)) {
                dest = flagMap.get(destArg)!;
                dest = dest.length === 1 ? dest[0] : dest;
                break;
            } else if (typeof destArg === 'number' && positionalArgs.length > Math.abs(destArg)) {
                dest = destArg < 0 ? positionalArgs[positionalArgs.length + destArg] : positionalArgs[destArg];
                positionalArgs.splice(destArg < 0 ? positionalArgs.length + destArg : destArg, 1);
                break;
            }
        }
        return dest;
    }

    #executeMultipleArgs(
        name: string,
        func: CommandImplementation<unknown>,
        stdin: string,
        inPipe: boolean,
        positionalArgs: (string | null)[],
        flagMap: Map<string, string[]>,
        settings: CommandSettings
    ): CommandResult {
        const { destinationArgLocations = null, sortArgs = null } = settings;

        const dest = destinationArgLocations
            ? this.#popDestinationArg(positionalArgs as string[], flagMap, destinationArgLocations)
            : null;

        if (sortArgs) {
            (positionalArgs as string[]).sort(sortArgs);
        }
        if (positionalArgs.length === 0) {
            positionalArgs.push(null);
        }

        let stdout = '';
        let stderr = '';
        for (let arg of positionalArgs) {
            try {
                stdout += func(stdin, destinationArgLocations ? [arg, dest] : arg, flagMap, {
                    multipleArgsMode: positionalArgs.length > 1,
                    inPipe: inPipe,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                stderr += `\n${name}: ${message}`;
            }
        }
        const trimNewlinesOnly = (str: string) => {
            return str.replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, '');
        };
        return { stdin: '', stdout: trimNewlinesOnly(stdout), stderr: stderr.trim() };
    }

    #parseArgs(
        args: string[],
        flags: Record<string, FlagType>
    ): { positionalArgs: string[]; flagMap: Map<string, string[]> } {
        const { positionalArgs, flagMap } = getFlags(args, flags);

        const expandWildcards = (arg: string): string[] => {
            if (!/[*?[\]]/.test(arg)) return [arg];
            const matches = this.fileSystem.getWildcardMatches(arg);
            return matches.length > 0 ? matches : [arg];
        };

        const processArg = (str: string): string | string[] => {
            if (str.startsWith("'") && str.endsWith("'")) {
                return str.slice(1, -1);
            }
            // $VAR substitution
            str = str.replace(/\$(\w+)/g, (_, varName) => this.env[varName] ?? '');

            if (str.startsWith('"') && str.endsWith('"')) {
                const unquoted = str.slice(1, -1);
                return unquoted ? expandWildcards(unquoted) : [];
            } else {
                const escaped = str.replace(/\\(?!\\)/g, '');
                return escaped ? expandWildcards(escaped) : [];
            }
        };
        return {
            positionalArgs: positionalArgs.flatMap(processArg),
            flagMap: flagMap,
        };
    }

    #command(name: string, func: CommandImplementation<unknown>, settings: CommandSettings = {}): CommandFunction {
        const { flags = {}, callForEachArg = false } = settings;

        return (stdin: string, args: string[], inPipe: boolean): CommandResult => {
            this.emit('command', name, stdin, args);
            const workingColorize = this.colorize;
            this.colorize = inPipe ? (text) => text : this.colorize;

            try {
                const { positionalArgs, flagMap } = this.#parseArgs(args, flags);

                if (callForEachArg) {
                    return this.#executeMultipleArgs(name, func, stdin, inPipe, positionalArgs, flagMap, settings);
                } else {
                    return {
                        stdin: '',
                        stdout: func(stdin, positionalArgs, flagMap, {
                            multipleArgsMode: false,
                            inPipe: inPipe,
                        }),
                        stderr: '',
                    };
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return { stdin: '', stdout: '', stderr: `${name}: ${message}` };
            } finally {
                this.colorize = workingColorize;
            }
        };
    }

    #initializeCommands(definitions: CommandDefinitions): Record<string, CommandFunction> {
        const commands: Record<string, CommandFunction> = {};
        for (const [name, definition] of Object.entries(definitions)) {
            const [func, settings] = definition;
            if (settings && settings.sortArgs) {
                settings.sortArgs = settings.sortArgs.bind(this);
            }
            commands[name] = this.#command(name, func.bind(this), settings ?? {});
        }
        return commands;
    }

    #handleVariableAssignment(command: string[]): CommandResult | null {
        const match = command[0].match(/^(\w+)=(.*)$/);
        if (!match) {
            return null;
        }
        const [, varName, varValue] = match;
        const varValueArgs = [...this.splitIntoArgs(varValue), ...command.splice(1)];
        const value = varValueArgs[0] ?? '';
        this.env[varName] = value.replace(/['"]/g, '');

        return varValueArgs.length > 1
            ? this.executeCommand(varValueArgs.splice(1).join(' '))
            : { stdin: '', stdout: '', stderr: '' };
    }

    getCommandsStartingWith(string: string): string[] {
        return Object.keys(this.commandDefinitions).filter((c) => c.startsWith(string));
    }

    splitIntoArgs(string: string): string[] {
        // Regex to handle:
        // - Double-quoted strings: "..."
        // - Single-quoted strings: '...'
        // - Unquoted words
        // TODO: when escaping special characters, does not remove backslash
        const regex = /("([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'|[^\s]+)/g;

        const matches = [];
        let match;
        while ((match = regex.exec(string)) !== null) {
            matches.push(match[0]);
        }
        return matches;
    }

    executeCommand(commandString: string, stdin: string = '', inPipe: boolean = false): CommandResult {
        const command = this.splitIntoArgs(commandString);
        if (command.length === 0) {
            return { stdin: '', stdout: '', stderr: '' };
        }
        const commandName = command[0]
            .replace(/['"]/g, '')
            .replace(/\$(\w+)/g, (match, varName) =>
                command[0].startsWith("'") && command[0].endsWith("'") ? match : (this.env[varName] ?? '')
            );
        const commandFunc = this.#commands[commandName];

        if (!commandFunc) {
            return (
                this.#handleVariableAssignment(command) ?? {
                    stdin: '',
                    stdout: '',
                    stderr: `${commandName}: command not found`,
                }
            );
        }
        const args = command.splice(1);
        return commandFunc(stdin, args, inPipe);
    }

    setCommand(name: string, callback: CommandImplementation<unknown>): void {
        this.#commands[name] = this.#command(name, callback);
        this.commandDefinitions[name] = [callback, {}];
    }

    formatColumns(stringsToDisplay: string[], uncoloredStrings: string[] | null = null): string {
        if (stringsToDisplay.length === 0 || this.terminalCols === null || this.terminalCols <= 0) {
            return '';
        }
        const stringsForWidthCalc = uncoloredStrings || stringsToDisplay;

        const maxItemWidth = stringsForWidthCalc.reduce((maxWidth, str) => Math.max(maxWidth, str.length), 0);
        const cols = Math.max(Math.floor(this.terminalCols / (maxItemWidth + 1)), 1);
        const rows = Math.ceil(stringsToDisplay.length / cols);

        let output = '';
        for (let row = 0; row < rows; row++) {
            let line = '';

            for (let col = 0; col < cols; col++) {
                const index = col * rows + row;
                if (index < stringsToDisplay.length) {
                    const itemToDisplay = stringsToDisplay[index];
                    const itemForWidth = stringsForWidthCalc[index];
                    const paddedItem = itemToDisplay + ' '.repeat(maxItemWidth - itemForWidth.length + 1);
                    line += paddedItem;
                }
            }
            output += line.trimEnd() + '\n';
        }
        return output.trimEnd();
    }
}

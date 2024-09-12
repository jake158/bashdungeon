import { EventEmitter } from '../event-emitter.js';
import { getFlags } from './get-flags.js';
import { FILESYSTEM_COMMANDS } from './definitions/filesystem-commands.js';
import { TEXT_COMMANDS } from './definitions/text-commands.js';
import { OTHER_COMMANDS } from './definitions/other-commands.js';
import { Man } from './man/man.js';


export class CommandExecutor extends EventEmitter {
    #commands;

    constructor(fileSystem, colorize = (text) => text, terminalCols = null) {
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
        }

        this.man = new Man(this.commandDefinitions, colorize);
        this.#commands = this.#initializeCommands(this.commandDefinitions);
    }

    #popDestinationArg(positionalArgs, flagMap, destinationArgs) {
        let dest = null;
        for (let destArg of destinationArgs) {
            if (typeof destArg === 'string' && flagMap.has(destArg)) {
                dest = flagMap.get(destArg);
                dest = dest.length === 1 ? dest[0] : dest;
                break;
            }
            else if (typeof destArg === 'number' && positionalArgs.length > Math.abs(destArg)) {
                dest = destArg < 0 ? positionalArgs[positionalArgs.length + destArg] : positionalArgs[destArg];
                positionalArgs.splice((destArg < 0) ? (positionalArgs.length + destArg) : destArg, 1);
                break;
            }
        }
        return dest;
    }

    #executeMultipleArgs(name, func, stdin, inPipe, positionalArgs, flagMap, settings) {
        const {
            destinationArgLocations = null,
            sortArgs = null
        } = settings;

        const dest = destinationArgLocations
            ? this.#popDestinationArg(positionalArgs, flagMap, destinationArgLocations)
            : null;

        if (sortArgs) { positionalArgs.sort(sortArgs); }
        if (positionalArgs.length === 0) { positionalArgs.push(null); }

        let stdout = '';
        let stderr = '';
        for (let arg of positionalArgs) {
            try {
                stdout += func(
                    stdin,
                    destinationArgLocations ? [arg, dest] : arg,
                    flagMap,
                    {
                        multipleArgsMode: positionalArgs.length > 1,
                        terminalCols: this.terminalCols,
                        inPipe: inPipe
                    }
                );
            }
            catch (error) {
                stderr += `\n${name}: ${error.message}`;
            }
        }
        const trimNewlinesOnly = (str) => {
            return str.replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, '');
        }
        return { stdin: '', stdout: trimNewlinesOnly(stdout), stderr: stderr.trim() };
    }

    #parseArgs(args, flags) {
        const { positionalArgs, flagMap } = getFlags(args, flags);

        const expandWildcards = (arg) => {
            if (!/[*?[\]]/.test(arg)) return [arg];
            const matches = this.fileSystem.getWildcardMatches(arg);
            return matches.length > 0 ? matches : [arg];
        };

        const processArg = (str) => {
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

    #command(name, func, settings = {}) {
        const {
            flags = {},
            callForEachArg = false,
        } = settings;

        return (stdin, args, inPipe) => {
            this.emit('command', name, stdin, args);
            const workingColorize = this.colorize;
            this.colorize = inPipe ? (text) => text : this.colorize;

            try {
                const { positionalArgs, flagMap } = this.#parseArgs(args, flags);

                if (callForEachArg) {
                    return this.#executeMultipleArgs(
                        name,
                        func,
                        stdin,
                        inPipe,
                        positionalArgs,
                        flagMap,
                        settings
                    );
                } else {
                    return {
                        stdin: '',
                        stdout: func(
                            stdin,
                            positionalArgs,
                            flagMap,
                            {
                                multipleArgsMode: false,
                                terminalCols: this.terminalCols,
                                inPipe: inPipe
                            }
                        ),
                        stderr: '',
                    };
                }
            } catch (error) {
                return { stdin: '', stdout: '', stderr: `${name}: ${error.message}` };
            } finally {
                this.colorize = workingColorize;
            }
        };
    }

    #initializeCommands(definitions) {
        const commands = {};
        for (const [name, [func, settings]] of Object.entries(definitions)) {
            if (settings && settings.sortArgs) { settings.sortArgs = settings.sortArgs.bind(this); }
            commands[name] = this.#command(name, func.bind(this), settings ?? {});
        }
        return commands;
    }


    #handleVariableAssignment(command) {
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

    getCommandsStartingWith(string) {
        return Object.keys(this.commandDefinitions).filter(c => c.startsWith(string));
    }

    splitIntoArgs(string) {
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

    executeCommand(commandString, stdin = '', inPipe = false) {
        const command = this.splitIntoArgs(commandString);
        if (command.length === 0) {
            return { stdin: '', stdout: '', stderr: '' };
        }
        const commandName = command[0]
            .replace(/['"]/g, '')
            .replace(/\$(\w+)/g, (match, varName) => command[0].startsWith("'") && command[0].endsWith("'") ? match : this.env[varName] ?? '');
        const commandFunc = this.#commands[commandName];

        if (!commandFunc) {
            return this.#handleVariableAssignment(command)
                ?? { stdin: '', stdout: '', stderr: `${commandName}: command not found` };
        }
        const args = command.splice(1);
        return commandFunc(stdin, args, inPipe);
    }

    setCommand(name, callback) {
        this.#commands[name] = this.#command(name, callback);
        this.commandDefinitions[name] = [callback, {}];
    }
}

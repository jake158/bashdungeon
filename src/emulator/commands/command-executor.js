import { EventEmitter } from '../event-emitter.js';
import { getFlags } from './get-flags.js';
import { SYSTEM_COMMANDS } from './system-commands.js';
import { TEXT_COMMANDS } from './text-commands.js';


export class CommandExecutor extends EventEmitter {
    #commands;
    #env;

    constructor(fileSystem, colorize = (text) => text, terminalCols = null) {
        super();
        this.fileSystem = fileSystem;
        this.colorize = colorize;
        this.terminalCols = terminalCols;
        this.#env = {
            SHELL: '/bin/bash',
            // TODO: Do not hardcode:
            USER: 'wizard',
            LANGUAGE: 'en_US',
        };
        this.#commands = {
            // TODO: Implement
            env: this.#command('env', (stdin, args) => {
                return Object.entries(this.#env).map(([key, value]) => `${key}=${value}`).join('\n');
            })
        };
        this.#initializeCommands();
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

    #executeMultipleArgs(name, func, stdin, inPipe, positionalArgs, flagMap, destinationArgs, sortArgs) {
        const dest = destinationArgs ? this.#popDestinationArg(positionalArgs, flagMap, destinationArgs) : null;
        if (sortArgs) { positionalArgs.sort(sortArgs); }
        if (positionalArgs.length === 0) { positionalArgs.push(null); }

        let stdout = '';
        let stderr = '';
        for (let arg of positionalArgs) {
            try {
                stdout += func(
                    stdin,
                    destinationArgs ? [arg, dest] : arg,
                    flagMap,
                    {
                        multipleArgsMode: positionalArgs.length > 1,
                        terminalCols: this.terminalCols,
                        inPipe: inPipe
                    }
                );
            }
            catch (error) {
                stderr += `${name}: ${error.message}\n`;
            }
        }
        return { stdin: '', stdout: stdout.trim(), stderr: stderr.trim() };
    }

    #expandWildcards(arg) {
        if (!/[*?[\]]/.test(arg)) return arg;
        const matches = this.fileSystem.matchFiles(arg);
        return matches.length > 0 ? matches : arg;
    }

    #parseArgs(args, flags) {
        const { positionalArgs, flagMap } = getFlags(args, flags);

        // TODO: grep test $(ls) fails because \n is not considered whitespace by getFlags
        const processArg = (str) => {
            if (str.startsWith("'") && str.endsWith("'")) {
                return str.slice(1, -1);
            }
            // $VAR
            str = str.replace(/\$(\w+)/g, (match, varName) =>
                this.#env[varName] ?? '');

            // $(command) and `command`
            str = str.replace(/\$\(([^)]+)\)|`([^`]+)`/g, (match, cmd1, cmd2) =>
                this.executeCommand(cmd1 || cmd2, '', true).stdout.trim());

            // Quotes and wildcards
            if (str.startsWith('"') && str.endsWith('"')) {
                const sliced = str.slice(1, -1);
                return sliced ? this.#expandWildcards(sliced) : '';
            } else {
                const escaped = str.replace(/\\(?!\\)/g, '');
                return escaped ? this.#expandWildcards(escaped) : '';
            }
        };
        return {
            positionalArgs: positionalArgs.flatMap(processArg),
            flagMap: flagMap
        };
    }

    #command(name, func, settings = {}) {
        const {
            flags = {},
            callForEachArg = false,
            destinationArgLocations = null,
            sortArgs = null
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
                        destinationArgLocations,
                        sortArgs
                    );
                }

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
                    stderr: ''
                };
            } catch (error) {
                return { stdin: '', stdout: '', stderr: `${name}: ${error.message}` };
            } finally {
                this.colorize = workingColorize;
            }
        };
    }

    #initializeCommands() {
        for (const [name, [func, settings]] of Object.entries({ ...SYSTEM_COMMANDS, ...TEXT_COMMANDS })) {
            if (settings && settings.sortArgs) { settings.sortArgs = settings.sortArgs.bind(this); }
            this.#commands[name] = this.#command(name, func.bind(this), settings ?? {});
        }
    }

    setCommand(name, callback) {
        this.#commands[name] = this.#command(name, callback);
    }

    executeCommand(command, stdin = '', inPipe = false) {
        // TODO: Worst regex I have ever seen
        const [commandName, ...args] = command.match(/(?:(?<!\\)(?:["'])(?:(?:\\.)|[^\1])*?\1|`[^`]*`|\$\([^\)]*\)|[^\s"]+|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g);
        const commandFunc = this.#commands[commandName];
        if (!commandFunc) { return { stdin: '', stdout: '', stderr: `${commandName}: command not found` }; }
        return commandFunc(stdin, args, inPipe);
    }

    setEnv(key, value = '') {
        this.#env[key] = value;
    }

    getEnv(key, value = '') {
        this.#env[key] = value;
    }
}

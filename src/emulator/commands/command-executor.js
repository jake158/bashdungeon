import { EventEmitter } from '../event-emitter.js';
import { getFlags } from './get-flags.js';
import { SYSTEM_COMMANDS } from './system-commands.js';
import { TEXT_COMMANDS } from './text-commands.js';


export class CommandExecutor extends EventEmitter {
    #commandDefinitions;
    #commands;
    #env;

    constructor(fileSystem, colorize = (text) => text, terminalCols = null) {
        super();
        this.fileSystem = fileSystem;
        this.colorize = colorize;
        this.terminalCols = terminalCols;

        this.#env = {
            SHELL: '/bin/bash',
            LANGUAGE: 'en_US',
            USER: fileSystem.user,
            HOME: fileSystem.homeDirectory,
        };

        this.#commandDefinitions = {
            ...SYSTEM_COMMANDS,
            ...TEXT_COMMANDS,

            'env': [
                function () {
                    return Object.entries(this.#env).map(([key, value]) => `${key}=${value}`).join('\n');
                }
            ]
        }
        this.#commands = this.#initializeCommands(this.#commandDefinitions);
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

    #executeMultipleArgs(name, func, stdin, inPipe, positionalArgs, flagMap, nestedCommandErrors, settings) {
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
        let stderr = nestedCommandErrors || '';
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
        return { stdin: '', stdout: stdout.trim(), stderr: stderr.trim() };
    }

    #parseArgs(args, flags) {
        const { positionalArgs, flagMap } = getFlags(args, flags);

        const expandWildcards = (arg) => {
            if (!/[*?[\]]/.test(arg)) return [arg];
            const matches = this.fileSystem.matchFiles(arg);
            return matches.length > 0 ? matches : [arg];
        };

        const queue = [...positionalArgs];
        const processedArgs = [];
        let errors = '';

        while (queue.length > 0) {
            let str = queue.shift();

            if (str.startsWith("'") && str.endsWith("'")) {
                processedArgs.push(str.slice(1, -1));
                continue;
            }

            // Handle variable substitution: $VAR
            str = str.replace(/\$(\w+)/g, (match, varName) =>
                this.#env[varName] ?? ''
            );

            // Handle command substitution: $(command) and `command`
            const commandSubsRegex = /\$\(([^)]+)\)|`([^`]+)`/g;
            let commandSubsMatch;
            while ((commandSubsMatch = commandSubsRegex.exec(str)) !== null) {
                const [fullMatch, cmd1, cmd2] = commandSubsMatch;
                const result = this.executeCommand(cmd1 || cmd2, '', true);
                errors += result.stderr;

                const splitArgs = this.splitIntoArgs(result.stdout);
                queue.unshift(...splitArgs);
                str = str.replace(fullMatch, '');
            }

            // Handle quotes and wildcards
            if (str.startsWith('"') && str.endsWith('"')) {
                const unquoted = str.slice(1, -1);
                if (unquoted) {
                    processedArgs.push(...expandWildcards(unquoted));
                }
            } else {
                const escaped = str.replace(/\\(?!\\)/g, '');
                if (escaped) {
                    processedArgs.push(...expandWildcards(escaped));
                }
            }
        }
        return {
            positionalArgs: processedArgs,
            flagMap: flagMap,
            nestedCommandErrors: errors,
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
                const { positionalArgs, flagMap, nestedCommandErrors } = this.#parseArgs(args, flags);

                if (callForEachArg) {
                    return this.#executeMultipleArgs(
                        name,
                        func,
                        stdin,
                        inPipe,
                        positionalArgs,
                        flagMap,
                        nestedCommandErrors,
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
                        stderr: nestedCommandErrors,
                    };
                }
            } catch (error) {
                return { stdin: '', stdout: '', stderr: `${name}: ${error.message}\n${nestedCommandErrors}`.trim() };
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

    splitIntoArgs(string) {
        // Regex to handle:
        // - Command substitution: $(...)
        // - Backtick substitution: `...`
        // - Double-quoted strings: "..."
        // - Single-quoted strings: '...'
        // - Unquoted words
        const regex = /("([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'|\$\(([^()]*|\((?:[^()]|\([^()]*\))*\))*\)|`[^`]*`|[^\s]+)/g;

        const matches = [];
        let match;
        while ((match = regex.exec(string)) !== null) {
            matches.push(match[0]);
        }
        return matches;
    }

    setCommand(name, callback) {
        this.#commands[name] = this.#command(name, callback);
    }

    executeCommand(command, stdin = '', inPipe = false) {
        const [commandName, ...incorrectlySplitArgs] = command.trim().split(/\s+(.*)/s);
        const commandFunc = this.#commands[commandName];

        if (!commandFunc) {
            return { stdin: '', stdout: '', stderr: `${commandName}: command not found` };
        }
        const args = this.splitIntoArgs(incorrectlySplitArgs.join(' '));
        return commandFunc(stdin, args, inPipe);
    }

    setEnv(key, value = '') {
        this.#env[key] = value;
    }

    getEnv(key, value = '') {
        this.#env[key] = value;
    }
}

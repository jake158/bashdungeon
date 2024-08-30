import { SystemCommands } from './definitions/system-commands.js';
import { TextCommands } from './definitions/text-commands.js';
import { parseArgs } from './parse-args.js';


export class CommandExecutor {
    #commands;

    constructor(fileSystem, colorize = (text) => text, terminalCols = null) {
        this.fileSystem = fileSystem;
        this.colorize = colorize;
        this.terminalCols = terminalCols;
        this.#commands = {};
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

    #executeMultipleArgs(name, func, stdin, positionalArgs, flagMap, destinationArgs, sortArgs) {
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
                    }
                );
            }
            catch (error) {
                stderr += `${name}: ${error.message}\n`;
            }
        }
        return { stdin: '', stdout: stdout.trim(), stderr: stderr.trim() };
    }

    #command(name, func, settings = {}) {
        const {
            flags = {},
            callForEachArg = false,
            destinationArgLocations = null,
            sortArgs = null
        } = settings;

        return (stdin, args) => {
            try {
                const { positionalArgs, flagMap } = parseArgs(args, flags);

                if (callForEachArg) {
                    return this.#executeMultipleArgs(
                        name,
                        func,
                        stdin,
                        positionalArgs,
                        flagMap,
                        destinationArgLocations,
                        sortArgs
                    );
                }

                return { stdin: '', stdout: func(stdin, positionalArgs, flagMap), stderr: '' };
            } catch (error) {
                return { stdin: '', stdout: '', stderr: `${name}: ${error.message}` };
            }
        };
    }

    #initializeCommands() {
        const sysCommands = new SystemCommands(this.fileSystem, this.colorize).get();
        const textCommands = new TextCommands(this.fileSystem, this.colorize).get();

        for (const [name, [func, settings]] of Object.entries({ ...sysCommands, ...textCommands })) {
            this.#commands[name] = this.#command(name, func, settings ?? {});
        }
    }

    set(name, callback) {
        this.#commands[name] = this.#command(name, callback);
    }

    execute(commandName, stdin, args) {
        const command = this.#commands[commandName];
        if (!command) { return { stdin: '', stdout: '', stderr: `${commandName}: command not found` }; }
        return command(stdin, args);
    }
}

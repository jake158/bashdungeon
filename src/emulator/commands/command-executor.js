import { SystemCommands } from './definitions/system.js';
import { TextCommands } from './definitions/text.js';
import { parseArgs } from './parse-args.js';


export class CommandExecutor {
    #commands;

    constructor(fileSystem, colorize = (text) => text) {
        this.fileSystem = fileSystem;
        this.colorize = colorize;
        this.#commands = this.#initializeCommands();
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

    #executeMultipleArgs(func, stdin, positionalArgs, flagMap, name, destinationArgs, sortArgs) {
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
                    positionalArgs.length > 1
                );
            }
            catch (error) {
                stderr += `${name}: ${error.message}\n`;
            }
        }
        return { stdin: '', stdout: stdout.trim(), stderr: stderr.trim() };
    }

    #command(func, settings = {}) {
        const {
            name = 'unnamed command',
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
                        func,
                        stdin,
                        positionalArgs,
                        flagMap,
                        name,
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
        const commands = {};
        const sysCommands = new SystemCommands(this.fileSystem, this.colorize).get();
        const textCommands = new TextCommands(this.fileSystem, this.colorize).get();

        for (const [name, [func, settings]] of Object.entries({ ...sysCommands, ...textCommands })) {
            commands[name] = this.#command(func, settings);
        }
        return commands;
    }

    get(name) {
        return this.#commands[name];
    }

    set(name, callback) {
        this.#commands[name] = this.#command(callback, { name });
    }
}

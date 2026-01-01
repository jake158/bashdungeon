import type { FileSystem } from '../filesystem/file-system';
import type { Man } from './man/man';

export type ColorizeFunction = (text: string, ...styles: string[]) => string;
export type FlagType = 'regular' | 'argument';

export interface CommandContext {
    fileSystem: FileSystem;
    colorize: ColorizeFunction;
    env: Record<string, string>;
    terminalCols: number | null;
    formatColumns: (stringsToDisplay: string[], uncoloredStrings?: string[] | null) => string;
    man: Man;
    commandNames: string[];
}

export interface CommandInfo {
    multipleArgsMode: boolean;
    inPipe?: boolean;
    baseCase?: boolean;
}

export interface CommandSettings {
    flags?: Record<string, FlagType>;
    callForEachArg?: boolean;
    destinationArgLocations?: (string | number)[];
    sortArgs?: ((a: string, b: string) => number) | null;
}

export abstract class Command<TArgs = unknown> {
    protected context: CommandContext;

    // Static metadata - each command class defines these
    static readonly commandName: string;
    static readonly settings: CommandSettings = {};

    constructor(context: CommandContext) {
        this.context = context;
    }

    // Convenience getters for context
    protected get fileSystem(): FileSystem {
        return this.context.fileSystem;
    }

    protected get colorize(): ColorizeFunction {
        return this.context.colorize;
    }

    protected get env(): Record<string, string> {
        return this.context.env;
    }

    protected get formatColumns(): CommandContext['formatColumns'] {
        return this.context.formatColumns;
    }

    protected get man(): Man {
        return this.context.man;
    }

    protected get commandNames(): string[] {
        return this.context.commandNames;
    }

    // Abstract method each command must implement
    abstract execute(stdin: string, args: TArgs, flagMap: Map<string, string[]>, options: CommandInfo): string;

    // Optional lifecycle hooks
    beforeExecute?(stdin: string, args: TArgs, flagMap: Map<string, string[]>): void;
    afterExecute?(result: string): string;

    // Helper for sortArgs that needs context binding
    static getSortFunction?(context: CommandContext): (a: string, b: string) => number;
}

import type { CommandDefinitions, CommandExecutor, CommandInfo } from '../command-executor';

export const OTHER_COMMANDS: CommandDefinitions = {
    env: [
        function (
            this: CommandExecutor,
            _stdin: string,
            _args: unknown,
            _flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            return Object.entries(this.env)
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');
        },
    ],

    man: [
        function (
            this: CommandExecutor,
            _stdin: string,
            arg: unknown,
            _flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            const argValue = arg as string | null;
            if (!argValue) return "What manual page do you want?\nFor example, try 'man cd'";
            return this.man.getManEntry(argValue);
        },
        {
            callForEachArg: true,
        },
    ],

    help: [
        function (
            this: CommandExecutor,
            _stdin: string,
            _args: unknown,
            _flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            return Object.keys(this.commandDefinitions)
                .map((c) => {
                    try {
                        return this.man.getHelpEntry(c);
                    } catch {
                        return null;
                    }
                })
                .filter((h) => h !== null)
                .join('\n')
                .trimEnd();
        },
    ],

    base64: [
        function (
            this: CommandExecutor,
            stdin: string,
            args: unknown,
            flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            const argsArray = args as string[];
            if (argsArray.length > 1) {
                throw new Error(`extra operand ${argsArray[1]}`);
            }
            const decode = flagMap.has('-d') || flagMap.has('--decode');

            const base64Encode = (input: string): string => {
                return btoa(input);
            };
            const base64Decode = (input: string): string => {
                try {
                    return atob(input);
                } catch {
                    throw new Error('invalid input');
                }
            };
            const inputContent =
                argsArray[0] && argsArray[0] !== '-' ? this.fileSystem.getFileContent(argsArray[0]) : stdin;

            if (!inputContent) {
                throw new Error('no input provided');
            }
            const output = decode ? base64Decode(inputContent.trim()) : base64Encode(inputContent);
            return output;
        },

        {
            flags: {
                '-d': 'regular',
                '--decode': 'regular',
            },
        },
    ],
};

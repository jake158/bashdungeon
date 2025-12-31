import type { CommandExecutor, CommandDefinitions, CommandInfo } from '../command-executor';

export const TEXT_COMMANDS: CommandDefinitions = {
    echo: [
        function (
            this: CommandExecutor,
            _stdin: string,
            arg: unknown,
            flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            const argValue = arg as string | null;
            const processEscapeSequences = (input: string): string => {
                return input
                    .replace(/\\n/g, '\n')
                    .replace(/\\t/g, '\t')
                    .replace(/\\r/g, '\r')
                    .replace(/\\f/g, '\f')
                    .replace(/\\b/g, '\b')
                    .replace(/\\v/g, '\v')
                    .replace(/\\\\/g, '\\');
            };
            let processEscapes = false;

            for (const [flag] of flagMap.entries()) {
                switch (flag) {
                    case '-e':
                        processEscapes = true;
                        break;
                    case '-E':
                        processEscapes = false;
                }
            }

            const str = argValue ? argValue : ' ';
            return processEscapes ? processEscapeSequences(str) + ' ' : str + ' ';
        },

        {
            flags: {
                '-e': 'regular',
                '-E': 'regular',
            },
            callForEachArg: true,
        },
    ],

    cat: [
        function (
            this: CommandExecutor,
            stdin: string,
            arg: unknown,
            _flagMap: Map<string, string[]>,
            info: CommandInfo
        ): string {
            const argValue = arg as string | null;
            if (!argValue) {
                return stdin;
            }
            let output = this.fileSystem.getFileContent(argValue);
            output += info.multipleArgsMode && output ? '\n' : '';
            return output;
        },

        {
            callForEachArg: true,
        },
    ],

    grep: [
        function grep(
            this: CommandExecutor,
            stdin: string,
            args: unknown,
            flagMap: Map<string, string[]>,
            info: CommandInfo
        ): string {
            const [file, pattern] = args as [string | null, string | null];
            let text = stdin;
            const options = {
                ignoreCase: flagMap.has('-i'),
                lineNumbers: flagMap.has('-n'),
                recursive: flagMap.has('-r'),
            };

            const recurse = (file: string): string => {
                try {
                    if (this.fileSystem.isDirectory(file)) {
                        const contents = this.fileSystem.ls(file);
                        const prefix = file.endsWith('/') ? file : file + '/';
                        return contents
                            .map((i) =>
                                grep.call(this, stdin, [prefix + i.name, pattern] as unknown, flagMap, {
                                    multipleArgsMode: true,
                                    inPipe: info.inPipe,
                                })
                            )
                            .join('');
                    } else {
                        return grep.call(this, stdin, [file, pattern] as unknown, flagMap, {
                            multipleArgsMode: true,
                            baseCase: true,
                            inPipe: info.inPipe,
                        });
                    }
                } catch (error) {
                    // TODO: Bug: this does not get printed on a newline sometimes
                    const message = error instanceof Error ? error.message : String(error);
                    return 'grep: ' + message;
                }
            };
            if (!file && options.recursive) {
                return recurse('.');
            }
            if (file && file !== '-' && options.recursive && !info.baseCase) {
                return recurse(file);
            }
            if (file && file !== '-') {
                text = this.fileSystem.getFileContent(file);
            }

            const regex = new RegExp(pattern!, 'g' + (options.ignoreCase ? 'i' : ''));
            const lines = text.split('\n');
            const results: string[] = [];

            lines.forEach((line, index) => {
                if (regex.test(line)) {
                    let outputLine = line.replace(regex, (match) => this.colorize(match, 'bold', 'red'));
                    if (options.lineNumbers) {
                        outputLine = `${this.colorize(String(index + 1), 'green')}${this.colorize(':', 'cyan')}${outputLine}`;
                    }
                    if (info.multipleArgsMode) {
                        outputLine = `${this.colorize(file!, 'magenta')}${this.colorize(':', 'cyan')}${outputLine}`;
                    }
                    results.push(outputLine);
                }
            });
            return results.join('\n') + (info.multipleArgsMode ? '\n' : '');
        },

        {
            flags: {
                '-i': 'regular', // Case insensitive search
                '-n': 'regular', // Show line numbers
                '-r': 'regular', // Recursive
            },
            callForEachArg: true,
            destinationArgLocations: [0],
        },
    ],
};

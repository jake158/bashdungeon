import { Command, type CommandInfo } from '../../command';

export class GrepCommand extends Command<[string | null, string | null]> {
    static override readonly commandName = 'grep';
    static override readonly settings = {
        flags: {
            '-i': 'regular' as const,
            '-n': 'regular' as const,
            '-r': 'regular' as const,
        },
        callForEachArg: true,
        destinationArgLocations: [0],
    };

    override execute(
        stdin: string,
        args: [string | null, string | null],
        flagMap: Map<string, string[]>,
        info: CommandInfo
    ): string {
        const [file, pattern] = args;
        let text = stdin;
        const options = {
            ignoreCase: flagMap.has('-i'),
            lineNumbers: flagMap.has('-n'),
            recursive: flagMap.has('-r'),
        };

        if (!file && options.recursive) {
            return this.recurse('.', pattern, flagMap, info);
        }
        if (file && file !== '-' && options.recursive && !info.baseCase) {
            return this.recurse(file, pattern, flagMap, info);
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
    }

    private recurse(file: string, pattern: string | null, flagMap: Map<string, string[]>, info: CommandInfo): string {
        try {
            if (this.fileSystem.isDirectory(file)) {
                const contents = this.fileSystem.ls(file);
                const prefix = file.endsWith('/') ? file : file + '/';
                return contents
                    .map((i: { name: string }) =>
                        this.execute('', [prefix + i.name, pattern], flagMap, {
                            multipleArgsMode: true,
                            inPipe: info.inPipe,
                        })
                    )
                    .join('');
            } else {
                return this.execute('', [file, pattern], flagMap, {
                    multipleArgsMode: true,
                    baseCase: true,
                    inPipe: info.inPipe,
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return 'grep: ' + message;
        }
    }
}

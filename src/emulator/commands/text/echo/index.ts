import { Command, type CommandInfo } from '../../command';

export class EchoCommand extends Command<string | null> {
    static override readonly commandName = 'echo';
    static override readonly settings = {
        flags: {
            '-e': 'regular' as const,
            '-E': 'regular' as const,
        },
        callForEachArg: true,
    };

    override execute(
        _stdin: string,
        arg: string | null,
        flagMap: Map<string, string[]>,
        _options: CommandInfo
    ): string {
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

        const str = arg ?? ' ';
        return processEscapes ? processEscapeSequences(str) + ' ' : str + ' ';
    }
}

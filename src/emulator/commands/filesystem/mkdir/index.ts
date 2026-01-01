import { Command, type CommandInfo } from '../../command';

export class MkdirCommand extends Command<string | null> {
    static override readonly commandName = 'mkdir';
    static override readonly settings = {
        flags: {
            '-p': 'regular' as const,
            '--parents': 'regular' as const,
            '-v': 'regular' as const,
            '--verbose': 'regular' as const,
        },
        callForEachArg: true,
    };

    override execute(
        _stdin: string,
        arg: string | null,
        flagMap: Map<string, string[]>,
        _options: CommandInfo
    ): string {
        if (!arg) {
            throw new Error('missing operand');
        }
        return this.fileSystem.mkdir(arg, {
            parents: flagMap.has('-p') || flagMap.has('--parents'),
            verbose: flagMap.has('-v') || flagMap.has('--verbose'),
        });
    }
}

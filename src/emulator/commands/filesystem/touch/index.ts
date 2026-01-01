import { Command, type CommandInfo } from '../../command';

export class TouchCommand extends Command<string | null> {
    static override readonly commandName = 'touch';
    static override readonly settings = {
        flags: {
            '-c': 'regular' as const,
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
            throw new Error('missing file operand');
        }
        this.fileSystem.touch(arg, { noCreate: flagMap.has('-c') });
        return '';
    }
}

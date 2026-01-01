import { Command, type CommandInfo } from '../../command';

export class CpCommand extends Command<[string | null, string | string[] | null]> {
    static override readonly commandName = 'cp';
    static override readonly settings = {
        flags: {
            '-t': 'argument' as const,
            '--target-directory': 'argument' as const,
            '-r': 'regular' as const,
        },
        callForEachArg: true,
        destinationArgLocations: ['-t', '--target-directory', -1],
    };

    override execute(
        _stdin: string,
        args: [string | null, string | string[] | null],
        flagMap: Map<string, string[]>,
        _options: CommandInfo
    ): string {
        const [source, dest] = args;
        if (!dest || !source) {
            const error = source ? `missing destination file operand after '${source}'` : 'missing file operand';
            throw new Error(error);
        }
        if (Array.isArray(dest)) {
            throw new Error('multiple target directories specified');
        }
        if (!flagMap.has('-r') && this.fileSystem.isDirectory(source)) {
            throw new Error(`-r not specified; omitting directory '${source}'`);
        }
        this.fileSystem.cp(source, dest);
        return '';
    }
}

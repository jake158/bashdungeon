import { Command, type CommandInfo } from '../../command';

export class RmCommand extends Command<string | null> {
    static override readonly commandName = 'rm';
    static override readonly settings = {
        flags: {
            '-r': 'regular' as const,
            '-f': 'regular' as const,
            '-v': 'regular' as const,
        },
        callForEachArg: true,
    };

    override execute(
        _stdin: string,
        arg: string | null,
        flagMap: Map<string, string[]>,
        _options: CommandInfo
    ): string {
        if (this.fileSystem.isDirectory(arg!) && !flagMap.has('-r')) {
            throw new Error(`cannot remove '${arg}': Is a directory`);
        }
        if (arg === '.' || arg === '..') {
            throw new Error(`refusing to remove '.' or '..' directory: skipping '${arg}'`);
        }
        const output = this.fileSystem.rm(arg!, { force: flagMap.has('-f') });
        return flagMap.has('-v') ? output + '\n' : '';
    }
}

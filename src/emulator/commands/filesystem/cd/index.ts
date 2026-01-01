import { Command, type CommandInfo } from '../../command';

export class CdCommand extends Command<string[]> {
    static override readonly commandName = 'cd';
    static override readonly settings = {};

    override execute(_stdin: string, args: string[], _flagMap: Map<string, string[]>, _options: CommandInfo): string {
        if (args.length > 1) {
            throw new Error('too many arguments');
        }
        const path = args.length === 1 ? args[0] : '~';
        this.fileSystem.cd(path);
        return '';
    }
}

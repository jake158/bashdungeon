import { Command, type CommandInfo } from '../../command';

export class UmaskCommand extends Command<string[]> {
    static override readonly commandName = 'umask';
    static override readonly settings = {};

    override execute(_stdin: string, args: string[], _flagMap: Map<string, string[]>, _options: CommandInfo): string {
        if (args.length > 1) {
            throw new Error('too many arguments');
        } else if (args.length === 0) {
            return this.fileSystem.umask;
        } else {
            this.fileSystem.umask = args[0];
        }
        return '';
    }
}

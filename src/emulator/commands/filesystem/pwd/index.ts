import { Command, type CommandInfo } from '../../command';

export class PwdCommand extends Command {
    static override readonly commandName = 'pwd';
    static override readonly settings = {};

    override execute(_stdin: string, _args: unknown, _flagMap: Map<string, string[]>, _options: CommandInfo): string {
        return this.fileSystem.currentDirectory;
    }
}

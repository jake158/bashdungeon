import { Command, type CommandInfo } from '../../command';

export class HelpCommand extends Command {
    static override readonly commandName = 'help';
    static override readonly settings = {};

    override execute(_stdin: string, _args: unknown, _flagMap: Map<string, string[]>, _options: CommandInfo): string {
        return this.commandNames
            .map((c) => {
                try {
                    return this.man.getHelpEntry(c);
                } catch {
                    return null;
                }
            })
            .filter((h) => h !== null)
            .join('\n')
            .trimEnd();
    }
}

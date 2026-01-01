import { Command, type CommandInfo } from '../../command';

export class ManCommand extends Command<string | null> {
    static override readonly commandName = 'man';
    static override readonly settings = {
        callForEachArg: true,
    };

    override execute(
        _stdin: string,
        arg: string | null,
        _flagMap: Map<string, string[]>,
        _options: CommandInfo
    ): string {
        if (!arg) return "What manual page do you want?\nFor example, try 'man cd'";
        return this.man.getManEntry(arg);
    }
}

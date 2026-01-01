import { Command, type CommandInfo } from '../../command';

export class ChmodCommand extends Command<string[]> {
    static override readonly commandName = 'chmod';
    static override readonly settings = {
        flags: {
            '-r': 'regular' as const,
            '-w': 'regular' as const,
            '-x': 'regular' as const,
        },
    };

    override execute(_stdin: string, args: string[], flagMap: Map<string, string[]>, _options: CommandInfo): string {
        let flagPerms = '';
        flagPerms += flagMap.has('-r') ? '-r' : '';
        flagPerms += flagMap.has('-w') ? '-w' : '';
        flagPerms += flagMap.has('-x') ? '-x' : '';

        if ((flagPerms.length !== 0 && args.length < 1) || (flagPerms.length === 0 && args.length < 2)) {
            const error = args.length === 1 ? `missing operand after '${args[0]}'` : 'missing operand';
            throw new Error(error);
        }

        for (let i = flagPerms ? 0 : 1; i < args.length; i++) {
            this.fileSystem.chmod(args[i], flagPerms ? flagPerms : args[0]);
        }
        return '';
    }
}

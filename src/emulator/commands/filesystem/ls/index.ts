import { Command, type CommandContext, type CommandInfo } from '../../command';

interface LsItem {
    type: string;
    permissions: string;
    links: number;
    username: string;
    groupname: string;
    size: number;
    modified: Date;
    name: string;
}

export class LsCommand extends Command<string | null> {
    static override readonly commandName = 'ls';
    static override readonly settings = {
        flags: {
            '-l': 'regular' as const,
            '-d': 'regular' as const,
            '-a': 'regular' as const,
        },
        callForEachArg: true,
        sortArgs: null,
    };

    static override getSortFunction(context: CommandContext): (a: string, b: string) => number {
        return (a: string, b: string): number => {
            if (context.fileSystem.isDirectory(a) && !context.fileSystem.isDirectory(b)) {
                return 1;
            }
            if (!context.fileSystem.isDirectory(a) && context.fileSystem.isDirectory(b)) {
                return -1;
            }
            return 0;
        };
    }

    override execute(_stdin: string, arg: string | null, flagMap: Map<string, string[]>, info: CommandInfo): string {
        let argValue = arg ?? '.';
        const long = flagMap.has('-l');
        const options = {
            dir: flagMap.has('-d'),
            all: flagMap.has('-a'),
        };

        const result = this.fileSystem.ls(argValue, options);

        result.forEach((item) => {
            item.name = /\s/g.test(item.name) ? `'${item.name}'` : item.name;
        });

        const output = long ? this.formatLsLong(result, new Date()) : this.formatLsShort(result, info.inPipe ?? false);

        if (!info.multipleArgsMode) {
            return output;
        }
        return !options.dir && this.fileSystem.isDirectory(argValue)
            ? `\n${argValue.replace('~', this.fileSystem.homeDirectory)}:\n${output}\n`
            : `${output}\n`;
    }

    private formatLsShort(items: LsItem[], inPipe: boolean): string {
        if (items.length === 0) {
            return '';
        } else if (inPipe) {
            return items
                .map((i) => (i.type === 'directory' ? this.colorize(i.name, 'bold', 'blue') : i.name))
                .join('\n');
        }
        const stringsToDisplay = items.map((i) =>
            i.type === 'directory' ? this.colorize(i.name, 'bold', 'blue') : i.name
        );

        const uncoloredStrings = items.map((i) => i.name);
        return this.formatColumns(stringsToDisplay, uncoloredStrings);
    }

    private formatLsLong(items: LsItem[], now: Date): string {
        const formatDate = (date: Date): string => {
            const isCurrentYear = date.getFullYear() === now.getFullYear();
            const month = date.toLocaleString('en-US', { month: 'short' });
            const day = String(date.getDate()).padStart(2, ' ');
            const timeOrYear = isCurrentYear
                ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                : ' ' + date.getFullYear();
            return `${month} ${day} ${timeOrYear}`;
        };

        const maxLengths = {
            permissions: 0,
            links: 0,
            username: 0,
            groupname: 0,
            size: 0,
            date: 0,
        };

        items.forEach((item) => {
            maxLengths.permissions = Math.max(maxLengths.permissions, item.permissions.length);
            maxLengths.links = Math.max(maxLengths.links, String(item.links).length);
            maxLengths.username = Math.max(maxLengths.username, item.username.length);
            maxLengths.groupname = Math.max(maxLengths.groupname, item.groupname.length);
            maxLengths.size = Math.max(maxLengths.size, String(item.size).length, 2);
        });

        return items
            .map((item) => {
                const formattedDate = formatDate(item.modified);
                return (
                    `${item.permissions.padEnd(maxLengths.permissions)} ` +
                    `${String(item.links).padStart(maxLengths.links)} ` +
                    `${item.username.padEnd(maxLengths.username)} ` +
                    `${item.groupname.padEnd(maxLengths.groupname)} ` +
                    `${String(item.size).padStart(maxLengths.size)} ` +
                    `${formattedDate} ${item.type === 'directory' ? this.colorize(item.name, 'bold', 'blue') : item.name}`
                );
            })
            .join('\n');
    }
}

import type { CommandDefinitions, CommandExecutor, CommandInfo } from '../command-executor';

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

function formatLsShort(this: CommandExecutor, items: LsItem[], inPipe: boolean): string {
    if (items.length === 0) {
        return '';
    } else if (inPipe) {
        return items.map((i) => (i.type === 'directory' ? this.colorize(i.name, 'bold', 'blue') : i.name)).join('\n');
    }
    const stringsToDisplay = items.map((i) =>
        i.type === 'directory' ? this.colorize(i.name, 'bold', 'blue') : i.name
    );

    const uncoloredStrings = items.map((i) => i.name);
    return this.formatColumns(stringsToDisplay, uncoloredStrings);
}

function formatLsLong(this: CommandExecutor, items: LsItem[], now: Date): string {
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

export const FILESYSTEM_COMMANDS: CommandDefinitions = {
    pwd: [
        function (
            this: CommandExecutor,
            _stdin: string,
            _args: unknown,
            _flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            return this.fileSystem.currentDirectory;
        },
    ],

    cd: [
        function (
            this: CommandExecutor,
            _stdin: string,
            args: unknown,
            _flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            const argsArray = args as string[];
            if (argsArray.length > 1) {
                throw new Error('too many arguments');
            }
            const path = argsArray.length === 1 ? argsArray[0] : '~';
            this.fileSystem.cd(path);
            return '';
        },
    ],

    umask: [
        function (
            this: CommandExecutor,
            _stdin: string,
            args: unknown,
            _flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            const argsArray = args as string[];
            if (argsArray.length > 1) {
                throw new Error('too many arguments');
            } else if (argsArray.length === 0) {
                return this.fileSystem.umask;
            } else {
                this.fileSystem.umask = argsArray[0];
            }
            return '';
        },
    ],

    chmod: [
        function (
            this: CommandExecutor,
            _stdin: string,
            args: unknown,
            flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            const argsArray = args as string[];
            let flagPerms = '';
            flagPerms += flagMap.has('-r') ? '-r' : '';
            flagPerms += flagMap.has('-w') ? '-w' : '';
            flagPerms += flagMap.has('-x') ? '-x' : '';

            if ((flagPerms.length !== 0 && argsArray.length < 1) || (flagPerms.length === 0 && argsArray.length < 2)) {
                const error = argsArray.length === 1 ? `missing operand after '${argsArray[0]}'` : 'missing operand';
                throw new Error(error);
            }

            for (let i = flagPerms ? 0 : 1; i < argsArray.length; i++) {
                this.fileSystem.chmod(argsArray[i], flagPerms ? flagPerms : argsArray[0]);
            }
            return '';
        },

        // Add: -R
        // Problem: chmod -x+w, chmod -x,w etc.
        {
            flags: {
                '-r': 'regular',
                '-w': 'regular',
                '-x': 'regular',
            },
        },
    ],

    mkdir: [
        function (
            this: CommandExecutor,
            _stdin: string,
            arg: unknown,
            flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            const argValue = arg as string | null;
            if (!argValue) {
                throw new Error('missing operand');
            }
            return this.fileSystem.mkdir(argValue, {
                parents: flagMap.has('-p') || flagMap.has('--parents'),
                verbose: flagMap.has('-v') || flagMap.has('--verbose'),
            });
        },

        {
            flags: {
                '-p': 'regular',
                '--parents': 'regular',
                '-v': 'regular',
                '--verbose': 'regular',
            },
            callForEachArg: true,
        },
    ],

    rmdir: [
        function (
            this: CommandExecutor,
            _stdin: string,
            arg: unknown,
            _flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            const argValue = arg as string | null;
            if (!argValue) {
                throw new Error('missing operand');
            }
            this.fileSystem.rmdir(argValue);
            return '';
        },

        {
            callForEachArg: true,
        },
    ],

    // TODO: Implement prompting
    // rm: remove write-protected regular file 'test'? (y/n)
    rm: [
        function (
            this: CommandExecutor,
            _stdin: string,
            arg: unknown,
            flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            const argValue = arg as string | null;
            if (this.fileSystem.isDirectory(argValue!) && !flagMap.has('-r')) {
                throw new Error(`cannot remove '${argValue}': Is a directory`);
            }
            if (argValue === '.' || argValue === '..') {
                throw new Error(`refusing to remove '.' or '..' directory: skipping '${argValue}'`);
            }
            const output = this.fileSystem.rm(argValue!, { force: flagMap.has('-f') });
            return flagMap.has('-v') ? output + '\n' : '';
        },

        {
            flags: {
                '-r': 'regular',
                '-f': 'regular',
                '-v': 'regular',
            },
            callForEachArg: true,
        },
    ],

    ls: [
        function (
            this: CommandExecutor,
            _stdin: string,
            arg: unknown,
            flagMap: Map<string, string[]>,
            info: CommandInfo
        ): string {
            let argValue = arg as string | null;
            const long = flagMap.has('-l');
            const options = {
                dir: flagMap.has('-d'),
                all: flagMap.has('-a'),
            };
            argValue = argValue ? argValue : '.';
            const result = this.fileSystem.ls(argValue, options);

            result.map((item) => {
                item.name = /\s/g.test(item.name) ? `'${item.name}'` : item.name;
            });

            const output = long
                ? formatLsLong.call(this, result, new Date())
                : formatLsShort.call(this, result, info.inPipe ?? false);

            if (!info.multipleArgsMode) {
                return output;
            }
            return !options.dir && this.fileSystem.isDirectory(argValue)
                ? `\n${argValue.replace('~', this.fileSystem.homeDirectory)}:\n${output}\n`
                : `${output}\n`;
        },

        {
            flags: {
                '-l': 'regular',
                '-d': 'regular',
                '-a': 'regular',
            },
            callForEachArg: true,
            sortArgs: function (this: CommandExecutor, a: string, b: string): number {
                if (this.fileSystem.isDirectory(a) && !this.fileSystem.isDirectory(b)) {
                    return 1;
                }
                if (!this.fileSystem.isDirectory(a) && this.fileSystem.isDirectory(b)) {
                    return -1;
                }
                return 0;
            },
        },
    ],

    cp: [
        function (
            this: CommandExecutor,
            _stdin: string,
            args: unknown,
            flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            const [source, dest] = args as [string | null, string | string[] | null];
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
        },

        {
            flags: {
                '-t': 'argument',
                '--target-directory': 'argument',
                '-r': 'regular',
            },
            callForEachArg: true,
            destinationArgLocations: ['-t', '--target-directory', -1],
        },
    ],

    mv: [
        function (
            this: CommandExecutor,
            _stdin: string,
            args: unknown,
            _flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            const [source, dest] = args as [string | null, string | string[] | null];
            if (!dest || !source) {
                const error = source ? `missing destination file operand after '${source}'` : 'missing file operand';
                throw new Error(error);
            }
            if (Array.isArray(dest)) {
                throw new Error('multiple target directories specified');
            }
            this.fileSystem.mv(source, dest);
            return '';
        },

        {
            flags: {
                '-t': 'argument',
                '--target-directory': 'argument',
            },
            callForEachArg: true,
            destinationArgLocations: ['-t', '--target-directory', -1],
        },
    ],

    touch: [
        function (
            this: CommandExecutor,
            _stdin: string,
            arg: unknown,
            flagMap: Map<string, string[]>,
            _options: CommandInfo
        ): string {
            const argValue = arg as string | null;
            if (!argValue) {
                throw new Error('missing file operand');
            }
            this.fileSystem.touch(argValue, { noCreate: flagMap.has('-c') });
            return '';
        },

        {
            flags: {
                '-c': 'regular',
            },
            callForEachArg: true,
        },
    ],
};

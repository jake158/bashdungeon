

function formatLsShort(items, terminalCols, inPipe) {
    if (items.length === 0 || terminalCols <= 0) {
        return '';
    } else if (inPipe) {
        return items.map(i => i.type === 'directory'
            ? this.colorize(i.name, 'bold', 'blue')
            : i.name
        ).join('\n');
    }
    const maxItemWidth = items.reduce((maxWidth, i) => Math.max(maxWidth, i.name.length), 0);
    const cols = Math.max(Math.floor(terminalCols / (maxItemWidth + 1)), 1);
    const rows = Math.ceil(items.length / cols);

    let output = '';

    for (let row = 0; row < rows; row++) {
        let line = '';
        for (let col = 0; col < cols; col++) {
            const index = col * rows + row;
            if (index < items.length) {
                const item = items[index];
                const paddedItem = (item.type === 'directory'
                    ? this.colorize(item.name, 'bold', 'blue')
                    : item.name
                ) + ' '.repeat(maxItemWidth - item.name.length + 1);
                line += paddedItem;
            }
        }
        output += line.trimEnd() + '\n';
    }
    return output.trimEnd();
}

function formatLsLong(items, now) {
    const formatDate = (date) => {
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
        date: 0
    };

    items.forEach(item => {
        maxLengths.permissions = Math.max(maxLengths.permissions, item.permissions.length);
        maxLengths.links = Math.max(maxLengths.links, String(item.links).length);
        maxLengths.username = Math.max(maxLengths.username, item.username.length);
        maxLengths.groupname = Math.max(maxLengths.groupname, item.groupname.length);
        maxLengths.size = Math.max(maxLengths.size, String(item.size).length, 2);
    });

    return items.map(item => {
        const formattedDate = formatDate(item.modified);
        return `${item.permissions.padEnd(maxLengths.permissions)} ` +
            `${String(item.links).padStart(maxLengths.links)} ` +
            `${item.username.padEnd(maxLengths.username)} ` +
            `${item.groupname.padEnd(maxLengths.groupname)} ` +
            `${String(item.size).padStart(maxLengths.size)} ` +
            `${formattedDate} ${item.type === 'directory' ? this.colorize(item.name, 'bold', 'blue') : item.name}`;
    }).join('\n');
}


export const FILESYSTEM_COMMANDS = {
    'pwd': [
        function () { return this.fileSystem.currentDirectory; },
    ],

    'cd': [
        function (stdin, args) {
            if (args.length > 1) {
                throw new Error('too many arguments');
            }
            const path = args.length === 1 ? args[0] : '~';
            this.fileSystem.cd(path);
            return '';
        },
    ],

    'umask': [
        function (stdin, args) {
            if (args.length > 1) {
                throw new Error('too many arguments');
            }
            else if (args.length === 0) {
                return this.fileSystem.umask;
            }
            else {
                this.fileSystem.umask = args[0];
            }
            return '';
        },
    ],

    'chmod': [
        function (stdin, args, flagMap) {
            let flagPerms = ''
            flagPerms += flagMap.has('-r') ? '-r' : '';
            flagPerms += flagMap.has('-w') ? '-w' : '';
            flagPerms += flagMap.has('-x') ? '-x' : '';

            if (flagPerms.length !== 0 && args.length < 1 || flagPerms.length === 0 && args.length < 2) {
                const error = args.length === 1
                    ? `missing operand after '${args[0]}'`
                    : 'missing operand';
                throw new Error(error);
            }

            for (let i = flagPerms ? 0 : 1; i < args.length; i++) {
                this.fileSystem.chmod(args[i], flagPerms ? flagPerms : args[0]);
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
        }
    ],

    'mkdir': [
        function (stdin, arg, flagMap) {
            if (!arg) {
                throw new Error('missing operand');
            }
            return this.fileSystem.mkdir(arg, {
                parents: flagMap.has('-p') || flagMap.has('--parents'),
                verbose: flagMap.has('-v') || flagMap.has('--verbose')
            });
        },

        {
            flags: {
                '-p': 'regular',
                '--parents': 'regular',
                '-v': 'regular',
                '--verbose': 'regular',
            },
            callForEachArg: true
        }
    ],

    'rmdir': [
        function (stdin, arg) {
            if (!arg) {
                throw new Error('missing operand');
            }
            this.fileSystem.rmdir(arg);
            return '';
        },

        {
            callForEachArg: true
        }
    ],

    // TODO: Implement prompting
    // rm: remove write-protected regular file 'test'? (y/n)
    'rm': [
        function (stdin, arg, flagMap) {
            if (this.fileSystem.isDirectory(arg) && !flagMap.has('-r')) {
                throw new Error(`cannot remove '${arg}': Is a directory`);
            }
            if (arg === '.' || arg === '..') {
                throw new Error(`refusing to remove '.' or '..' directory: skipping '${arg}'`);
            }
            const output = this.fileSystem.rm(arg, { force: flagMap.has('-f') });
            return flagMap.has('-v') ? output + '\n' : '';
        },

        {
            flags: {
                '-r': 'regular',
                '-f': 'regular',
                '-v': 'regular',
            },
            callForEachArg: true,
        }
    ],

    'ls': [
        function (stdin, arg, flagMap, info) {
            const long = flagMap.has('-l');
            const options = {
                dir: flagMap.has('-d'),
                all: flagMap.has('-a'),
            };
            arg = arg ? arg : '.';
            const result = this.fileSystem.ls(arg, options);

            result.map(item => {
                item.name = /\s/g.test(item.name) ? `'${item.name}'` : item.name;
            });

            const output = long
                ? formatLsLong.call(this, result, new Date())
                : formatLsShort.call(this, result, info.terminalCols, info.inPipe)

            if (!info.multipleArgsMode) {
                return output;
            }
            return !options.dir && this.fileSystem.isDirectory(arg)
                ? `\n${arg.replace('~', this.fileSystem.homeDirectory)}:\n${output}\n`
                : `${output}\n`;
        },

        {
            flags: {
                '-l': 'regular',
                '-d': 'regular',
                '-a': 'regular',
            },
            callForEachArg: true,
            sortArgs: function (a, b) {
                if (this.fileSystem.isDirectory(a) && !this.fileSystem.isDirectory(b)) { return 1; }
                if (!this.fileSystem.isDirectory(a) && this.fileSystem.isDirectory(b)) { return -1; }
                return 0;
            }
        }
    ],

    'cp': [
        function (stdin, [source, dest], flagMap) {
            if (!dest || !source) {
                const error = source
                    ? `missing destination file operand after '${source}'`
                    : 'missing file operand';
                throw new Error(error);
            }
            if (Array.isArray(dest)) {
                throw new Error('multiple target directories specified')
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
                '-r': 'regular'
            },
            callForEachArg: true,
            destinationArgLocations: ['-t', '--target-directory', -1]
        }
    ],

    'mv': [
        function (stdin, [source, dest], flagMap) {
            if (!dest || !source) {
                const error = source
                    ? `missing destination file operand after '${source}'`
                    : 'missing file operand';
                throw new Error(error);
            }
            if (Array.isArray(dest)) {
                throw new Error('multiple target directories specified')
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
            destinationArgLocations: ['-t', '--target-directory', -1]
        }
    ],

    'touch': [
        function (stdin, arg, flagMap) {
            if (!arg) { throw new Error('missing file operand'); }
            this.fileSystem.touch(arg, { noCreate: flagMap.has('-c') });
            return '';
        },

        {
            flags: {
                '-c': 'regular',
            },
            callForEachArg: true,
        }
    ]
}
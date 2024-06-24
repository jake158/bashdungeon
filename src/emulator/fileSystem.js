

function Dir(name, contents = [], permissions = 'drwxr-xr-x') {
    const _type = 'directory';
    let _name = name;
    let _permissions = permissions;
    let _contents = contents;

    const checkPermissions = (action) => {
        const perms = {
            read: _permissions[1] === 'r',
            write: _permissions[2] === 'w',
            execute: _permissions[3] === 'x'
        };
        if (!perms[action]) {
            throw Error('Permission denied');
        }
    };

    const findItemByName = (name) => {
        checkPermissions('execute');
        return _contents.find(item => item.getName() === name);
    };

    const removeItem = (item) => {
        checkPermissions('write');

        const index = _contents.indexOf(item);
        if (index !== -1) {
            _contents.splice(index, 1);
            return '';
        } else {
            throw new Error(`Item ${item.getName()} not found in directory ${_name}`);
        }
    };


    return {
        getType: () => _type,
        getName: () => _name,
        getPermissions: () => _permissions,
        isEmpty: () => _contents.length === 0,
        getContents: () => {
            checkPermissions('read');
            return _contents;
        },
        addItem: (item) => {
            checkPermissions('write');
            _contents.push(item);
        },
        findItemByName,
        removeItem
    };
}


function File(name, content = '', permissions = '-rw-r--r--') {
    const _type = 'file';
    let _name = name;
    let _permissions = permissions;
    let _content = content;

    const checkPermissions = (action) => {
        const perms = {
            read: _permissions[1] === 'r',
            write: _permissions[2] === 'w',
            execute: _permissions[3] === 'x'
        };
        if (!perms[action]) {
            throw new Error('Permission denied');
        }
    };


    return {
        getType: () => _type,
        getName: () => _name,
        getPermissions: () => _permissions,
        getContent: () => {
            checkPermissions('read');
            return _content;
        },
        setContent: (content) => {
            checkPermissions('write');
            _content = content;
        },
        appendContent: (content) => {
            checkPermissions('write');
            _content += content;
        }
    };
}


function FileSystem(colorize = (text) => text) {
    const homeDirectory = '/home/wizard';
    let currentDirectory = `${homeDirectory}/Dungeon`;
    let previousDirectory = currentDirectory;

    const tree = Dir('/', [
        Dir('home', [
            Dir('wizard', [
                Dir('Dungeon', [
                    File('file1.txt'),
                    File('file2.txt'),
                    Dir('noexecute', [], 'drw-------'),
                    Dir('noread', [], 'd-wx------')
                ])
            ])
        ])
    ]);

    const evaluatePath = (path) => {
        path = path.replace('~', homeDirectory);
        const stack = path.startsWith('/') ? [] : currentDirectory.split('/').filter(Boolean);
        const parts = path.split('/');

        for (const part of parts) {
            if (part === '' || part === '.') {
                continue;
            } else if (part === '..') {
                if (stack.length > 0) {
                    stack.pop();
                }
            } else {
                stack.push(part);
            }
        }
        return '/' + stack.join('/');
    };

    const getItem = (path) => {
        const parts = path.split('/').filter(Boolean);
        let curr = tree;

        for (const part of parts) {
            const item = curr.findItemByName(part);
            if (item) {
                curr = item;
            }
            else {
                return null;
            }
        }
        return curr;
    };

    const chainErrors = (func, message = null) => {
        return function (...args) {
            try {
                return func(...args);
            } catch (error) {
                throw new Error(`${message ? message + ' ' : ''}'${args[0].replace('~', homeDirectory)}': ${error.message}`);
            }
        };
    };


    const ls = chainErrors(
        (path) => {
            const absolutePath = evaluatePath(path);
            const item = getItem(absolutePath);

            if (!item) {
                throw new Error('No such file or directory');
            }
            else if (item.getType() === 'file') {
                return item.getName();
            }
            return item.getContents().map(item => {
                const entry = item.getName()
                return item.getType() === 'directory' ? colorize(entry, 'bold', 'blue') : entry;
            }).join('  ');
        },
        'cannot access'
    );

    const cd = chainErrors(
        (path) => {
            const absolutePath = path === '-' ? previousDirectory : evaluatePath(path);
            const item = getItem(absolutePath);

            if (!item) {
                throw new Error('No such file or directory');
            }
            else if (item.getType() != 'directory') {
                throw new Error('Not a directory');
            }
            else if (item.getPermissions()[3] != 'x') {
                throw new Error('Permission denied');
            }

            previousDirectory = currentDirectory;
            currentDirectory = absolutePath;
        }
    );

    const mkdir = chainErrors(
        (path) => {
            const absolutePath = evaluatePath(path);
            const sep = absolutePath.lastIndexOf('/');
            const directory = getItem(absolutePath.substring(0, sep));
            const dirname = absolutePath.substring(sep + 1);

            if (!directory) {
                throw new Error('No such file or directory');
            }
            else if (directory.getType() != 'directory') {
                throw new Error('Not a directory');
            }
            else if (!dirname || directory.findItemByName(dirname)) {
                throw new Error('File exists');
            }

            directory.addItem(Dir(dirname));
        },
        'cannot create directory'
    );

    const rmdir = chainErrors(
        (path) => {
            const absolutePath = evaluatePath(path);
            const directory = getItem(absolutePath);
            const sep = absolutePath.lastIndexOf('/');

            if (!directory) {
                throw new Error('No such file or directory');
            }
            else if (directory.getType() != 'directory') {
                throw new Error('Not a directory');
            }
            else if (!directory.isEmpty()) {
                throw new Error('Directory not empty');
            }

            const parentDirectory = getItem(absolutePath.substring(0, sep));
            parentDirectory.removeItem(directory);
        },
        'failed to remove'
    );


    return {
        getHomeDirectory: () => homeDirectory,
        pwd: () => currentDirectory,
        ls,
        cd,
        mkdir,
        rmdir
    };
}


export { FileSystem, Dir, File };

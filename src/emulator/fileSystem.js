

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


function FileSystem() {
    const homeDirectory = '/home/wizard';
    let currentDirectory = `${homeDirectory}/Dungeon`;
    let previousDirectory = currentDirectory;

    const tree = Dir('/', [
        Dir('home', [
            Dir('wizard', [
                Dir('Dungeon', [
                    File('file1.txt', 'Content of file1.txt'),
                    File('emptyfile.txt'),
                    File('.test', 'Hidden file contents'),
                    File('unreadable.txt', 'Unreadable', '--wx------'),
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

    const isDirectory = (path) => {
        const item = getItem(evaluatePath(path));
        if (!item) return false;
        return item.getType() === 'directory';
    }

    const chainErrors = (func, message = null) => {
        return function (...args) {
            try {
                return func(...args);
            } catch (error) {
                throw new Error(`${message ? message + ' ' : ''}'${args[0].replace('~', homeDirectory)}': ${error.message}`);
            }
        };
    };


    const getFileContent = chainErrors(
        (path) => {
            const item = getItem(evaluatePath(path));
            if (!item) {
                throw new Error('No such file or directory');
            }
            else if (item.getType() === 'directory') {
                throw new Error('Is a directory');
            }
            return item.getContent();
        }
    );

    const ls = chainErrors(
        // Implement . .. when -a
        (path, all = false) => {
            const absolutePath = evaluatePath(path);
            const item = getItem(absolutePath);
            if (!item) { throw new Error('No such file or directory'); }

            const constructObject = (item) => ({
                type: item.getType(),
                permissions: item.getPermissions(),
                name: item.getName(),
            });

            if (item.getType() === 'file') {
                return constructObject(item);
            }

            const result = all
                ? item.getContents().map(constructObject)
                : item.getContents().filter(i => !i.getName().startsWith('.')).map(constructObject);

            return result.sort(
                (itemA, itemB) => {
                    if (itemA.type === 'directory' && itemB.type !== 'directory') { return -1; }
                    if (itemA.type !== 'directory' && itemB.type === 'directory') { return 1; }
                    const a = itemA.name.toLowerCase();
                    const b = itemB.name.toLowerCase();
                    return (a < b) ? -1 : (a > b) ? 1 : 0;
                });
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
        getCurrentDirectory: () => currentDirectory,
        isDirectory,
        getFileContent,
        ls,
        cd,
        mkdir,
        rmdir
    };
}


export { FileSystem, Dir, File };

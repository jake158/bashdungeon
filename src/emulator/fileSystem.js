

function Dir(name, contents = [], permissions = 'drwxr-xr-x') {
    const _type = 'directory';
    let _name = name;
    let _permissions = permissions;
    let _contents = contents;
    let _parent = null;

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

    const removeItemByName = (name) => {
        checkPermissions('write');

        const index = _contents.findIndex(item => item.getName() === name);
        if (index !== -1) {
            _contents.splice(index, 1);
            return true;
        } else {
            return false;
        }
    };

    const calculateLinks = () => {
        // Initial links: 1 for the directory itself, 1 for the parent link
        let links = 2;
        _contents.forEach(item => {
            if (item.getType() === 'directory') {
                links += 1;
            }
        });
        return links;
    };


    return {
        isEmpty: () => _contents.length === 0,
        getType: () => _type,
        getName: () => _name,
        getPermissions: () => _permissions,
        getContents: (bypass = false) => {
            if (!bypass) checkPermissions('read');
            return _contents;
        },
        getLinks: calculateLinks,
        setName: (name) => _name = name,
        addItem: (item) => {
            checkPermissions('write');
            _contents.push(item);
        },
        findItemByName,
        removeItemByName,
        setParent: (parent) => _parent = parent,
        getParent: () => _parent
    };
}


function File(name, content = '', permissions = '-rw-r--r--') {
    const _type = 'file';
    let _name = name;
    let _permissions = permissions;
    let _content = content;
    let _parent = null;

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
        getLinks: () => 1,
        setName: (name) => _name = name,
        setContent: (content) => {
            checkPermissions('write');
            _content = content;
        },
        appendContent: (content) => {
            checkPermissions('write');
            _content += content;
        },
        setParent: (parent) => _parent = parent,
        getParent: () => _parent
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
                    Dir('noread', [], 'd-wx------'),
                    Dir('nowrite', [], 'dr-x------')
                ])
            ])
        ])
    ]);

    (function setParents(dir) {
        const traverse = (currentDir) => {
            currentDir.getContents(true).forEach(item => {
                item.setParent(currentDir);
                if (item.getType() === 'directory') {
                    traverse(item);
                }
            });
        };
        traverse(dir);
    })(tree);


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
                links: item.getLinks(),
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

            const newDir = Dir(dirname);
            newDir.setParent(directory);
            directory.addItem(newDir);
        },
        'cannot create directory'
    );

    const rmdir = chainErrors(
        (path) => {
            const absolutePath = evaluatePath(path);
            const directory = getItem(absolutePath);

            if (!directory) {
                throw new Error('No such file or directory');
            }
            else if (directory.getType() != 'directory') {
                throw new Error('Not a directory');
            }
            else if (!directory.isEmpty()) {
                throw new Error('Directory not empty');
            }

            const parentDirectory = getItem(absolutePath).getParent();
            parentDirectory.removeItemByName(directory.getName());
        },
        'failed to remove'
    );


    const _handleItemMove = (sourcePath, sourceItem, destPath, operation) => {

        const getDestinationInfo = (destPath) => {
            const sep = destPath.lastIndexOf('/');
            const destDirPath = sep === -1 ? currentDirectory : destPath.substring(0, sep);
            const destFileName = sep === -1 ? destPath : destPath.substring(sep + 1);
            const destDir = getItem(destDirPath);
            return { destDir, destFileName };
        };

        const itemAtPath = getItem(destPath);
        const { destDir, destFileName } = itemAtPath && itemAtPath.getType() === 'directory'
            ? { destDir: itemAtPath, destFileName: sourceItem.getName() }
            : getDestinationInfo(destPath);

        if (!destDir) {
            throw new Error(`'${destPath}': No such file or directory`);
        }

        const destItem = destDir.findItemByName(destFileName);
        if (destItem) {
            destDir.removeItemByName(destFileName);
        }

        const copyItem = (item) => item.getType() === 'file'
            ? File(item.getName(), item.getContent(), item.getPermissions())
            : Dir(item.getName(), item.getContents().map(copyItem), item.getPermissions());

        const newItem = (operation === 'copy') ? copyItem(sourceItem) : sourceItem;
        // Check write, execute permissions on destDir?
        newItem.setName(destFileName);
        destDir.addItem(newItem);

        if (operation === 'move') {
            const sourceDirPath = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
            const sourceDir = getItem(sourceDirPath);
            const sourceItemName = sourceItem.getName();
            if (sourceDirPath !== destPath || sourceItemName !== destFileName) { sourceDir.removeItemByName(sourceItemName); }
        }
    };

    // Ensure none of:
    // Moving directory you are in right now
    // Tampering with root

    const cp = chainErrors(
        (source, dest) => {
            const sourcePath = evaluatePath(source);
            const destPath = evaluatePath(dest);

            const sourceItem = getItem(sourcePath);
            if (!sourceItem) {
                throw new Error('No such file or directory');
            }

            _handleItemMove(sourcePath, sourceItem, destPath, 'copy');
        },
        'cannot copy'
    );

    const mv = chainErrors(
        (source, dest) => {
            const sourcePath = evaluatePath(source);
            const destPath = evaluatePath(dest);

            const sourceItem = getItem(sourcePath);
            if (!sourceItem) {
                throw new Error('No such file or directory');
            }

            _handleItemMove(sourcePath, sourceItem, destPath, 'move');
        },
        'cannot move'
    );


    return {
        getHomeDirectory: () => homeDirectory,
        getCurrentDirectory: () => currentDirectory,
        isDirectory,
        getFileContent,
        ls,
        cd,
        mkdir,
        rmdir,
        cp,
        mv
    };
}


export { FileSystem, Dir, File };

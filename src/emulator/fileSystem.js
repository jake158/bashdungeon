

function Dir(name, contents = [], permissions = 'drwxr-xr-x') {
    const _type = 'directory';
    let _name = name;
    let _permissions = permissions;
    let _contents = contents;

    const checkPermissions = (action) => {
        // TODO: Implement
        if (action === 'read' && _permissions[1] !== 'r' || action === 'write' && _permissions[2] !== 'w') {
            return `Permission denied: cannot ${action} directory ${_name}`;
        }
        return null;
    };

    const findItemByName = (name) => {
        return _contents.find(item => item.getName() === name);
    };


    return {
        getType: () => _type,
        getName: () => _name,
        getPermissions: () => _permissions,
        getContents: () => {
            const error = checkPermissions('read');
            if (error) return error;
            return _contents;
        },
        addItem: (item) => {
            const error = checkPermissions('write');
            if (error) return error;
            _contents.push(item);
        },
        findItemByName
    };
}


function File(name, content = '', permissions = '-rw-r--r--') {
    const _type = 'file';
    let _name = name;
    let _permissions = permissions;
    let _content = content;

    const checkPermissions = (action) => {
        // TODO: Implement
        if (_permissions[1] !== 'r') {
            return `Permission denied: cannot ${action} file ${_name}`;
        }
        return null;
    };


    return {
        getType: () => _type,
        getName: () => _name,
        getPermissions: () => _permissions,
        getContent: () => {
            const error = checkPermissions('read');
            if (error) return error;
            return _content;
        },
        setContent: (content) => {
            const error = checkPermissions('write');
            if (error) return error;
            _content = content;
        },
        appendContent: (content) => {
            const error = checkPermissions('write');
            if (error) return error;
            _content += content;
        }
    };
}


function FileSystem() {
    const homeDirectory = '/home/wizard';
    let currentDirectory = `${homeDirectory}/Dungeon`;

    const tree = Dir('/', [
        Dir('home', [
            Dir('wizard', [
                Dir('Dungeon', [
                    File('file1.txt'),
                    File('file2.txt')
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

    const cd = (path) => {
        // TODO: cd -
        const absolutePath = evaluatePath(path);
        const item = getItem(absolutePath);

        if (!item) {
            return `bash: cd: ${path.replace('~', homeDirectory)}: No such file or directory`;
        }
        else if (item.getType() != 'directory') {
            return `bash: cd: ${path.replace('~', homeDirectory)}: Not a directory`
        }
        currentDirectory = absolutePath;
        return '';
    };

    const ls = () => {
        const dir = getItem(currentDirectory);
        return dir.getContents().map(item => item.getName()).join(' ');
    };

    const mkdir = (path) => {
        const absolutePath = evaluatePath(path);
        const sep = absolutePath.lastIndexOf('/');
        const directory = getItem(absolutePath.substring(0, sep));
        const dirname = absolutePath.substring(sep + 1);

        if (!directory) {
            return `mkdir: cannot create directory ‘${path.replace('~', homeDirectory)}’: No such file or directory`
        }
        else if (directory.getType() != 'directory') {
            return `mkdir: cannot create directory ‘${path.replace('~', homeDirectory)}’: Not a directory`
        }
        else if (!dirname || directory.findItemByName(dirname)) {
            return `mkdir: cannot create directory ‘${path.replace('~', homeDirectory)}’: File exists`
        }

        const error = directory.addItem(Dir(dirname));
        return error || '';
    };

    const rmdir = (path) => {
        // TODO: Implement
        return '';
    };


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

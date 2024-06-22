

function Dir(name, contents = [], permissions = 'drwxr-xr-x') {
    const _type = 'directory';
    let _name = name;
    let _permissions = permissions;
    let _contents = contents;

    const checkPermissions = (action) => {
        // TODO: Implement
        if (_permissions[1] !== 'r') {
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
        add: (item) => {
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

    const changeDirectory = (path) => {
        // TODO: cd -
        const absolutePath = evaluatePath(path);
        const parts = absolutePath.split('/').filter(Boolean);

        let dir = tree;
        for (const part of parts) {
            const foundItem = dir.findItemByName(part);
            if (foundItem && foundItem.getType() === 'directory') {
                dir = foundItem;
            } else if (foundItem) {
                return `bash: cd: ${path.replace('~', homeDirectory)}: Not a directory`
            } else {
                return `bash: cd: ${path.replace('~', homeDirectory)}: No such file or directory`;
            }
        }
        currentDirectory = absolutePath;
        return '';
    };

    const listDirectory = () => {
        const parts = currentDirectory.split('/').filter(Boolean);

        let dir = tree;
        for (const part of parts) {
            const newDir = dir.findItemByName(part);
            if (newDir) {
                dir = newDir;
            }
        }
        return dir.getContents().map(item => item.getName()).join(' ');
    };


    return {
        getWorkingDirectory: () => currentDirectory,
        getHomeDirectory: () => homeDirectory,
        changeDirectory,
        listDirectory,
    };
}


export { FileSystem, Dir, File };

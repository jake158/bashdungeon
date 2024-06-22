

function Dir(name, contents = [], permissions = 'drwxr-xr-x') {
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
        getName: () => _name,
        getPermissions: () => _permissions,
        getContents: () => {
            const error = checkPermissions('read');
            if (error) return error;
            return _contents;
        },
        setContents: (newContents) => {
            _contents = newContents;
        },
        addFile: (file) => {
            _contents.push(file);
        },
        addDir: (dir) => {
            _contents.push(dir);
        },
        findItemByName
    };
}


function File(name, content = '', permissions = '-rw-r--r--') {
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
        getName: () => _name,
        getPermissions: () => _permissions,
        getContent: () => {
            const error = checkPermissions('read');
            if (error) return error;
            return _content;
        },
        setContent: (newContent) => {
            const error = checkPermissions('write');
            if (error) return error;
            _content = newContent;
        },
        appendContent: (additionalContent) => {
            const error = checkPermissions('write');
            if (error) return error;
            _content += additionalContent;
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
        const absolutePath = evaluatePath(path);
        const parts = absolutePath.split('/').filter(Boolean);

        let dir = tree;
        for (const part of parts) {
            const foundItem = dir.findItemByName(part);
            if (foundItem && foundItem.getContents) {
                dir = foundItem;
            } else if (foundItem) {
                return `bash: cd: ${path.replace('~', getHomeDirectory())}: Not a directory`
            } else {
                return `bash: cd: ${path.replace('~', getHomeDirectory())}: No such file or directory`;
            }
        }
        currentDirectory = absolutePath;
        return '';
    };

    const listDirectory = () => {
        const parts = getWorkingDirectory().split('/').filter(Boolean);
        parts.unshift('/');

        let dir = tree;
        for (const part of parts) {
            const foundItem = dir.findItemByName(part);
            if (foundItem) {
                dir = foundItem;
            }
        }
        return dir.getContents().map(item => item.getName()).join(' ');
    };

    const getWorkingDirectory = () => currentDirectory;

    const getHomeDirectory = () => homeDirectory;


    return {
        changeDirectory,
        listDirectory,
        getWorkingDirectory,
        getHomeDirectory
    };
}


export { FileSystem, Dir, File };

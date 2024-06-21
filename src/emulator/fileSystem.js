

function Dir(name, contents = {}, permissions = 'drwxr-xr-x') {
    return {
        type: 'directory',
        name,
        permissions,
        contents
    }
}


function File(name, content = '', permissions = '-rw-r--r--') {
    return {
        type: 'file',
        name,
        permissions,
        content
    }
}


function FileSystem() {
    const homeDirectory = '/home/wizard';
    let currentDirectory = `${homeDirectory}/Dungeon`;

    const tree = {
        '/': Dir('/', {
            'home': Dir('home', {
                'wizard': Dir('wizard', {
                    'Dungeon': Dir('Dungeon', {
                        'file1.txt': File('file1.txt'),
                        'file2.txt': File('file2.txt')
                    })
                })
            })
        })
    };

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

    const isValidPath = (path) => {
        const parts = path.split('/').filter(Boolean);
        parts.unshift('/');

        let dir = tree;
        for (const part of parts) {
            if (dir[part] && dir[part].contents) {
                dir = dir[part].contents;
            } else {
                return false;
            }
        }
        return true;
    };

    const changeDirectory = (path) => {
        const absolutePath = evaluatePath(path);

        if (isValidPath(absolutePath)) {
            currentDirectory = absolutePath;
        } else {
            return `bash: cd: ${path.replace('~', getHomeDirectory())}: No such file or directory`;
        }
        return '';
    };

    const listDirectory = () => {
        const parts = getWorkingDirectory().split('/').filter(Boolean);
        parts.unshift('/');

        let dir = tree;
        for (const part of parts) {
            if (part) {
                dir = dir[part].contents;
            }
        }
        return Object.keys(dir).join(' ');
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


export { FileSystem };

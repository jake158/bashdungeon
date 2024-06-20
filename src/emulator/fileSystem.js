
const homeDirectory = '/home/wizard';
let currentDirectory = `${homeDirectory}/Dungeon`;


const fileSystem = {
    '/': {
        'home':
        {
            'wizard':
            {
                'Dungeon':
                {
                    'file1.txt': '',
                    'file2.txt': ''
                }
            }
        }
    }
};


function changeDirectory(path) {
    const absolutePath = evaluatePath(path);

    if (isValidPath(absolutePath)) {
        currentDirectory = absolutePath;
    } else {
        return `bash: cd: ${path}: No such file or directory`;
    }
    return '';
}


function evaluatePath(path) {
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
}


function isValidPath(path) {
    const parts = path.split('/').filter(Boolean);
    parts.unshift('/');

    let dir = fileSystem;
    for (const part of parts) {
        if (dir[part]) {
            dir = dir[part];
        } else {
            return false;
        }
    }
    return true;
}


function listDirectory() {
    const parts = getWorkingDirectory().split('/').filter(Boolean);
    parts.unshift('/');

    let dir = fileSystem;
    for (const part of parts) {
        if (part) {
            dir = dir[part];
        }
    }
    return Object.keys(dir).join(' ');
}


function getWorkingDirectory() {
    return currentDirectory;
}


function getHomeDirectory() {
    return homeDirectory;
}


export {
    changeDirectory,
    listDirectory,
    getWorkingDirectory,
    getHomeDirectory
};

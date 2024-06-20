let homeDirectory = '/home/wizard';
let currentDirectory = `${homeDirectory}/dungeon`;

const fileSystem = {
    '/home': { 'wizard': { 'dungeon': { 'file1.txt': '', 'file2.txt': '' } } }
};


export const changeDirectory = (path) => {
    // TODO: Does not work
    if (path === '..') {
        const parts = currentDirectory.split('/');
        parts.pop();
        currentDirectory = parts.join('/') || '/';
    } else {
        const newPath = path.startsWith('/') ? path : `${currentDirectory}/${path}`;
        if (newPath in fileSystem) {
            currentDirectory = newPath;
        } else {
            return `No such directory: ${path}`;
        }
    }
    return '';
};

export const listDirectory = () => {
    const parts = currentDirectory.slice(1).split('/');
    parts[0] = '/' + parts[0];
    let dir = fileSystem;
    for (const part of parts) {
        if (part) {
            dir = dir[part];
        }
    }
    return Object.keys(dir).join(' ');
};

export const getWorkingDirectory = () => {
    return currentDirectory;
};

export const getHomeDirectory = () => {
    return homeDirectory;
};
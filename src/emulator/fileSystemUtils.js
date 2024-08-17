

class Item {
    #type;
    #name;
    #permissions;
    #immutable;
    #parent;

    constructor(name, { type = null, permissions = '---------', immutable = false } = {}) {
        this.#type = type;
        this.#name = name;
        this.#permissions = permissions;
        this.#immutable = immutable;
        this.#parent = null;
    }

    checkPermissions(action) {
        const perms = {
            read: this.#permissions[1] === 'r',
            write: this.#permissions[2] === 'w',
            execute: this.#permissions[3] === 'x'
        };
        if (!perms[action]) {
            throw new Error('Permission denied');
        }
    }

    get type() {
        return this.#type;
    }

    get parent() {
        return this.#parent;
    }

    get name() {
        return this.#name;
    }

    get permissions() {
        return this.#permissions;
    }

    get immutable() {
        return this.#immutable;
    }

    set parent(parent) {
        this.#parent = parent;
    }

    set name(name) {
        if (this.#immutable) throw new Error('Permission denied');
        this.#parent.checkPermissions('write');
        this.#name = name;
    }

    set permissions(permissions) {
        if (this.#immutable) throw new Error('Permission denied');
        this.#permissions = permissions;
    }
}


export class Dir extends Item {
    #contents;

    constructor(name, { permissions = 'drwxrwxr-x', immutable = false } = {}, contents = []) {
        super(name, { type: 'directory', permissions, immutable });
        this.#contents = contents;
        contents.forEach(item => item.parent = this);
    }

    get contents() {
        this.checkPermissions('read');
        return this.#contents;
    }

    get links() {
        let links = 2;
        this.#contents.forEach(item => {
            if (item.type === 'directory') {
                links += 1;
            }
        });
        return links;
    }

    get isEmpty() {
        return this.#contents.length === 0;
    }

    findItemByName(name) {
        this.checkPermissions('execute');
        return this.#contents.find(item => item.name === name);
    }

    removeItemByName(name, force = false) {
        if (!force) this.checkPermissions('write');
        const index = this.#contents.findIndex(item => item.name === name);
        if (index !== -1) {
            if (this.#contents[index].immutable) throw new Error('Permission denied');
            this.#contents.splice(index, 1);
            return true;
        } else {
            return false;
        }
    }

    addItem(item) {
        this.checkPermissions('write');
        this.#contents.push(item);
        item.parent = this;
    }
}


export class File extends Item {
    #content;

    constructor(name, { content = '', permissions = '-rw-rw-r--', immutable = false } = {}) {
        super(name, { type: 'file', permissions, immutable });
        this.#content = content;
    }

    get content() {
        this.checkPermissions('read');
        return this.#content;
    }

    get links() {
        return 1;
    }

    set content(content) {
        if (this.immutable) throw new Error('Permission denied');
        this.checkPermissions('write');
        this.#content = content;
    }

    appendContent(content) {
        if (this.immutable) throw new Error('Permission denied');
        this.checkPermissions('write');
        this.#content += content;
    }
}


export function permsToOctal(perms) {
    const permissionBits = { 'r': 4, 'w': 2, 'x': 1, '-': 0 };
    let octal = '';

    for (let i = 1; i < perms.length; i += 3) {
        let value = 0;
        value += permissionBits[perms[i]];
        value += permissionBits[perms[i + 1]];
        value += permissionBits[perms[i + 2]];
        octal += value.toString(8);
    }
    return octal;
}

export function octalToPerms(octal, isDirectory = false) {
    const permissionChars = { 4: 'r', 2: 'w', 1: 'x', 0: '-' };
    const typeChar = isDirectory ? 'd' : '-';
    let perms = typeChar;

    for (let i = 0; i < octal.length; i++) {
        let value = parseInt(octal[i], 8);
        perms += permissionChars[(value & 4)];
        perms += permissionChars[(value & 2)];
        perms += permissionChars[(value & 1)];
    }
    return perms;
}


export function parseChmodString(string, currentPermissions) {
    const modes = string.split(',').filter(Boolean);
    let permissions = currentPermissions.split('');

    if (/^[0-7]{3,4}$/.test(string)) {
        if (string.length === 4 && string[0] !== '0') {
            throw new Error('SUID, SGID, Sticky Bit not supported');
        }
        return octalToPerms(string.padStart(4, '0').slice(1), permissions[0] === 'd');
    }

    for (const mode of modes) {
        _processMode(mode, permissions);
    }
    return permissions.join('');
}

function _processMode(mode, permissions) {
    const regex = /([ugoa]*)([+\-=])([ugo]{1}|[rwxXst]*)/g;
    let match;
    let prev = null;
    let consumedLength = 0;

    while ((match = regex.exec(mode)) !== null) {
        let [fullMatch, groups, operator, perms] = match;
        groups = prev || groups || 'a';
        prev = groups;

        if (/[Xst]/.test(perms)) {
            throw new Error('SUID, SGID, Sticky Bit not supported');
        }

        _applyPermissions(groups, operator, perms, permissions);
        consumedLength += fullMatch.length;
    }

    if (consumedLength !== mode.length) {
        throw new Error(`invalid mode: '${mode}'`);
    }
}

function _applyPermissions(groups, operator, perms, permissions) {
    // Implement umask!!!

    const indices = {
        'u': [1, 2, 3],
        'g': [4, 5, 6],
        'o': [7, 8, 9],
        'a': [1, 2, 3, 4, 5, 6, 7, 8, 9],
    };

    const currentGroupPerms = {
        'u': permissions.slice(1, 4),
        'g': permissions.slice(4, 7),
        'o': permissions.slice(7, 10),
    };

    for (const group of groups) {
        let permSet = perms;

        if (['u', 'g', 'o'].includes(perms) || (operator === '=' && !perms)) {
            permSet = !perms ? '---' : currentGroupPerms[perms].join('');
            _applyGroupPerms(indices[group], operator, permSet, permissions);
        } else {
            _applyIndividualPerms(indices[group], operator, permSet, permissions);
        }
    }
}

function _applyGroupPerms(indexList, operator, permSet, permissions) {
    for (let i = 0; i < indexList.length; i++) {
        switch (operator) {
            case '+':
                if (permSet[i % 3] !== '-') {
                    permissions[indexList[i]] = permSet[i % 3];
                }
                break;
            case '-':
                if (permSet[i % 3] !== '-') {
                    permissions[indexList[i]] = '-';
                }
                break;
            case '=':
                permissions[indexList[i]] = permSet[i % 3];
                break;
        }
    }
}

function _applyIndividualPerms(indexList, operator, permSet, permissions) {
    for (const perm of permSet) {
        const posIndeces = {
            'r': [1, 4, 7],
            'w': [2, 5, 8],
            'x': [3, 6, 9]
        }[perm];

        for (const pos of posIndeces) {
            if (indexList.includes(pos)) {
                switch (operator) {
                    case '+':
                        permissions[pos] = perm;
                        break;
                    case '-':
                        permissions[pos] = '-';
                        break;
                    case '=':
                        permissions[pos] = perm;
                        break;
                }
            }
        }
    }
}

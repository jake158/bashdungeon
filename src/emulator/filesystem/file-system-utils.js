

function permsToOctal(perms) {
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

function octalToPerms(octal, isDirectory = false) {
    const permissionChars = { 4: 'r', 2: 'w', 1: 'x', 0: '-' };
    let perms = isDirectory ? 'd' : '-';

    for (let i = 0; i < octal.length; i++) {
        let value = parseInt(octal[i], 8);
        perms += permissionChars[(value & 4)];
        perms += permissionChars[(value & 2)];
        perms += permissionChars[(value & 1)];
    }
    return perms;
}

export function applyUmask(permissions, umask) {
    const permOctal = permsToOctal(permissions);
    const result = permOctal - umask;
    return octalToPerms(result.toString().padStart(3, '0'), permissions[0] === 'd');
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
        // TODO: Implement umask handling
        // const aIsImplicit = (!prev && !groups);
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

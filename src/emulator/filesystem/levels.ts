import { Item, type ItemJSON } from './items';

export const ROOT = Item.fromJSON({
    type: 'directory',
    name: '/',
    options: {
        immutable: true,
    },
    contents: [
        {
            type: 'directory',
            name: 'home',
            options: {
                immutable: true,
            },
            contents: [
                {
                    type: 'directory',
                    name: 'wizard',
                    options: {
                        immutable: true,
                    },
                    contents: [
                        {
                            type: 'directory',
                            name: 'Dungeon',
                            options: {
                                immutable: true,
                            },
                            contents: getTestFiles(),
                        },
                    ],
                },
            ],
        },
    ],
});

function getTestFiles(): ItemJSON[] {
    return [
        {
            type: 'file' as const,
            name: 'file1.txt',
            content: 'file1 yo\nhello YO yo\n yo hello HI\n hello test',
        },
        {
            type: 'file' as const,
            name: 'emptyfile.txt',
        },
        {
            type: 'file' as const,
            name: '.test',
            content: 'hidden immutable file yo',
            options: {
                immutable: true,
            },
        },
        {
            type: 'file' as const,
            name: 'unreadable.txt',
            content: 'unreadable yo',
            options: {
                permissions: '--wx------',
                lastModified: new Date(2017, 0, 1).toISOString(),
            },
        },
        {
            type: 'directory' as const,
            name: 'noexecute',
            options: {
                permissions: 'drw-------',
            },
        },
        {
            type: 'directory' as const,
            name: 'noread',
            options: {
                permissions: 'd-wx------',
            },
        },
        {
            type: 'directory' as const,
            name: 'nowrite',
            options: {
                permissions: 'dr-x------',
            },
            contents: [
                {
                    type: 'file',
                    name: 'denied',
                    content: "can't delete this",
                    options: {},
                },
            ],
        },
    ];
}

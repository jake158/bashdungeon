import { Dir, File } from './items.js';


export const ROOT = new Dir('/', { immutable: true }, [
    new Dir('home', { immutable: true }, [
        new Dir('wizard', { immutable: true }, [
            new Dir('Dungeon', { immutable: true }, [
                new File('file1.txt', { content: 'file1 yo\nhello YO yo\n yo hello HI\n hello test' }),
                new File('emptyfile.txt'),
                new File('.test', { content: 'hidden immutable file yo', immutable: true }),
                new File('unreadable.txt', { content: 'unreadable yo', permissions: '--wx------' }),
                new Dir('noexecute', { permissions: 'drw-------' }),
                new Dir('noread', { permissions: 'd-wx------' }),
                new Dir('nowrite', { permissions: 'dr-x------' }, [new File('denied')])
            ])
        ])
    ])
]);


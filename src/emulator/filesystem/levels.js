import { Item } from './items.js';


export const ROOT = Item.fromJSON({
    "type": "directory",
    "name": "/",
    "options": {
        "immutable": true
    },
    "contents": [
        {
            "type": "directory",
            "name": "home",
            "options": {
                "immutable": true
            },
            "contents": [
                {
                    "type": "directory",
                    "name": "wizard",
                    "options": {
                        "immutable": true
                    },
                    "contents": [
                        {
                            "type": "directory",
                            "name": "Dungeon",
                            "options": {
                                "immutable": true
                            },
                            "contents": getTestFiles()
                        }
                    ]
                }
            ]
        }
    ]
});


function getTestFiles() {
    return [
        {
            "type": "file",
            "name": "file1.txt",
            "content": "file1 yo\nhello YO yo\n yo hello HI\n hello test",
        },
        {
            "type": "file",
            "name": "emptyfile.txt",
        },
        {
            "type": "file",
            "name": ".test",
            "content": "hidden immutable file yo",
            "options": {
                "immutable": true
            }
        },
        {
            "type": "file",
            "name": "unreadable.txt",
            "content": "unreadable yo",
            "options": {
                "permissions": "--wx------",
                "lastModified": new Date(2017, 0, 1).toISOString()
            }
        },
        {
            "type": "directory",
            "name": "noexecute",
            "options": {
                "permissions": "drw-------"
            }
        },
        {
            "type": "directory",
            "name": "noread",
            "options": {
                "permissions": "d-wx------"
            }
        },
        {
            "type": "directory",
            "name": "nowrite",
            "options": {
                "permissions": "dr-x------"
            },
            "contents": [
                {
                    "type": "file",
                    "name": "denied",
                    "content": "can't delete this",
                    "options": {}
                }
            ]
        }
    ]
}

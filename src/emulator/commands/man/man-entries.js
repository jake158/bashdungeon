

export const manEntries = {
    "pwd": {
        "SUMMARY": "print name of current/working directory",
        "SYNOPSIS": "[OPTION]...",
        "DESCRIPTION": "Print the full filename of the current working directory.",
        "OPTIONS": {}
    },

    "cd": {
        "SUMMARY": "change directory to the one specified",
        "SYNOPSIS": "[DIRECTORY]",
        "DESCRIPTION": `Relative path: cd folder1/folder2
Absolute path: cd /home/wizard/Dungeon/folder1/folder2
Parent directory: cd ..
Previous directory: cd -`,
        "OPTIONS": {}
    },

    "umask": {
        "SUMMARY": "set file mode creation mask",
        "SYNOPSIS": "[MASK]",
        "DESCRIPTION": `umask sets the calling process's file mode creation mask (umask) 
to mask & 0777 (i.e., only the file permission bits of mask are used), 
and returns the previous value of the mask.`,
        "OPTIONS": {}
    },

    "chmod": {
        "SUMMARY": "change file mode bits",
        "SYNOPSIS": "[OPTION]... MODE[,MODE]... FILE...\n[OPTION]... OCTAL-MODE FILE...",
        "DESCRIPTION":
            `chmod changes the file mode bits of each given file according to
mode, which can be either a symbolic representation of changes to make,
or an octal number representing the bit pattern for the new mode bits.

User gets rwx, other groups get ---:  chmod 700 file.txt
Add execute (x) permissions to user:  chmod u+x file.txt
Add read (r) permissions to ugo:      chmod +r  file.txt`,
        "OPTIONS": {}
    },

    "mkdir": {
        "SUMMARY": "make directories",
        "SYNOPSIS": "[OPTION]... DIRECTORY...",
        "DESCRIPTION": "Create the DIRECTORY(ies), if they do not already exist.",
        "OPTIONS": {
            "-p": "no error if existing, make parent directories as needed",
            "--parents": "same as -p",
            "-v": "print a message for each created directory",
            "--verbose": "same as -v"
        }
    },

    "rmdir": {
        "SUMMARY": "remove empty directories",
        "SYNOPSIS": "[OPTION]... DIRECTORY...",
        "DESCRIPTION": "Remove the DIRECTORY(ies), if they are empty.",
        "OPTIONS": {}
    },

    "rm": {
        "SUMMARY": "remove files or directories",
        "SYNOPSIS": "[OPTION]... [FILE]...",
        "DESCRIPTION": "rm removes each specified file. By default, it does not remove directories.",
        "OPTIONS": {
            "-r": "remove directories and their contents recursively",
            "-f": "ignore nonexistent files and arguments, never prompt",
            "-v": "explain what is being done"
        }
    },

    "ls": {
        "SUMMARY": "list directory contents",
        "SYNOPSIS": "[OPTION]... [FILE]...",
        "DESCRIPTION": "List  information  about the FILEs (the current directory by default).",
        "OPTIONS": {
            "-l": "use a long listing format",
            "-d": "list directories themselves, not their contents",
            "-a": "do not ignore entries starting with . (hidden entries)"
        }
    },

    "cp": {
        "SUMMARY": "copy files and directories",
        "SYNOPSIS": "[OPTION]... SOURCE DEST\n[OPTION]... SOURCE... DIRECTORY\n[OPTION]... -t DIRECTORY SOURCE...",
        "DESCRIPTION": "Copy SOURCE to DEST, or multiple SOURCE(s) to DIRECTORY.",
        "OPTIONS": {
            "-t": "copy all SOURCE arguments into -t=DIRECTORY",
            "--target-directory": "same as -t",
            "-r": "copy directories recursively"
        }
    },

    "mv": {
        "SUMMARY": "move (rename) files",
        "SYNOPSIS": "[OPTION]... SOURCE DEST\n[OPTION]... SOURCE... DIRECTORY\n[OPTION]... -t DIRECTORY SOURCE...",
        "DESCRIPTION": "Rename SOURCE to DEST, or move SOURCE(s) to DIRECTORY.",
        "OPTIONS": {
            "-t": "move all SOURCE arguments into -t=DIRECTORY",
            "--target-directory": "same as -t",
        }
    },

    "touch": {
        "SUMMARY": "change file timestamps",
        "SYNOPSIS": "[OPTION]... FILE...",
        "DESCRIPTION": `Update the access and modification times of each FILE to the current 
time. A FILE argument that does not exist is created empty, 
unless -c is supplied.`,
        "OPTIONS": {
            "-c": "do not create any files"
        }
    },

    "base64": {
        "SUMMARY": "base64 encode/decode data and print to standard output",
        "SYNOPSIS": "[OPTION]... [FILE]",
        "DESCRIPTION": `Base64 encode or decode FILE, or standard input, to standard output.

With no FILE, or when FILE is -, read standard input.`,
        "OPTIONS": {
            "-d": "decode data",
            "--decode": "same as -d"
        }
    },

    "echo": {
        "SUMMARY": "display a line of text",
        "SYNOPSIS": "[SHORT-OPTION]... [STRING]...",
        "DESCRIPTION": "Echo the STRING(s) to standard output.",
        "OPTIONS": {
            "-e": "enable interpretation of backslash escapes",
            "-E": "disable interpretation of backslash escapes (default)"
        }
    },

    "cat": {
        "SUMMARY": "concatenate files and print on the standard output",
        "SYNOPSIS": "[OPTION]... [FILE]...",
        "DESCRIPTION": `Concatenate FILE(s) to standard output.
With no FILE, or when FILE is -, read standard input.`,
        "OPTIONS": {}
    },

    "grep": {
        "SUMMARY": "print lines that match patterns",
        "SYNOPSIS": "[OPTION...] PATTERNS [FILE...]",
        "DESCRIPTION": `grep  searches for PATTERNS in each FILE.  
PATTERNS is one or more patterns separated by newline characters,
and grep prints each line that matches a pattern.  
Typically PATTERNS should be quoted when grep is used in a shell command.

A  FILE  of  “-”  stands  for  standard  input.  If no FILE is given, 
recursive searches examine the working directory, and 
nonrecursive searches read standard input.`,
        "OPTIONS": {
            "-i": "Ignore case distinctions in patterns and input data (ignore case)",
            "-n": `Prefix each line of output with the line number within 
its input file`,
            "-r": `Read all files under each directory, recursively.  Note that if 
no file operand is given, grep searches the working directory.`
        }
    }
};

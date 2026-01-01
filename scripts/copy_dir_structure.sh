#!/bin/bash
echo "copy_dir_structure.sh DIR=. DEPTH=3 MKDIR_FLAGS=''"
dir="${1:-.}"
dep="${2:-3}"
mkdir_flag="${3:-}"

# Detect available clipboard tool
if command -v xclip &> /dev/null; then
    CLIP_CMD="xclip -selection clipboard"
elif command -v wl-copy &> /dev/null; then
    CLIP_CMD="wl-copy"
else
    echo "Error: Neither xclip nor wl-copy found. Please install one of them." >&2
    exit 1
fi

(
    find "$dir" -maxdepth "$dep" ! -name "." ! -name ".." \
        -type d -print0 | while IFS= read -r -d '' dir; \
    do
        printf "mkdir -p %s \"%s\" && " "$mkdir_flag" "$dir"
    done
    find "$dir" -maxdepth "$dep" \
        -type f -print0 | while IFS= read -r -d '' file; \
    do
        printf "touch \"%s\" && " "$file"
    done
) | sed 's/ && $//' | tr -d '\n' | $CLIP_CMD

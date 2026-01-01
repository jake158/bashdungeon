#!/bin/bash
# fetch-coreutils-references.sh
# Downloads C source code from GNU coreutils for reference

set -euo pipefail

readonly COREUTILS_BASE_URL="https://raw.githubusercontent.com/coreutils/coreutils/master/src"
readonly COMMANDS_DIR="src/emulator/commands"
readonly SKIP_COMMANDS=("cd" "umask" "help" "man" "grep")

readonly RED='\033[0;31m'
readonly NC='\033[0m' # No Color

if command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl"
elif command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget"
else
    echo "Error: Neither curl nor wget found. Please install one of them." >&2
    exit 1
fi

find_all_commands() {
    find "$COMMANDS_DIR" -type f -name "index.ts" 2>/dev/null | while IFS= read -r index_file; do
        local cmd_dir
        cmd_dir=$(dirname "$index_file")
        local cmd_name
        cmd_name=$(basename "$cmd_dir")
        echo "${cmd_name}:${cmd_dir}"
    done
}

should_skip() {
    local cmd_name=$1
    for skip_cmd in "${SKIP_COMMANDS[@]}"; do
        if [[ "$cmd_name" == "$skip_cmd" ]]; then
            return 0
        fi
    done
    return 1
}

download_reference() {
    local cmd_name=$1
    local cmd_path=$2
    local url="${COREUTILS_BASE_URL}/${cmd_name}.c"
    local output_file="${cmd_path}/${cmd_name}.reference.c"

    if should_skip "$cmd_name"; then
        echo -e "  ${RED}✗ ${cmd_name}${NC}"
        return 2
    fi

    if [[ "$DOWNLOAD_CMD" == "curl" ]]; then
        curl -sSf -o "$output_file" "$url" 2>/dev/null
        local exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
            echo "  ✓ ${cmd_name}"
            return 0  # Return 0 for successfully downloaded
        elif [[ $exit_code -eq 22 ]]; then
            # curl returns 22 for HTTP errors like 404
            echo -e "  ${RED}✗ ${cmd_name}${NC}"
            return 2  # Return 2 for skipped (404)
        else
            echo "  ✗ ${cmd_name}: Download failed (curl error $exit_code)" >&2
            return 1  # Return 1 for error
        fi
    else
        wget -q -O "$output_file" "$url" 2>/dev/null
        local exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
            echo "  ✓ ${cmd_name}"
            return 0  # Return 0 for successfully downloaded
        elif [[ $exit_code -eq 8 ]]; then
            # wget returns 8 for HTTP errors like 404
            echo -e "  ${RED}✗ ${cmd_name}${NC}"
            return 2  # Return 2 for skipped (404)
        else
            echo "  ✗ ${cmd_name}: Download failed (wget error $exit_code)" >&2
            return 1  # Return 1 for error
        fi
    fi
}

remove_references() {
    echo "Removing all *.reference.c files..."

    local ref_files
    ref_files=$(find "$COMMANDS_DIR" -type f -name "*.reference.c" 2>/dev/null)

    if [[ -z "$ref_files" ]]; then
        echo "No reference files found"
        return 0
    fi

    local count=0
    while IFS= read -r ref_file; do
        rm -f "$ref_file"
        count=$((count + 1))
    done <<< "$ref_files"

    echo ""
    echo "Summary: Removed $count reference files"
}

main() {
    local remove_mode=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            -r|--remove)
                remove_mode=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [-r|--remove] [-h|--help]"
                echo ""
                echo "Downloads C source code from GNU coreutils as reference files."
                echo ""
                echo "Options:"
                echo "  -r, --remove    Remove all *.reference.c files"
                echo "  -h, --help      Show this help message"
                exit 0
                ;;
            *)
                echo "Error: Unknown option: $1" >&2
                echo "Use -h or --help for usage information" >&2
                exit 1
                ;;
        esac
    done

    if [[ "$remove_mode" == true ]]; then
        remove_references
        exit 0
    fi

    echo "Fetching GNU coreutils reference files..."

    local commands
    commands=$(find_all_commands)

    if [[ -z "$commands" ]]; then
        echo "Error: No commands found in $COMMANDS_DIR" >&2
        exit 1
    fi

    echo ""
    echo "Downloading references:"

    local total=0
    local downloaded=0
    local skipped=0
    local failed=0

    while IFS=: read -r cmd_name cmd_path; do
        total=$((total + 1))
        set +e
        download_reference "$cmd_name" "$cmd_path"
        local result=$?
        set -e

        if [[ $result -eq 0 ]]; then
            downloaded=$((downloaded + 1))
        elif [[ $result -eq 2 ]]; then
            skipped=$((skipped + 1))
        else
            failed=$((failed + 1))
        fi
    done <<< "$commands"

    echo ""
    echo "Summary: Downloaded $downloaded references, skipped $skipped commands"

    if [[ $failed -gt 0 ]]; then
        echo "Warning: $failed downloads failed" >&2
        exit 1
    fi
}

main "$@"

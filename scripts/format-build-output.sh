#!/bin/bash

# Format webpack build output for better readability

# Replace home directory path with tilde (~)
sed "s|$HOME|~|g" | \

# Add newlines before file sizes after .js/.ts/.jsx/.tsx/.css files (formats Entrypoint section)
# Matches: file extension + ANSI codes + space + size → extension + ANSI codes + newline + size
sed 's/\(\.[jt]sx\?\|\.css\)\([^ ]*\) \([0-9.]\+ KiB\)/\1\2\n  \3/g' | \

# Add blank line after bundle report path
sed 's/bundle-report\.html.*$/&\n/' | \

# Add blank line after "assets by status" section
sed 's/assets by status.*$/&\n/' | \

# Add blank line before "Entrypoint" section
sed 's/^Entrypoint /\n&/' | \

# Add blank line after "auxiliary assets" (end of Entrypoint section)
sed 's/auxiliary assets$/&\n/' | \

# Add newline before [cached] tag
sed 's/ \([^ ]*\[cached\]\)/\n\1/g' | \

# Add blank line after orphan modules section
sed 's/\[orphan\].*module$/&\n/' | \

# Add blank line before final webpack compilation message
sed 's/^webpack /\n&/'

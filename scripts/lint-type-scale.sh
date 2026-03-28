#!/usr/bin/env bash
# lint-type-scale.sh — checks for banned font sizes in source files
#
# Faffweasel type scale: 14px (text-sm), 16px (default), 24px (text-2xl)
# Plus text-5xl for cost/hero display only.
# Nothing below 14px. Nothing off-scale.
#
# Exit 1 if violations found, 0 if clean.
# Run: npm run lint:type-scale

set -euo pipefail

VIOLATIONS=0

# 1. Check for banned Tailwind classes (sub-14px)
echo "Checking for banned Tailwind size classes..."
BANNED_CLASSES='text-xs|text-2xs|text-\[1[0-3]px\]|text-\[10px\]|text-\[11px\]|text-\[12px\]|text-\[13px\]'
if grep -rn --include='*.tsx' --include='*.html' --include='*.jsx' -E "$BANNED_CLASSES" src/ 2>/dev/null; then
  echo "  ✗ Found banned size classes (nothing below 14px / text-sm)"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "  ✓ No banned size classes"
fi

# 2. Check raw CSS for sub-14px font-size declarations
echo "Checking for sub-14px font-size in CSS..."
BANNED_CSS='font-size:\s*(1[0-3]px|0\.7[0-9]*rem|0\.6[0-9]*rem)'
if grep -rn --include='*.css' -E "$BANNED_CSS" src/ 2>/dev/null; then
  echo "  ✗ Found sub-14px font-size declarations"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "  ✓ No sub-14px font-size declarations"
fi

# 3. Check that only approved text-size classes are used
echo "Checking for off-scale Tailwind sizes..."
# Approved: text-sm (14), text-base (16, explicit), text-2xl (24), text-5xl (48 cost display)
# Also allow: text-center, text-left, text-right (alignment not size),
#             text-[var(--*)] (custom property references), text-inherit
ALLOWED='text-sm|text-2xl|text-5xl|text-base|text-center|text-left|text-right|text-\[var\(|text-inherit'
OFF_SCALE=$(grep -rn --include='*.tsx' --include='*.jsx' -oE 'text-[a-z0-9\[\]]+' src/ 2>/dev/null | grep -vE "$ALLOWED" || true)
if [ -n "$OFF_SCALE" ]; then
  echo "$OFF_SCALE"
  echo "  ✗ Found text sizes outside the 14/16/24 scale"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo "  ✓ All text sizes on scale"
fi

# Summary
echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAIL: $VIOLATIONS type scale violation(s) found."
  echo ""
  echo "Allowed sizes:"
  echo "  14px  text-sm       footer, labels, metadata, state indicators"
  echo "  16px  (default)     body text, inputs, buttons, FAQ, form fields"
  echo "  24px  text-2xl      page title, section headings, elapsed time"
  echo "  48px  text-5xl      cost display only"
  echo ""
  echo "Banned: text-xs, text-2xs, anything below 14px."
  exit 1
fi

echo "PASS: Type scale is consistent."
exit 0

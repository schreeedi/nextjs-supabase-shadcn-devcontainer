#!/usr/bin/env bash
# Merge gate: code only reaches `main` after /security-review ran over it.
#
#   check  PreToolUse hook (Bash, see .claude/settings.json): reads the hook
#          JSON from stdin and blocks `gh pr merge`, `git push … main` and
#          `git merge` while on main, unless the current HEAD was reviewed.
#   mark   run after the review: records the reviewed HEAD commit.
#
# Every new commit afterwards needs a new review before the merge.
set -euo pipefail

MAIN="${SECURITY_GATE_BRANCH:-main}"

# Command start: line start or after ; & | ( { $( — optionally with VAR=x prefixes.
PRE='(^|[;&|({]|\$\()[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*'
# git global options such as -C dir or --no-pager
GITOPTS='([[:space:]]+-[Cc][[:space:]]+[^[:space:]]+|[[:space:]]+--?[A-Za-z][A-Za-z-]*(=[^[:space:]]+)?)*'
PR_MERGE_RE="${PRE}gh[[:space:]]+pr[[:space:]]+merge([[:space:]]|$)"
PUSH_MAIN_RE="${PRE}git${GITOPTS}[[:space:]]+push[[:space:]][^;&|]*\b${MAIN}\b"
MERGE_RE="${PRE}git${GITOPTS}[[:space:]]+merge([[:space:]]|$)"

marker_file() { printf '%s/security-review-ok' "$(git rev-parse --git-common-dir)"; }

# JSON via node (always present in this stack; jq may not be installed).
json_field() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s)?.[process.argv[1]]?.[process.argv[2]]??JSON.parse(s)?.[process.argv[1]];process.stdout.write(typeof v==="string"?v:"")})' "$@"; }

deny() {
  node -e 'console.log(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:process.argv[1]}}))' "$1"
  exit 0
}

case "${1:-}" in
  check)
    input="$(cat)"
    cmd="$(json_field tool_input command <<<"$input")"
    cwd="$(json_field cwd <<<"$input")"
    [[ -n "$cwd" ]] && cd "$cwd"
    git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
    gated=0
    grep -Eq "$PR_MERGE_RE" <<<"$cmd" && gated=1
    grep -Eq "$PUSH_MAIN_RE" <<<"$cmd" && gated=1
    if grep -Eq "$MERGE_RE" <<<"$cmd" && [[ "$(git branch --show-current)" == "$MAIN" ]]; then
      gated=1
    fi
    ((gated)) || exit 0
    reviewed="$(cat "$(marker_file)" 2>/dev/null || true)"
    [[ -n "$reviewed" && "$(git rev-parse HEAD)" == "$reviewed" ]] ||
      deny "Merge/push to $MAIN blocked: the current HEAD has no security review. Run the /security-review skill over the changes, fix or report the findings, then run \`.claude/hooks/security-review-gate.sh mark\` and retry. Every new commit afterwards needs a new review."
    ;;
  mark)
    sha="$(git rev-parse HEAD)"
    printf '%s\n' "$sha" >"$(marker_file)"
    echo "security review recorded for $(git branch --show-current)@${sha:0:12}"
    ;;
  *)
    echo "usage: $0 check|mark" >&2
    exit 64
    ;;
esac

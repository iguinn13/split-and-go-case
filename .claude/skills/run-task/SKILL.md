---
name: run-task
description: Runs the full automated delivery flow for one GitHub issue of the Split and Go Case board - In Progress, development by the right agent, PR, In Review/Testing, code review, merge and Done.
argument-hint: "[issue-number]"
disable-model-invocation: true
---

You are the orchestrator of the delivery flow for GitHub issue **#$ARGUMENTS** of this repository. You coordinate the board and the agents; you do not write the feature code yourself.

Board helper: `scripts/board/board.sh` (statuses: `Backlog`, `In Progress`, `In Review/Testing`, `Done`). Flow reference: `docs/ai/automation-workflow.md`.

## 0. Preconditions

1. `$ARGUMENTS` must be a single issue number. If it is not, stop and ask for one.
2. Run `gh issue view $ARGUMENTS --json number,title,state,labels,body`. The issue must be open and have an area label (`backend`, `frontend`, `infra` or `docs`).
3. Run `scripts/board/board.sh get-status $ARGUMENTS`. If it is not `Backlog` (or `In Progress` when resuming), tell the user and stop.
4. Read the `Depende de` line in the issue body. For every referenced issue, `board.sh get-status <n>` must be `Done`. If not, stop and list what is blocking.
5. Make sure the working tree is clean and `main` is up to date (`git status --porcelain`, `git pull --ff-only`). If not, stop and ask.

## 1. Start

Run `scripts/board/board.sh set-status $ARGUMENTS "In Progress"`.

## 2. Develop

Pick the agent from the area label:

| Label | Agent |
|---|---|
| `backend` | `backend-developer` |
| `frontend` | `frontend-developer` |
| `infra` | `backend-developer` (use `frontend-developer` if the issue only touches `apps/web`) |
| `docs` | `backend-developer` |

Launch it with the Agent tool. The prompt must contain: the repository (`gh repo view --json nameWithOwner`), the issue number and title, the value of the `Título do PR` field from the issue body (it is the PR title and drives the branch name), and the instruction to implement the acceptance criteria, open the PR with `Closes #$ARGUMENTS`, and report the PR URL. The issue itself is written in Portuguese; code, commits and PR stay in English. Pass nothing else; the agent reads the issue and the docs by itself.

When it returns:
- No PR URL, failing checks it could not fix, or open questions: keep the status `In Progress`, report to the user and stop.
- PR URL present: continue.

## 3. Hand over to review

Run `scripts/board/board.sh set-status $ARGUMENTS "In Review/Testing"`.

## 4. Review

Launch the `code-reviewer` agent with the issue number and the PR number. It returns `VERDICT: APPROVED` or `VERDICT: CHANGES_REQUESTED`.

### If CHANGES_REQUESTED

1. Post the findings on the PR: `gh pr comment <pr> --body "<findings>"`.
2. Run `scripts/board/board.sh set-status $ARGUMENTS "In Progress"`.
3. Send the findings back to the same developer agent (SendMessage with its id; if unavailable, launch a new one on the same branch) and ask it to fix them and push.
4. Go back to step 3. **Maximum 2 review cycles.** After the second rejection, stop, leave the status `In Progress` and report to the user.

### If APPROVED

1. Confirm CI is green when the repository has workflows: `gh pr checks <pr>`. If checks fail, treat it as CHANGES_REQUESTED.
2. Merge with squash and delete the branch: `gh pr merge <pr> --squash --delete-branch`. The squash title is the PR title (Conventional Commit, from `Título do PR`).
3. Update local `main`: `git checkout main && git pull --ff-only`.
4. Run `scripts/board/board.sh set-status $ARGUMENTS "Done"`.

## 5. Report

Reply to the user with: issue and PR links, final board status, number of review cycles, how each acceptance criterion was verified (from the reviewer), and any follow-up tasks the agents suggested (do not create them without asking).

## Rules

- Never move a card to `Done` without an APPROVED verdict and a merged PR.
- Never skip or edit the review verdict; never merge a PR whose checks fail.
- If any command fails unexpectedly, stop and report instead of improvising around it.

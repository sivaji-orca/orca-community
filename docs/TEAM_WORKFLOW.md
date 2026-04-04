# Team Workflow

This document describes the branching model, merge pipeline, and day-to-day workflow for the Orca Community Edition core team.

---

## Repo Governance

The repository is **public** -- anyone can discover, clone, and fork the code. Write access is controlled through branch protection rules:

- **`main`** is protected: requires a pull request, passing CI (backend tests + frontend lint/build/tests), and at least 1 approving review before merging.
- No one pushes directly to `main` -- not even the owner.
- External contributors can fork and submit PRs, but nothing merges without owner approval.

---

## Branching Model

```
main                    (protected, production-ready)
 ├── dev/sivaji          (owner's working branch)
 ├── dev/sathish         (contributor branch)
 └── dev/rajiv           (contributor branch)
```

### Branch Roles

| Branch | Owner | Purpose |
|--------|-------|---------|
| `main` | Protected | Production-ready code. All merges via PR with CI + review. |
| `dev/sivaji` | Sivaji | Owner's working branch. Pushes directly, PRs to `main` when ready. |
| `dev/sathish` | Sathish | Contributor's integration branch. Receives PRs from Sathish's fork. |
| `dev/rajiv` | Rajiv | Contributor's integration branch. Receives PRs from Rajiv's fork. |

### Feature Branches

Short-lived branches for individual tasks, following this naming convention:

| Type | Prefix | Example |
|------|--------|---------|
| Bug fix | `fix/` | `fix/port-conflict-on-startup` |
| Feature | `feature/` | `feature/api-response-time-chart` |
| Documentation | `docs/` | `docs/windows-setup-instructions` |
| DX improvement | `dx/` | `dx/better-java-version-error` |
| Refactor | `refactor/` | `refactor/health-check-consolidation` |
| Test | `test/` | `test/deploy-endpoint-integration` |

---

## Merge Pipeline

### For Contributors (Sathish, Rajiv)

**Stage 1: Fork to dev branch**

1. Create a feature branch in your fork
2. Make your changes and test locally
3. Open a PR from your fork's feature branch to your `dev/<name>` branch in the upstream repo
4. CI runs automatically
5. Owner reviews and merges into your dev branch

**Stage 2: Dev to main**

1. When a batch of work is ready, the owner opens a PR from `dev/<name>` to `main`
2. Full CI must pass
3. Owner squash-merges into `main`

### For the Owner (Sivaji)

1. Work on `dev/sivaji` -- push directly or merge local feature branches
2. When ready, open a PR from `dev/sivaji` to `main`
3. CI must pass, then merge

---

## Step-by-Step: Contributor Workflow

### Initial Setup (one-time)

```bash
# 1. Fork the repo on GitHub (click the "Fork" button)

# 2. Clone your fork
git clone https://github.com/<your-username>/orca-community.git
cd orca-community

# 3. Add upstream remote
git remote add upstream https://github.com/sivaji-orca/orca-community.git

# 4. Fetch all branches
git fetch upstream

# 5. Track your dev branch
git checkout -b dev/<your-name> upstream/dev/<your-name>
```

### Working on a Task

```bash
# 1. Make sure your dev branch is up to date
git checkout dev/<your-name>
git fetch upstream
git rebase upstream/dev/<your-name>

# 2. Create a feature branch
git checkout -b fix/descriptive-name

# 3. Make your changes, test locally
cd backend && bun test
cd ../frontend && bun run test && bun run lint

# 4. Commit with conventional format
git add -A
git commit -m "fix(backend): resolve port 3003 conflict"

# 5. Push to your fork
git push origin fix/descriptive-name

# 6. Open a PR on GitHub
#    Base: sivaji-orca/orca-community  dev/<your-name>
#    Compare: <your-fork>  fix/descriptive-name
```

### Keeping in Sync

```bash
# Sync your dev branch with upstream
git checkout dev/<your-name>
git fetch upstream
git rebase upstream/dev/<your-name>

# Sync your dev branch with main (when main has new changes)
git fetch upstream
git rebase upstream/main
git push origin dev/<your-name> --force-with-lease
```

---

## Step-by-Step: Owner Workflow

### Day-to-Day Development

```bash
# Work on dev/sivaji
git checkout dev/sivaji

# Create a feature branch (optional, for larger changes)
git checkout -b feature/new-dashboard-tab

# ... make changes, test ...

# Merge back into dev/sivaji
git checkout dev/sivaji
git merge feature/new-dashboard-tab
git branch -d feature/new-dashboard-tab
git push origin dev/sivaji
```

### Merging a Contributor's Work to Main

```bash
# 1. Review the PR from dev/<contributor> to main on GitHub
# 2. Ensure CI passes
# 3. Squash and merge via GitHub UI

# Or via CLI:
gh pr create --base main --head dev/sathish --title "feat: merge Sathish's dashboard improvements"
gh pr merge <pr-number> --squash
```

### Keeping Dev Branches in Sync with Main

After merging to main, sync the dev branches:

```bash
# Update all dev branches to include latest main
git checkout dev/sivaji && git rebase main && git push origin dev/sivaji --force-with-lease
git checkout dev/sathish && git rebase main && git push origin dev/sathish --force-with-lease
git checkout dev/rajiv && git rebase main && git push origin dev/rajiv --force-with-lease
```

---

## CI Pipeline

CI runs automatically on:
- Pushes to `main` and all `dev/**` branches
- Pull requests targeting `main` or any `dev/**` branch

**Checks:**
- Backend tests (`cd backend && bun test`)
- Frontend lint (`cd frontend && bun run lint`)
- Frontend type check (`bunx tsc -b --noEmit`)
- Frontend tests (`cd frontend && bun run test`)
- Frontend build (`cd frontend && bun run build`)

All checks must pass before a PR can be merged to `main`.

---

## Team Members

| Name | GitHub | Branch | Role |
|------|--------|--------|------|
| Sivaji | [@sivaji-orca](https://github.com/sivaji-orca) | `dev/sivaji` | Owner / Maintainer |
| Sathish | [@sathish-aidev](https://github.com/sathish-aidev) | `dev/sathish` | Contributor |
| Rajiv | TBD | `dev/rajiv` | Contributor |
| Narendra | TBD | `dev/narendra` | Contributor |
| Srinivas | TBD | `dev/srinivas` | Contributor |
| Leela | TBD | `dev/leela` | Contributor |
| Sivaji Nandimandalam | TBD | `dev/sivajinandimandalam` | Contributor |

---

## Quick Reference

| Action | Command |
|--------|---------|
| Sync with upstream | `git fetch upstream && git rebase upstream/main` |
| Create feature branch | `git checkout -b fix/description` |
| Run all tests | `cd backend && bun test && cd ../frontend && bun run test` |
| Push feature branch | `git push origin fix/description` |
| Create PR (CLI) | `gh pr create --base dev/<name> --head fix/description` |

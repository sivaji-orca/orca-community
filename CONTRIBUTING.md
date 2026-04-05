# Contributing to Orca Community Edition

Thank you for your interest in contributing! Whether you hit a roadblock during setup, found a bug, improved the docs, or have an idea for the next version -- every contribution matters.

---

## Table of Contents

- [Types of Contributions](#types-of-contributions)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
  - [Community Contributors](#community-contributors)
  - [Team Contributors](#team-contributors)
  - [Release Branches](#release-branches)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Process](#pull-request-process)
- [Code Guidelines](#code-guidelines)
- [Testing](#testing)
- [Cursor AI Rules](#cursor-ai-rules)
- [Issue Guidelines](#issue-guidelines)
- [Community](#community)

---

## Types of Contributions

| Type | Branch Prefix | Label | Example |
|------|--------------|-------|---------|
| Bug fix | `fix/` | `bug` | Fix port conflict on startup |
| New feature | `feature/` | `enhancement` | Add CloudHub 2.0 deployment status |
| Documentation | `docs/` | `documentation` | Improve setup instructions for Windows |
| DX improvement | `dx/` | `dx` | Better error messages in setup.sh |
| Refactor | `refactor/` | `refactor` | Consolidate API health check logic |
| Test | `test/` | `test` | Add integration tests for deploy endpoint |

Not sure which type? Open an issue first and we'll figure it out together.

---

## Getting Started

### 1. Fork and Clone

```bash
# Fork via GitHub UI, then:
git clone https://github.com/<your-username>/orca-community.git
cd orca-community
git remote add upstream https://github.com/sivaji-orca/orca-community.git
```

### 2. Set Up Your Environment

```bash
chmod +x scripts/*.sh
./scripts/setup.sh
```

This checks prerequisites (Java 17+, Maven 3.8+, Bun, Git), installs dependencies, and seeds the local database.

**Prerequisites:**

| Tool | Version | Install (macOS) |
|------|---------|----------------|
| Java | 17+ | `brew install openjdk@17` |
| Maven | 3.8+ | `brew install maven` |
| Bun | latest | `curl -fsSL https://bun.sh/install \| bash` |
| Git | latest | `brew install git` |

### 3. Create a Branch

```bash
git checkout -b fix/descriptive-name   # for bug fixes
git checkout -b feature/descriptive-name  # for features
git checkout -b docs/descriptive-name     # for documentation
```

### 4. Make Your Changes

- Backend code lives in `backend/src/`
- Frontend code lives in `frontend/src/`
- MuleSoft projects live in `projects/`
- Documentation lives in `docs/` and root markdown files
- Cursor AI rules live in `.cursor/rules/`
- Shell scripts live in `scripts/`

### 5. Test Your Changes

```bash
# Backend tests
cd backend && bun test

# Frontend tests
cd frontend && bun run test

# Frontend lint
cd frontend && bun run lint
```

All checks must pass before submitting a PR. The CI pipeline runs these automatically.

---

## Development Workflow

### Community Contributors

If you're contributing from the community (not a core team member), fork and PR directly to `main`:

```
main (protected)
 │
 ├── feature/new-deploy-status    ← your feature branch (in your fork)
 ├── fix/port-conflict            ← your bug fix branch (in your fork)
 └── docs/windows-setup           ← your docs branch (in your fork)
```

1. Always branch from the latest `main`
2. Keep branches focused -- one issue per branch
3. Sync with upstream before submitting a PR:

```bash
git fetch upstream
git rebase upstream/main
```

### Team Contributors

Core team members use a two-stage PR flow through dedicated `dev/<name>` branches. See [docs/TEAM_WORKFLOW.md](docs/TEAM_WORKFLOW.md) for the full guide.

```
main (protected, production)
 ├── dev/sivaji              ← owner's working branch
 ├── dev/sathish             ← Sathish
 ├── dev/rajiv               ← Rajiv
 ├── dev/leela               ← Leela
 ├── dev/narendra            ← Narendra
 ├── dev/srinivas            ← Srinivas
 ├── dev/sivajinandimandalam ← Sivaji Nandimandalam
 ├── dev/arjun               ← Arjun
 ├── dev/mahesh              ← Mahesh
 ├── dev/rakesh              ← Rakesh
 └── dev/arun                ← Arun
```

1. Fork the repo or work directly on your `dev/<name>` branch
2. Create feature branches from your `dev/<name>` branch
3. PR your feature branch to your `dev/<name>` branch in upstream
4. Owner reviews and merges `dev/<name>` to `main` when ready

### Release Branches

Product-specific release branches are used to accumulate features for a particular domain before merging into `main`. When working on a feature tied to a specific product area, branch from and PR into the corresponding release branch.

| Branch | Scope | Examples |
|--------|-------|---------|
| `release/mulesoft` | MuleSoft runtime, API scaffolding, deployment | New project templates, CloudHub deploy, runtime management |
| `release/salesforce` | Salesforce DevTools, SOQL, Record Browser | Schema Explorer, NLP-to-SOQL, Org Inspector |
| `release/kafka` | Confluent Cloud, Kafka streaming, CDC sync | Topic management, consumer flows, Schema Registry |
| `release/cursor` | Cursor AI integration, agent workflows | AI rules, onboarding automation, agent handoff |
| `release/ai` | NLP-to-SOQL, LLM features, AI tooling | LLM provider config, prompt engineering, template matching |

**Workflow:**

```
main (protected)
 ├── release/mulesoft    ← MuleSoft features accumulate here
 │    ├── feature/new-deploy-target
 │    └── fix/runtime-startup
 ├── release/salesforce  ← Salesforce features accumulate here
 │    ├── feature/bulk-record-edit
 │    └── fix/soql-pagination
 ├── release/kafka       ← Kafka features accumulate here
 ├── release/cursor      ← Cursor AI features accumulate here
 └── release/ai          ← AI/LLM features accumulate here
```

1. Branch from the relevant `release/*` branch
2. PR into the `release/*` branch for review
3. Once a release branch has a stable set of features, the owner merges it into `main`

---

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

<optional body>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `dx`

**Scopes:** `backend`, `frontend`, `scripts`, `deploy`, `postman`, `git`, `docs`, `ci`

**Examples:**

```
feat(frontend): add API response time chart to Analytics tab
fix(backend): resolve port 3003 conflict when process already running
docs(setup): add Windows/WSL prerequisite instructions
dx(scripts): show clear error when Java version < 17
test(backend): add health endpoint integration tests
```

---

## Pull Request Process

**Community contributors:** Open a PR against `main`.
**Team contributors:** Open a PR against your `dev/<name>` branch (the owner merges dev to main).

1. **Open a PR** with a clear title following the commit convention
2. **Fill out the PR template** -- describe what changed, how to test, and link related issues
3. **CI must pass** -- backend tests, frontend tests, lint, and build
4. **A maintainer will review** within 48 hours
5. **Address feedback** -- push new commits (don't force-push during review)
6. **Squash and merge** -- the maintainer will merge using squash

### PR Checklist

Before submitting, confirm:

- [ ] Branch is up-to-date with `main`
- [ ] `cd backend && bun test` passes
- [ ] `cd frontend && bun run test` passes
- [ ] `cd frontend && bun run lint` passes
- [ ] New features have documentation
- [ ] Commit messages follow the convention

---

## Code Guidelines

### Backend (Express.js / Bun)

- Use `async/await` over callbacks
- Return consistent JSON response shapes: `{ success: true, data: ... }` or `{ success: false, error: ... }`
- SQLite queries go through the existing database helper in `backend/src/database/`
- API routes are grouped by feature under `backend/src/routes/`

### Frontend (React / Vite)

- Components use functional style with hooks
- Use the existing shadcn/ui component library -- don't add new UI frameworks
- State management uses React hooks (no Redux)
- Follow existing file naming: `PascalCase` for components, `camelCase` for utilities

### Scripts (Bash)

- Start with `#!/usr/bin/env bash` and `set -euo pipefail`
- Use functions for reusable logic
- Print colored status messages using the existing helper functions in `scripts/`
- Always check for required tools before using them

---

## Testing

### Backend

Tests live in `backend/src/__tests__/` and use Bun's built-in test runner:

```bash
cd backend && bun test
```

When adding a new API endpoint, add a corresponding test file.

### Frontend

Tests live in `frontend/src/__tests__/` and use Vitest:

```bash
cd frontend && bun run test
```

When adding a new component or page, add a corresponding test file.

---

## Cursor AI Rules

One of the unique aspects of this project is AI-assisted development via Cursor IDE rules (`.cursor/rules/*.mdc`).

If your contribution introduces a new MuleSoft pattern, deployment workflow, or development convention, consider adding a Cursor rule so the AI can guide future developers:

```yaml
---
description: When this rule should activate
globs: ["relevant/file/patterns/**"]
---

Your guidance for the AI agent here.
```

See existing rules in `.cursor/rules/` for examples.

---

## Issue Guidelines

### Reporting a Bug

Use the **Bug Report** template. Include:

- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Java version, Bun version)
- Relevant logs

### Suggesting a Feature

Use the **Feature Request** template. Describe:

- The problem it solves
- Your proposed solution
- Any alternatives you considered

### Reporting a Roadblock / DX Issue

Use the **Documentation & DX Improvement** template for:

- Confusing setup steps
- Missing documentation
- Unclear error messages
- Suggestions to improve the developer experience

These are incredibly valuable -- they help us make Orca easier for the next developer.

---

## Community

- **GitHub Issues** -- bug reports, feature requests, DX feedback
- **GitHub Discussions** -- questions, ideas, show & tell
- **Email** -- [community@orcaesb.com](mailto:community@orcaesb.com)
- **Website** -- [orcaesb.com](https://orcaesb.com)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold a welcoming, inclusive, and respectful community.

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

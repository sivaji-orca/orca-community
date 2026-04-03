# Orca Community Edition

[![CI](https://github.com/sivaji-orca/orca-community/actions/workflows/ci.yml/badge.svg)](https://github.com/sivaji-orca/orca-community/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-green.svg)](CHANGELOG.md)

**Open-source MuleSoft Developer Productivity Tool** — a cloneable Git repository that any MuleSoft team can fork, configure, and run alongside Cursor IDE for end-to-end API lifecycle management.

> Part of the [Orca](https://orcaesb.com) product family. Looking for team collaboration, cloud dashboards, and managed Anypoint/Salesforce integrations? Check out [Orca Cloud](https://orcaesb.com/pricing).

---

## What You Get

| Component | Description |
|-----------|-------------|
| **customer-papi** (port 8081) | Process API — client-facing orchestrator with bidirectional sync |
| **customer-management-api** (port 8082) | System API — CRUD on MuleSoft Object Store |
| **customer-sf-sapi** (port 8083) | System API — Salesforce Account connector |
| **customer-mock-service** (port 8084) | Mock — simulates Salesforce for local development |
| **Dashboard** (port 5173/3003) | React + Express web UI for monitoring, deploying, and managing APIs |
| **Cursor AI Rules** | `.cursor/rules/` files that teach Cursor your MuleSoft project patterns |

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/sivaji-orca/orca-community.git
cd orca-community

# 2. Run setup (checks prereqs, installs deps, seeds database)
chmod +x scripts/*.sh
./scripts/setup.sh

# 3. Configure your credentials
cp config.template.yaml config.yaml
# Edit config.yaml with your Anypoint Platform credentials
./scripts/configure.sh

# 4. Build all MuleSoft APIs
./scripts/build-all.sh

# 5. Start everything
./scripts/start.sh

# 6. Open dashboard
open http://localhost:5173
```

**Default login credentials:**

| Role | Username | Password |
|------|----------|----------|
| Administrator | `admin` | `admin` |
| Developer | `developer` | `developer` |

### Docker Quick Start

If you prefer Docker (dashboard only, without Mule Runtime):

```bash
docker-compose up --build
open http://localhost:3003
```

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Java | 17+ | MuleSoft runtime requirement |
| Maven | 3.8+ | Build MuleSoft projects, download Mule runtime |
| Bun | latest | Dashboard backend/frontend runtime |
| Git | latest | Version control |
| Salesforce CLI | latest | SF org management (optional) |
| Cursor IDE | latest | AI-powered development (recommended) |

See [detailed installation instructions](docs/PREREQUISITES.md) for each tool. Having issues? Check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md).

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Orca Dashboard                       │
│           React Frontend (5173) ←→ Express (3003)     │
└───────────────────────┬──────────────────────────────┘
                        │ manage / monitor
┌───────────────────────▼──────────────────────────────┐
│               customer-papi (8081)                    │
│            Process API — Orchestration                │
└────────┬──────────────────────────┬──────────────────┘
         │                          │
┌────────▼──────────┐    ┌─────────▼─────────────────┐
│ customer-mgmt-api │    │ customer-sf-sapi (8083)    │
│     (8082)        │    │ System API — Salesforce    │
│ System API — CRUD │    │                            │
└───────────────────┘    │ local → mock (8084)        │
                         │ cloud → real SF org        │
                         └─────────┬─────────────────┘
                                   │ (local dev only)
                         ┌─────────▼─────────────────┐
                         │ customer-mock-service      │
                         │     (8084)                 │
                         └───────────────────────────┘
```

---

## Customization

### Adding Your Own API

1. Create a new Maven project under `projects/`
2. Copy `pom.xml` from an existing API
3. Design your RAML spec
4. Implement your flows
5. Add to `scripts/build-all.sh`

### Extending Cursor AI Rules

Add `.mdc` files to `.cursor/rules/` to teach Cursor your patterns:

```yaml
---
description: When this rule applies
globs: ["patterns/to/match/**"]
---

Your rule content here.
```

---

## Running Tests

```bash
# Backend tests (Bun)
cd backend && bun test

# Frontend tests (Vitest)
cd frontend && bun run test
```

---

## Upgrade to Orca Cloud

Need team collaboration, centralized dashboards, or managed integrations?

- **Orca Cloud** — SaaS platform for MuleSoft teams at [orcaesb.com](https://orcaesb.com)
- **Orca Professional Services** — custom integrations and training

Contact **sales@orcaesb.com** to discuss your needs.

---

## Project Structure

```
orca-community/
├── .cursor/rules/          # Cursor AI context rules
├── .github/workflows/      # CI/CD pipeline
├── backend/                # Express.js dashboard API (port 3003)
│   └── src/__tests__/      # Backend unit tests (Bun)
├── frontend/               # React dashboard UI (port 5173)
│   └── src/__tests__/      # Frontend component tests (Vitest)
├── projects/               # MuleSoft API workspaces
│   ├── customer-papi/
│   ├── customer-management-api/
│   ├── customer-sf-sapi/
│   └── customer-mock-service/
├── softwares/              # Mule runtime (auto-downloaded)
├── scripts/                # Setup, configure, build, start, stop
├── docs/                   # Prerequisites, troubleshooting
├── config.template.yaml    # Template (checked into Git)
├── Dockerfile              # Container build
├── docker-compose.yml      # Container orchestration
├── CHANGELOG.md            # Version history
└── README.md               # This file
```

---

## Community & Contributing

We welcome contributions of all kinds -- bug fixes, features, documentation improvements, and DX feedback.

| Resource | Description |
|----------|-------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Full contribution guide (fork, branch, PR workflow) |
| [Team Workflow](docs/TEAM_WORKFLOW.md) | Branching model and merge pipeline for core team |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards |
| [SECURITY.md](SECURITY.md) | How to report vulnerabilities |
| [GitHub Issues](https://github.com/sivaji-orca/orca-community/issues) | Bug reports, feature requests, DX feedback |
| [GitHub Discussions](https://github.com/sivaji-orca/orca-community/discussions) | Questions, ideas, show & tell |

First time contributing? Check out the issue templates -- especially **Documentation & DX Improvement** for sharing roadblocks you hit during setup.

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

---

Built with care by [Orca](https://orcaesb.com)

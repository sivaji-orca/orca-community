# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Orca Community Edition, **please do not open a public issue**.

Instead, report it privately by emailing **[security@orcaesb.com](mailto:security@orcaesb.com)** with:

- A description of the vulnerability
- Steps to reproduce or a proof of concept
- The affected component (backend, frontend, scripts, Docker, etc.)
- Any potential impact you've identified

## Response Timeline

- **Acknowledgement**: Within 48 hours of your report
- **Assessment**: Within 1 week we'll provide an initial assessment
- **Fix**: Critical vulnerabilities will be patched as soon as possible

## Scope

This policy covers the `orca-community` repository including:

- Backend Express.js API (`backend/`)
- Frontend React application (`frontend/`)
- Shell scripts (`scripts/`)
- Docker configuration (`Dockerfile`, `docker-compose.yml`)
- GitHub Actions CI/CD (`.github/workflows/`)

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x (current) | Yes |

## Responsible Disclosure

We kindly ask that you give us reasonable time to address the issue before disclosing it publicly. We're committed to acknowledging contributors who help us improve security.

## Security Best Practices for Users

- Never commit `config.yaml` or `.env` files with real credentials to public forks
- Rotate default admin/developer passwords after initial setup
- Run the dashboard behind a reverse proxy if exposing it beyond localhost
- Keep Java, Maven, and Bun up to date

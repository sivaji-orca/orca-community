# Changelog

All notable changes to Orca Community Edition will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-28

### Added

- **Dashboard**: 11-tab developer dashboard (Overview, API Design, Projects, New Project, Deploy, Monitoring, Logs, Analytics, Postman, Git, Settings)
- **Admin Panel**: Team management and encrypted secrets vault
- **API Health Monitoring**: Real-time health probes for all 4 sample APIs (ports 8081-8084)
- **API Metrics**: 24-hour analytics with request counts, success rates, error tracking, and response times
- **Runtime Log Viewer**: Live log streaming from Mule Runtime with level filtering and search
- **Project Scaffold Wizard**: Step-by-step project creation with Git, GitHub, deploy, and Postman automation
- **Postman Integration**: Auto-generate collections and environments from API specs
- **Git Integration**: Init, commit, push, and GitHub PR creation from the dashboard
- **Local Deploy**: One-click deployment to local Mule Runtime
- **CloudHub Deploy**: Deploy to Anypoint CloudHub 2.0 with status tracking
- **Salesforce Connector**: Health monitoring and org connection management
- **Sample APIs**: 4 pre-built MuleSoft applications (customer-papi, customer-management-api, customer-sf-sapi, customer-mock-service)
- **Cursor AI Rules**: 5 `.mdc` rule files for MuleSoft-aware AI assistance
- **Shell Scripts**: Automated setup, configure, build, start, and stop scripts
- **Docker Support**: Dockerfile and docker-compose.yml for containerized deployment
- **CI/CD**: GitHub Actions workflow for automated testing and builds
- **Automated Tests**: Backend tests (Bun) and frontend tests (Vitest)
- **Documentation**: Prerequisites guide, troubleshooting guide, contributing guide

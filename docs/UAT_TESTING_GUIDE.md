# Orca Community Edition V2 -- UAT Testing Guide

This document is the single source of truth for User Acceptance Testing of Orca Community Edition V2. It walks the UAT tester through every prerequisite account, credential capture step, environment setup, onboarding flow, and feature test case.

---

## Table of Contents

1. [Account Setup Instructions](#1-account-setup-instructions)
2. [Credential Collection Checklist](#2-credential-collection-checklist)
3. [Environment Setup](#3-environment-setup)
4. [Onboarding Walkthrough](#4-onboarding-walkthrough)
5. [Feature Test Matrix](#5-feature-test-matrix)
6. [Bug Reporting Template](#6-bug-reporting-template)

---

## 1. Account Setup Instructions

Create the following accounts **before** starting UAT. Each subsection lists the signup URL, recommended plan, exact steps to generate credentials, and which Orca field the value maps to.

### 1.1 MuleSoft Anypoint Platform

| Detail | Value |
|--------|-------|
| Signup URL | https://anypoint.mulesoft.com/login/signup |
| Plan | Free 30-day trial (sufficient for UAT) |

**Steps:**

1. Sign up and verify your email.
2. Log in to Anypoint Platform.
3. Go to **Access Management > Connected Apps**.
4. Click **Create a Connected App**.
5. Choose **App acts on its own behalf (client credentials)**.
6. Give it a name (e.g. `orca-uat`), grant scopes: `Design Center Developer`, `CloudHub Developer`, `Exchange Contributor`.
7. After creation, copy the **Client ID** and **Client Secret**.
8. Go to **Access Management > Organization** and copy the **Organization ID**.
9. Note your target environment name (e.g. `Sandbox`).

| Orca Field | What to Enter |
|------------|---------------|
| `anypoint_client_id` | Client ID from step 7 |
| `anypoint_client_secret` | Client Secret from step 7 |
| `anypoint_org_id` | Organization ID from step 8 |

### 1.2 Salesforce Developer Edition

| Detail | Value |
|--------|-------|
| Signup URL | https://developer.salesforce.com/signup |
| Plan | Free Developer Edition (permanent) |

**Steps:**

1. Sign up for a Developer Edition org.
2. After activation, log in to your org.
3. Note your **Instance URL** from the browser address bar (e.g. `https://yourorg.my.salesforce.com`).
4. Go to **Setup > My Personal Information > Reset My Security Token**.
5. Click **Reset Security Token** -- a new token is emailed to you.
6. Create some sample data: at least 5 Accounts and 5 Contacts (for testing SOQL queries and Record Browser).

| Orca Field | What to Enter |
|------------|---------------|
| `salesforce_instance_url` | Your org URL (e.g. `https://yourorg.my.salesforce.com`) |
| `salesforce_username` | Your Salesforce login email |
| `salesforce_password` | Your Salesforce password |
| `salesforce_security_token` | Token from step 5 |

### 1.3 GitHub

| Detail | Value |
|--------|-------|
| Signup URL | https://github.com/signup |
| Plan | Free (sufficient for UAT) |

**Steps:**

1. Log in to GitHub.
2. Go to **Settings > Developer Settings > Personal Access Tokens > Tokens (classic)**.
3. Click **Generate new token (classic)**.
4. Give it a name (e.g. `orca-uat`), set expiration to 90 days.
5. Select the `repo` scope (full control of private repositories).
6. Click **Generate token** and **immediately copy it** (it won't be shown again).
7. Note your GitHub **username** (shown in top-right profile menu).

| Orca Field | What to Enter |
|------------|---------------|
| `github_username` | Your GitHub username |
| `github_token` | PAT from step 6 |

### 1.4 Postman

| Detail | Value |
|--------|-------|
| Signup URL | https://www.postman.com/postman-account/ |
| Plan | Free (sufficient for UAT) |

**Steps:**

1. Sign up or log in to Postman.
2. Click your avatar (top right) > **Account Settings**.
3. Go to the **API Keys** tab.
4. Click **Generate API Key**, name it `orca-uat`.
5. Copy the generated key.

| Orca Field | What to Enter |
|------------|---------------|
| `postman_api_key` | API key from step 5 |

### 1.5 Neon PostgreSQL

| Detail | Value |
|--------|-------|
| Signup URL | https://neon.tech |
| Plan | Free tier (sufficient) or Pro for no limits |

**Steps:**

1. Sign up with GitHub or email.
2. Click **New Project**, name it `orca-uat`, choose a region near you.
3. After creation, go to the **Dashboard** of your project.
4. Click the **Connection string** dropdown and copy the full `postgres://` connection string (with password visible).

| Orca Field | What to Enter |
|------------|---------------|
| `neon_database_url` | Full `postgres://...` connection string from step 4 |

### 1.6 Confluent Cloud (Kafka)

| Detail | Value |
|--------|-------|
| Signup URL | https://confluent.cloud/signup |
| Plan | Free trial ($400 credit) or Pro |

**Steps:**

1. Sign up and create an **Environment** (e.g. `orca-uat`).
2. Create a **Basic** or **Standard** Kafka cluster.
3. Go to **Cluster > API Keys > Create Key** (scope: cluster).
4. Copy the **API Key** and **API Secret**.
5. Go to **Cluster Overview > Cluster Settings** and copy the **Bootstrap server** URL.
6. Go to **Schema Registry** (under Environment).
7. Click **API credentials > Create key** for Schema Registry.
8. Copy the SR **API Key**, **API Secret**, and the **Endpoint URL**.

| Orca Field | What to Enter |
|------------|---------------|
| `kafka_bootstrap_servers` | Bootstrap server from step 5 |
| `kafka_api_key` | Cluster API key from step 4 |
| `kafka_api_secret` | Cluster API secret from step 4 |
| `kafka_schema_registry_url` | SR endpoint URL from step 8 |
| `kafka_sr_api_key` | SR API key from step 7 |
| `kafka_sr_api_secret` | SR API secret from step 7 |

### 1.7 LLM Provider (OpenAI or Anthropic)

| Detail | Value |
|--------|-------|
| OpenAI URL | https://platform.openai.com/api-keys |
| Anthropic URL | https://console.anthropic.com/settings/keys |
| Plan | Paid (pay-as-you-go; NLP-to-SOQL uses minimal tokens) |

**Steps (OpenAI):**

1. Log in to OpenAI Platform.
2. Go to **API Keys** and click **Create new secret key**.
3. Copy the key.

**Steps (Anthropic):**

1. Log in to Anthropic Console.
2. Go to **Settings > API Keys** and click **Create Key**.
3. Copy the key.

| Orca Field | Where to Enter |
|------------|----------------|
| `llm_provider` | `openai` or `anthropic` -- enter via **Settings > Secrets** (not onboarding) |
| `llm_api_key` | API key from step 3 -- enter via **Settings > Secrets** |
| `llm_model` | Optional (defaults: `gpt-4o` for OpenAI, `claude-sonnet-4-20250514` for Anthropic) |

> **Note:** LLM credentials are NOT part of the onboarding flow. Enter them after login via **Settings > Secrets > Add Secret**.

---

## 2. Credential Collection Checklist

Fill in this table as you create each account. Mark Status as Done when the credential is verified working.

| # | Service | Field | Your Value | Status |
|---|---------|-------|------------|--------|
| 1 | Anypoint | `client_id` | | |
| 2 | Anypoint | `client_secret` | | |
| 3 | Anypoint | `org_id` | | |
| 4 | Salesforce | `instance_url` | | |
| 5 | Salesforce | `username` | | |
| 6 | Salesforce | `password` | | |
| 7 | Salesforce | `security_token` | | |
| 8 | GitHub | `username` | | |
| 9 | GitHub | `token` (PAT) | | |
| 10 | Postman | `api_key` | | |
| 11 | Neon | `database_url` | | |
| 12 | Kafka | `bootstrap_servers` | | |
| 13 | Kafka | `api_key` | | |
| 14 | Kafka | `api_secret` | | |
| 15 | Kafka | `schema_registry_url` | | |
| 16 | Kafka | `sr_api_key` | | |
| 17 | Kafka | `sr_api_secret` | | |
| 18 | LLM | `provider` | | |
| 19 | LLM | `api_key` | | |

**Important:** Keep this table in a secure location. Never share tokens in plain text via email or chat.

---

## 3. Environment Setup

### Prerequisites

Ensure these are installed on your machine:

- **Bun** (v1.0+): https://bun.sh -- `curl -fsSL https://bun.sh/install | bash`
- **Git** (v2.30+): `git --version`
- **Java 17+**: `java -version` (needed for Mule Runtime and DataWeave)
- **Maven 3.8+**: `mvn -version` (needed for building Mule apps)

### Clone and Start

```bash
# 1. Clone the repository
git clone https://github.com/sivaji-orca/orca-community.git
cd orca-community

# 2. Install backend dependencies
cd backend && bun install

# 3. Seed the database (creates default users: admin/admin, developer/developer)
bun run seed

# 4. Start the backend (runs on port 3003)
bun run dev &

# 5. Install and start the frontend (runs on port 5173)
cd ../frontend && bun install
bun run dev &

# 6. Open in browser
open http://localhost:5173
```

### Verify Startup

- Backend health: `curl http://localhost:3003/api/system/prerequisites` should return JSON
- Frontend: browser should show either the Onboarding wizard (first run) or the Login screen

---

## 4. Onboarding Walkthrough

When you first open the app (or click "Run Setup Wizard Again" on the login screen), the onboarding wizard appears with 6 steps.

### Step 1: Brand

- Enter a custom app name (e.g. `UAT Test App`) or leave as `Orca Community Edition`
- Optionally enter a description
- Click **Continue**

### Step 2: Welcome

- Read the welcome message
- Click **Continue**

### Step 3: Prerequisites

- The system checks for installed tools (Java, Maven, Bun, Git)
- Required tools show green checkmarks; optional tools show yellow indicators
- If anything is missing, follow the provided install instructions
- Click **Continue** once required tools pass

### Step 4: Install

- Review optional tools (Mule Runtime, WireMock)
- These can be installed later -- click **Continue**

### Step 5: Configure

This is where you enter all your credentials. There are multiple tabs:

**Anypoint tab:**
- Client ID, Client Secret, Org ID from your Anypoint Connected App

**Salesforce tab:**
- Instance URL, Username, Password, Security Token

**Git & PM tab:**
- GitHub Username (this is your GitHub user or org name)
- GitHub Token (your PAT with `repo` scope)
- Postman API Key

**Neon tab** (if visible):
- Database URL (full postgres:// connection string)

**Kafka tab** (if visible):
- Bootstrap Servers, API Key, API Secret
- Schema Registry URL, SR API Key, SR API Secret

Click **Save Credentials** after entering each section, then **Continue**.

### Step 6: Ready

- If you entered a custom brand name AND a GitHub token, you'll see a **"Create My App Repo"** button
  - Clicking this creates a private GitHub repo, pushes the branded code, and protects the `main` branch
  - Wait for the green success message with the repo URL
- Click **Go to Dashboard** to proceed to the login screen

### Post-Onboarding: Add LLM Keys

1. Log in as **admin** (username: `admin`, password: `admin`)
2. Navigate to **Settings > Secrets**
3. Add these secrets manually:
   - Key: `llm_provider`, Value: `openai` (or `anthropic`), Category: `other`
   - Key: `llm_api_key`, Value: your API key, Category: `other`
   - Key: `llm_model`, Value: `gpt-4o` (or your preferred model), Category: `other`

---

## 5. Feature Test Matrix

### How to Use This Matrix

- **Test each case** by following the Steps column
- Mark **Pass/Fail** in the Result column
- If Fail, note the **Bug ID** and file a bug report (Section 6)
- Some tests require specific credentials -- see the Prereq column

### Legend

- **P** = Prerequisite credentials needed
- **AP** = Anypoint, **SF** = Salesforce, **GH** = GitHub, **PM** = Postman, **NE** = Neon, **KF** = Kafka, **LLM** = LLM key

---

### 5.1 Login and Session

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| L-01 | Developer login | Enter `developer` / `developer`, click Sign In | Dashboard loads, "Overview" tab visible | None | |
| L-02 | Admin login | Enter `admin` / `admin`, click Sign In | Admin dashboard loads with Team Management | None | |
| L-03 | Invalid credentials | Enter `wrong` / `wrong`, click Sign In | Error message shown, no redirect | None | |
| L-04 | Logout | Click Sign Out in header | Returns to login screen | None | |
| L-05 | Setup wizard link | On login screen, click "Run Setup Wizard Again" | Onboarding wizard starts from Brand step | None | |

### 5.2 Onboarding

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| O-01 | Complete brand step | Enter app name + description, click Continue | Advances to Welcome step, brand saved | None | |
| O-02 | Skip branding | Leave fields empty, click Continue | Uses default "Orca Community Edition" | None | |
| O-03 | Prerequisites check | Advance to Prerequisites step | Shows installed/missing tools with versions | None | |
| O-04 | Enter all credentials | Fill all fields in Configure step, click Save | Success message, credentials saved to vault | All | |
| O-05 | Create branded repo | On Ready step, click "Create My App Repo" | Spinner, then success with GitHub repo URL | GH | |
| O-06 | Skip repo creation | On Ready step, click "Go to Dashboard" directly | Proceeds to login without repo creation | None | |

### 5.3 Developer Dashboard -- Overview

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-01 | Overview loads | Log in as developer | Overview tab renders with stats | None | |
| D-02 | Quick navigation | Click any quick-link card in Overview | Navigates to the correct tab | None | |

### 5.4 API Design

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-03 | Tab renders | Click "API Design" tab | RAML editor or design interface loads | None | |

### 5.5 Projects

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-04 | List projects | Click "Projects" tab | Shows list of existing projects (may be empty) | None | |
| D-05 | Project tree | Click on a project name | File tree loads, shows Mule XML and configs | D-08 | |

### 5.6 New Project (Scaffold)

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-06 | View templates | Click "New Project" tab | Template cards displayed | None | |
| D-07 | Credential gates | Check template prerequisite badges | Shows green/red for configured/missing services | All | |
| D-08 | Scaffold hello-world | Select hello-world template, enter name, scaffold | Project created, git initialized, files visible | None | |
| D-09 | Scaffold SF-Postgres sync | Select sf-postgres-sync, enter name, scaffold | 3 Mule apps created with Kafka config | AP, SF, NE, KF | |
| D-10 | Push to GitHub | During scaffold wizard, proceed to push step | Code pushed to GitHub, URL shown | GH | |
| D-11 | Generate Postman | During scaffold wizard, proceed to Postman step | Postman collection generated and synced | PM | |

### 5.7 Use Case Gallery

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-12 | Gallery renders | Click "Use Cases" tab | SF-Postgres Bidirectional Sync card visible | None | |
| D-13 | Prerequisite badges | Check the prerequisite indicators on the card | Shows which services are configured vs missing | None | |
| D-14 | Deploy use case | Click "Deploy This Use Case" (when all prereqs met) | Navigates to New Project with template pre-selected | AP, SF, NE, KF | |

### 5.8 Code Scanner

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-15 | Scan local project | Click "Scanner" tab, enter path to a Mule project, click Scan | Scan runs, health score + findings displayed | D-08 | |
| D-16 | View findings | After scan, expand finding categories | Shows severity, rule ID, file location, recommendation | D-15 | |
| D-17 | Export report | Click "Export Report" | JSON report downloads | D-15 | |
| D-18 | Migration plan | Click "Migrate This Project", review plan | Migration plan with steps listed | D-15 | |
| D-19 | Execute migration | Enable desired steps, click Execute Migration | Files restructured, health score updated | D-18 | |
| D-20 | Scan history | Check scan history sidebar | Previous scans listed with timestamps | D-15 | |

### 5.9 DataWeave Playground

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-21 | Load example | Click "DW Playground" tab, select an example from sidebar | Script, input, and output pre-populated | None | |
| D-22 | Execute script | Modify script or use example, click Run | Output panel shows result or error | None | |
| D-23 | Save snippet | Click Save, enter name, confirm | Snippet appears in Snippets sidebar tab | None | |
| D-24 | Execution history | Click History tab in sidebar | Previous executions listed | D-22 | |
| D-25 | Share result | After execution, click Share | Share URL copied to clipboard | D-22 | |
| D-26 | Engine status | Check engine badge in header | Shows Mule CLI, Java, or Simulated | None | |

### 5.10 Salesforce DevTools

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-27 | Connection status | Click "SF DevTools" tab | Green dot if connected, connection info shown | SF | |
| D-28 | SOQL Workbench -- run query | Enter `SELECT Id, Name FROM Account LIMIT 5`, click Run | Results table with Account records | SF | |
| D-29 | SOQL Workbench -- NLP | Type "show all contacts", click Generate SOQL | SOQL generated from natural language | SF, LLM | |
| D-30 | SOQL Workbench -- templates | Click Templates button | Pre-built query templates listed | None | |
| D-31 | SOQL Workbench -- favorites | Run a query, click Save to Favorites | Query appears in Favorites tab | D-28 | |
| D-32 | Schema Explorer | Click "Schema Explorer" sub-tab, select an object | Fields, types, relationships displayed | SF | |
| D-33 | Record Browser -- list | Click "Record Browser" sub-tab, select Account | Records listed in a table | SF | |
| D-34 | Record Browser -- create | Click Create, fill fields, save | New record created in Salesforce | SF | |
| D-35 | Record Browser -- edit | Click a record, modify a field, save | Record updated in Salesforce | SF | |
| D-36 | Record Browser -- delete | Select a record, click Delete, confirm | Record removed from Salesforce | SF | |
| D-37 | Org Inspector | Click "Org Inspector" sub-tab | Health status, API limits, record counts shown | SF | |

### 5.11 Deploy

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-38 | Package project | Click "Deploy" tab, select a project, click Package | Maven build runs, artifact created | D-08, Java, Maven | |
| D-39 | Deploy to CloudHub | After packaging, click Deploy to CloudHub | Deployment starts, status shown | AP, D-38 | |

### 5.12 Monitoring and Logs

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-40 | Monitoring tab | Click "Monitoring" tab | Real-time metrics display (may be empty) | None | |
| D-41 | Log viewer | Click "Logs" tab | Log entries stream via SSE | None | |

### 5.13 Analytics

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-42 | Summary view | Click "Analytics" tab | Total requests, avg response time, error rate | None | |
| D-43 | Timeline chart | Check timeline section | Time-series chart of requests | None | |
| D-44 | Endpoint breakdown | Check endpoints section | Table of endpoints with stats | None | |

### 5.14 Postman

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-45 | Sync collections | Click "Postman" tab, click Sync | Collections synced with Postman workspace | PM, D-08 | |
| D-46 | Generate environment | Click Generate Environment | Postman environment file created | PM | |

### 5.15 Git

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-47 | View branches | Click "Git" tab, select a project | Branch list shown | D-08 | |
| D-48 | Commit changes | Make a file change, stage, commit | Commit created successfully | D-08 | |
| D-49 | Push to remote | Click Push | Code pushed to GitHub | GH, D-48 | |
| D-50 | Create PR | Click Create PR | PR created on GitHub, URL shown | GH, D-49 | |

### 5.16 Workstation

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| D-51 | Prerequisites display | Click "Workstation" tab | All prerequisite tools listed with install status | None | |

### 5.17 Settings

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| S-01 | Workspaces -- create | Settings > Workspaces > Create | New workspace created | None | |
| S-02 | Workspaces -- switch | Click on a different workspace | Workspace switches, header updates | S-01 | |
| S-03 | Secrets -- list | Settings > Secrets | Secrets listed by category | None | |
| S-04 | Secrets -- add | Add a new secret (key, value, category) | Secret saved to vault | None | |
| S-05 | Secrets -- reveal/hide | Click eye icon on a secret | Value toggles between shown and hidden | S-04 | |
| S-06 | Salesforce -- health | Settings > Salesforce | Shows org health, instance URL, username | SF | |
| S-07 | Salesforce -- SOQL | Enter and run a SOQL query | Results displayed | SF | |
| S-08 | Team -- list members | Settings > Team | Users listed with roles | None | |
| S-09 | Team -- add member | Click Add, enter username/password/role | New user created | None | |
| S-10 | Security -- overview | Settings > Security > Overview | Encryption status, PII stats, audit stats shown | None | |
| S-11 | Security -- PII registry | Settings > Security > PII Registry | Field classifications listed | None | |
| S-12 | Security -- mask preview | Settings > Security > Mask Preview, enter JSON | Masked output displayed | None | |
| S-13 | Appearance -- theme | Settings > Appearance, toggle Dark/Light/System | Theme changes immediately | None | |
| S-14 | Appearance -- accent | Click a different accent color (e.g. Rose) | Accent color changes across the UI | None | |
| S-15 | Appearance -- persist | Change theme, refresh page | Theme persists after reload | S-13 | |

### 5.18 Admin Dashboard

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| A-01 | Team Management | Log in as admin, go to Team Management | User list with roles visible | None | |
| A-02 | Add user | Click Add, enter username/password, select role | User created, appears in list | None | |
| A-03 | Change role | Edit a user's role | Role updated | A-02 | |
| A-04 | Delete user | Delete a non-default user | User removed from list | A-02 | |
| A-05 | Secrets Manager | Go to Secrets Manager tab | Secrets listed by category | None | |
| A-06 | CRUD secrets | Add, view, update, delete a secret | All operations succeed | None | |

### 5.19 Cross-Cutting Tests

| ID | Test Case | Steps | Expected | Prereq | Result |
|----|-----------|-------|----------|--------|--------|
| X-01 | Workspace isolation | Create workspace, scaffold project, switch back to Default | Project only visible in the workspace where created | None | |
| X-02 | Theme persistence | Set theme to Light + Rose accent, logout, login | Theme still Light + Rose | None | |
| X-03 | Token expiry | Wait 8+ hours (or manually expire token) | App redirects to login | None | |
| X-04 | Concurrent tabs | Open app in 2 browser tabs, perform actions in both | No data corruption or conflicts | None | |
| X-05 | Workspace header | Switch workspace, check DW Playground history | History is workspace-scoped | S-01 | |
| X-06 | Correlation ID | Make an API call, check response headers | `X-Correlation-Id` header present | None | |

---

## 6. Bug Reporting Template

Use this template for every bug found during UAT. Create one report per bug.

```
## Bug Report

**Bug ID:** UAT-XXXX
**Date:** YYYY-MM-DD
**Tester:** [Your Name]
**Severity:** P0 (Blocker) | P1 (Critical) | P2 (Major) | P3 (Minor)

### Environment
- OS: [e.g. macOS 15.3, Windows 11]
- Browser: [e.g. Chrome 130, Firefox 135]
- Bun Version: [e.g. 1.3.11]
- Java Version: [e.g. 17.0.12]
- Orca Branch/Commit: [e.g. main @ abc1234]

### Feature / Tab
[e.g. SF DevTools > SOQL Workbench]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Result
[What should happen]

### Actual Result
[What actually happened]

### Screenshot / Video
[Attach or link]

### Console Errors (if any)
[Paste browser console or backend log errors]

### Additional Notes
[Any relevant context]
```

### Severity Definitions

| Level | Name | Definition |
|-------|------|------------|
| **P0** | Blocker | App cannot start, data loss, security vulnerability |
| **P1** | Critical | Core feature completely broken, no workaround |
| **P2** | Major | Feature partially broken, workaround exists |
| **P3** | Minor | Cosmetic issue, typo, minor UX inconvenience |

---

## Quick Reference: Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Developer | `developer` | `developer` |
| Administrator | `admin` | `admin` |

---

## Testing Order Recommendation

For the most efficient UAT, follow this order:

1. **Environment Setup** (Section 3) -- get the app running
2. **Onboarding** (O-01 through O-06) -- enter all credentials
3. **Login** (L-01 through L-05) -- verify authentication
4. **New Project** (D-06 through D-11) -- scaffold a project to have data for later tests
5. **Core Features** (D-01 through D-51) -- work through each tab
6. **Settings** (S-01 through S-15) -- test all configuration options
7. **Admin** (A-01 through A-06) -- test admin-specific features
8. **Cross-Cutting** (X-01 through X-06) -- test system-wide behavior
9. **File Bug Reports** for any failures found

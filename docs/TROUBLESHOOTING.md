# Troubleshooting — Orca Community Edition

Common issues and solutions when running Orca Community Edition.

---

## Java Issues

### "java could not be found" when starting Mule Runtime

**Cause:** `JAVA_HOME` is not set or Java 17+ is not installed.

**Fix:**
```bash
# Check if Java is installed
java -version

# If not found, install it
brew install openjdk@17        # macOS
sudo apt install openjdk-17-jdk  # Ubuntu/Debian

# Set JAVA_HOME in your shell profile (~/.zshrc or ~/.bashrc)
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="$JAVA_HOME/bin:$PATH"
```

### Mule fails with "Unsupported major.minor version"

**Cause:** Running Java 8 or 11 instead of 17+.

**Fix:** Ensure `java -version` shows `17.x.x` or later. Mule 4.11.x requires Java 17.

---

## Mule Runtime Issues

### "WrapperManager Error: The backend could not be initialized"

**Cause:** Stale wrapper process state.

**Fix:**
```bash
# Navigate to Mule home
cd softwares/mule-standalone

# Clean stale state files
rm -f .mule/*.pid .mule/*.lock .mule/*.anchor conf/wrapper-pid.txt

# Restart
bin/mule start
```

### "There were N failed launches in a row"

**Cause:** Mule wrapper detected repeated startup failures.

**Fix:** Same as above -- clean stale state files. Also check the Mule log at `softwares/mule-standalone/logs/mule_ee.log` for the root cause.

### Port 8081 (or 8082-8084) is already in use

**Cause:** Another process is using the port.

**Fix:**
```bash
# Find what's using the port
lsof -ti:8081

# Kill it if safe
lsof -ti:8081 | xargs kill -9

# Or change the port in the Mule app's configuration
```

---

## Dashboard Issues

### Backend fails to start on port 3003

**Cause:** Port already in use or missing `.env` file.

**Fix:**
```bash
# Check if port is in use
lsof -ti:3003

# Ensure .env exists
cp backend/.env.example backend/.env
```

### Login fails with "Invalid credentials"

**Cause:** Database not seeded with default users.

**Fix:**
```bash
cd backend
bun src/db/seed.ts
```

Default credentials:
- **Admin:** username `admin`, password `admin`
- **Developer:** username `developer`, password `developer`

### Frontend shows blank page

**Cause:** Frontend not built or Vite dev server not running.

**Fix (development):**
```bash
cd frontend
bun install
bun run dev
```

**Fix (production):**
```bash
cd frontend
bun run build
# Backend will serve frontend/dist/ automatically
```

---

## Maven Issues

### "Could not resolve dependencies" during build

**Cause:** Missing MuleSoft repository configuration in `~/.m2/settings.xml`.

**Fix:**
```bash
# Run the configure script to set up Maven
./scripts/configure.sh

# Or manually add the MuleSoft repos to ~/.m2/settings.xml
```

### "Unauthorized" when downloading from Anypoint Exchange

**Cause:** Invalid or expired Anypoint Platform credentials.

**Fix:**
1. Verify your Connected App credentials in `config.yaml`
2. Re-run `./scripts/configure.sh`
3. Check that your Connected App has the correct scopes

---

## Postman Integration Issues

### "No workspace connected" in Postman tab

**Cause:** Postman API key not configured.

**Fix:**
1. Get your API key from [Postman Settings](https://web.postman.co/settings/me/api-keys)
2. Add it to `config.yaml` under `postman.api_key`
3. Re-run `./scripts/configure.sh`

---

## Docker Issues

### Build fails with "bun.lock not found"

**Cause:** Dependencies haven't been installed yet.

**Fix:**
```bash
cd backend && bun install
cd ../frontend && bun install
docker-compose up --build
```

---

## Still Stuck?

- Check the logs: `backend.log` and `frontend.log` in the project root
- Check Mule logs: `softwares/mule-standalone/logs/mule_ee.log`
- Open a [GitHub Issue](https://github.com/sivaji-orca/orca-community/issues)
- Email: community@orcaesb.com

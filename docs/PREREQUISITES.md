# Prerequisites — Orca Community Edition

This guide covers installing every tool required to run Orca Community Edition.

---

## Java 17+

MuleSoft 4.x requires Java 17 or later.

### macOS

```bash
brew install openjdk@17
```

Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="$JAVA_HOME/bin:$PATH"
```

### Windows

Download from [Adoptium](https://adoptium.net/) and run the installer. Select "Set JAVA_HOME" during installation.

### Linux

```bash
sudo apt install openjdk-17-jdk   # Debian/Ubuntu
sudo dnf install java-17-openjdk  # Fedora/RHEL
```

### Verify

```bash
java -version
# Expected: openjdk version "17.x.x" or later
```

---

## Maven 3.8+

Maven builds MuleSoft projects and downloads the Mule runtime.

### macOS

```bash
brew install maven
```

### Windows

Download from [maven.apache.org](https://maven.apache.org/download.cgi), extract, and add `bin/` to your `PATH`.

### Linux

```bash
sudo apt install maven   # Debian/Ubuntu
sudo dnf install maven   # Fedora/RHEL
```

### Verify

```bash
mvn -version
# Expected: Apache Maven 3.8.x or later
```

---

## Bun

Bun powers the Orca dashboard (backend + frontend).

### All Platforms

```bash
curl -fsSL https://bun.sh/install | bash
```

### Verify

```bash
bun --version
```

---

## Git

### macOS

```bash
brew install git
```

### Windows

Download from [git-scm.com](https://git-scm.com/downloads).

### Linux

```bash
sudo apt install git   # Debian/Ubuntu
sudo dnf install git   # Fedora/RHEL
```

### Verify

```bash
git --version
```

---

## Salesforce CLI (optional)

Required only if you plan to connect to a real Salesforce org.

### All Platforms

```bash
npm install -g @salesforce/cli
```

Or download from [developer.salesforce.com/tools/salesforcecli](https://developer.salesforce.com/tools/salesforcecli).

### Verify

```bash
sf --version
```

---

## Cursor IDE (recommended)

Orca Community Edition includes `.cursor/rules/` files that teach Cursor your MuleSoft project patterns for AI-assisted development.

Download from [cursor.com](https://www.cursor.com/).

---

## Next Steps

Once all prerequisites are installed, return to the main [README](../README.md) and follow the Quick Start guide.

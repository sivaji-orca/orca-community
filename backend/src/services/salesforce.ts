import { execSync } from "child_process";
import { getSecret } from "./vault";

function getSfInstanceUrl(): string {
  return getSecret("salesforce_instance_url") || "";
}

function getSfUsername(): string {
  return getSecret("salesforce_username") || "";
}

export async function getHealth(): Promise<Record<string, unknown>> {
  const instanceUrl = getSfInstanceUrl();
  const username = getSfUsername();
  if (!instanceUrl || !username) {
    return { status: "NOT_CONFIGURED", message: "Salesforce credentials not set in vault" };
  }
  try {
    const raw = execSync(
      `sf org display --target-org "${username}" --json 2>/dev/null`,
      { encoding: "utf8", timeout: 15000 }
    );
    const data = JSON.parse(raw);
    return {
      status: "CONNECTED",
      instanceUrl: data.result?.instanceUrl || instanceUrl,
      username,
      orgId: data.result?.id || "unknown",
    };
  } catch {
    return { status: "DISCONNECTED", instanceUrl, username };
  }
}

export async function getOrgInfo(): Promise<Record<string, unknown>> {
  const username = getSfUsername();
  if (!username) throw new Error("Salesforce username not configured");
  const raw = execSync(
    `sf org display --target-org "${username}" --json`,
    { encoding: "utf8", timeout: 15000 }
  );
  return JSON.parse(raw).result || {};
}

export async function queryAccounts(): Promise<Record<string, unknown>> {
  return runSOQL("SELECT Id, Name, Industry, Phone, Website FROM Account ORDER BY Name LIMIT 100");
}

export async function runSOQL(soql: string): Promise<Record<string, unknown>> {
  const username = getSfUsername();
  if (!username) throw new Error("Salesforce username not configured");
  const raw = execSync(
    `sf data query --query "${soql.replace(/"/g, '\\"')}" --target-org "${username}" --json`,
    { encoding: "utf8", timeout: 30000 }
  );
  return JSON.parse(raw).result || {};
}

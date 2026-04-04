import jsforce from "jsforce";
import { getSecret } from "./vault";

let _conn: jsforce.Connection | null = null;
let _connectedAt = 0;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCredentials() {
  try {
    return {
      instanceUrl: getSecret("salesforce_instance_url") || "",
      username: getSecret("salesforce_username") || "",
      password: getSecret("salesforce_password") || "",
      securityToken: getSecret("salesforce_security_token") || "",
    };
  } catch {
    return { instanceUrl: "", username: "", password: "", securityToken: "" };
  }
}

function isConfigured(): boolean {
  const { username, password } = getCredentials();
  return !!(username && password);
}

export async function getConnection(): Promise<jsforce.Connection> {
  if (_conn && Date.now() - _connectedAt < SESSION_TTL_MS) {
    return _conn;
  }

  const { instanceUrl, username, password, securityToken } = getCredentials();
  if (!username || !password) {
    throw new Error("Salesforce credentials not configured in vault");
  }

  const conn = new jsforce.Connection({
    loginUrl: instanceUrl || "https://login.salesforce.com",
  });

  await conn.login(username, password + (securityToken || ""));
  _conn = conn;
  _connectedAt = Date.now();
  return conn;
}

export function resetConnection(): void {
  if (_conn) {
    try { _conn.logout(); } catch {}
  }
  _conn = null;
  _connectedAt = 0;
}

export async function getHealth(): Promise<Record<string, unknown>> {
  if (!isConfigured()) {
    return { status: "NOT_CONFIGURED", message: "Salesforce credentials not set in vault" };
  }
  try {
    const conn = await getConnection();
    const identity = await conn.identity();
    return {
      status: "CONNECTED",
      instanceUrl: conn.instanceUrl,
      username: identity.username,
      orgId: identity.organization_id,
      userId: identity.user_id,
      displayName: identity.display_name,
    };
  } catch (e: any) {
    resetConnection();
    return {
      status: "DISCONNECTED",
      instanceUrl: getCredentials().instanceUrl,
      username: getCredentials().username,
      error: e.message,
    };
  }
}

export async function getOrgInfo(): Promise<Record<string, unknown>> {
  const conn = await getConnection();
  const identity = await conn.identity();
  const org = await conn.query(
    "SELECT Id, Name, OrganizationType, IsSandbox, InstanceName, NamespacePrefix FROM Organization LIMIT 1"
  );
  return {
    identity,
    organization: (org.records || [])[0] || {},
    apiVersion: conn.version,
    instanceUrl: conn.instanceUrl,
  };
}

export async function queryAccounts(): Promise<Record<string, unknown>> {
  return runSOQL("SELECT Id, Name, Industry, Phone, Website FROM Account ORDER BY Name LIMIT 100");
}

export async function runSOQL(soql: string): Promise<Record<string, unknown>> {
  const conn = await getConnection();
  const result = await conn.query(soql);
  return {
    totalSize: result.totalSize,
    done: result.done,
    records: result.records || [],
  };
}

export async function describeGlobal(): Promise<jsforce.DescribeGlobalResult> {
  const conn = await getConnection();
  return conn.describeGlobal();
}

export async function describeSObject(name: string): Promise<jsforce.DescribeSObjectResult> {
  const conn = await getConnection();
  return conn.describe(name);
}

export async function getLimits(): Promise<Record<string, unknown>> {
  const conn = await getConnection();
  const res = await conn.request("/services/data/v" + conn.version + "/limits");
  return res as Record<string, unknown>;
}

export async function createRecord(objectName: string, data: Record<string, unknown>): Promise<any> {
  const conn = await getConnection();
  return (conn.sobject(objectName) as any).create(data);
}

export async function updateRecord(objectName: string, data: Record<string, unknown>): Promise<any> {
  const conn = await getConnection();
  return (conn.sobject(objectName) as any).update(data);
}

export async function deleteRecord(objectName: string, id: string): Promise<any> {
  const conn = await getConnection();
  return (conn.sobject(objectName) as any).destroy(id);
}

export async function getRecord(objectName: string, id: string): Promise<any> {
  const conn = await getConnection();
  return (conn.sobject(objectName) as any).retrieve(id);
}

export async function searchSOSL(sosl: string): Promise<any> {
  const conn = await getConnection();
  return conn.search(sosl);
}

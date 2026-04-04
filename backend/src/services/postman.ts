import { getSecret } from "./vault";
import fs from "fs";
import path from "path";

const PROJECTS_DIR = path.join(import.meta.dir, "../../../projects");
const DATA_DIR = path.join(import.meta.dir, "../../data");
const WORKSPACE_FILE = path.join(DATA_DIR, "postman-workspace.json");
const SYNC_FILE = path.join(DATA_DIR, "postman-sync.json");

function getApiKey(): string {
  const key = getSecret("postman_api_key");
  if (!key) throw new Error("Postman API key not configured. Add it in Admin > Secrets.");
  return key;
}

async function postmanFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = getApiKey();
  const resp = await fetch(`https://api.getpostman.com${endpoint}`, {
    ...options,
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", ...options.headers },
  });
  return resp;
}

function loadSyncMap(): Record<string, { collectionUid: string; lastSynced: string }> {
  if (!fs.existsSync(SYNC_FILE)) return {};
  return JSON.parse(fs.readFileSync(SYNC_FILE, "utf8"));
}

function saveSyncMap(map: Record<string, { collectionUid: string; lastSynced: string }>): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SYNC_FILE, JSON.stringify(map, null, 2));
}

function loadWorkspaceConfig(): { workspaceId: string; workspaceName: string } | null {
  if (!fs.existsSync(WORKSPACE_FILE)) return null;
  return JSON.parse(fs.readFileSync(WORKSPACE_FILE, "utf8"));
}

function saveWorkspaceConfig(config: { workspaceId: string; workspaceName: string }): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(config, null, 2));
}

export function generateCollection(projectName: string, basePath: string = "/api"): Record<string, any> {
  const pathParts = basePath.split("/").filter(Boolean);
  const collection = {
    info: {
      name: `${projectName} API Collection`,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      { key: "baseUrl", value: "http://localhost:8081", description: "Switch between Local and CloudHub using Postman Environments" },
    ],
    item: [
      {
        name: `GET ${basePath}/hello`,
        request: {
          method: "GET",
          header: [],
          url: {
            raw: `{{baseUrl}}${basePath}/hello`,
            host: ["{{baseUrl}}"],
            path: [...pathParts, "hello"],
          },
        },
      },
      {
        name: `GET ${basePath}/hello?name=World`,
        request: {
          method: "GET",
          header: [],
          url: {
            raw: `{{baseUrl}}${basePath}/hello?name=World`,
            host: ["{{baseUrl}}"],
            path: [...pathParts, "hello"],
            query: [{ key: "name", value: "World" }],
          },
        },
      },
    ],
  };

  const collectionsDir = path.join(PROJECTS_DIR, projectName, "postman");
  if (!fs.existsSync(collectionsDir)) fs.mkdirSync(collectionsDir, { recursive: true });
  fs.writeFileSync(path.join(collectionsDir, `${projectName}-collection.json`), JSON.stringify(collection, null, 2));
  return collection;
}

function makeRequest(name: string, method: string, baseUrlVar: string, pathStr: string, body?: Record<string, any>): Record<string, any> {
  const pathParts = pathStr.split("/").filter(Boolean);
  const req: Record<string, any> = {
    name,
    request: {
      method,
      header: [{ key: "Content-Type", value: "application/json" }],
      url: {
        raw: `{{${baseUrlVar}}}${pathStr}`,
        host: [`{{${baseUrlVar}}}`],
        path: pathParts,
      },
    },
  };
  if (body) {
    req.request.body = { mode: "raw", raw: JSON.stringify(body, null, 2) };
  }
  return req;
}

export function generateSyncCollections(prefix: string, outputDir: string): string[] {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const generated: string[] = [];

  const sfCollection = {
    info: {
      name: `${prefix}-sf-system-api`,
      description: "Salesforce System API — HTTP read endpoints for Salesforce data. Write operations are handled by Kafka consumers (orca.neon.contacts.pending / orca.neon.accounts.pending).",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [{ key: "sfBaseUrl", value: "http://localhost:8082", description: "SF System API base" }],
    item: [
      { name: "Health", item: [makeRequest("Health Check", "GET", "sfBaseUrl", "/api/health")] },
      { name: "Contacts (Read — HTTP)", item: [
        makeRequest("GET All Contacts", "GET", "sfBaseUrl", "/api/contacts"),
        makeRequest("GET Contact by ID", "GET", "sfBaseUrl", "/api/contacts/003XXXXXXXXXXXXXXX"),
      ]},
      { name: "Accounts (Read — HTTP)", item: [
        makeRequest("GET All Accounts", "GET", "sfBaseUrl", "/api/accounts"),
        makeRequest("GET Account by ID", "GET", "sfBaseUrl", "/api/accounts/001XXXXXXXXXXXXXXX"),
      ]},
    ],
  };
  fs.writeFileSync(path.join(outputDir, `${prefix}-sf-system-api-collection.json`), JSON.stringify(sfCollection, null, 2));
  generated.push(`${prefix}-sf-system-api-collection.json`);

  const dbCollection = {
    info: {
      name: `${prefix}-db-system-api`,
      description: "Database System API — HTTP read endpoints for Neon PostgreSQL. Write operations via Kafka consumers (orca.sfdc.*.cdc topics). Audit trail persisted from orca.audit.sync-events topic.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [{ key: "dbBaseUrl", value: "http://localhost:8083", description: "DB System API base" }],
    item: [
      { name: "Health", item: [makeRequest("Health Check", "GET", "dbBaseUrl", "/api/health")] },
      { name: "Contacts (Read — HTTP)", item: [
        makeRequest("GET All Contacts", "GET", "dbBaseUrl", "/api/contacts"),
        makeRequest("GET Contacts Since", "GET", "dbBaseUrl", "/api/contacts?since=2024-01-01T00:00:00Z"),
      ]},
      { name: "Accounts (Read — HTTP)", item: [
        makeRequest("GET All Accounts", "GET", "dbBaseUrl", "/api/accounts"),
      ]},
      { name: "Audit Trail", item: [
        makeRequest("GET Sync Events", "GET", "dbBaseUrl", "/api/sync-events"),
        makeRequest("GET Sync Events by Correlation ID", "GET", "dbBaseUrl", "/api/sync-events?correlation_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"),
        makeRequest("GET Failed Sync Events", "GET", "dbBaseUrl", "/api/sync-events?status=failure"),
      ]},
    ],
  };
  fs.writeFileSync(path.join(outputDir, `${prefix}-db-system-api-collection.json`), JSON.stringify(dbCollection, null, 2));
  generated.push(`${prefix}-db-system-api-collection.json`);

  const syncCollection = {
    info: {
      name: `${prefix}-sync-process-api`,
      description: "Sync Process API — Orchestrator with Kafka event backbone. CDC events from Salesforce are published to Kafka topics. Scheduler polls db-system-api for pending rows and publishes to Kafka. No direct HTTP write paths.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [{ key: "syncBaseUrl", value: "http://localhost:8081", description: "Sync Process API base" }],
    item: [
      { name: "Health", item: [makeRequest("Sync Health Check (incl. Kafka topics)", "GET", "syncBaseUrl", "/api/health")] },
    ],
  };
  fs.writeFileSync(path.join(outputDir, `${prefix}-sync-process-api-collection.json`), JSON.stringify(syncCollection, null, 2));
  generated.push(`${prefix}-sync-process-api-collection.json`);

  return generated;
}

export async function getOrCreateWorkspace(): Promise<{ workspaceId: string; workspaceName: string }> {
  const existing = loadWorkspaceConfig();
  if (existing) {
    const resp = await postmanFetch(`/workspaces/${existing.workspaceId}`);
    if (resp.ok) return existing;
  }

  const listResp = await postmanFetch("/workspaces");
  if (!listResp.ok) throw new Error(`Failed to list workspaces: ${listResp.status} ${await listResp.text()}`);
  const listData = (await listResp.json()) as any;
  const found = (listData.workspaces || []).find((w: any) => w.name === "Orca");
  if (found) {
    const config = { workspaceId: found.id, workspaceName: found.name };
    saveWorkspaceConfig(config);
    return config;
  }

  const createResp = await postmanFetch("/workspaces", {
    method: "POST",
    body: JSON.stringify({
      workspace: { name: "Orca", type: "personal", description: "MuleSoft API collections managed by Orca" },
    }),
  });
  if (!createResp.ok) throw new Error(`Failed to create workspace: ${createResp.status} ${await createResp.text()}`);
  const createData = (await createResp.json()) as any;
  const config = { workspaceId: createData.workspace.id, workspaceName: createData.workspace.name };
  saveWorkspaceConfig(config);
  return config;
}

export function getWorkspaceStatus(): { connected: boolean; workspaceId: string | null; workspaceName: string | null } {
  const config = loadWorkspaceConfig();
  if (!config) return { connected: false, workspaceId: null, workspaceName: null };
  return { connected: true, workspaceId: config.workspaceId, workspaceName: config.workspaceName };
}

export async function createCollectionInWorkspace(collection: Record<string, any>, workspaceId: string): Promise<string> {
  const resp = await postmanFetch(`/collections?workspace=${workspaceId}`, {
    method: "POST",
    body: JSON.stringify({ collection }),
  });
  if (!resp.ok) throw new Error(`Failed to create collection: ${resp.status} ${await resp.text()}`);
  const data = (await resp.json()) as any;
  return data.collection.uid;
}

export async function updateCollection(collectionUid: string, collection: Record<string, any>): Promise<void> {
  const resp = await postmanFetch(`/collections/${collectionUid}`, {
    method: "PUT",
    body: JSON.stringify({ collection }),
  });
  if (!resp.ok) throw new Error(`Failed to update collection: ${resp.status} ${await resp.text()}`);
}

export async function deleteCollectionFromPostman(collectionUid: string): Promise<void> {
  const resp = await postmanFetch(`/collections/${collectionUid}`, { method: "DELETE" });
  if (!resp.ok) throw new Error(`Failed to delete collection: ${resp.status} ${await resp.text()}`);
}

export async function getCollection(collectionUid: string): Promise<any> {
  const resp = await postmanFetch(`/collections/${collectionUid}`);
  if (!resp.ok) throw new Error(`Failed to get collection: ${resp.status} ${await resp.text()}`);
  return (await resp.json()) as any;
}

export async function syncProjectToPostman(projectName: string): Promise<{ action: "created" | "updated"; collectionUid: string }> {
  const workspace = await getOrCreateWorkspace();
  const collection = generateCollection(projectName);
  const syncMap = loadSyncMap();

  if (syncMap[projectName]?.collectionUid) {
    try {
      await updateCollection(syncMap[projectName].collectionUid, collection);
      syncMap[projectName].lastSynced = new Date().toISOString();
      saveSyncMap(syncMap);
      return { action: "updated", collectionUid: syncMap[projectName].collectionUid };
    } catch {
      // Collection may have been deleted from Postman; fall through to create
    }
  }

  const uid = await createCollectionInWorkspace(collection, workspace.workspaceId);
  syncMap[projectName] = { collectionUid: uid, lastSynced: new Date().toISOString() };
  saveSyncMap(syncMap);
  return { action: "created", collectionUid: uid };
}

export async function removeProjectFromPostman(projectName: string): Promise<void> {
  const syncMap = loadSyncMap();
  if (!syncMap[projectName]) throw new Error(`Project '${projectName}' is not synced to Postman.`);
  await deleteCollectionFromPostman(syncMap[projectName].collectionUid);
  delete syncMap[projectName];
  saveSyncMap(syncMap);
}

export function getSyncStatus(): Array<{ projectName: string; synced: boolean; collectionUid: string | null; lastSynced: string | null }> {
  if (!fs.existsSync(path.join(PROJECTS_DIR))) return [];
  const projects = fs.readdirSync(PROJECTS_DIR).filter((f) => fs.statSync(path.join(PROJECTS_DIR, f)).isDirectory());
  const syncMap = loadSyncMap();
  return projects.map((p) => ({
    projectName: p,
    synced: !!syncMap[p],
    collectionUid: syncMap[p]?.collectionUid || null,
    lastSynced: syncMap[p]?.lastSynced || null,
  }));
}

export async function syncAllProjects(): Promise<Array<{ projectName: string; action: string; collectionUid: string }>> {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const projects = fs.readdirSync(PROJECTS_DIR).filter((f) => fs.statSync(path.join(PROJECTS_DIR, f)).isDirectory());
  const results: Array<{ projectName: string; action: string; collectionUid: string }> = [];
  for (const p of projects) {
    const result = await syncProjectToPostman(p);
    results.push({ projectName: p, action: result.action, collectionUid: result.collectionUid });
  }
  return results;
}

export async function listCollections(): Promise<any[]> {
  const resp = await postmanFetch("/collections");
  if (!resp.ok) throw new Error(`Postman list failed: ${resp.status} ${await resp.text()}`);
  const data = (await resp.json()) as any;
  return data.collections || [];
}

export async function importToPostman(collection: Record<string, any>): Promise<any> {
  const resp = await postmanFetch("/collections", {
    method: "POST",
    body: JSON.stringify({ collection }),
  });
  if (!resp.ok) throw new Error(`Postman import failed: ${resp.status} ${await resp.text()}`);
  return resp.json();
}

export async function createEnvironment(
  workspaceId: string,
  name: string,
  values: Array<{ key: string; value: string; enabled?: boolean }>
): Promise<string> {
  const resp = await postmanFetch(`/environments?workspace=${workspaceId}`, {
    method: "POST",
    body: JSON.stringify({
      environment: {
        name,
        values: values.map((v) => ({ key: v.key, value: v.value, enabled: v.enabled ?? true, type: "default" })),
      },
    }),
  });
  if (!resp.ok) throw new Error(`Failed to create environment: ${resp.status} ${await resp.text()}`);
  const data = (await resp.json()) as any;
  return data.environment.uid;
}

export async function updateEnvironment(
  envUid: string,
  name: string,
  values: Array<{ key: string; value: string; enabled?: boolean }>
): Promise<void> {
  const resp = await postmanFetch(`/environments/${envUid}`, {
    method: "PUT",
    body: JSON.stringify({
      environment: {
        name,
        values: values.map((v) => ({ key: v.key, value: v.value, enabled: v.enabled ?? true, type: "default" })),
      },
    }),
  });
  if (!resp.ok) throw new Error(`Failed to update environment: ${resp.status} ${await resp.text()}`);
}

export async function listEnvironments(): Promise<any[]> {
  const resp = await postmanFetch("/environments");
  if (!resp.ok) throw new Error(`Failed to list environments: ${resp.status} ${await resp.text()}`);
  const data = (await resp.json()) as any;
  return data.environments || [];
}

export async function getEnvironmentDetail(envUid: string): Promise<any> {
  const resp = await postmanFetch(`/environments/${envUid}`);
  if (!resp.ok) throw new Error(`Failed to get environment: ${resp.status} ${await resp.text()}`);
  return (await resp.json()) as any;
}

const ENV_SYNC_FILE = path.join(DATA_DIR, "postman-environments.json");

function loadEnvSyncMap(): Record<string, { envUid: string; lastSynced: string }> {
  if (!fs.existsSync(ENV_SYNC_FILE)) return {};
  return JSON.parse(fs.readFileSync(ENV_SYNC_FILE, "utf8"));
}

function saveEnvSyncMap(map: Record<string, { envUid: string; lastSynced: string }>): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ENV_SYNC_FILE, JSON.stringify(map, null, 2));
}

export async function syncEnvironment(
  envName: string,
  values: Array<{ key: string; value: string; enabled?: boolean }>
): Promise<{ action: "created" | "updated"; envUid: string }> {
  const workspace = await getOrCreateWorkspace();
  const envMap = loadEnvSyncMap();

  if (envMap[envName]?.envUid) {
    try {
      await updateEnvironment(envMap[envName].envUid, envName, values);
      envMap[envName].lastSynced = new Date().toISOString();
      saveEnvSyncMap(envMap);
      return { action: "updated", envUid: envMap[envName].envUid };
    } catch {
      // Environment may have been deleted; fall through to create
    }
  }

  const uid = await createEnvironment(workspace.workspaceId, envName, values);
  envMap[envName] = { envUid: uid, lastSynced: new Date().toISOString() };
  saveEnvSyncMap(envMap);
  return { action: "created", envUid: uid };
}

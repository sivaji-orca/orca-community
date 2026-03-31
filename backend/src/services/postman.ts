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

export async function getOrCreateWorkspace(): Promise<{ workspaceId: string; workspaceName: string }> {
  const existing = loadWorkspaceConfig();
  if (existing) {
    const resp = await postmanFetch(`/workspaces/${existing.workspaceId}`);
    if (resp.ok) return existing;
  }

  const listResp = await postmanFetch("/workspaces");
  if (!listResp.ok) throw new Error(`Failed to list workspaces: ${listResp.status} ${await listResp.text()}`);
  const listData = (await listResp.json()) as any;
  const found = (listData.workspaces || []).find((w: any) => w.name === "Dhurandhar");
  if (found) {
    const config = { workspaceId: found.id, workspaceName: found.name };
    saveWorkspaceConfig(config);
    return config;
  }

  const createResp = await postmanFetch("/workspaces", {
    method: "POST",
    body: JSON.stringify({
      workspace: { name: "Dhurandhar", type: "personal", description: "MuleSoft API collections managed by Dhurandhar" },
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

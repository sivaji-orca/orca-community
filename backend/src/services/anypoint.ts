import { getSecretsByCategory, getSecret } from "./vault";
import fs from "fs";

const BASE_URL = "https://anypoint.mulesoft.com";

async function getAccessToken(): Promise<string> {
  const clientId = getSecret("anypoint_client_id");
  const clientSecret = getSecret("anypoint_client_secret");

  if (!clientId || !clientSecret) {
    throw new Error("Anypoint Platform credentials not configured. Add them in Admin > Secrets.");
  }

  const resp = await fetch(`${BASE_URL}/accounts/api/v2/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Anypoint auth failed: ${resp.status} ${await resp.text()}`);
  }

  const data = await resp.json() as any;
  return data.access_token;
}

async function getOrgId(token: string): Promise<string> {
  const storedOrgId = getSecret("anypoint_org_id");
  if (storedOrgId) return storedOrgId;

  const resp = await fetch(`${BASE_URL}/accounts/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await resp.json() as any;
  return data.user.organizationId;
}

export async function getAnypointAuth(): Promise<{ token: string; orgId: string }> {
  const token = await getAccessToken();
  const orgId = await getOrgId(token);
  return { token, orgId };
}

export async function getEnvironmentByName(name: string): Promise<any> {
  const envs = await getEnvironments();
  const match = envs.find((e: any) =>
    e.name.toLowerCase() === name.toLowerCase() ||
    e.type?.toLowerCase() === name.toLowerCase()
  );
  if (!match) {
    throw new Error(`Environment '${name}' not found. Available: ${envs.map((e: any) => e.name).join(", ")}`);
  }
  return match;
}

export async function getCloudHubRuntimes(): Promise<any[]> {
  const { token } = await getAnypointAuth();
  const resp = await fetch(`${BASE_URL}/cloudhub/api/v2/runtimes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Failed to fetch runtimes: ${resp.status}`);
  const data = await resp.json() as any;
  return data.data || data;
}

export async function getCloudHubApp(domain: string, envId: string): Promise<any | null> {
  const { token, orgId } = await getAnypointAuth();
  const resp = await fetch(`${BASE_URL}/cloudhub/api/v2/applications/${domain}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-ANYPNT-ORG-ID": orgId,
      "X-ANYPNT-ENV-ID": envId,
    },
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Failed to check app: ${resp.status} ${await resp.text()}`);
  return await resp.json();
}

export async function deployToCloudHub(opts: {
  jarPath: string;
  domain: string;
  environment?: string;
  muleVersion?: string;
  workerSize?: string;
  workers?: number;
  region?: string;
}): Promise<{ domain: string; status: string; fullDomain: string; message: string }> {
  const { token, orgId } = await getAnypointAuth();

  const envName = opts.environment || "Sandbox";
  const env = await getEnvironmentByName(envName);
  const envId = env.id;

  const muleVersion = opts.muleVersion || "4.8.0";

  const workerType = opts.workerSize || "MICRO";
  const workerTypeConfig: Record<string, any> = {
    MICRO: { name: "Micro", weight: 0.1, cpu: "0.1 vCores", memory: "500 MB" },
    SMALL: { name: "Small", weight: 0.2, cpu: "0.2 vCores", memory: "1 GB" },
    MEDIUM: { name: "Medium", weight: 1, cpu: "1 vCores", memory: "1.5 GB" },
    LARGE: { name: "Large", weight: 2, cpu: "2 vCores", memory: "3.5 GB" },
  };

  const selectedWorker = workerTypeConfig[workerType.toUpperCase()] || workerTypeConfig.MICRO;

  const appInfoJson = {
    domain: opts.domain,
    muleVersion: { version: muleVersion },
    region: opts.region || "us-east-1",
    monitoringAutoRestart: true,
    workers: {
      type: selectedWorker,
      amount: opts.workers || 1,
    },
    properties: {},
    loggingNgEnabled: true,
    persistentQueues: false,
    objectStoreV1: false,
  };

  const existing = await getCloudHubApp(opts.domain, envId);
  const isUpdate = !!existing;

  const jarBuffer = fs.readFileSync(opts.jarPath);
  const jarBlob = new Blob([jarBuffer], { type: "application/java-archive" });
  const jarFileName = opts.domain + ".jar";

  const formData = new FormData();
  formData.append("autoStart", "true");
  formData.append("appInfoJson", JSON.stringify(appInfoJson));
  formData.append("file", jarBlob, jarFileName);

  const url = isUpdate
    ? `${BASE_URL}/cloudhub/api/v2/applications/${opts.domain}`
    : `${BASE_URL}/cloudhub/api/v2/applications`;

  const resp = await fetch(url, {
    method: isUpdate ? "PUT" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-ANYPNT-ORG-ID": orgId,
      "X-ANYPNT-ENV-ID": envId,
    },
    body: formData,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`CloudHub deploy failed (${resp.status}): ${errText}`);
  }

  const result = await resp.json() as any;

  return {
    domain: opts.domain,
    fullDomain: `${opts.domain}.us-e1.cloudhub.io`,
    status: result.status || (isUpdate ? "UPDATING" : "DEPLOYING"),
    message: isUpdate
      ? `Application '${opts.domain}' updated on CloudHub`
      : `Application '${opts.domain}' deployed to CloudHub`,
  };
}

export async function getCloudHubAppStatus(domain: string, environment?: string): Promise<any> {
  const { token, orgId } = await getAnypointAuth();
  const env = await getEnvironmentByName(environment || "Sandbox");
  const resp = await fetch(`${BASE_URL}/cloudhub/api/v2/applications/${domain}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-ANYPNT-ORG-ID": orgId,
      "X-ANYPNT-ENV-ID": env.id,
    },
  });
  if (!resp.ok) throw new Error(`App not found: ${resp.status}`);
  const app = await resp.json() as any;
  return {
    domain: app.domain,
    fullDomain: app.fullDomain,
    status: app.status,
    muleVersion: app.muleVersion?.version,
    workers: app.workers,
    region: app.region,
    lastUpdateTime: app.lastUpdateTime,
  };
}

export async function deleteCloudHubApp(domain: string, environment?: string): Promise<string> {
  const { token, orgId } = await getAnypointAuth();
  const env = await getEnvironmentByName(environment || "Sandbox");
  const resp = await fetch(`${BASE_URL}/cloudhub/api/v2/applications/${domain}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-ANYPNT-ORG-ID": orgId,
      "X-ANYPNT-ENV-ID": env.id,
    },
  });
  if (!resp.ok) throw new Error(`Delete failed: ${resp.status} ${await resp.text()}`);
  return `Application '${domain}' deleted from CloudHub`;
}

export async function getEnvironments(): Promise<any[]> {
  const token = await getAccessToken();
  const orgId = await getOrgId(token);

  const resp = await fetch(`${BASE_URL}/accounts/api/organizations/${orgId}/environments`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) throw new Error(`Failed to fetch environments: ${resp.status}`);
  const data = await resp.json() as any;
  return data.data || [];
}

export async function getApplications(envId?: string): Promise<any[]> {
  const token = await getAccessToken();
  const orgId = await getOrgId(token);

  const envs = envId ? [{ id: envId, name: envId }] : await getEnvironments();
  const allApps: any[] = [];

  for (const env of envs) {
    const listResp = await fetch(
      `${BASE_URL}/amc/application-manager/api/v2/organizations/${orgId}/environments/${env.id}/deployments`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!listResp.ok) continue;
    const data = await listResp.json() as any;
    const items = data.items || [];

    const details = await Promise.all(
      items.map(async (item: any) => {
        try {
          const detailResp = await fetch(
            `${BASE_URL}/amc/application-manager/api/v2/organizations/${orgId}/environments/${env.id}/deployments/${item.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (detailResp.ok) return await detailResp.json();
        } catch {}
        return item;
      })
    );

    allApps.push(
      ...details.map((app: any) => ({
        id: app.id,
        name: app.name,
        status: app.application?.status || app.status,
        target: app.target?.targetId,
        muleVersion: app.target?.deploymentSettings?.runtimeVersion ||
                     app.currentRuntimeVersion,
        publicUrl: app.target?.deploymentSettings?.http?.inbound?.publicUrl,
        replicas: app.target?.replicas,
        vCores: app.application?.vCores,
        artifact: app.application?.ref,
        lastModified: app.lastModifiedDate,
        environmentId: env.id,
        environmentName: (env as any).name || env.id,
      }))
    );
  }

  return allApps;
}

export async function getApiContracts(): Promise<any[]> {
  const token = await getAccessToken();
  const orgId = await getOrgId(token);
  const envs = await getEnvironments();
  const allContracts: any[] = [];

  for (const env of envs) {
    const apisResp = await fetch(
      `${BASE_URL}/apimanager/api/v1/organizations/${orgId}/environments/${env.id}/apis?ascending=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!apisResp.ok) continue;
    const apisData = await apisResp.json() as any;
    const apis = apisData.assets || [];

    for (const asset of apis) {
      for (const api of asset.apis || []) {
        const contractsResp = await fetch(
          `${BASE_URL}/apimanager/api/v1/organizations/${orgId}/environments/${env.id}/apis/${api.id}/contracts`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (contractsResp.ok) {
          const contracts = await contractsResp.json() as any;
          allContracts.push(
            ...(contracts.contracts || []).map((c: any) => ({
              ...c,
              apiName: asset.assetId,
              apiVersion: api.assetVersion,
              environmentName: env.name,
            }))
          );
        }
      }
    }
  }

  return allContracts;
}

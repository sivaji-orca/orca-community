export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  requiredCredentials: string[];
  ports: Record<string, number>;
  projects: string[];
  architecture?: string;
}

export interface ScaffoldResult {
  files: string[];
  projects: string[];
}

export interface Template {
  metadata: TemplateMetadata;
  scaffold(basePath: string, projectName: string, vars?: Record<string, string>): Promise<ScaffoldResult>;
}

import { helloWorldTemplate } from "./hello-world";
import { sfPostgresSyncTemplate } from "./sf-postgres-sync";

export const templateRegistry: Record<string, Template> = {
  "hello-world": helloWorldTemplate,
  "sf-postgres-sync": sfPostgresSyncTemplate,
};

export function getTemplateList(): TemplateMetadata[] {
  return Object.values(templateRegistry).map((t) => t.metadata);
}

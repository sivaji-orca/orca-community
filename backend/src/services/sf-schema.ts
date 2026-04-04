import { getDb } from "../db/schema";
import { describeGlobal, describeSObject } from "./salesforce";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface CachedObject {
  name: string;
  label: string;
  keyPrefix: string | null;
  isCustom: boolean;
  isQueryable: boolean;
  isCreateable: boolean;
  isUpdateable: boolean;
  isDeletable: boolean;
  recordCount: number;
  lastRefreshed: string;
}

export interface CachedField {
  fieldName: string;
  label: string;
  type: string;
  length: number;
  precision: number;
  scale: number;
  referenceTo: string[];
  picklistValues: { label: string; value: string; active: boolean }[];
  isRequired: boolean;
  isUnique: boolean;
  isCustom: boolean;
  isCreateable: boolean;
  isUpdateable: boolean;
  isFormula: boolean;
  formula: string | null;
  defaultValue: string | null;
  description: string | null;
}

export interface Relationship {
  fieldName: string;
  referenceTo: string;
  relationshipName: string | null;
  type: "lookup" | "master-detail";
}

function isCacheValid(lastRefreshed: string): boolean {
  const ts = new Date(lastRefreshed).getTime();
  return Date.now() - ts < CACHE_TTL_MS;
}

export async function getCachedObjects(workspaceId = 1, forceRefresh = false): Promise<CachedObject[]> {
  const db = getDb();

  if (!forceRefresh) {
    const rows = db.query(
      "SELECT * FROM sf_schema_objects WHERE workspace_id = ? ORDER BY name"
    ).all(workspaceId) as any[];

    if (rows.length > 0 && isCacheValid(rows[0].last_refreshed)) {
      return rows.map(mapObjectRow);
    }
  }

  const global = await describeGlobal();

  db.run("DELETE FROM sf_schema_objects WHERE workspace_id = ?", [workspaceId]);

  const stmt = db.prepare(
    `INSERT INTO sf_schema_objects (name, label, key_prefix, is_custom, is_queryable, is_createable, is_updateable, is_deletable, workspace_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const obj of global.sobjects) {
    stmt.run(
      obj.name,
      obj.label,
      obj.keyPrefix || null,
      obj.custom ? 1 : 0,
      obj.queryable ? 1 : 0,
      obj.createable ? 1 : 0,
      obj.updateable ? 1 : 0,
      obj.deletable ? 1 : 0,
      workspaceId
    );
  }

  return db.query(
    "SELECT * FROM sf_schema_objects WHERE workspace_id = ? ORDER BY name"
  ).all(workspaceId).map(mapObjectRow as any);
}

export async function getCachedFields(objectName: string, workspaceId = 1, forceRefresh = false): Promise<CachedField[]> {
  const db = getDb();

  if (!forceRefresh) {
    const rows = db.query(
      "SELECT * FROM sf_schema_fields WHERE object_name = ? AND workspace_id = ? ORDER BY field_name"
    ).all(objectName, workspaceId) as any[];

    if (rows.length > 0) {
      const objRow = db.query(
        "SELECT last_refreshed FROM sf_schema_objects WHERE name = ? AND workspace_id = ?"
      ).get(objectName, workspaceId) as any;

      if (objRow && isCacheValid(objRow.last_refreshed)) {
        return rows.map(mapFieldRow);
      }
    }
  }

  const desc = await describeSObject(objectName);

  db.run("DELETE FROM sf_schema_fields WHERE object_name = ? AND workspace_id = ?", [objectName, workspaceId]);

  const stmt = db.prepare(
    `INSERT INTO sf_schema_fields (object_name, field_name, label, type, length, precision_val, scale,
      reference_to, picklist_values, is_required, is_unique, is_custom, is_createable, is_updateable,
      is_formula, formula, default_value, description, workspace_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const f of desc.fields) {
    const refs = (f.referenceTo || []).filter(Boolean);
    const picks = (f.picklistValues || []).map((p: any) => ({
      label: p.label, value: p.value, active: p.active,
    }));

    stmt.run(
      objectName,
      f.name,
      f.label,
      f.type,
      f.length || 0,
      (f as any).precision || 0,
      (f as any).scale || 0,
      refs.length > 0 ? JSON.stringify(refs) : null,
      picks.length > 0 ? JSON.stringify(picks) : null,
      f.nillable === false && !f.defaultedOnCreate ? 1 : 0,
      f.unique ? 1 : 0,
      f.custom ? 1 : 0,
      f.createable ? 1 : 0,
      f.updateable ? 1 : 0,
      f.calculated ? 1 : 0,
      (f as any).calculatedFormula || null,
      f.defaultValue != null ? String(f.defaultValue) : null,
      (f as any).inlineHelpText || null,
      workspaceId
    );
  }

  db.run(
    `INSERT OR REPLACE INTO sf_schema_objects (name, label, key_prefix, is_custom, is_queryable, is_createable, is_updateable, is_deletable, last_refreshed, workspace_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
    [
      desc.name,
      desc.label,
      desc.keyPrefix || null,
      desc.custom ? 1 : 0,
      desc.queryable ? 1 : 0,
      desc.createable ? 1 : 0,
      desc.updateable ? 1 : 0,
      desc.deletable ? 1 : 0,
      workspaceId,
    ]
  );

  return db.query(
    "SELECT * FROM sf_schema_fields WHERE object_name = ? AND workspace_id = ? ORDER BY field_name"
  ).all(objectName, workspaceId).map(mapFieldRow as any);
}

export async function getRelationships(objectName: string, workspaceId = 1): Promise<{
  parents: Relationship[];
  children: { objectName: string; fieldName: string; relationshipName: string | null }[];
}> {
  const fields = await getCachedFields(objectName, workspaceId);

  const parents: Relationship[] = fields
    .filter((f) => f.referenceTo.length > 0)
    .map((f) => ({
      fieldName: f.fieldName,
      referenceTo: f.referenceTo[0],
      relationshipName: f.fieldName.replace(/Id$/, ""),
      type: f.isRequired ? "master-detail" as const : "lookup" as const,
    }));

  const db = getDb();
  const childRows = db.query(
    `SELECT object_name, field_name, reference_to FROM sf_schema_fields
     WHERE workspace_id = ? AND reference_to LIKE ?`
  ).all(workspaceId, `%"${objectName}"%`) as any[];

  const children = childRows.map((r: any) => ({
    objectName: r.object_name,
    fieldName: r.field_name,
    relationshipName: r.field_name.replace(/Id$/, ""),
  }));

  return { parents, children };
}

export async function getErdData(objectNames: string[], workspaceId = 1): Promise<{
  nodes: { name: string; label: string; fields: { name: string; type: string; referenceTo?: string }[] }[];
  edges: { from: string; to: string; field: string; type: string }[];
}> {
  const nodes: any[] = [];
  const edges: any[] = [];
  const included = new Set(objectNames);

  for (const name of objectNames) {
    const fields = await getCachedFields(name, workspaceId);
    nodes.push({
      name,
      label: fields.length > 0 ? name : name,
      fields: fields.slice(0, 30).map((f) => ({
        name: f.fieldName,
        type: f.type,
        referenceTo: f.referenceTo[0] || undefined,
      })),
    });

    for (const f of fields) {
      if (f.referenceTo.length > 0 && included.has(f.referenceTo[0])) {
        edges.push({
          from: name,
          to: f.referenceTo[0],
          field: f.fieldName,
          type: f.isRequired ? "master-detail" : "lookup",
        });
      }
    }
  }

  return { nodes, edges };
}

export async function refreshAllSchema(workspaceId = 1): Promise<{ objectCount: number }> {
  const objects = await getCachedObjects(workspaceId, true);
  return { objectCount: objects.length };
}

function mapObjectRow(row: any): CachedObject {
  return {
    name: row.name,
    label: row.label,
    keyPrefix: row.key_prefix,
    isCustom: !!row.is_custom,
    isQueryable: !!row.is_queryable,
    isCreateable: !!row.is_createable,
    isUpdateable: !!row.is_updateable,
    isDeletable: !!row.is_deletable,
    recordCount: row.record_count || 0,
    lastRefreshed: row.last_refreshed,
  };
}

function mapFieldRow(row: any): CachedField {
  return {
    fieldName: row.field_name,
    label: row.label,
    type: row.type,
    length: row.length,
    precision: row.precision_val,
    scale: row.scale,
    referenceTo: row.reference_to ? JSON.parse(row.reference_to) : [],
    picklistValues: row.picklist_values ? JSON.parse(row.picklist_values) : [],
    isRequired: !!row.is_required,
    isUnique: !!row.is_unique,
    isCustom: !!row.is_custom,
    isCreateable: !!row.is_createable,
    isUpdateable: !!row.is_updateable,
    isFormula: !!row.is_formula,
    formula: row.formula,
    defaultValue: row.default_value,
    description: row.description,
  };
}

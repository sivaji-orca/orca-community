import { getSecret } from "./vault";
import { getCachedObjects, getCachedFields, type CachedField } from "./sf-schema";

export interface NlpResult {
  soql: string;
  explanation: string;
  confidence: number;
  engine: "llm" | "template";
  suggestions?: string[];
}

// ── Template-based fallback (no LLM required) ─────────────────────────────

interface TemplatePattern {
  patterns: RegExp[];
  build: (match: RegExpMatchArray, input: string) => string | null;
}

const COMMON_OBJECTS: Record<string, { fields: string; name: string }> = {
  account: { fields: "Id, Name, Industry, Phone, Website, Type, BillingCity", name: "Account" },
  contact: { fields: "Id, FirstName, LastName, Email, Phone, AccountId, Title", name: "Contact" },
  opportunity: { fields: "Id, Name, StageName, Amount, CloseDate, AccountId", name: "Opportunity" },
  lead: { fields: "Id, FirstName, LastName, Email, Company, Status, Phone", name: "Lead" },
  case: { fields: "Id, CaseNumber, Subject, Status, Priority, ContactId", name: "Case" },
  task: { fields: "Id, Subject, Status, Priority, ActivityDate, WhoId", name: "Task" },
  user: { fields: "Id, Name, Email, Username, IsActive, Profile.Name", name: "User" },
};

function singularize(word: string): string[] {
  const w = word.toLowerCase();
  const variants = [w];
  if (w.endsWith("ies")) variants.push(w.slice(0, -3) + "y");
  if (w.endsWith("ses") || w.endsWith("xes") || w.endsWith("zes") || w.endsWith("ches") || w.endsWith("shes")) variants.push(w.slice(0, -2));
  if (w.endsWith("s") && !w.endsWith("ss")) variants.push(w.slice(0, -1));
  return variants;
}

function resolveObject(raw: string): { key: string; info: { fields: string; name: string } } | null {
  for (const variant of singularize(raw)) {
    if (COMMON_OBJECTS[variant]) return { key: variant, info: COMMON_OBJECTS[variant] };
  }
  const lower = raw.toLowerCase();
  for (const [k, v] of Object.entries(COMMON_OBJECTS)) {
    if (k.startsWith(lower) || lower.startsWith(k)) return { key: k, info: v };
  }
  return null;
}

const TEMPLATE_PATTERNS: TemplatePattern[] = [
  {
    patterns: [
      /(?:show|get|list|find|fetch|display)\s+(?:all\s+)?(\w+)(?:\s+(?:records?|data|items?))?\s*$/i,
      /^(?:all\s+)?(\w+)\s*$/i,
    ],
    build: (match) => {
      const r = resolveObject(match[1]);
      if (r) return `SELECT ${r.info.fields} FROM ${r.info.name} ORDER BY Name LIMIT 100`;
      return null;
    },
  },
  {
    patterns: [
      /(?:show|get|find|list)\s+(?:all\s+)?(\w+)\s+(?:where|with|having|that have)\s+(\w+)\s*(?:=|is|equals?|like)\s*['""]?([^'""\n]+?)['""]?\s*$/i,
    ],
    build: (match) => {
      const r = resolveObject(match[1]);
      if (!r) return null;
      const field = guessFieldName(match[2], r.key);
      const value = match[3].trim();
      const isNumeric = /^\d+(\.\d+)?$/.test(value);
      const whereVal = isNumeric ? value : `'${value}'`;
      return `SELECT ${r.info.fields} FROM ${r.info.name} WHERE ${field} = ${whereVal} LIMIT 100`;
    },
  },
  {
    patterns: [
      /(?:count|how many)\s+(\w+)\s*$/i,
      /(?:total|number of)\s+(\w+)\s*$/i,
    ],
    build: (match) => {
      const r = resolveObject(match[1]);
      if (r) return `SELECT COUNT() FROM ${r.info.name}`;
      return null;
    },
  },
  {
    patterns: [
      /(?:recent|latest|newest|last)\s+(\d+)?\s*(\w+)\s*$/i,
    ],
    build: (match) => {
      const limit = match[1] ? parseInt(match[1]) : 10;
      const r = resolveObject(match[2]);
      if (r) return `SELECT ${r.info.fields} FROM ${r.info.name} ORDER BY CreatedDate DESC LIMIT ${limit}`;
      return null;
    },
  },
  {
    patterns: [
      /(\w+)\s+created\s+(?:this|current)\s+(week|month|year|quarter)/i,
      /(\w+)\s+(?:from|in)\s+(?:this|current)\s+(week|month|year|quarter)/i,
    ],
    build: (match) => {
      const r = resolveObject(match[1]);
      const period = match[2].toUpperCase();
      if (r) return `SELECT ${r.info.fields} FROM ${r.info.name} WHERE CreatedDate = THIS_${period} ORDER BY CreatedDate DESC`;
      return null;
    },
  },
  {
    patterns: [
      /(?:search|find)\s+(\w+)\s+(?:named?|called)\s+['""]?(.+?)['""]?\s*$/i,
    ],
    build: (match) => {
      const r = resolveObject(match[1]);
      const searchTerm = match[2].trim();
      if (r) return `SELECT ${r.info.fields} FROM ${r.info.name} WHERE Name LIKE '%${searchTerm}%' LIMIT 50`;
      return null;
    },
  },
  {
    patterns: [
      /(?:top|biggest|largest|highest)\s+(\d+)?\s*(\w+)\s+by\s+(\w+)/i,
    ],
    build: (match) => {
      const limit = match[1] ? parseInt(match[1]) : 10;
      const r = resolveObject(match[2]);
      const field = match[3];
      if (r) return `SELECT ${r.info.fields} FROM ${r.info.name} ORDER BY ${field} DESC LIMIT ${limit}`;
      return null;
    },
  },
];

function guessFieldName(input: string, objectKey: string): string {
  const lower = input.toLowerCase();
  const fieldMap: Record<string, Record<string, string>> = {
    account: { name: "Name", industry: "Industry", type: "Type", phone: "Phone", city: "BillingCity", website: "Website" },
    contact: { name: "Name", email: "Email", phone: "Phone", title: "Title", firstname: "FirstName", lastname: "LastName" },
    opportunity: { name: "Name", stage: "StageName", amount: "Amount", close: "CloseDate" },
    lead: { name: "Name", email: "Email", company: "Company", status: "Status" },
    case: { subject: "Subject", status: "Status", priority: "Priority", number: "CaseNumber" },
  };
  return fieldMap[objectKey]?.[lower] || input;
}

function tryTemplateFallback(query: string): NlpResult | null {
  for (const tpl of TEMPLATE_PATTERNS) {
    for (const pattern of tpl.patterns) {
      const match = query.match(pattern);
      if (match) {
        const soql = tpl.build(match, query);
        if (soql) {
          return {
            soql,
            explanation: `Matched template pattern for "${query}"`,
            confidence: 0.7,
            engine: "template",
          };
        }
      }
    }
  }
  return null;
}

// ── LLM-powered SOQL generation ───────────────────────────────────────────

function getLlmConfig() {
  try {
    const provider = getSecret("llm_provider") || "openai";
    const apiKey = getSecret("llm_api_key") || "";
    const model = getSecret("llm_model") || (provider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o");
    return { provider, apiKey, model };
  } catch {
    return { provider: "openai", apiKey: "", model: "gpt-4o" };
  }
}

async function buildSchemaContext(objectHints: string[], workspaceId: number): Promise<string> {
  const allObjects = await getCachedObjects(workspaceId);
  const relevantNames = objectHints.length > 0
    ? objectHints
    : allObjects.filter((o) => o.isQueryable).slice(0, 50).map((o) => o.name);

  const lines: string[] = ["Available Salesforce Objects and Fields:"];

  for (const name of relevantNames.slice(0, 10)) {
    try {
      const fields = await getCachedFields(name, workspaceId);
      const fieldSummary = fields
        .slice(0, 40)
        .map((f: CachedField) => {
          let desc = `${f.fieldName} (${f.type})`;
          if (f.referenceTo.length > 0) desc += ` -> ${f.referenceTo.join(",")}`;
          if (f.picklistValues.length > 0) {
            const vals = f.picklistValues.filter((p) => p.active).slice(0, 8).map((p) => p.value);
            desc += ` [${vals.join("|")}]`;
          }
          return desc;
        })
        .join("; ");
      lines.push(`\n${name}: ${fieldSummary}`);
    } catch {
      lines.push(`\n${name}: (fields unavailable)`);
    }
  }

  return lines.join("\n");
}

function detectObjectHints(query: string): string[] {
  const hints: string[] = [];
  const lower = query.toLowerCase();
  for (const [key, info] of Object.entries(COMMON_OBJECTS)) {
    if (lower.includes(key)) hints.push(info.name);
  }
  return hints;
}

async function callOpenAI(prompt: string, apiKey: string, model: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a Salesforce SOQL expert. Given a natural language query and schema context, generate a valid SOQL query. Return ONLY the SOQL query on the first line, then a blank line, then a brief explanation. Do not use markdown code blocks." },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(prompt: string, apiKey: string, model: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [
        { role: "user", content: `You are a Salesforce SOQL expert. Given a natural language query and schema context, generate a valid SOQL query. Return ONLY the SOQL query on the first line, then a blank line, then a brief explanation. Do not use markdown code blocks.\n\n${prompt}` },
      ],
    }),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text || "";
}

function parseLlmResponse(response: string): { soql: string; explanation: string } {
  const lines = response.trim().split("\n");
  let soql = "";
  const explanationLines: string[] = [];
  let foundBlank = false;

  for (const line of lines) {
    if (!soql && line.trim().toUpperCase().startsWith("SELECT")) {
      soql = line.trim();
    } else if (soql && !foundBlank && line.trim() === "") {
      foundBlank = true;
    } else if (soql) {
      if (!foundBlank && (line.trim().startsWith("FROM") || line.trim().startsWith("WHERE") || line.trim().startsWith("ORDER") || line.trim().startsWith("GROUP") || line.trim().startsWith("LIMIT"))) {
        soql += " " + line.trim();
      } else {
        explanationLines.push(line);
      }
    }
  }

  if (!soql) {
    const selectMatch = response.match(/SELECT\s+[\s\S]*?(?:LIMIT\s+\d+|$)/i);
    if (selectMatch) soql = selectMatch[0].trim();
  }

  return { soql: soql || response.trim(), explanation: explanationLines.join(" ").trim() };
}

export async function generateSOQL(query: string, workspaceId = 1): Promise<NlpResult> {
  const templateResult = tryTemplateFallback(query);

  const { provider, apiKey, model } = getLlmConfig();
  if (!apiKey) {
    if (templateResult) return templateResult;
    return {
      soql: "",
      explanation: "LLM API key not configured. Configure it in Settings > Secrets under 'llm_api_key'. Template-based generation could not match your query.",
      confidence: 0,
      engine: "template",
      suggestions: [
        "Try simpler queries like 'show all accounts' or 'recent 10 contacts'",
        "Configure an OpenAI or Anthropic API key for advanced NLP",
      ],
    };
  }

  try {
    const objectHints = detectObjectHints(query);
    const schemaContext = await buildSchemaContext(objectHints, workspaceId);
    const prompt = `${schemaContext}\n\nUser query: "${query}"\n\nGenerate a valid Salesforce SOQL query for this request.`;

    let rawResponse: string;
    if (provider === "anthropic") {
      rawResponse = await callAnthropic(prompt, apiKey, model);
    } else {
      rawResponse = await callOpenAI(prompt, apiKey, model);
    }

    const { soql, explanation } = parseLlmResponse(rawResponse);

    return {
      soql,
      explanation: explanation || `Generated from "${query}" using ${provider}`,
      confidence: soql.toUpperCase().startsWith("SELECT") ? 0.9 : 0.5,
      engine: "llm",
    };
  } catch (e: any) {
    if (templateResult) {
      templateResult.suggestions = [`LLM call failed: ${e.message}. Using template fallback.`];
      return templateResult;
    }
    return {
      soql: "",
      explanation: `LLM error: ${e.message}`,
      confidence: 0,
      engine: "llm",
      suggestions: ["Check your LLM API key configuration", "Try a simpler query"],
    };
  }
}

export function validateSOQL(soql: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const upper = soql.trim().toUpperCase();

  if (!upper.startsWith("SELECT") && !upper.startsWith("SELECT ")) {
    errors.push("Query must start with SELECT");
  }

  if (!upper.includes("FROM")) {
    errors.push("Query must include a FROM clause");
  }

  const dangerousKeywords = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE"];
  for (const kw of dangerousKeywords) {
    if (upper.startsWith(kw)) {
      errors.push(`DML/DDL operations (${kw}) are not supported in SOQL`);
    }
  }

  if (soql.includes(";")) {
    errors.push("SOQL does not use semicolons");
  }

  return { valid: errors.length === 0, errors };
}

export function getLlmStatus(): { configured: boolean; provider: string; model: string } {
  const { provider, apiKey, model } = getLlmConfig();
  return { configured: !!apiKey, provider, model };
}

export function getQueryTemplates(): Array<{ name: string; description: string; soql: string; category: string }> {
  return [
    { name: "All Accounts", description: "List all accounts with key fields", soql: "SELECT Id, Name, Industry, Phone, Website, Type, BillingCity FROM Account ORDER BY Name LIMIT 200", category: "accounts" },
    { name: "Accounts by Industry", description: "Group accounts by industry", soql: "SELECT Industry, COUNT(Id) cnt FROM Account GROUP BY Industry ORDER BY COUNT(Id) DESC", category: "accounts" },
    { name: "Accounts Without Contacts", description: "Find accounts that have no contacts", soql: "SELECT Id, Name FROM Account WHERE Id NOT IN (SELECT AccountId FROM Contact WHERE AccountId != null)", category: "accounts" },
    { name: "All Contacts", description: "List all contacts with email and phone", soql: "SELECT Id, FirstName, LastName, Email, Phone, Account.Name, Title FROM Contact ORDER BY LastName LIMIT 200", category: "contacts" },
    { name: "Contacts Without Email", description: "Find contacts missing email addresses", soql: "SELECT Id, FirstName, LastName, Account.Name FROM Contact WHERE Email = null ORDER BY LastName", category: "contacts" },
    { name: "Duplicate Emails", description: "Find contacts with duplicate email addresses", soql: "SELECT Email, COUNT(Id) FROM Contact WHERE Email != null GROUP BY Email HAVING COUNT(Id) > 1", category: "contacts" },
    { name: "Open Opportunities", description: "List all open opportunities", soql: "SELECT Id, Name, StageName, Amount, CloseDate, Account.Name FROM Opportunity WHERE IsClosed = false ORDER BY CloseDate", category: "opportunities" },
    { name: "Opportunities Closing This Month", description: "Deals expected to close this month", soql: "SELECT Id, Name, StageName, Amount, CloseDate, Account.Name FROM Opportunity WHERE CloseDate = THIS_MONTH AND IsClosed = false ORDER BY Amount DESC", category: "opportunities" },
    { name: "Won Opportunities by Amount", description: "Top closed-won deals", soql: "SELECT Id, Name, Amount, CloseDate, Account.Name FROM Opportunity WHERE IsWon = true ORDER BY Amount DESC LIMIT 50", category: "opportunities" },
    { name: "Pipeline by Stage", description: "Opportunity count and amount by stage", soql: "SELECT StageName, COUNT(Id) cnt, SUM(Amount) total FROM Opportunity WHERE IsClosed = false GROUP BY StageName", category: "opportunities" },
    { name: "Open Leads", description: "List unconverted leads", soql: "SELECT Id, FirstName, LastName, Company, Status, Email, Phone FROM Lead WHERE IsConverted = false ORDER BY CreatedDate DESC LIMIT 200", category: "leads" },
    { name: "Open Cases", description: "List all open cases", soql: "SELECT Id, CaseNumber, Subject, Status, Priority, Contact.Name FROM Case WHERE IsClosed = false ORDER BY Priority, CreatedDate DESC", category: "cases" },
    { name: "Active Users", description: "List all active users", soql: "SELECT Id, Name, Email, Username, Profile.Name, UserRole.Name FROM User WHERE IsActive = true ORDER BY Name", category: "admin" },
    { name: "Recently Modified Records", description: "Records modified in the last 7 days", soql: "SELECT Id, Name, LastModifiedDate, LastModifiedBy.Name FROM Account WHERE LastModifiedDate = LAST_N_DAYS:7 ORDER BY LastModifiedDate DESC LIMIT 50", category: "admin" },
    { name: "Record Count Summary", description: "Count records across key objects", soql: "SELECT COUNT() FROM Account", category: "admin" },
  ];
}

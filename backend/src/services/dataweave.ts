import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { getMuleHome } from "./runtime";
import { getDb } from "../db/schema";

const TMP_PREFIX = "/tmp/orca-dw-";
const EXECUTION_TIMEOUT = 10000;

export interface DwExecutionResult {
  output: string;
  mimeType: string;
  executionTimeMs: number;
  engine: "mule-cli" | "java-fallback" | "simulated";
  success: boolean;
  error?: string;
}

export interface DwEngineStatus {
  available: boolean;
  engine: "mule-cli" | "java-fallback" | "none";
  muleHome: string;
  dwCliPath: string | null;
  javaAvailable: boolean;
}

export interface DwExample {
  id: string;
  name: string;
  category: string;
  description: string;
  script: string;
  sampleInput: string;
  inputMimeType: string;
  outputMimeType: string;
}

export interface DwSnippet {
  id: number;
  name: string;
  description: string;
  script: string;
  sample_input: string;
  input_mime: string;
  output_mime: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

function getDwCliPath(): string | null {
  const muleHome = getMuleHome();
  const dwPath = path.join(muleHome, "bin", "dw");
  if (fs.existsSync(dwPath)) return dwPath;
  const dwBat = path.join(muleHome, "bin", "dw.bat");
  if (fs.existsSync(dwBat)) return dwBat;
  return null;
}

function isJavaAvailable(): boolean {
  try {
    execSync("java -version 2>&1", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function findDwJars(): string | null {
  const muleHome = getMuleHome();
  const libDir = path.join(muleHome, "lib", "boot");
  if (!fs.existsSync(libDir)) return null;
  try {
    const allLibDirs = [
      path.join(muleHome, "lib", "boot"),
      path.join(muleHome, "lib", "mule"),
      path.join(muleHome, "lib", "opt"),
    ];
    const jars: string[] = [];
    for (const dir of allLibDirs) {
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith(".jar")) jars.push(path.join(dir, f));
      }
    }
    return jars.length > 0 ? jars.join(":") : null;
  } catch {
    return null;
  }
}

export function getDwEngineStatus(): DwEngineStatus {
  const muleHome = getMuleHome();
  const dwCliPath = getDwCliPath();
  const javaAvailable = isJavaAvailable();

  let engine: DwEngineStatus["engine"] = "none";
  if (dwCliPath) engine = "mule-cli";
  else if (javaAvailable && findDwJars()) engine = "java-fallback";

  return {
    available: engine !== "none",
    engine,
    muleHome,
    dwCliPath,
    javaAvailable,
  };
}

export function executeDw(
  script: string,
  input: string,
  inputMimeType = "application/json",
  outputMimeType = "application/json"
): DwExecutionResult {
  const startTime = Date.now();
  const scriptFile = `${TMP_PREFIX}${Date.now()}.dwl`;
  const inputFile = `${TMP_PREFIX}${Date.now()}-input.dat`;

  try {
    if (!script.includes("%dw")) {
      script = `%dw 2.0\noutput ${outputMimeType}\n---\n${script}`;
    }

    fs.writeFileSync(scriptFile, script, "utf8");
    fs.writeFileSync(inputFile, input, "utf8");

    const dwCliPath = getDwCliPath();
    if (dwCliPath) {
      return executeMuleCli(dwCliPath, scriptFile, inputFile, inputMimeType, outputMimeType, startTime);
    }

    if (isJavaAvailable()) {
      const classpath = findDwJars();
      if (classpath) {
        return executeJavaFallback(classpath, scriptFile, inputFile, inputMimeType, outputMimeType, startTime);
      }
    }

    return executeSimulated(script, input, inputMimeType, outputMimeType, startTime);
  } catch (err: any) {
    return {
      output: "",
      mimeType: outputMimeType,
      executionTimeMs: Date.now() - startTime,
      engine: "simulated",
      success: false,
      error: err.message || "Unknown error",
    };
  } finally {
    try { fs.unlinkSync(scriptFile); } catch {}
    try { fs.unlinkSync(inputFile); } catch {}
  }
}

function executeMuleCli(
  dwCli: string,
  scriptFile: string,
  inputFile: string,
  inputMime: string,
  outputMime: string,
  startTime: number
): DwExecutionResult {
  try {
    const muleHome = getMuleHome();
    const cmd = `cat "${inputFile}" | "${dwCli}" -f "${scriptFile}"`;
    const output = execSync(cmd, {
      timeout: EXECUTION_TIMEOUT,
      env: { ...process.env, MULE_HOME: muleHome },
      encoding: "utf8",
    });
    return {
      output: output.trim(),
      mimeType: outputMime,
      executionTimeMs: Date.now() - startTime,
      engine: "mule-cli",
      success: true,
    };
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message || "DW CLI execution failed";
    return {
      output: "",
      mimeType: outputMime,
      executionTimeMs: Date.now() - startTime,
      engine: "mule-cli",
      success: false,
      error: stderr,
    };
  }
}

function executeJavaFallback(
  classpath: string,
  scriptFile: string,
  inputFile: string,
  inputMime: string,
  outputMime: string,
  startTime: number
): DwExecutionResult {
  try {
    const cmd = `java -cp "${classpath}" org.mule.weave.v2.cli.DataWeaveCLI -f "${scriptFile}" < "${inputFile}"`;
    const output = execSync(cmd, {
      timeout: EXECUTION_TIMEOUT,
      encoding: "utf8",
    });
    return {
      output: output.trim(),
      mimeType: outputMime,
      executionTimeMs: Date.now() - startTime,
      engine: "java-fallback",
      success: true,
    };
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message || "Java DW execution failed";
    return {
      output: "",
      mimeType: outputMime,
      executionTimeMs: Date.now() - startTime,
      engine: "java-fallback",
      success: false,
      error: stderr,
    };
  }
}

function executeSimulated(
  script: string,
  input: string,
  inputMime: string,
  outputMime: string,
  startTime: number
): DwExecutionResult {
  try {
    const body = extractDwBody(script);
    let result: unknown;

    const inputData = inputMime === "application/json" ? JSON.parse(input) : input;

    if (body.includes("payload") && body.trim() === "payload") {
      result = inputData;
    } else if (body.includes("payload map")) {
      if (Array.isArray(inputData)) {
        result = inputData.map((item: unknown) => item);
      } else {
        result = inputData;
      }
    } else if (body.includes("payload filter")) {
      result = Array.isArray(inputData) ? inputData : inputData;
    } else if (body.includes("sizeOf")) {
      if (Array.isArray(inputData)) result = inputData.length;
      else if (typeof inputData === "string") result = inputData.length;
      else result = Object.keys(inputData).length;
    } else if (body.includes("upper(") || body.includes("upper (")) {
      result = typeof inputData === "string" ? inputData.toUpperCase() : inputData;
    } else if (body.includes("lower(") || body.includes("lower (")) {
      result = typeof inputData === "string" ? inputData.toLowerCase() : inputData;
    } else if (body.match(/^"[^"]*"$/) || body.match(/^'[^']*'$/)) {
      result = body.slice(1, -1);
    } else if (!isNaN(Number(body))) {
      result = Number(body);
    } else if (body === "true" || body === "false") {
      result = body === "true";
    } else if (body === "null") {
      result = null;
    } else if (body.startsWith("{") || body.startsWith("[")) {
      result = inputData;
    } else {
      result = inputData;
    }

    const output = outputMime === "application/json"
      ? JSON.stringify(result, null, 2)
      : String(result);

    return {
      output,
      mimeType: outputMime,
      executionTimeMs: Date.now() - startTime,
      engine: "simulated",
      success: true,
    };
  } catch (err: any) {
    return {
      output: "",
      mimeType: outputMime,
      executionTimeMs: Date.now() - startTime,
      engine: "simulated",
      success: false,
      error: `Simulated engine: ${err.message}. Install Mule Runtime for full DataWeave support.`,
    };
  }
}

function extractDwBody(script: string): string {
  const parts = script.split("---");
  if (parts.length >= 2) return parts.slice(1).join("---").trim();
  return script.trim();
}

// --- Snippet CRUD ---

export function getSnippets(workspaceId = 1): DwSnippet[] {
  const db = getDb();
  return db.query("SELECT * FROM dw_snippets WHERE workspace_id = ? ORDER BY updated_at DESC").all(workspaceId) as DwSnippet[];
}

export function saveSnippet(data: { name: string; description?: string; script: string; sampleInput?: string; inputMime?: string; outputMime?: string; tags?: string[] }, workspaceId = 1): number {
  const db = getDb();
  db.run(
    "INSERT INTO dw_snippets (name, description, script, sample_input, input_mime, output_mime, tags, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [data.name, data.description || "", data.script, data.sampleInput || "{}", data.inputMime || "application/json", data.outputMime || "application/json", JSON.stringify(data.tags || []), workspaceId]
  );
  return (db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id;
}

export function updateSnippet(id: number, data: Partial<{ name: string; description: string; script: string; sampleInput: string; inputMime: string; outputMime: string; tags: string[] }>): void {
  const db = getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (data.name !== undefined) { sets.push("name = ?"); vals.push(data.name); }
  if (data.description !== undefined) { sets.push("description = ?"); vals.push(data.description); }
  if (data.script !== undefined) { sets.push("script = ?"); vals.push(data.script); }
  if (data.sampleInput !== undefined) { sets.push("sample_input = ?"); vals.push(data.sampleInput); }
  if (data.inputMime !== undefined) { sets.push("input_mime = ?"); vals.push(data.inputMime); }
  if (data.outputMime !== undefined) { sets.push("output_mime = ?"); vals.push(data.outputMime); }
  if (data.tags !== undefined) { sets.push("tags = ?"); vals.push(JSON.stringify(data.tags)); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  db.run(`UPDATE dw_snippets SET ${sets.join(", ")} WHERE id = ?`, vals);
}

export function deleteSnippet(id: number): void {
  getDb().run("DELETE FROM dw_snippets WHERE id = ?", [id]);
}

// --- Execution history ---

export function saveExecution(data: DwExecutionResult & { script: string; inputData: string; inputMime: string; outputMime: string }, workspaceId = 1): number {
  const db = getDb();
  db.run(
    "INSERT INTO dw_executions (script, input_data, input_mime, output_mime, output_data, success, error_message, execution_time_ms, engine, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [data.script, data.inputData, data.inputMime, data.outputMime, data.output, data.success ? 1 : 0, data.error || null, data.executionTimeMs, data.engine, workspaceId]
  );
  return (db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id;
}

export function getExecutionHistory(workspaceId = 1): unknown[] {
  return getDb().query(
    "SELECT id, script, input_mime, output_mime, success, error_message, execution_time_ms, engine, executed_at FROM dw_executions WHERE workspace_id = ? ORDER BY executed_at DESC LIMIT 50"
  ).all(workspaceId);
}

export function getExecutionById(id: number): unknown {
  return getDb().query("SELECT * FROM dw_executions WHERE id = ?").get(id);
}

// --- Built-in examples ---

export function getBuiltInExamples(): DwExample[] {
  return EXAMPLES;
}

const EXAMPLES: DwExample[] = [
  {
    id: "basics-hello",
    name: "Hello World",
    category: "Basics",
    description: "The simplest DataWeave script",
    script: '%dw 2.0\noutput application/json\n---\n"Hello, DataWeave!"',
    sampleInput: "{}",
    inputMimeType: "application/json",
    outputMimeType: "application/json",
  },
  {
    id: "basics-variables",
    name: "Variable Assignment",
    category: "Basics",
    description: "Define and use local variables",
    script: '%dw 2.0\noutput application/json\nvar greeting = "Hello"\nvar name = payload.name\n---\n{\n  message: greeting ++ ", " ++ name ++ "!"\n}',
    sampleInput: '{ "name": "MuleSoft Developer" }',
    inputMimeType: "application/json",
    outputMimeType: "application/json",
  },
  {
    id: "basics-coercion",
    name: "Type Coercion",
    category: "Basics",
    description: "Convert between types using 'as'",
    script: '%dw 2.0\noutput application/json\n---\n{\n  asString: 42 as String,\n  asNumber: "100" as Number,\n  asDate: "2025-01-15" as Date\n}',
    sampleInput: "{}",
    inputMimeType: "application/json",
    outputMimeType: "application/json",
  },
  {
    id: "arrays-map",
    name: "Array Map",
    category: "Arrays",
    description: "Transform each element of an array",
    script: '%dw 2.0\noutput application/json\n---\npayload.items map {\n  name: upper($.name),\n  total: $.price * $.quantity\n}',
    sampleInput: '{\n  "items": [\n    { "name": "widget", "price": 9.99, "quantity": 3 },\n    { "name": "gadget", "price": 24.50, "quantity": 1 },\n    { "name": "doohickey", "price": 4.75, "quantity": 10 }\n  ]\n}',
    inputMimeType: "application/json",
    outputMimeType: "application/json",
  },
  {
    id: "arrays-filter",
    name: "Array Filter",
    category: "Arrays",
    description: "Keep only elements matching a condition",
    script: '%dw 2.0\noutput application/json\n---\npayload.users filter ($.age >= 18)',
    sampleInput: '{\n  "users": [\n    { "name": "Alice", "age": 30 },\n    { "name": "Bob", "age": 15 },\n    { "name": "Charlie", "age": 25 },\n    { "name": "Diana", "age": 12 }\n  ]\n}',
    inputMimeType: "application/json",
    outputMimeType: "application/json",
  },
  {
    id: "arrays-reduce",
    name: "Array Reduce",
    category: "Arrays",
    description: "Accumulate array values into a single result",
    script: '%dw 2.0\noutput application/json\n---\n{\n  total: payload.orders reduce ((item, acc = 0) -> acc + item.amount),\n  count: sizeOf(payload.orders)\n}',
    sampleInput: '{\n  "orders": [\n    { "id": 1, "amount": 150 },\n    { "id": 2, "amount": 230 },\n    { "id": 3, "amount": 75 }\n  ]\n}',
    inputMimeType: "application/json",
    outputMimeType: "application/json",
  },
  {
    id: "arrays-groupby",
    name: "Group By",
    category: "Arrays",
    description: "Group array elements by a key",
    script: '%dw 2.0\noutput application/json\n---\npayload.employees groupBy $.department',
    sampleInput: '{\n  "employees": [\n    { "name": "Alice", "department": "Engineering" },\n    { "name": "Bob", "department": "Marketing" },\n    { "name": "Charlie", "department": "Engineering" },\n    { "name": "Diana", "department": "Marketing" }\n  ]\n}',
    inputMimeType: "application/json",
    outputMimeType: "application/json",
  },
  {
    id: "arrays-distinctby",
    name: "Distinct By",
    category: "Arrays",
    description: "Remove duplicate elements by a key",
    script: '%dw 2.0\noutput application/json\n---\npayload.items distinctBy $.category',
    sampleInput: '{\n  "items": [\n    { "name": "A", "category": "fruit" },\n    { "name": "B", "category": "veggie" },\n    { "name": "C", "category": "fruit" },\n    { "name": "D", "category": "dairy" }\n  ]\n}',
    inputMimeType: "application/json",
    outputMimeType: "application/json",
  },
  {
    id: "objects-mapobject",
    name: "Map Object",
    category: "Objects",
    description: "Transform each key-value pair of an object",
    script: '%dw 2.0\noutput application/json\n---\npayload.config mapObject ((value, key) ->\n  (upper(key)): value\n)',
    sampleInput: '{\n  "config": {\n    "host": "localhost",\n    "port": 8080,\n    "debug": true\n  }\n}',
    inputMimeType: "application/json",
    outputMimeType: "application/json",
  },
  {
    id: "objects-pluck",
    name: "Pluck (Object to Array)",
    category: "Objects",
    description: "Convert object key-value pairs into an array",
    script: '%dw 2.0\noutput application/json\n---\npayload.scores pluck ((value, key) -> {\n  subject: key,\n  score: value\n})',
    sampleInput: '{\n  "scores": {\n    "math": 95,\n    "science": 88,\n    "english": 92\n  }\n}',
    inputMimeType: "application/json",
    outputMimeType: "application/json",
  },
  {
    id: "formats-json-to-xml",
    name: "JSON to XML",
    category: "Formats",
    description: "Transform JSON input to XML output",
    script: '%dw 2.0\noutput application/xml\n---\n{\n  person: {\n    firstName: payload.first_name,\n    lastName: payload.last_name,\n    email: payload.email\n  }\n}',
    sampleInput: '{\n  "first_name": "John",\n  "last_name": "Doe",\n  "email": "john@example.com"\n}',
    inputMimeType: "application/json",
    outputMimeType: "application/xml",
  },
  {
    id: "formats-json-to-csv",
    name: "JSON to CSV",
    category: "Formats",
    description: "Transform a JSON array to CSV",
    script: '%dw 2.0\noutput application/csv\n---\npayload.contacts map {\n  Name: $.name,\n  Email: $.email,\n  Phone: $.phone\n}',
    sampleInput: '{\n  "contacts": [\n    { "name": "Alice", "email": "alice@test.com", "phone": "555-0001" },\n    { "name": "Bob", "email": "bob@test.com", "phone": "555-0002" }\n  ]\n}',
    inputMimeType: "application/json",
    outputMimeType: "application/csv",
  },
  {
    id: "strings-interpolation",
    name: "String Interpolation",
    category: "Strings",
    description: "Build strings with embedded expressions",
    script: '%dw 2.0\noutput application/json\n---\n{\n  greeting: "Hello, $(payload.name)! You have $(sizeOf(payload.items)) items.",\n  upper: upper(payload.name),\n  lower: lower(payload.name),\n  trimmed: trim("  spaces  ")\n}',
    sampleInput: '{\n  "name": "MuleSoft",\n  "items": [1, 2, 3]\n}',
    inputMimeType: "application/json",
    outputMimeType: "application/json",
  },
  {
    id: "advanced-pattern-match",
    name: "Pattern Matching",
    category: "Advanced",
    description: "Use match for conditional logic",
    script: '%dw 2.0\noutput application/json\n\nfun classify(score) = score match {\n  case s if s >= 90 -> "A"\n  case s if s >= 80 -> "B"\n  case s if s >= 70 -> "C"\n  else -> "F"\n}\n---\npayload.students map {\n  name: $.name,\n  grade: classify($.score)\n}',
    sampleInput: '{\n  "students": [\n    { "name": "Alice", "score": 95 },\n    { "name": "Bob", "score": 82 },\n    { "name": "Charlie", "score": 67 },\n    { "name": "Diana", "score": 91 }\n  ]\n}',
    inputMimeType: "application/json",
    outputMimeType: "application/json",
  },
  {
    id: "advanced-custom-functions",
    name: "Custom Functions",
    category: "Advanced",
    description: "Define and use reusable functions",
    script: '%dw 2.0\noutput application/json\n\nfun fullName(person) = person.firstName ++ " " ++ person.lastName\nfun initials(person) = person.firstName[0] ++ person.lastName[0]\n---\npayload.people map {\n  full: fullName($),\n  initials: initials($),\n  display: "$(fullName($)) ($(initials($)))"\n}',
    sampleInput: '{\n  "people": [\n    { "firstName": "John", "lastName": "Doe" },\n    { "firstName": "Jane", "lastName": "Smith" }\n  ]\n}',
    inputMimeType: "application/json",
    outputMimeType: "application/json",
  },
];

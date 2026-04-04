import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

interface TreeNode { name: string; path: string; type: "file" | "directory"; size?: number; children?: TreeNode[] }

function FileTree({ nodes, onSelect, selected }: { nodes: TreeNode[]; onSelect: (p: string) => void; selected: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (p: string) => setExpanded((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });

  return (
    <div className="text-sm">
      {nodes.map((node) => (
        <div key={node.path}>
          {node.type === "directory" ? (
            <>
              <button onClick={() => toggle(node.path)}
                className="flex items-center gap-1 w-full px-2 py-1 hover:bg-slate-100 rounded text-left cursor-pointer">
                <span className="text-xs">{expanded.has(node.path) ? "\u25BE" : "\u25B8"}</span>
                <span className="text-amber-600">&#128193;</span>
                <span className="text-slate-700">{node.name}</span>
              </button>
              {expanded.has(node.path) && node.children && (
                <div className="ml-4"><FileTree nodes={node.children} onSelect={onSelect} selected={selected} /></div>
              )}
            </>
          ) : (
            <button onClick={() => onSelect(node.path)}
              className={`flex items-center gap-1 w-full px-2 py-1 rounded text-left cursor-pointer ${selected === node.path ? "bg-primary-bg text-primary-text" : "hover:bg-slate-100 text-slate-600"}`}>
              <span className="text-xs opacity-0">{"\u25B8"}</span>
              <span className="text-slate-400">&#128196;</span>
              <span>{node.name}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function ProjectExplorer() {
  const [projects, setProjects] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [file, setFile] = useState<{ path: string; content: string } | null>(null);
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get<string[]>("/projects/list").then(setProjects).catch(() => {}); }, []);

  const loadProject = async (name: string) => {
    setSelected(name); setFile(null); setLoading(true);
    try {
      const [t, i] = await Promise.all([api.get<TreeNode[]>(`/projects/${name}/tree`), api.get<any>(`/projects/${name}/info`)]);
      setTree(t); setInfo(i);
    } catch {} finally { setLoading(false); }
  };

  const openFile = async (filePath: string) => {
    try { setFile(await api.get<{ path: string; content: string }>(`/projects/${selected}/file?path=${encodeURIComponent(filePath)}`)); } catch {}
  };

  const ext = file?.path.split(".").pop() || "";
  const langMap: Record<string, string> = { xml: "xml", raml: "yaml", json: "json", py: "python", md: "markdown", yml: "yaml", yaml: "yaml", ts: "typescript", js: "javascript" };

  return (
    <Card title="Project Explorer">
      <div className="flex gap-3 mb-4 items-center">
        <select value={selected} onChange={(e) => e.target.value && loadProject(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary outline-none">
          <option value="">Select a project</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {info && (
          <div className="flex gap-3 text-xs text-slate-500">
            <span>Branch: <span className="font-mono text-primary">{info.branch}</span></span>
            {info.lastCommit && <span>Last: <span className="font-mono">{info.lastCommit.hash}</span> {info.lastCommit.message}</span>}
          </div>
        )}
      </div>
      {loading ? <p className="text-sm text-slate-500">Loading...</p> : !selected ? (
        <p className="text-sm text-slate-400">Select a project to browse its files.</p>
      ) : (
        <div className="flex gap-4 min-h-[400px]">
          <div className="w-64 shrink-0 border-r border-slate-200 pr-4 overflow-y-auto max-h-[500px]">
            <FileTree nodes={tree} onSelect={openFile} selected={file?.path || ""} />
          </div>
          <div className="flex-1 overflow-hidden">
            {file ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-mono text-slate-600">{file.path}</span>
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{langMap[ext] || ext}</span>
                </div>
                <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-auto max-h-[450px] whitespace-pre-wrap">{file.content}</pre>
              </div>
            ) : (
              <p className="text-sm text-slate-400 mt-12 text-center">Click a file to view its contents</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

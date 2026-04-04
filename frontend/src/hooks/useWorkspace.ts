import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { api } from "../api/client";

export interface Workspace {
  id: number;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  is_default: number;
  projectCount: number;
}

export interface WorkspaceContextValue {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  switchWorkspace: (id: number) => void;
  createWorkspace: (name: string, description?: string) => Promise<Workspace>;
  updateWorkspace: (id: number, data: { name?: string; description?: string }) => Promise<void>;
  deleteWorkspace: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = "orca_active_workspace";

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspaceProvider(): WorkspaceContextValue {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : 1;
  });
  const [loading, setLoading] = useState(true);

  const loadWorkspaces = useCallback(async () => {
    try {
      const data = await api.get<Workspace[]>("/workspaces");
      setWorkspaces(data);
      if (data.length > 0 && !data.find((w) => w.id === activeId)) {
        const def = data.find((w) => w.is_default) || data[0];
        setActiveId(def.id);
        localStorage.setItem(STORAGE_KEY, String(def.id));
      }
    } catch {
      // on first load before auth, workspaces may 401 -- ignore
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const activeWorkspace = workspaces.find((w) => w.id === activeId) || workspaces[0] || null;

  const switchWorkspace = useCallback((id: number) => {
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  const createWorkspace = useCallback(async (name: string, description?: string): Promise<Workspace> => {
    const created = await api.post<Workspace>("/workspaces", { name, description });
    await loadWorkspaces();
    return created;
  }, [loadWorkspaces]);

  const updateWorkspace = useCallback(async (id: number, data: { name?: string; description?: string }) => {
    await api.patch(`/workspaces/${id}`, data);
    await loadWorkspaces();
  }, [loadWorkspaces]);

  const deleteWorkspace = useCallback(async (id: number) => {
    await api.delete(`/workspaces/${id}`);
    if (activeId === id) {
      const remaining = workspaces.filter((w) => w.id !== id);
      const def = remaining.find((w) => w.is_default) || remaining[0];
      if (def) {
        setActiveId(def.id);
        localStorage.setItem(STORAGE_KEY, String(def.id));
      }
    }
    await loadWorkspaces();
  }, [activeId, workspaces, loadWorkspaces]);

  return {
    activeWorkspace,
    workspaces,
    loading,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    refresh: loadWorkspaces,
  };
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceContext.Provider");
  return ctx;
}

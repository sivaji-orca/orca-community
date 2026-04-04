import { useState, useEffect, createContext, useContext, useCallback } from "react";

export interface Branding {
  appName: string;
  appShortName: string;
  description: string;
  logoSvg: string | null;
  repoName: string | null;
  forkedAt: string | null;
}

const DEFAULT_BRANDING: Branding = {
  appName: "Orca Community Edition",
  appShortName: "Orca",
  description: "MuleSoft Developer Productivity Tool",
  logoSvg: null,
  repoName: null,
  forkedAt: null,
};

interface BrandingContextType {
  branding: Branding;
  isCustomBranded: boolean;
  refresh: () => Promise<void>;
}

export const BrandingContext = createContext<BrandingContextType>({
  branding: DEFAULT_BRANDING,
  isCustomBranded: false,
  refresh: async () => {},
});

export function useBrandingProvider() {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/branding");
      if (res.ok) {
        const data = await res.json();
        if (data.appName) setBranding(data);
      }
    } catch { /* use defaults */ }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isCustomBranded = branding.appName !== DEFAULT_BRANDING.appName;

  return { branding, isCustomBranded, refresh };
}

export function useBranding() {
  return useContext(BrandingContext);
}

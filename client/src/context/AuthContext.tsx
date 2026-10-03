'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro';
  role: 'owner' | 'member';
  usage?: {
    yearMonth: string;
    checkCount: number;
    limit: number;
    remaining: number;
  };
}

interface AuthContextType {
  user: User | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  token: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => void;
  switchWorkspace: (workspaceId: string) => void;
  refreshWorkspace: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load session on startup
  useEffect(() => {
    const savedToken = localStorage.getItem('trustlayer_token');
    const savedWsId = localStorage.getItem('trustlayer_ws_id');

    if (!savedToken) {
      setLoading(false);
      return;
    }

    setToken(savedToken);

    // Fetch me & workspaces
    api
      .get<{ user: User; workspaces: Workspace[] }>('/v1/auth/me')
      .then((data) => {
        setUser(data.user);
        setWorkspaces(data.workspaces || []);

        if (data.workspaces && data.workspaces.length > 0) {
          const selected = data.workspaces.find((w) => w.id === savedWsId) || data.workspaces[0];
          setWorkspace(selected);
          localStorage.setItem('trustlayer_ws_id', selected.id);
        }
      })
      .catch((err) => {
        console.error('Failed to load session:', err);
        localStorage.removeItem('trustlayer_token');
        setToken(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: User; workspace: Workspace; token: string }>('/v1/auth/login', {
      email,
      password,
    });

    localStorage.setItem('trustlayer_token', res.token);
    setToken(res.token);
    setUser(res.user);

    if (res.workspace) {
      setWorkspace(res.workspace);
      localStorage.setItem('trustlayer_ws_id', res.workspace.id);
    }

    // Refresh all workspaces
    const meData = await api.get<{ workspaces: Workspace[] }>('/v1/auth/me');
    setWorkspaces(meData.workspaces || []);
  };

  const signup = async (name: string, email: string, password: string) => {
    const res = await api.post<{ user: User; workspace: Workspace; token: string }>('/v1/auth/signup', {
      name,
      email,
      password,
    });

    localStorage.setItem('trustlayer_token', res.token);
    setToken(res.token);
    setUser(res.user);

    if (res.workspace) {
      setWorkspace(res.workspace);
      setWorkspaces([res.workspace]);
      localStorage.setItem('trustlayer_ws_id', res.workspace.id);
    }
  };

  const logout = () => {
    localStorage.removeItem('trustlayer_token');
    localStorage.removeItem('trustlayer_ws_id');
    setToken(null);
    setUser(null);
    setWorkspace(null);
    setWorkspaces([]);
    window.location.href = '/login';
  };

  const switchWorkspace = (workspaceId: string) => {
    const target = workspaces.find((w) => w.id === workspaceId);
    if (target) {
      setWorkspace(target);
      localStorage.setItem('trustlayer_ws_id', target.id);
    }
  };

  const refreshWorkspace = async () => {
    if (!workspace) return;
    try {
      const refreshed = await api.get<Workspace>(`/v1/workspaces/${workspace.id}`);
      setWorkspace(refreshed);
      setWorkspaces((prev) => prev.map((w) => (w.id === refreshed.id ? refreshed : w)));
    } catch (e) {
      console.warn('Failed to refresh workspace:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        workspaces,
        token,
        loading,
        login,
        signup,
        logout,
        switchWorkspace,
        refreshWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

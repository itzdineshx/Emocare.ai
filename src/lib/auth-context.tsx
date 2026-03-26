import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AuthTokenResponse,
  UserRecord,
  clearAuthToken,
  createChild,
  getAuthToken,
  getMe,
  listChildren,
  login,
  registerParent,
  setAuthToken,
} from './api';

interface AuthContextValue {
  user: UserRecord | null;
  token: string | null;
  children: UserRecord[];
  selectedChildId: string | null;
  isLoading: boolean;
  loginUser: (email: string, password: string) => Promise<void>;
  registerParentUser: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshChildren: () => Promise<void>;
  createChildUser: (name: string, email: string, password: string) => Promise<void>;
  setSelectedChildId: (childId: string | null) => void;
}

const SELECTED_CHILD_KEY = 'emocare-selected-child-id';
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [childrenList, setChildrenList] = useState<UserRecord[]>([]);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChildId, setSelectedChildIdState] = useState<string | null>(localStorage.getItem(SELECTED_CHILD_KEY));

  const applyLogin = async (auth: AuthTokenResponse) => {
    setAuthToken(auth.access_token);
    setToken(auth.access_token);
    setUser(auth.user);

    if (auth.user.role === 'parent') {
      const parentChildren = await listChildren();
      setChildrenList(parentChildren);
      const fallbackChild = parentChildren[0]?.user_id || null;
      setSelectedChildIdState((previous) => previous || fallbackChild);
    } else {
      setChildrenList([]);
      setSelectedChildIdState(auth.user.user_id);
    }
  };

  const refreshChildren = async () => {
    if (user?.role !== 'parent') {
      return;
    }

    const parentChildren = await listChildren();
    setChildrenList(parentChildren);
    if (parentChildren.length === 0) {
      setSelectedChildIdState(null);
      return;
    }

    const stillExists = parentChildren.some((child) => child.user_id === selectedChildId);
    if (!stillExists) {
      setSelectedChildIdState(parentChildren[0].user_id);
    }
  };

  const loginUser = async (email: string, password: string) => {
    const auth = await login({ email, password });
    await applyLogin(auth);
  };

  const registerParentUser = async (name: string, email: string, password: string) => {
    await registerParent({ name, email, password });
    const auth = await login({ email, password });
    await applyLogin(auth);
  };

  const createChildUser = async (name: string, email: string, password: string) => {
    await createChild({ name, email, password });
    await refreshChildren();
  };

  const logout = () => {
    clearAuthToken();
    setToken(null);
    setUser(null);
    setChildrenList([]);
    setSelectedChildIdState(null);
    localStorage.removeItem(SELECTED_CHILD_KEY);
  };

  const setSelectedChildId = (childId: string | null) => {
    setSelectedChildIdState(childId);
    if (childId) {
      localStorage.setItem(SELECTED_CHILD_KEY, childId);
    } else {
      localStorage.removeItem(SELECTED_CHILD_KEY);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const currentToken = getAuthToken();
      if (!currentToken) {
        setIsLoading(false);
        return;
      }

      try {
        const me = await getMe();
        setToken(currentToken);
        setUser(me);

        if (me.role === 'parent') {
          const parentChildren = await listChildren();
          setChildrenList(parentChildren);
          const fallbackChild = parentChildren[0]?.user_id || null;
          setSelectedChildIdState((previous) => previous || fallbackChild);
        } else {
          setChildrenList([]);
          setSelectedChildIdState(me.user_id);
        }
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      children: childrenList,
      selectedChildId,
      isLoading,
      loginUser,
      registerParentUser,
      logout,
      refreshChildren,
      createChildUser,
      setSelectedChildId,
    }),
    [user, token, childrenList, selectedChildId, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

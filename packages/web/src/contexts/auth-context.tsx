import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface AuthState {
  token: string | null;
  username: string | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, username: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AUTH_TOKEN_KEY = "site_auth_token";
const AUTH_USERNAME_KEY = "site_auth_username";

function loadAuth(): AuthState {
  return {
    token: localStorage.getItem(AUTH_TOKEN_KEY),
    username: localStorage.getItem(AUTH_USERNAME_KEY),
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(loadAuth);

  const login = useCallback((token: string, username: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USERNAME_KEY, username);
    setAuth({ token, username });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USERNAME_KEY);
    setAuth({ token: null, username: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...auth,
      login,
      logout,
      isAuthenticated: auth.token !== null,
    }),
    [auth, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

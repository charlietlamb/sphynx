import {
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import type {
  PaletteContribution,
  PaletteMode,
} from "@/components/command-palette/palette-commands";
import { useCommandK } from "@/components/command-palette/use-command-k";

const CommandPalette = lazy(
  () => import("@/components/command-palette/command-palette")
);

interface CommandPaletteContextValue {
  contributions: readonly PaletteContribution[];
  mode: PaletteMode;
  open: boolean;
  register: (id: string, contribution: PaletteContribution) => () => void;
  setMode: (mode: PaletteMode) => void;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null
);

interface PaletteState {
  mode: PaletteMode;
  open: boolean;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PaletteState>({
    mode: "root",
    open: false,
  });
  const [registrations, setRegistrations] = useState<
    ReadonlyMap<string, PaletteContribution>
  >(new Map());

  const register = useCallback(
    (id: string, contribution: PaletteContribution) => {
      setRegistrations((current) => {
        const next = new Map(current);
        next.set(id, contribution);
        return next;
      });
      return () => {
        setRegistrations((current) => {
          const next = new Map(current);
          next.delete(id);
          return next;
        });
      };
    },
    []
  );

  const openPalette = useCallback((next: boolean) => {
    setState({ mode: "root", open: next });
  }, []);

  const setMode = useCallback((mode: PaletteMode) => {
    setState((current) => ({ ...current, mode }));
  }, []);

  const toggle = useCallback(() => {
    setState((current) => ({ mode: "root", open: !current.open }));
  }, []);
  useCommandK(toggle);

  const value = useMemo(
    () => ({
      contributions: [...registrations.values()],
      mode: state.mode,
      open: state.open,
      register,
      setMode,
      setOpen: openPalette,
    }),
    [registrations, state, register, setMode, openPalette]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {state.open ? (
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      ) : null}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette requires CommandPaletteProvider");
  }
  return context;
}

export function useRegisterCommands(contribution: PaletteContribution) {
  const id = useId();
  const { register } = useCommandPalette();
  useEffect(() => register(id, contribution), [register, id, contribution]);
}

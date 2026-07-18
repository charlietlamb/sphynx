import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

// biome-ignore lint/suspicious/noExplicitAny: dialog prop maps vary per app
export type DialogComponentMap = Record<string, any>;

export interface DialogEntry<TMap extends DialogComponentMap> {
  key: keyof TMap;
  props: TMap[keyof TMap];
}

export interface DialogContextValue<TMap extends DialogComponentMap> {
  close: () => void;
  closeAll: () => void;
  open: <K extends keyof TMap>(key: K, props: TMap[K]) => void;
  stack: DialogEntry<TMap>[];
}

export type DialogRegistry<TMap extends DialogComponentMap> = {
  [K in keyof TMap]: (props: TMap[K]) => ReactNode;
};

export interface DialogSystem<TMap extends DialogComponentMap> {
  DialogProvider: (props: {
    registry: DialogRegistry<TMap>;
    children: ReactNode;
  }) => ReactNode;
  useDialog: () => DialogContextValue<TMap>;
  useDialogOpen: (key: keyof TMap) => boolean;
}

export function createDialogSystem<
  TMap extends DialogComponentMap,
>(): DialogSystem<TMap> {
  const DialogContext = createContext<DialogContextValue<TMap> | null>(null);

  function useDialog(): DialogContextValue<TMap> {
    const context = useContext(DialogContext);
    if (!context) {
      throw new Error("useDialog must be used within a DialogProvider");
    }
    return context;
  }

  function useDialogOpen(key: keyof TMap): boolean {
    return useDialog().stack.some((entry) => entry.key === key);
  }

  function DialogRenderer({ registry }: { registry: DialogRegistry<TMap> }) {
    const { stack } = useDialog();
    const keys = Object.keys(registry) as (keyof TMap)[];

    return (
      <>
        {keys.map((key) => {
          const Dialog = registry[key] as (props: object) => ReactNode;
          const entry = stack.find((item) => item.key === key);
          if (!entry) {
            return null;
          }
          return <Dialog key={String(key)} {...(entry.props as object)} />;
        })}
      </>
    );
  }

  function DialogProvider({
    registry,
    children,
  }: {
    registry: DialogRegistry<TMap>;
    children: ReactNode;
  }) {
    const [stack, setStack] = useState<DialogEntry<TMap>[]>([]);

    const value = useMemo<DialogContextValue<TMap>>(
      () => ({
        stack,
        open: (key, props) => {
          requestAnimationFrame(() => {
            setStack((prev) => [...prev, { key, props } as DialogEntry<TMap>]);
          });
        },
        close: () => setStack((prev) => prev.slice(0, -1)),
        closeAll: () => setStack([]),
      }),
      [stack]
    );

    return (
      <DialogContext.Provider value={value}>
        {children}
        <DialogRenderer registry={registry} />
      </DialogContext.Provider>
    );
  }

  return { DialogProvider, useDialog, useDialogOpen };
}

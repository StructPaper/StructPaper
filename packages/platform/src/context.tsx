'use client';

import React from 'react';
import type {
  Capabilities,
  PlatformKind,
  PlatformServices,
  UpdateErrorCode,
  UpdateInfo,
  UpdateService,
  UpdateState,
  WindowService,
} from './types';

const PlatformContext = React.createContext<PlatformServices | null>(null);

export interface PlatformProviderProps {
  value: PlatformServices;
  children: React.ReactNode;
}

export function PlatformProvider({ value, children }: PlatformProviderProps): React.ReactElement {
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): PlatformServices {
  const ctx = React.useContext(PlatformContext);
  if (!ctx) {
    throw new Error('usePlatform must be used within a PlatformProvider');
  }
  return ctx;
}

/** Reads platform services without throwing when rendered outside PlatformProvider. */
export function useOptionalPlatform(): PlatformServices | null {
  return React.useContext(PlatformContext);
}

export function useCapabilities(): Capabilities {
  return usePlatform().capabilities;
}

export function useUpdateService(): UpdateService {
  return usePlatform().updates;
}

export function useWindowService(): WindowService {
  return usePlatform().window;
}

export interface DownloadProgress {
  received: number;
  total?: number;
  percent?: number;
}

export interface UseAppUpdaterReturn {
  state: UpdateState;
  hasUpdate: boolean;
  updateInfo: UpdateInfo | null;
  isChecking: boolean;
  isDownloading: boolean;
  isReady: boolean;
  isInstalling: boolean;
  error: { code: UpdateErrorCode; message: string; retryAt?: number } | null;
  downloadProgress: DownloadProgress | null;
  checkForUpdates: (opts?: { manual?: boolean }) => Promise<UpdateInfo | null>;
  startUpdate: () => Promise<void>;
  restart: () => Promise<void>;
  dismissUpdate: (hours?: number) => void;
  skipVersion: (version?: string) => void;
  remindLater: (hours: number) => void;
}

export function useAppUpdater(): UseAppUpdaterReturn {
  const updateService = useUpdateService();
  const [state, setState] = React.useState<UpdateState>(() => updateService.getState());

  React.useEffect(() => {
    setState(updateService.getState());
    return updateService.subscribe((nextState) => {
      setState(nextState);
    });
  }, [updateService]);

  const hasUpdate =
    state.s === 'available' ||
    state.s === 'downloading' ||
    state.s === 'ready' ||
    state.s === 'installing';

  const updateInfo = 'info' in state ? state.info : null;
  const isChecking = state.s === 'checking';
  const isDownloading = state.s === 'downloading';
  const isReady = state.s === 'ready';
  const isInstalling = state.s === 'installing';
  const error =
    state.s === 'error'
      ? { code: state.code, message: state.message, retryAt: state.retryAt }
      : null;

  const downloadProgress: DownloadProgress | null =
    state.s === 'downloading'
      ? {
          received: state.received,
          total: state.total,
          percent:
            state.total && state.total > 0
              ? Math.round((state.received / state.total) * 100)
              : undefined,
        }
      : null;

  const checkForUpdates = React.useCallback(
    async (opts?: { manual?: boolean }) => {
      return updateService.check(opts);
    },
    [updateService]
  );

  const startUpdate = React.useCallback(async () => {
    if (updateInfo) {
      await updateService.install(updateInfo);
    }
  }, [updateService, updateInfo]);

  const restart = React.useCallback(async () => {
    await updateService.restart();
  }, [updateService]);

  const dismissUpdate = React.useCallback(
    (hours = 24) => {
      updateService.remindLater(hours);
    },
    [updateService]
  );

  const skipVersion = React.useCallback(
    (version?: string) => {
      const v = version ?? updateInfo?.version;
      if (v) {
        updateService.skipVersion(v);
      }
    },
    [updateService, updateInfo]
  );

  const remindLater = React.useCallback(
    (hours: number) => {
      updateService.remindLater(hours);
    },
    [updateService]
  );

  return {
    state,
    hasUpdate,
    updateInfo,
    isChecking,
    isDownloading,
    isReady,
    isInstalling,
    error,
    downloadProgress,
    checkForUpdates,
    startUpdate,
    restart,
    dismissUpdate,
    skipVersion,
    remindLater,
  };
}

export function createFakePlatform(options?: {
  kind?: PlatformKind;
  overrides?: Partial<PlatformServices>;
}): PlatformServices {
  const kind = options?.kind ?? 'web';
  const defaultServices: PlatformServices = {
    capabilities: {
      kind,
      canInstallApp: kind === 'web',
      hasAppUpdater: kind === 'desktop',
      hasNativeCompiler: kind === 'desktop',
      hasFileSystem: kind === 'desktop',
    },
    config: {
      apiBaseUrl: 'http://localhost:3000/api',
      appVersion: '1.0.0',
      buildId: 'fake-build-001',
      channel: 'stable',
    },
    files: {
      saveFile: async () => {},
      openFile: async () => null,
    },
    updates: {
      channel: 'stable',
      getState: () => ({ s: 'idle' }),
      subscribe: () => () => {},
      check: async () => null,
      install: async () => {},
      restart: async () => {},
      skipVersion: () => {},
      remindLater: () => {},
    },
    shell: {
      openExternal: async () => {},
    },
    window: {
      isSupported: () => kind === 'desktop',
      minimize: async () => {},
      toggleMaximize: async () => {},
      close: async () => {},
      startDragging: async () => {},
      isMaximized: async () => false,
      onMaximizedChange: () => () => {},
    },
  };

  if (!options?.overrides) {
    return defaultServices;
  }

  return {
    ...defaultServices,
    ...options.overrides,
    capabilities: {
      ...defaultServices.capabilities,
      ...(options.overrides.capabilities || {}),
      kind: options.overrides.capabilities?.kind ?? kind,
    },
    config: {
      ...defaultServices.config,
      ...(options.overrides.config || {}),
    },
    files: options.overrides.files ?? defaultServices.files,
    updates: options.overrides.updates ?? defaultServices.updates,
    shell: options.overrides.shell ?? defaultServices.shell,
    window: options.overrides.window ?? defaultServices.window,
  };
}

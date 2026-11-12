'use client';

export * from './bootstrap';
export * from './provider';
export * from './slots';

export {
  usePlatform,
  useOptionalPlatform,
  useCapabilities,
  useUpdateService,
  useAppUpdater,
  createFakePlatform,
  Slot,
  defineSlots,
  registerSlot,
  getRegisteredSlot,
  clearSlotRegistry,
} from '@structpaper/platform';

export type {
  PlatformServices,
  Capabilities,
  PlatformKind,
  RuntimeConfig,
  UpdateService,
  UpdateInfo,
  UpdateState,
  UpdateErrorCode,
  DownloadProgress,
  UseAppUpdaterReturn,
  SlotImplementations,
  SlotRegistry,
  SlotProps,
} from '@structpaper/platform';

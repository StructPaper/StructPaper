import { LayoutZoneConfig, GridAreaCoords, TemplateGridConfig } from '@/types/template-builder';
import { ZonePathItem } from './types';

/**
 * Returns default sub-grid configuration for a zone
 */
export function getDefaultSubGridConfig(): TemplateGridConfig {
  return {
    enabled: true,
    columns: 2,
    rows: 2,
    rowGap: 6,
    colGap: 6,
    gapSync: true,
    unit: 'px',
  };
}

/**
 * Recursively find a zone by ID at any depth
 */
export function findZoneDeep(zones: LayoutZoneConfig[], id: string): LayoutZoneConfig | null {
  for (const zone of zones) {
    if (zone.id === id) return zone;
    if (zone.subZones && zone.subZones.length > 0) {
      const found = findZoneDeep(zone.subZones, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Recursively finds the parent zone of a zone with target ID
 */
export function findParentZone(zones: LayoutZoneConfig[], targetId: string): LayoutZoneConfig | null {
  for (const zone of zones) {
    if (zone.subZones && zone.subZones.some((sz) => sz.id === targetId)) {
      return zone;
    }
    if (zone.subZones && zone.subZones.length > 0) {
      const found = findParentZone(zone.subZones, targetId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Builds the breadcrumb path from root down to the target zone
 */
export function findZonePath(
  zones: LayoutZoneConfig[],
  targetId: string,
  currentPath: ZonePathItem[] = []
): ZonePathItem[] | null {
  for (const zone of zones) {
    const item: ZonePathItem = {
      id: zone.id,
      name: zone.name,
      level: currentPath.length + 1,
    };
    if (zone.id === targetId) {
      return [...currentPath, item];
    }
    if (zone.subZones && zone.subZones.length > 0) {
      const subPath = findZonePath(zone.subZones, targetId, [...currentPath, item]);
      if (subPath) return subPath;
    }
  }
  return null;
}

/**
 * Recursively update a zone at any depth in the tree
 */
export function updateZoneDeep(
  zones: LayoutZoneConfig[],
  id: string,
  updated: Partial<LayoutZoneConfig>
): LayoutZoneConfig[] {
  return zones.map((zone) => {
    if (zone.id === id) {
      return { ...zone, ...updated };
    }
    if (zone.subZones && zone.subZones.length > 0) {
      return {
        ...zone,
        subZones: updateZoneDeep(zone.subZones, id, updated),
      };
    }
    return zone;
  });
}

/**
 * Recursively deletes a zone at any depth in the tree
 */
export function deleteZoneDeep(zones: LayoutZoneConfig[], id: string): LayoutZoneConfig[] {
  return zones
    .filter((zone) => zone.id !== id)
    .map((zone) => {
      if (zone.subZones && zone.subZones.length > 0) {
        return {
          ...zone,
          subZones: deleteZoneDeep(zone.subZones, id),
        };
      }
      return zone;
    });
}

/**
 * Adds a new child sub-zone to a parent zone
 */
export function addChildSubZone(
  zones: LayoutZoneConfig[],
  parentId: string,
  area?: GridAreaCoords,
  customName?: string
): { updatedZones: LayoutZoneConfig[]; newChild: LayoutZoneConfig } {
  const parent = findZoneDeep(zones, parentId);
  const subGrid = parent?.subGridConfig || getDefaultSubGridConfig();
  const existingSubZones = parent?.subZones || [];
  const subIndex = existingSubZones.length + 1;

  const defaultArea: GridAreaCoords = area || {
    rowStart: 1,
    colStart: 1,
    rowSpan: 1,
    colSpan: Math.max(1, Math.floor(subGrid.columns / 2)),
  };

  const newChild: LayoutZoneConfig = {
    id: `subzone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: customName || `${parent?.name || 'Vùng'} . ${subIndex}`,
    description: `Phân vùng con ${subIndex} thuộc ${parent?.name || 'vùng cha'}`,
    type: defaultArea.colSpan > 1 ? 'multi-column' : 'full-width',
    columns: 1,
    columnGap: 4,
    showColumnRule: false,
    columnRuleColor: '#E2E8F0',
    order: subIndex,
    gridArea: defaultArea,
    parentId,
    pageScope: parent?.pageScope || 'all',
    subGridConfig: getDefaultSubGridConfig(),
    subZones: [],
  };

  const updatedZones = updateZoneDeep(zones, parentId, {
    subGridConfig: subGrid,
    subZones: [...existingSubZones, newChild],
  });

  return { updatedZones, newChild };
}

/**
 * Flattens all zones and sub-zones at all levels into a single flat array
 * (Prefixes child zone names with indentation for selectors)
 */
export function flattenAllZones(
  zones: LayoutZoneConfig[],
  depth = 0,
  result: { zone: LayoutZoneConfig; depth: number; displayName: string }[] = []
): { zone: LayoutZoneConfig; depth: number; displayName: string }[] {
  for (const zone of zones) {
    const prefix = depth > 0 ? `${'— '.repeat(depth)}` : '';
    result.push({
      zone,
      depth,
      displayName: `${prefix}${zone.name}`,
    });
    if (zone.subZones && zone.subZones.length > 0) {
      flattenAllZones(zone.subZones, depth + 1, result);
    }
  }
  return result;
}

import { LayoutZoneConfig, GridAreaCoords, TemplateGridConfig } from '@/types/template-builder';

export interface ZonePathItem {
  id: string;
  name: string;
  level: number;
}

export interface SubZoneActionPayload {
  parentId: string;
  subZoneId?: string;
  area?: GridAreaCoords;
  name?: string;
}

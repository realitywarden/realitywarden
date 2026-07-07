import type { DeviceGeometry, DeviceType } from '@/types/deviceMeta';

export interface ComponentNode {
  id: string;
  type: 'device' | 'workspace' | 'zone' | 'object' | 'sensor' | 'indicator';
  label: string;
  position?: [number, number, number];
  metadata?: Record<string, unknown>;
}

export interface ComponentEdge {
  from: string;
  to: string;
  relation: 'contains' | 'monitors' | 'moves_with' | 'targets';
}

export interface ComponentGraph {
  graph_version: 'component-graph.v1';
  device_type: DeviceType;
  nodes: ComponentNode[];
  edges: ComponentEdge[];
}

export function buildComponentGraph(deviceType: DeviceType, geometry: DeviceGeometry): ComponentGraph {
  const nodes: ComponentNode[] = [
    {
      id: 'device',
      type: 'device',
      label: deviceType,
      position: geometry.robot?.base_position ?? geometry.camera.position
    },
    {
      id: 'workspace',
      type: 'workspace',
      label: 'workspace',
      metadata: geometry.workspace
    }
  ];

  const edges: ComponentEdge[] = [{ from: 'workspace', to: 'device', relation: 'contains' }];

  for (const [zoneId, zone] of Object.entries(geometry.zones)) {
    nodes.push({
      id: zoneId,
      type: 'zone',
      label: zoneId,
      position: zone.position,
      metadata: { size: zone.size }
    });
    edges.push({ from: 'workspace', to: zoneId, relation: 'contains' });
    edges.push({ from: 'device', to: zoneId, relation: 'targets' });
  }

  for (const [objectId, objectValue] of Object.entries(geometry.objects)) {
    const metadata = objectValue as Record<string, unknown> & { position?: [number, number, number] };
    nodes.push({
      id: objectId,
      type: 'object',
      label: objectId,
      position: metadata.position,
      metadata
    });
    edges.push({ from: 'workspace', to: objectId, relation: 'contains' });
    edges.push({ from: 'device', to: objectId, relation: 'targets' });
  }

  for (const [nodeId, node] of Object.entries(geometry.stage?.nodes ?? {})) {
    nodes.push({
      id: `stage:${nodeId}`,
      type: 'sensor',
      label: node.label ?? nodeId,
      position: node.position
    });
    edges.push({ from: 'workspace', to: `stage:${nodeId}`, relation: 'contains' });
  }

  for (const [indicatorId, indicatorValue] of Object.entries(geometry.stage?.indicators ?? {})) {
    nodes.push({
      id: `indicator:${indicatorId}`,
      type: 'indicator',
      label: indicatorId,
      metadata: { value: indicatorValue }
    });
    edges.push({ from: 'device', to: `indicator:${indicatorId}`, relation: 'monitors' });
  }

  return {
    graph_version: 'component-graph.v1',
    device_type: deviceType,
    nodes,
    edges
  };
}

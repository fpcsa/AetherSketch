import type { Architecture } from '../model/types';
import { boundaryKinds } from './structure';

export type NetworkRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Coordinates remain in the IR. Boundaries enclose members without owning their coordinates. */
export function networkLayout(
  architecture: Architecture,
): Map<string, NetworkRect> {
  const rects = new Map(
    architecture.components.map((component) => [
      component.id,
      {
        ...component.position,
        width: boundaryKinds.has(component.kind) ? 300 : 216,
        height: boundaryKinds.has(component.kind) ? 190 : 140,
      },
    ]),
  );
  for (const kind of ['subnet', 'virtual-network']) {
    for (const boundary of architecture.components.filter(
      (component) => component.kind === kind,
    )) {
      const members = architecture.components.filter(
        (component) =>
          component.id !== boundary.id &&
          (kind === 'subnet'
            ? component.network?.subnetIds?.[0] === boundary.id
            : component.network?.virtualNetworkId === boundary.id &&
              !component.network?.subnetIds?.length),
      );
      if (!members.length) continue;
      const boxes = members.map((member) => rects.get(member.id)!);
      const x = Math.min(...boxes.map((box) => box.x)) - 28;
      const y = Math.min(...boxes.map((box) => box.y)) - 64;
      rects.set(boundary.id, {
        x,
        y,
        width: Math.max(
          300,
          Math.max(...boxes.map((box) => box.x + box.width)) - x + 28,
        ),
        height: Math.max(
          190,
          Math.max(...boxes.map((box) => box.y + box.height)) - y + 28,
        ),
      });
    }
  }
  return rects;
}

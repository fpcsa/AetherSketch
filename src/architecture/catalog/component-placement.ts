import { networkLayout } from '../network/layout';
import type { Architecture, ComponentPosition } from '../model';

export function nextAutomaticPosition(
  architecture: Architecture,
): ComponentPosition {
  const origin = { x: 48, y: 48 };
  const spacing = { x: 304, y: 208 };
  const columns = 3;
  const occupiedRects = [...networkLayout(architecture).values()];

  for (let index = 0; index < 1000; index += 1) {
    const candidate = {
      x: origin.x + (index % columns) * spacing.x,
      y: origin.y + Math.floor(index / columns) * spacing.y,
    };
    const occupied = occupiedRects.some(
      (rect) =>
        candidate.x < rect.x + rect.width + 32 &&
        candidate.x + 248 > rect.x &&
        candidate.y < rect.y + rect.height + 32 &&
        candidate.y + 160 > rect.y,
    );
    if (!occupied) return candidate;
  }

  return {
    x: origin.x,
    y:
      Math.max(
        origin.y,
        ...architecture.components.map((component) => component.position.y),
      ) + spacing.y,
  };
}

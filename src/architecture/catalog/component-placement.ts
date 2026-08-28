import type { Architecture, ComponentPosition } from '../model';

export function nextAutomaticPosition(
  architecture: Architecture,
): ComponentPosition {
  const origin = { x: 48, y: 48 };
  const spacing = { x: 304, y: 208 };
  const columns = 3;

  for (let index = 0; index < 1000; index += 1) {
    const candidate = {
      x: origin.x + (index % columns) * spacing.x,
      y: origin.y + Math.floor(index / columns) * spacing.y,
    };
    const occupied = architecture.components.some(
      (component) =>
        Math.abs(component.position.x - candidate.x) < 248 &&
        Math.abs(component.position.y - candidate.y) < 160,
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

import type { Architecture, ArchitectureComponent } from '../model';
import {
  architectureEntryIds,
  isComputeComponent,
  isDataComponent,
  reachableComponentIds,
} from './graph';

export function isPublicWebComponent(
  component: ArchitectureComponent,
): boolean {
  return (
    component.kind === 'internet' ||
    component.kind === 'internet-gateway' ||
    component.kind === 'cdn' ||
    (component.kind === 'load-balancer' &&
      component.configuration.scheme === 'internet-facing') ||
    (component.kind === 'api-gateway' &&
      component.configuration.endpointType !== 'private')
  );
}

export function analyzeWebProtection(architecture: Architecture) {
  const requestArchitecture = {
    ...architecture,
    connections: architecture.connections.filter(
      (connection) => connection.type === 'request',
    ),
  };
  const publicEntryIds = new Set(
    architecture.components
      .filter(
        (component) =>
          isPublicWebComponent(component) ||
          (component.kind === 'dns' &&
            component.configuration.zoneType === 'public'),
      )
      .map((component) => component.id),
  );
  const entries = architectureEntryIds(requestArchitecture).filter((id) =>
    publicEntryIds.has(id),
  );
  const reachable = reachableComponentIds(requestArchitecture, entries);
  const wafIds = new Set(
    architecture.components
      .filter((component) => component.kind === 'waf')
      .map((component) => component.id),
  );
  // Keep the original entry points: removing WAFs must not turn their
  // downstream load balancers or gateways into new public entry points.
  const withoutWaf = reachableComponentIds(
    requestArchitecture,
    entries,
    wafIds,
  );
  const requestSources = new Set(
    requestArchitecture.connections.map((connection) => connection.source),
  );
  const targets = architecture.components.filter(
    (component) =>
      reachable.has(component.id) &&
      (isComputeComponent(component) ||
        isDataComponent(component) ||
        (['cdn', 'load-balancer', 'api-gateway'].includes(component.kind) &&
          !requestSources.has(component.id))),
  );
  const protectedComponentIds = targets
    .filter((component) => !withoutWaf.has(component.id))
    .map((component) => component.id);
  const unprotectedComponentIds = targets
    .filter((component) => withoutWaf.has(component.id))
    .map((component) => component.id);

  return {
    protected: targets.length > 0 && unprotectedComponentIds.length === 0,
    protectedComponentIds,
    unprotectedComponentIds,
  };
}

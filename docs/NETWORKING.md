# Network modeling

The network catalog now has Virtual Network, Subnet, NAT Gateway, Network Security Rules, Private Service Endpoint, External Network, and VPN Connection. Generic labels are the default; the AWS label option changes display names without converting the architecture or contacting a provider.

## Membership and routes

A component's optional `network` object contains `virtualNetworkId`, `subnetIds`, `securityGroupIds`, `publicAddress`, and `internetAccessRequired`. Assign the network before choosing subnets or rules. Assigned subnets determine effective availability zones in analysis, simulation, canvas badges, and read tools. Older diagrams with no network placement retain their existing graph behavior.

Virtual networks and subnets appear as boundaries and cannot be traffic hops. Boundaries enclose assigned members; drag resource nodes to arrange the drawing. A resource spanning multiple subnets is drawn once, inside its first subnet; its badge and inspector list every placement. Boundary geometry does not change membership. Use **Focus on canvas** to inspect a dense diagram.

Subnets have canonical IPv4 CIDRs, one availability zone, public/private intent, and explicit routes. Attached subnet CIDRs must lie within the network and cannot overlap. Route destinations are `internet` or `external-network`:

- A public subnet uses an attached Internet Gateway. Direct workload internet access also requires a public address; internet-facing load balancers imply one.
- A private subnet uses a zonal NAT Gateway. That NAT must occupy a public subnet whose own internet route targets the network's Internet Gateway.
- An external-network route targets a VPN Connection. The VPN links a Virtual Private Gateway in the same network with an External Network. Both directions require the participating subnet's return route.
- Within one virtual network, local routes are implicit. Cross-network peering and transit routes are not modeled.

Only one route per destination is supported. Merely drawing a connection cannot bypass route validation. A NAT does not grant unsolicited public ingress.

Use **Requires HTTPS internet egress** for a workload whose critical function depends on internet access. Missing, blocked or incomplete routes produce `INTERNET_EGRESS_UNREACHABLE`. A single NAT and cross-zone NAT routes produce resilience findings. The requirement is specifically HTTPS; individual connections use their own protocol labels.

## Security rules and private endpoints

Network Security Rules attach to resources; they are not inline firewall boxes. Each ingress/egress rule has `peerId` and `protocol`. A peer can be an existing component, a virtual network, an attached rule-group ID, `internet`, or `*`. Protocols match connection labels case-insensitively; `*` matches any protocol. Multiple attached groups combine their allow rules. Empty lists deny that direction; replies to an allowed initiated connection are stateful. This is a logical protocol model, not a packet/port-range firewall emulator.

Unmodeled policies do not silently block legacy graphs: placement without attached rules raises a security finding and assumes permission. Broad inbound rules and data tiers in public subnets raise additional findings. Actual exposure also depends on routes and public addressing.

A Private Service Endpoint targets one supported managed service in the same region. It needs subnet placement and applicable ingress permission. Workload-to-service connections automatically use a surviving permitted endpoint. Without one, public service access needs permitted internet egress; services configured for private-only access cannot fall back to the internet.

VPNs have one or two modeled tunnels and an encryption setting. Missing attachments, disabled encryption and single-tunnel configurations generate findings. Tunnel count is a resilience hint; individual tunnel health and an external router's capacity are not simulated.

## Failure simulation

Boundary failure propagates to contained placement. A workload spanning surviving subnets can retain capacity. Routes and connections are reevaluated against failed NATs, gateways, endpoints, VPNs, networks and subnets. A surviving workload that loses required internet egress is degraded, and a critical workload with no remaining required egress makes the architecture unavailable. The simulation panel explains the lost dependency. Architecture data and undo history are unchanged.

## Planning costs

These are illustrative planning assumptions, not current provider quotes:

| Component                                                         |                                           Monthly estimate |
| ----------------------------------------------------------------- | ---------------------------------------------------------: |
| Virtual Network, Subnet, Network Security Rules, External Network |                                       $0 resource baseline |
| NAT Gateway                                                       |                         $35 + $0.05 × modeled processed GB |
| Private Service Endpoint                                          |         $8 × endpoint zones + $0.01 × modeled processed GB |
| VPN Connection                                                    | $36.50 per connection, including up to two modeled tunnels |
| Internet Gateway / Virtual Private Gateway                        |                               $0 gateway resource baseline |

Other transfer charges, regional pricing, public-address charges, discounts, taxes and external hardware costs are excluded. VPN connection cost is separate from its gateway resource.

## Repeatable example

1. Select **Private Network & Hybrid Access**. Baseline: 13 components, 2 connections, $373.50/month. Private Application in zone B uses NAT A in zone A; the queue has a private endpoint and office access has a VPN return route.
2. Inspect **Private B** and remove its internet route. Inspect **Private Application**: the panel reports **Internet unreachable**. Run analysis to see the validation finding. Undo the removal.
3. Simulate **eu-west-1a**. Public A and NAT A fail; Private Application retains compute capacity but loses required egress. Expected: 2 failed, 1 degraded, critical path unavailable.
4. Add **Public B**, CIDR `10.0.3.0/24`, zone `eu-west-1b`, attach it to Application Network, choose public visibility and add an internet route to Internet Gateway.
5. Add **NAT B**, attach it to Application Network and Public B. Change Private B's internet route from NAT A to NAT B.
6. Simulate **eu-west-1a** again. Expected: 2 failed, 0 degraded components, architecture degraded, critical path remaining. The modeled cost is $408.50/month when the new NAT has zero modeled GB.
7. Exercise policy edits, endpoint/VPN failure, and AWS/Generic labels. Export before replacing important work; Undo can restore template changes.

## WebMCP and safety

The existing five edit tools support the new kinds. `add_component` and `update_component` accept `network`; updates replace that object, so send the complete desired placement. Configuration patches support typed route/rule arrays. Inspect current component IDs and configuration first. Array edits replace that array.

All writes retain Review/Edit authority, human locks, atomic schema validation, activity, persistence and undo/redo. Deleting a referenced component requires detaching its routes, membership and policy references first; there is no implicit cascade through locked resources. Comparison includes network placement and nested configuration changes.

## Limits and references

This remains deterministic design analysis, not infrastructure provisioning or evidence of actual failover, packet delivery or production security. The model does not include arbitrary CIDR route matching, IPv6, peering, transit gateways, network ACLs, port ranges, regional NAT variants, real tunnel health, DNS resolution or throughput. Multi-subnet resources are drawn once; dense drawings require zoom/focus. The existing desktop layout requires horizontal scrolling below 1000 CSS pixels.

The modeled relationships are informed by the official documentation for [NAT gateways](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html), [security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html), [private endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html), and [site-to-site VPN](https://docs.aws.amazon.com/vpn/latest/s2svpn/how_it_works.html). The simplified planning values above are not sourced price quotes.

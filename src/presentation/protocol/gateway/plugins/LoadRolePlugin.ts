/**
 * LoadRolePlugin - loads user role into gateway context
 *
 * Uses GetUserRoleUseCase to resolve role from UserIdentity.
 * Sets role in context for downstream handlers.
 */

import type { GatewayPlugin, GatewayHandler, GatewayRequest } from "../types.js";
import type { GatewayContext } from "../GatewayContext.js";
import type { ClientResponseStream } from "../../types.js";
import type { GetUserRoleUseCase } from "../../../../domain/usecases/GetUserRoleUseCase.js";

class LoadRoleHandler implements GatewayHandler {
  constructor(
    private readonly getUserRole: GetUserRoleUseCase,
    private readonly next: GatewayHandler,
  ) {}

  async handle(req: GatewayRequest, ctx: GatewayContext): Promise<ClientResponseStream> {
    const role = await this.getUserRole.execute(req.identity);
    ctx.setRole(role);
    return this.next.handle(req, ctx);
  }
}

export class LoadRolePlugin implements GatewayPlugin {
  constructor(private readonly getUserRole: GetUserRoleUseCase) {}

  apply(next: GatewayHandler): GatewayHandler {
    return new LoadRoleHandler(this.getUserRole, next);
  }
}

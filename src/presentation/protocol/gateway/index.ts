/**
 * Gateway module exports
 */

export { Gateway } from "./Gateway.js";
export { GatewayContext } from "./GatewayContext.js";
export { GatewayCore } from "./GatewayCore.js";
export * from "./types.js";
export { StreamUtils } from "./stream.js";
export { GatewayMessages } from "./messages.js";
export { RoleGuard } from "./RoleGuard.js";

// Handlers
export { TelegramMessageHandler } from "./handlers/TelegramMessageHandler.js";
export { TelegramCallbackHandler } from "./handlers/TelegramCallbackHandler.js";
export { HttpRequestHandler } from "./handlers/HttpRequestHandler.js";

// Plugins
export * from "./plugins/index.js";

// Factory
export { GatewayFactory, type GatewayFactoryDeps } from "./GatewayFactory.js";

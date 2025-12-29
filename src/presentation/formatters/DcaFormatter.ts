/**
 * DCA formatter - domain objects to UI response
 */

import {
  DcaStartResult,
  DcaStopResult,
  DcaStatusResult,
} from "../../domain/usecases/types.js";
import { ClientResponse } from "../protocol/types.js";

export class DcaFormatter {
  formatStart(result: DcaStartResult): ClientResponse {
    switch (result.type) {
      case "started":
        return new ClientResponse(
          `**DCA Started**\n\n` +
            `Your automatic purchases are now enabled.\n` +
            `Scheduler status: ${result.isSchedulerRunning ? "Running" : "Waiting for schedule"}`,
        );

      case "already_active":
        return new ClientResponse(
          `DCA is already active.\n\n` +
            `Use /dca stop to disable automatic purchases.\n` +
            `Scheduler status: ${result.isSchedulerRunning ? "Running" : "Waiting for schedule"}`,
        );

      case "no_wallet":
        return new ClientResponse(
          `Cannot start DCA - no wallet connected.\n\n` +
            `Use /wallet create to create a wallet first.`,
        );

      case "unavailable":
        return new ClientResponse(`DCA is not available in this mode.`);

      default:
        return new ClientResponse("Unable to start DCA.");
    }
  }

  formatStop(result: DcaStopResult): ClientResponse {
    switch (result.type) {
      case "stopped":
        return new ClientResponse(
          `**DCA Stopped**\n\n` +
            `Your automatic purchases are now disabled.\n` +
            `Scheduler status: ${result.isSchedulerRunning ? "Running (other users active)" : "Stopped"}`,
        );

      case "not_active":
        return new ClientResponse(
          `DCA is not currently active.\n\n` +
            `Use /dca start to enable automatic purchases.`,
        );

      case "unavailable":
        return new ClientResponse(`DCA is not available in this mode.`);

      default:
        return new ClientResponse("Unable to stop DCA.");
    }
  }

  formatStatus(result: DcaStatusResult): ClientResponse {
    switch (result.type) {
      case "active":
        return new ClientResponse(
          `**DCA Status: Active**\n\n` +
            `Your automatic purchases are enabled.\n` +
            `Scheduler: ${result.isSchedulerRunning ? "Running" : "Waiting"}\n\n` +
            `_Command: /dca stop to disable_`,
        );

      case "inactive":
        return new ClientResponse(
          `**DCA Status: Inactive**\n\n` +
            `Your automatic purchases are disabled.\n` +
            `Scheduler: ${result.isSchedulerRunning ? "Running (other users)" : "Stopped"}\n\n` +
            `_Command: /dca start to enable_`,
        );

      case "no_wallet":
        return new ClientResponse(
          `**DCA Status: No Wallet**\n\n` +
            `You need a wallet first.\n\n` +
            `_Command: /wallet create or /wallet import <key>_`,
        );

      case "unavailable":
        return new ClientResponse(`DCA is not available in this mode.`);

      default:
        return new ClientResponse("Unable to get DCA status.");
    }
  }

  formatUnknownSubcommand(): ClientResponse {
    return new ClientResponse(
      `Unknown DCA command.\n\n` +
        `Available commands:\n` +
        `/dca - Show DCA status\n` +
        `/dca start - Start automatic purchases\n` +
        `/dca stop - Stop automatic purchases`,
    );
  }
}

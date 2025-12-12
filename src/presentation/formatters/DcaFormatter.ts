/**
 * DCA formatter - domain objects to UI response
 */

import {
  DcaStartResult,
  DcaStopResult,
  DcaStatusResult,
} from "../../domain/usecases/types.js";
import { UIResponse } from "../protocol/types.js";

export class DcaFormatter {
  formatStart(result: DcaStartResult): UIResponse {
    switch (result.type) {
      case "started":
        return {
          text:
            `**DCA Started**\n\n` +
            `Your automatic purchases are now enabled.\n` +
            `Scheduler status: ${result.isSchedulerRunning ? "Running" : "Waiting for schedule"}`,
        };

      case "already_active":
        return {
          text:
            `DCA is already active.\n\n` +
            `Use /dca stop to disable automatic purchases.\n` +
            `Scheduler status: ${result.isSchedulerRunning ? "Running" : "Waiting for schedule"}`,
        };

      case "no_wallet":
        return {
          text:
            `Cannot start DCA - no wallet connected.\n\n` +
            `Use /wallet create to create a wallet first.`,
        };

      case "unavailable":
        return {
          text: `DCA is not available in this mode.`,
        };

      default:
        return { text: "Unable to start DCA." };
    }
  }

  formatStop(result: DcaStopResult): UIResponse {
    switch (result.type) {
      case "stopped":
        return {
          text:
            `**DCA Stopped**\n\n` +
            `Your automatic purchases are now disabled.\n` +
            `Scheduler status: ${result.isSchedulerRunning ? "Running (other users active)" : "Stopped"}`,
        };

      case "not_active":
        return {
          text:
            `DCA is not currently active.\n\n` +
            `Use /dca start to enable automatic purchases.`,
        };

      case "unavailable":
        return {
          text: `DCA is not available in this mode.`,
        };

      default:
        return { text: "Unable to stop DCA." };
    }
  }

  formatStatus(result: DcaStatusResult): UIResponse {
    switch (result.type) {
      case "active":
        return {
          text:
            `**DCA Status: Active**\n\n` +
            `Your automatic purchases are enabled.\n` +
            `Scheduler: ${result.isSchedulerRunning ? "Running" : "Waiting"}\n\n` +
            `Use /dca stop to disable.`,
        };

      case "inactive":
        return {
          text:
            `**DCA Status: Inactive**\n\n` +
            `Your automatic purchases are disabled.\n` +
            `Scheduler: ${result.isSchedulerRunning ? "Running (other users)" : "Stopped"}\n\n` +
            `Use /dca start to enable.`,
        };

      case "no_wallet":
        return {
          text:
            `**DCA Status: No Wallet**\n\n` +
            `You need to connect a wallet first.\n\n` +
            `Use /wallet create to create a wallet.`,
        };

      case "unavailable":
        return {
          text: `DCA is not available in this mode.`,
        };

      default:
        return { text: "Unable to get DCA status." };
    }
  }

  formatUnknownSubcommand(): UIResponse {
    return {
      text:
        `Unknown DCA command.\n\n` +
        `Available commands:\n` +
        `/dca - Show DCA status\n` +
        `/dca start - Start automatic purchases\n` +
        `/dca stop - Stop automatic purchases`,
    };
  }
}

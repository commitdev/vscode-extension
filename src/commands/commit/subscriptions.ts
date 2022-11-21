import * as vscode from "vscode";
import { SubscriptionType } from "../../commitAPI";
const addSubscriptions = (
  context: vscode.ExtensionContext
): RegisterCommand => {
  return {
    command: "commit-extension.addSubscriptions",
    callback: async () => {
      // Open a dropdown to select Subscription Type
      const subscriptionType = await vscode.window.showQuickPick(
        // get the value of subscriptionType enum,
        // convert it to string and then to array
        Object.values(SubscriptionType).map((value) => value.toString()),
        {
          placeHolder: "Select a subscription type",
        }
      );

      if (!subscriptionType) {
        return;
      }

      // Based on the subscription type
      switch (subscriptionType) {
        case SubscriptionType.PROJECT_COMMENT:
          // TODO: Add project comment subscription
          // Show success message
          vscode.window.showInformationMessage(
            "Subscribed to project comment updates"
          );
          break;
        case SubscriptionType.PROJECT_UPDATE:
          // TODO: Add project updates subscription
          // Show success message
          vscode.window.showInformationMessage("Subscribed to project updates");
          break;
        default:
          break;
      }
    },
  };
};

export default addSubscriptions;

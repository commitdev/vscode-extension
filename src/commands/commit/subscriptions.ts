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
    },
  };
};

export default addSubscriptions;

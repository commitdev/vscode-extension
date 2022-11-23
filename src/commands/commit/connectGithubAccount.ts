import * as vscode from "vscode";
const connectGithubAccount = (
  context: vscode.ExtensionContext
): RegisterCommand => {
  return {
    command: "commit-extension.connectGithubAccount",
    callback: async () => {
      vscode.window.showInformationMessage("Connecting to Github...");
    },
  };
};

export default connectGithubAccount;

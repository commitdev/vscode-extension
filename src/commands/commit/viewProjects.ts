import path = require("path");
import * as fs from "fs";
import * as vscode from "vscode";
import { CommitAPI } from "../../commitAPI";

const viewProjects = (context: vscode.ExtensionContext) => {
  return {
    command: "commit-extension.viewProjects",
    callback: async () => {
      const commitAPI = context.globalState.get("commitAPI") as CommitAPI;
      const panel = vscode.window.createWebviewPanel(
        "commitExtension", // Identifies the type of the webview. Used internally
        "Commit Projects", // Title
        vscode.ViewColumn.One,
        {
          enableScripts: true, // Enable javascript in the webview
        }
      );

      // Send message to webview
      const sendMessage = (type: string, message: any) => {
        panel.webview.postMessage({
          command: type,
          data: message,
        });
      };

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
            case "updateProjects":
              try {
                const projects = await commitAPI.getUserProjects();
                sendMessage("projects", JSON.stringify(projects));

                // Show the success message
                vscode.window.showInformationMessage("Projects Updated");
              } catch (error: any) {
                vscode.window.showErrorMessage(error.message);
              }
              break;
            case "showMessage":
              vscode.window.showInformationMessage(message.data);
              break;
          }
        },
        undefined,
        context.subscriptions
      );

      // Set the webview's content using vsocde-resource URI
      panel.webview.html = getWebviewContent(context);
    },
  };
};

const getWebviewContent = (context: vscode.ExtensionContext) => {
  // Read the HTML file
  const htmlPath = vscode.Uri.file(
    path.join(context.asAbsolutePath("static"), "webview", "index.html")
  );

  const html = htmlPath.with({ scheme: "vscode-resource" });

  return fs.readFileSync(html.fsPath, "utf8");
};

export default viewProjects;

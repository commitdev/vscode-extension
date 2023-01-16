import * as vscode from "vscode";
import { env } from "vscode";
import { COMMIT_APP_BASE_URL } from "../../common/constants";

const viewProjects = (context: vscode.ExtensionContext) => {
  return {
    command: "commit-extension.viewProjects",
    callback: async () => {
      // Open the commit project in browser
      await env.openExternal(
        vscode.Uri.parse(COMMIT_APP_BASE_URL + "/projects")
      );
    },
  };
};

export default viewProjects;

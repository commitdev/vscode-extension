import * as vscode from "vscode";
import { CommitAPI } from "../../commitAPI";
import { getWebviewContent } from "../../utils";

const shareProjectUpdate = (context: vscode.ExtensionContext) => {
  return {
    command: "commit-extension.shareProjectUpdate",
    callback: async () => {
      const commitAPI = context.workspaceState.get("commitAPI") as CommitAPI;

      // Check if Commit API is initialized
      if (!commitAPI) {
        vscode.window.showErrorMessage("Commit API not initialized");
        return;
      }

      let projects: Project[] = [];
      try {
        projects = await commitAPI.getUserProjects();
      } catch (error: any) {
        vscode.window.showErrorMessage(error.message);
        return;
      }

      if (!projects) {
        vscode.window.showInformationMessage("No projects found");
        return;
      }

      // Show list of projects and get the selection
      const selectedProjectTitle = await vscode.window.showQuickPick(
        projects.map((project: Project) => project.title),
        {
          placeHolder: "Select a project",
        }
      );

      if (!selectedProjectTitle) {
        return;
      }

      // Get the Project Object
      const selectedProject: Project | undefined = projects.find(
        (project: { title: string }) => project.title === selectedProjectTitle
      );

      if (!selectedProject || selectedProject === undefined) {
        vscode.window.showErrorMessage("Project not found");
        return;
      }

      // Create a WebView Panel
      const shareProjectUpdatePanel = vscode.window.createWebviewPanel(
        "commitExtension",
        "Share Project Update",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
        }
      );

      // Send Project ID to the WebView
      shareProjectUpdatePanel.webview.postMessage({
        command: "setProjectId",
        data: JSON.stringify({
          projectId: selectedProject.id,
        }),
      });

      vscode.window.showInformationMessage("Project ID sent to the WebView");

      // Add HTML to the WebView
      shareProjectUpdatePanel.webview.html = getWebviewContent(context);
    },
  };
};

export default shareProjectUpdate;

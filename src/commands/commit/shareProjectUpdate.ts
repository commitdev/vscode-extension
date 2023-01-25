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

      // Get default project
      const defaultProject: Project | undefined =
        context.workspaceState.get("defaultProject");
      // Order the projects with default project first
      if (defaultProject) {
        const defaultProjectIndex = projects.findIndex(
          (project) => project.id === defaultProject.id
        );
        if (defaultProjectIndex !== -1) {
          projects.splice(defaultProjectIndex, 1);
          projects.unshift(defaultProject);
        }
      }

      if (!projects) {
        vscode.window.showInformationMessage("No projects found");
        return;
      }

      // Show list of projects and get the selection
      const selectedProjectTitle = await vscode.window.showQuickPick(
        projects.map((project: Project) => {
          return (
            project.title +
            (project.id === defaultProject?.id ? " (Default)" : "")
          );
        }),
        {
          placeHolder: "Select a project",
        }
      );

      if (!selectedProjectTitle) {
        return;
      }

      // Get the Project Object
      const selectedProject: Project | undefined = projects.find(
        (project: { title: string }) =>
          project.title === selectedProjectTitle.replace("(Default)", "")
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

      shareProjectUpdatePanel.webview.onDidReceiveMessage(
        async (message: any) => {
          await processWebviewMessage(message, context);
        },
        undefined,
        context.subscriptions
      );

      // Add HTML to the WebView
      shareProjectUpdatePanel.webview.html = getWebviewContent(context);
    },
  };
};

const processWebviewMessage = async (
  message: WebViewMessageSend,
  context: vscode.ExtensionContext
) => {
  const command = message.command;
  const data = JSON.parse(message.data);
  switch (command) {
    case "submitUpdate":
      const projectId = data.projectId;
      const udpateContent = `${data.updateContent}`;
      console.log(projectId, udpateContent);
      const commitAPI = context.workspaceState.get("commitAPI") as CommitAPI;
      try {
        await commitAPI.addProjectUpdate(projectId, udpateContent);
        vscode.window.showInformationMessage("Update added successfully");
      } catch (error: any) {
        vscode.window.showErrorMessage(
          "Unable to add update, please try again"
        );
      }
      break;
    default:
      break;
  }
};

export default shareProjectUpdate;

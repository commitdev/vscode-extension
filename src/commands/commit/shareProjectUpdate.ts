import * as vscode from "vscode";
import { API, Commit } from "../../@types/git";
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

      // Show list of projects and get the selection
      let selectedProjectTitle = await vscode.window.showQuickPick(
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

      if (!selectedProjectTitle || selectedProjectTitle === undefined) {
        return;
      }

      // Remove (Default) from the title
      selectedProjectTitle = selectedProjectTitle.replace(" (Default)", "");

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

      // Get git commits
      const repositoryCommits: Commit[] | undefined = await getGitCommits(
        context
      );

      // Send Project ID to the WebView3
      shareProjectUpdatePanel.webview.postMessage({
        command: "setWebViewProject",
        data: JSON.stringify({
          projectId: selectedProject.id,
          repositoryCommits: repositoryCommits || [],
        }),
      });

      shareProjectUpdatePanel.webview.onDidReceiveMessage(
        async (message: any) => {
          await processWebviewMessage(message, context);

          // Close the WebView Panel
          shareProjectUpdatePanel.dispose();
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

const getGitCommits: (
  context: vscode.ExtensionContext
) => Promise<Commit[] | undefined> = async (
  context: vscode.ExtensionContext,
  maxEntries: number = 10
) => {
  const gitAPI = context.workspaceState.get<API>("gitAPI");

  if (!gitAPI) {
    return [];
  }

  // Get Worspace folder
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  // Get the respository in the first workspace folder
  // TODO: At this point this will always pick the the first workspace folder
  // TODO: Add support for multiple workspace folders
  const workspaceFolder = workspaceFolders[0];
  const repository = gitAPI.getRepository(workspaceFolder.uri);

  return await repository?.log({
    maxEntries,
  });
};

export default shareProjectUpdate;

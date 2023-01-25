import * as vscode from "vscode";
import { API } from "../../@types/git";
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

      // Prompt user if they want multiline or single line update
      const isMultilineUpdate = await vscode.window.showQuickPick(
        ["Yes", "No"],
        {
          placeHolder: "Do you want to add a multiline update?",
        }
      );

      if (isMultilineUpdate === "No" || isMultilineUpdate === undefined) {
        // Open TextInput dialog
        vscode.window
          .showInputBox({
            prompt: "Enter the project update",
            placeHolder: "Implementing new feature ...",
            value: await getCommitMessage(context),
          })
          .then((value) => {
            if (value) {
              try {
                commitAPI.addProjectUpdate(selectedProject!.id, value);

                vscode.window.showInformationMessage(
                  "Project update successfully added"
                );
              } catch (e) {
                // Show the error message
                vscode.window.showErrorMessage("Unable to add project update");
              }
            }
          });
      } else {
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
          command: "setWebViewProject",
          data: JSON.stringify({
            projectId: selectedProject.id,
            lastCommitMessage: await getCommitMessage(context),
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
      }
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

const getCommitMessage = async (context: vscode.ExtensionContext) => {
  const gitAPI = context.workspaceState.get<API>("gitAPI");
  if (!gitAPI) {
    return;
  }

  // Get workspace folder
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return;
  }

  // Get root path
  const rootPath = workspaceFolders[0].uri.fsPath;

  // Get repository
  const repository = gitAPI.repositories.find(
    (repo) => repo.rootUri.fsPath === rootPath
  );

  if (!repository) {
    return;
  }

  // Get commit message
  const commit = await repository.getCommit("HEAD");
  return commit?.message || "";
};

export default shareProjectUpdate;

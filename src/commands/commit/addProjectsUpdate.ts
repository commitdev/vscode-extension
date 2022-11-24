import * as vscode from "vscode";
import { CommitAPI } from "../../commitAPI";

const addProjectComment = (
  context: vscode.ExtensionContext
): RegisterCommand => {
  return {
    command: "commit-extension.addProjectUpdates",
    callback: async () => {
      // Get the project from workspace state
      let selectedProject =
        context.workspaceState.get<Project>("connectedProject");

      // If project is not connected
      if (!selectedProject) {
        vscode.window.showErrorMessage("Please connect a project first");
        return;
      }
      const commitAPI = context.globalState.get("commitAPI") as CommitAPI;
      if (!selectedProject) {
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
        selectedProject = projects.find(
          (project: { title: string }) => project.title === selectedProjectTitle
        );
      }

      // Open TextInput dialog
      vscode.window
        .showInputBox({
          prompt: "Enter the update you want to add",
          placeHolder: "Implementing new feature ...",
        })
        .then((value) => {
          if (value) {
            try {
              commitAPI.addProjectUpdate(selectedProject!.id, value);

              vscode.window.showInformationMessage("Update added successfully");
            } catch (e) {
              console.log(e);

              // Show the error message
              vscode.window.showErrorMessage("Unable to add update");
            }
          }
        });
    },
  };
};

export default addProjectComment;

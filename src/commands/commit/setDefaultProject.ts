import * as vscode from "vscode";
import { Project, RegisterCommand } from "../../@types/types";
import { CommitAPI } from "../../commitAPI";

const setDefaultProject = (
  context: vscode.ExtensionContext
): RegisterCommand => {
  return {
    command: "commit-extension.setDefaultProject",
    callback: async () => {
      const commitAPI = context.workspaceState.get("commitAPI") as CommitAPI;
      if (!commitAPI) {
        vscode.window.showErrorMessage("Please login to Commit");
        return;
      }

      // Get the list of projects
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
      const selectedProject = projects.find(
        (project: { title: string }) => project.title === selectedProjectTitle
      );

      // Save the project in workspace state
      context.workspaceState.update("defaultProject", selectedProject);

      // Show the success message
      vscode.window.showInformationMessage("Default project set successfully");
    },
  };
};

export default setDefaultProject;

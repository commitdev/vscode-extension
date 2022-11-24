import * as vscode from "vscode";
import { Repository } from "../../@types/github";
import { CommitAPI } from "../../commitAPI";
import GituHubAPI from "../../githubAPI";
const connectGithubRepoToCommitProject = (
  context: vscode.ExtensionContext
): RegisterCommand => {
  return {
    command: "commit-extension.connectGithubRepoToCommitProject",
    callback: async () => {
      // Get CommitAPI from workspace state
      const commitAPI = context.globalState.get("commitAPI") as CommitAPI;
      if (!commitAPI) {
        vscode.window.showErrorMessage(
          "You need to login to commit before connecting a github repo"
        );
        return;
      }
      // Get Github Session
      const githubSession = commitAPI.getUserGithubSession;
      if (!githubSession) {
        vscode.window.showErrorMessage(
          "You need to login to github before connecting a github repo"
        );
        return;
      }
      // Variable to hold the information of the selected repo to connect
      let selectedRepo: Repository | undefined;

      // Create Github API instance
      const githubAPI = new GituHubAPI(githubSession);

      // Get Github Repos
      const repositories: Repository[] = await githubAPI.getGithubRepos();

      // Show QuickPick to select a repo names
      await vscode.window
        .showQuickPick(repositories.map((repo) => repo.name))
        .then(async (repoName) => {
          // Get the selected repo object from repositories array
          selectedRepo = repositories.find(
            (repo) => repo.name === repoName
          ) as Repository;
        });

      // Get the connected project to worksapce state
      const connectedCommitProject =
        context.workspaceState.get<Project>("connectedProject");

      // If no project is connected
      if (!connectedCommitProject) {
        // Show error message
        vscode.window.showErrorMessage(
          "Please connect a commit project first before connecting a github repo"
        );
        return;
      }

      // Get Projects Urls
      const projectsUrls = connectedCommitProject.urls as string[];

      // Check if the connected github repo url existed in the project urls
      if (projectsUrls.includes(selectedRepo?.html_url as string)) {
        // Show info message
        vscode.window.showInformationMessage(
          "This github repo is already connected to this project"
        );
        return;
      }

      // Add the github repo url to the project urls
      projectsUrls.push(selectedRepo?.html_url as string);

      // Update the project urls
      const updatedProject = await commitAPI.updateProject(
        connectedCommitProject
      );

      // If the project is updated successfully
      if (updatedProject) {
        // Update the connected project in workspace state
        context.workspaceState.update("connectedProject", updatedProject);
        // Show success message
        vscode.window.showInformationMessage(
          "Github repo connected successfully"
        );
      }
    },
  };
};

export default connectGithubRepoToCommitProject;

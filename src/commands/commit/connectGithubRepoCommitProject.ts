import * as vscode from "vscode";
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

      // Create Github API instance
      const githubAPI = new GituHubAPI(githubSession);

      // Get Github Repos
      const repositories = githubAPI.getGithubRepos();
    },
  };
};

export default connectGithubRepoToCommitProject;

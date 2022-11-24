import fetch from "node-fetch";
import * as vscode from "vscode";
import { Repository } from "./@types/github";

export default class GituHubAPI {
  private githubSession: vscode.AuthenticationSession;
  constructor(githubSession: vscode.AuthenticationSession) {
    this.githubSession = githubSession;
  }

  public getGithubSession() {
    return this.githubSession;
  }

  public setGithubSession(githubSession: vscode.AuthenticationSession) {
    this.githubSession = githubSession;
  }

  public async getGithubRepos(): Promise<Repository[] | []> {
    try {
      let userRepositories: Repository[] = [];
      const accessToken = this.githubSession.accessToken;

      // Make a request to Github to get list of repositories
      const headers = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Authorization: `Bearer ${accessToken}`,
      };
      const response = await fetch("https://api.github.com/user/repos", {
        headers: headers,
      });

      if (!response.ok) {
        throw new Error("Unable to get respositores");
      }

      return (await response.json()) as Repository[];
    } catch (error) {
      console.log(error);
      throw new Error("Unable to get user repositories");
    }
  }

  public async getUserInfo(): Promise<any> {}
}

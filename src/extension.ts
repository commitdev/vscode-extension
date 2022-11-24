import * as vscode from "vscode";
import {
  Auth0AuthenticationProvider,
  AUTH_TYPE as AUTH0_AUTH_TYPE,
} from "./authProviders/auth0AuthProvider";
import GitHubAuthProvider, {
  AUTH_TYPE as GITHUB_AUTH_TYPE,
} from "./authProviders/githubAuthProvider";
import addProjectComment from "./commands/commit/addProjectsUpdate";
import connectGithubRepoToCommitProject from "./commands/commit/connectGithubRepoCommitProject";
import connectProject from "./commands/commit/connectProejct";
import addSubscriptions from "./commands/commit/subscriptions";
import viewProjects from "./commands/commit/viewProjects";
import { CommitAPI } from "./commitAPI";
import { getCommitApolloClient, registerCommand } from "./utils";

export async function activate(this: any, context: vscode.ExtensionContext) {
  // Register the authentication provider
  context.subscriptions.push(new Auth0AuthenticationProvider(context));

  // Register the commit github app authentication provider
  context.subscriptions.push(new GitHubAuthProvider(context));

  // Get Commit Session
  await getCommitSessions();

  // Get Github Commit Session
  await getGithubCommitSessions();

  // Set CommitAPI
  await getCommitAPI(context);

  // Array of commands
  const commands = [
    addProjectComment,
    connectProject,
    addSubscriptions,
    viewProjects,
    connectGithubRepoToCommitProject,
  ];

  // Register all the commands
  commands.forEach((command) => registerCommand(command(context)));

  // Register subscription to update commit session
  context.subscriptions.push(
    vscode.authentication.onDidChangeSessions(async (e) => {
      // show a notification
      vscode.window.showInformationMessage(`Session ${e.provider.id} changed`);
      if (e.provider.id === AUTH0_AUTH_TYPE) {
        await handleAuth0SessionChange(context);
      } else if (e.provider.id === GITHUB_AUTH_TYPE) {
        await handleGithubSessionChange(context);
      }
    })
  );
}

/**
 * Method to handle change in Github Session needed for Commit Github App
 * @param context Vscode Extension Context
 * @returns
 */
const handleGithubSessionChange = async (context: vscode.ExtensionContext) => {
  // Get CommitAPI from workspace state
  const commitAPI = await getCommitAPI(context);

  if (!commitAPI) {
    return;
  }

  // Get Github Commit Session
  const githubSession = (await getGithubCommitSessions()) || null;

  // Set github session to commitAPI
  commitAPI.setUserGithubSession(githubSession);

  // Add the commitAPI to the workspace state
  context.globalState.update("commitAPI", commitAPI);
};

const handleAuth0SessionChange = async (context: vscode.ExtensionContext) => {
  console.log("Handling Session changed");
  const commitSession = await getCommitSessions();

  if (!commitSession) {
    // Remove the project from workspace state
    context.workspaceState.update("connectedProject", undefined);

    // Remove the commitAPI from global state
    context.globalState.update("commitAPI", undefined);

    return;
  }

  const commitAPI = await getCommitAPI(context);

  // Add the commitAPI to the workspace state
  context.globalState.update("commitAPI", commitAPI);
};

const getGithubCommitSessions = async () => {
  const session = await vscode.authentication.getSession(GITHUB_AUTH_TYPE, [], {
    createIfNone: false,
  });

  if (session) {
    vscode.window.showInformationMessage(
      `Welcome ${session.account.label} to Commit Githu App!`
    );
  }

  return session;
};

const getCommitSessions = async () => {
  const session = await vscode.authentication.getSession(AUTH0_AUTH_TYPE, [], {
    createIfNone: false,
  });

  if (session) {
    vscode.window.showInformationMessage(
      `Welcome ${session.account.label} to Commit!`
    );
  }

  return session;
};

const getCommitAPI = async (
  context: vscode.ExtensionContext
): Promise<CommitAPI | undefined> => {
  // Check if commitAPI is already initialized in workspace state
  let commitAPI = context.globalState.get<CommitAPI>("commitAPI");

  if (commitAPI) {
    return commitAPI;
  }

  // Get Commit Session
  const commitSession = await getCommitSessions();
  if (!commitSession) {
    return;
  }

  // Get Github Commit Session
  const githubSession = (await getGithubCommitSessions()) || null;

  // Create Apollo Client
  const commitApolloClient = await getCommitApolloClient(commitSession);

  // Create commitAPI instance
  commitAPI = new CommitAPI(commitApolloClient);

  // Set commit session to commitAPI
  commitAPI.setUserCommitSession(commitSession);

  // Set github session to commitAPI
  commitAPI.setUserGithubSession(githubSession);

  // Add the commitAPI to the workspace state
  context.globalState.update("commitAPI", commitAPI);

  return commitAPI;
};

// This method is called when your extension is deactivated
export function deactivate() {
  // Get extension context
}

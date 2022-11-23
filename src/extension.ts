import * as vscode from "vscode";
import {
  Auth0AuthenticationProvider,
  AUTH_TYPE as AUTH0_AUTH_TYPE,
} from "./authProviders/auth0AuthProvider";
import GitHubAuthProvider, {
  AUTH_TYPE as GITHUB_AUTH_TYPE,
} from "./authProviders/githubAuthProvider";
import addProjectComment from "./commands/commit/addProjectsUpdate";
import connectGithubAccount from "./commands/commit/connectGithubAccount";
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

  // Array of commands
  const commands = [
    addProjectComment,
    connectProject,
    addSubscriptions,
    viewProjects,
    connectGithubAccount,
  ];

  // Register all the commands
  commands.forEach((command) => registerCommand(command(context)));

  // Register subscription to update commit session
  context.subscriptions.push(
    vscode.authentication.onDidChangeSessions(async (e) => {
      if (e.provider.id === AUTH0_AUTH_TYPE) {
        await handleAuth0SessionChange(context);
      } else if (e.provider.id === GITHUB_AUTH_TYPE) {
        await handleGithubSessionChange(context);
      }
    })
  );
}

const handleGithubSessionChange = async (context: vscode.ExtensionContext) => {
  await getGithubCommitSessions();
};

const handleAuth0SessionChange = async (context: vscode.ExtensionContext) => {
  console.log("Handling Session changed");
  const commitSession = await getCommitSessions();

  if (!commitSession) {
    // Remove the project from workspace state
    context.workspaceState.update("connectedProject", undefined);
    return;
  }

  // Check if commitAPI is already initialized in workspace state
  let commitAPI = context.globalState.get<CommitAPI>("commitAPI");

  if (commitAPI) {
    commitAPI.setUserSession(commitSession);
    return;
  }

  const commitApolloClient = await getCommitApolloClient(commitSession);

  // Create commitAPI instance
  commitAPI = new CommitAPI(commitApolloClient);

  // Set commit session to commitAPI
  commitAPI.setUserSession(commitSession);

  // Add the commitAPI to the workspace state
  context.globalState.update("commitAPI", commitAPI);
};

const getGithubCommitSessions = async () => {
  const session = await vscode.authentication.getSession(GITHUB_AUTH_TYPE, [], {
    createIfNone: false,
  });

  if (session) {
    vscode.window.showInformationMessage(
      `Welcome ${session.account.label} to Commit!`
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

// This method is called when your extension is deactivated
export function deactivate() {
  // Get extension context
}

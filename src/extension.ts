import * as vscode from "vscode";
import { API, GitExtension } from "./@types/git";
import {
  Auth0AuthenticationProvider,
  AUTH_TYPE as AUTH0_AUTH_TYPE,
} from "./authProviders/auth0AuthProvider";
import addProjectComment from "./commands/commit/addProjectsUpdate";
import setDefaultProject from "./commands/commit/setDefaultProject";
import shareProject from "./commands/commit/shareProject";
import shareProjectUpdate from "./commands/commit/shareProjectUpdate";
import addSubscriptions from "./commands/commit/subscriptions";
import viewProjects from "./commands/commit/viewProjects";
import { CommitAPI } from "./commitAPI";
import { getCommitApolloClient, registerCommand } from "./utils";

export async function activate(this: any, context: vscode.ExtensionContext) {
  // Register the authentication provider
  context.subscriptions.push(new Auth0AuthenticationProvider(context));

  // Set CommitAPI
  await getCommitAPI(context);

  // Setup Git Extension
  await setupGitAPI(context);

  // Setup Github Extension
  await getGitExtension(context);

  // Array of commands
  const commands = [
    addProjectComment,
    setDefaultProject,
    addSubscriptions,
    viewProjects,
    shareProject,
    shareProjectUpdate,
  ];

  // Register all the commands
  commands.forEach((command) => registerCommand(command(context)));

  // Register subscription to update commit session
  context.subscriptions.push(
    vscode.authentication.onDidChangeSessions(async (e) => {
      if (e.provider.id === AUTH0_AUTH_TYPE) {
        handleAuth0SessionChange(context);
      }
    })
  );
}

const handleAuth0SessionChange = async (context: vscode.ExtensionContext) => {
  const commitSession = await getCommitSessions();

  if (!commitSession) {
    // Remove the project from workspace state
    context.workspaceState.update("defaultProject", undefined);

    // Remove the commitAPI from global state
    context.workspaceState.update("commitAPI", undefined);

    return;
  }

  const commitAPI = await getCommitAPI(context);

  // Add the commitAPI to the workspace state
  context.workspaceState.update("commitAPI", commitAPI);
};

const getCommitSessions = async () => {
  const session = await vscode.authentication.getSession(AUTH0_AUTH_TYPE, [], {
    createIfNone: false,
  });

  // decode access token to get expiry time

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
  let commitAPI = context.workspaceState.get<CommitAPI>("commitAPI");

  if (commitAPI) {
    return commitAPI;
  }

  // Get Commit Session
  const commitSession = await getCommitSessions();
  if (!commitSession) {
    return;
  }

  // Create Apollo Client
  const commitApolloClient = await getCommitApolloClient(commitSession);

  // Create commitAPI instance
  commitAPI = new CommitAPI(commitApolloClient);

  // Set commit session to commitAPI
  commitAPI.setUserCommitSession(commitSession);

  // Add the commitAPI to the workspace state
  context.workspaceState.update("commitAPI", commitAPI);

  return commitAPI;
};

const setupGitAPI = async (context: vscode.ExtensionContext) => {
  const extension: vscode.Extension<GitExtension> | undefined =
    vscode.extensions.getExtension("vscode.git");
  if (!extension) {
    vscode.window.showErrorMessage("Git extension not installed");
    return;
  }

  const gitExtension = extension.isActive
    ? extension.exports
    : await extension.activate();

  const gitAPI: API = gitExtension.getAPI(1);

  context.workspaceState.update("gitAPI", gitAPI);
};

const getGitExtension = async (context: vscode.ExtensionContext) => {
  const extension: vscode.Extension<GitExtension> | undefined =
    vscode.extensions.getExtension("vscode.git");
  if (!extension) {
    vscode.window.showErrorMessage("Git extension not installed");
    return;
  }

  const gitExtension = extension.isActive
    ? extension.exports
    : await extension.activate();

  const gitAPI: API = gitExtension.getAPI(1);

  context.workspaceState.update("gitAPI", gitAPI);
};

// This method is called when your extension is deactivated
export function deactivate() {
  // Get extension context
}

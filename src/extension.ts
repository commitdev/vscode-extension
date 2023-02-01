import * as vscode from "vscode";
import { API, GitExtension } from "./@types/git";
import { UserInfo } from "./@types/types";
import {
  Auth0AuthenticationProvider,
  AUTH_TYPE as AUTH0_AUTH_TYPE,
} from "./authProviders/auth0AuthProvider";
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

  // Array of commands
  const commands = [
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

  // Get Git API from workspace state
  const gitAPI = context.workspaceState.get("gitAPI") as API;

  if (gitAPI === undefined) {
    return;
  }

  // Get repository
  const repository = gitAPI.repositories[0];

  // Subscribe to on Git status change
  context.subscriptions.push(
    repository?.state.onDidChange(async () => {
      const commitAPI = context.workspaceState.get("commitAPI") as CommitAPI;
      await commitAPI.showAddProjectUpdateNotification(context);
    })
  );

  // Try showing the add project update notification
  const commitAPI = context.workspaceState.get("commitAPI") as CommitAPI;
  if (commitAPI) {
    await commitAPI.showAddProjectUpdateNotification(context);
  }
}

const handleAuth0SessionChange = async (context: vscode.ExtensionContext) => {
  const commitSession = await getCommitSessions();

  if (!commitSession) {
    // Remove all workspace state settings for commit
    await context.workspaceState.update("defaultProject", undefined);
    await context.workspaceState.update(
      "commitNotificationInterval",
      undefined
    );
    await context.workspaceState.update(
      "commitLastNotificationShown",
      undefined
    );
    await context.workspaceState.update("commitAPI", undefined);
    await context.workspaceState.update("gitAPI", undefined);
    await context.workspaceState.update("commitUserInfo", undefined);

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

  // Setup config
  await commitAPI.setupConfig(context);

  // Add the commitAPI to the workspace state
  context.workspaceState.update("commitAPI", commitAPI);

  // Add userInfo to workspace state
  // extract email from commit session label "name <email>"
  const userInfo: UserInfo = {
    email: commitSession.account.label.split("<")[1].split(">")[0],
    name: commitSession.account.label.split("<")[0].trim(),
    id: commitSession.account.id,
    commits: [],
  };
  context.workspaceState.update("commitUserInfo", userInfo);

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

// This method is called when your extension is deactivated
export function deactivate() {
  // Get extension context
}

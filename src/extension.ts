import * as vscode from "vscode";
import { API, GitExtension } from "./@types/git";
import { Auth0AuthProvider } from "./authProviders/authProvider";
import setDefaultProject from "./commands/commit/setDefaultProject";
import shareProject from "./commands/commit/shareProject";
import shareProjectUpdate from "./commands/commit/shareProjectUpdate";
import viewProjects from "./commands/commit/viewProjects";
import { CommitAPI } from "./commitAPI";
import { COMMIT_AUTH_TYPE } from "./common/constants";
import { getCommitApolloClient, registerCommand } from "./utils";

export async function activate(this: any, context: vscode.ExtensionContext) {
  // Register the authentication provider
  const subscriptions = context.subscriptions;

  subscriptions.push(new Auth0AuthProvider(context));

  // Get Commit Session
  await getCommitSessions();

  // Register subscription to update commit session
  subscriptions.push(
    vscode.authentication.onDidChangeSessions(async (e) => {
      if (e.provider.id === COMMIT_AUTH_TYPE) {
        await getCommitSessions();
        const commitAPI = await setupCommitAPI(context);
        await commitAPI?.showAddProjectUpdateNotification(context);
      }
    })
  );

  // Setup Commit API
  await setupCommitAPI(context);

  // Setup up Commit Commands
  const commands = [
    setDefaultProject,
    viewProjects,
    shareProject,
    shareProjectUpdate,
  ];

  // Register all the commands
  commands.forEach((command) => registerCommand(command(context)));

  // Setup Git Extension
  await setupGitAPI(context);
}

const getCommitSessions = async () => {
  try {
    const sessions = await vscode.authentication.getSession(
      COMMIT_AUTH_TYPE,
      ["openid", "email"],
      {
        createIfNone: false,
      }
    );

    if (sessions === undefined) {
      return;
    }

    vscode.window.showInformationMessage(
      `Welcome ${sessions.account.label} to Commit!`
    );
    return sessions;
  } catch (e) {
    console.log(e);
  }
};

const setupCommitAPI = async (
  context: vscode.ExtensionContext
): Promise<CommitAPI | undefined> => {
  // Check if Commit API instance exist in workspace state
  let commitAPI = context.workspaceState.get<CommitAPI>("commitAPI");

  if (commitAPI) {
    return commitAPI;
  }

  // Get Commit Session
  const session = await vscode.authentication.getSession(
    COMMIT_AUTH_TYPE,
    ["openid", "email"],
    {
      createIfNone: false,
    }
  );

  if (!session) {
    return;
  }

  // Create Apollo Client
  const commitApolloClient = await getCommitApolloClient(session);

  // Create commitAPI instance
  commitAPI = new CommitAPI(commitApolloClient);

  // Set commit session to commitAPI
  commitAPI.setUserCommitSession(session);

  // Setup config
  await commitAPI.setupConfig(context);

  // Add the commitAPI to the workspace state
  context.workspaceState.update("commitAPI", commitAPI);

  return commitAPI;
};

const setupGitAPI = async (
  context: vscode.ExtensionContext
): Promise<API | undefined> => {
  const extension: vscode.Extension<GitExtension> | undefined =
    vscode.extensions.getExtension("vscode.git");
  if (!extension) {
    vscode.window.showErrorMessage("Git extension not installed");
    return;
  }

  if (!extension.isActive) {
    await extension.activate();
  }

  const gitExtension = extension.exports;

  const gitAPI: API = gitExtension.getAPI(1);

  context.workspaceState.update("gitAPI", gitAPI);

  const repository = gitAPI?.repositories[0];

  if (repository === undefined) {
    return;
  }

  // Subscribe to on Git status change
  context.subscriptions.push(
    repository.state.onDidChange(async () => {
      const commitAPI = context.workspaceState.get("commitAPI") as CommitAPI;
      await commitAPI?.showAddProjectUpdateNotification(context);
    })
  );

  return gitAPI;
};

export function deactivate() {
  // nothing to do
}

import * as vscode from "vscode";
import { Auth0AuthenticationProvider, AUTH_TYPE } from "./auth0AuthProvider";
import addProjectComment from "./commands/commit/addProjectsUpdate";
import connectProject from "./commands/commit/connectProejct";
import addSubscriptions from "./commands/commit/subscriptions";
import viewProjects from "./commands/commit/viewProjects";
import { CommitAPI } from "./commitAPI";
import { getCommitApolloClient, registerCommand } from "./utils";
import path = require("path");

export async function activate(this: any, context: vscode.ExtensionContext) {
  // Register the authentication provider
  context.subscriptions.push(new Auth0AuthenticationProvider(context));

  // Get Commit Session
  await getCommitSessions();

  // Array of commands
  const commands = [
    addProjectComment,
    connectProject,
    addSubscriptions,
    viewProjects,
  ];

  // Register all the commands
  commands.forEach((command) => registerCommand(command(context)));

  // Register subscription to update commit session
  context.subscriptions.push(
    vscode.authentication.onDidChangeSessions(async (e) => {
      if (e.provider.id === AUTH_TYPE) {
        await handleSessionChange(context);
      }
    })
  );
}

const handleSessionChange = async (context: vscode.ExtensionContext) => {
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

const getCommitSessions = async () => {
  const session = await vscode.authentication.getSession(AUTH_TYPE, [], {
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

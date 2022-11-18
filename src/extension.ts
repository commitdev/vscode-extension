import * as vscode from "vscode";
import { Auth0AuthenticationProvider, AUTH_TYPE } from "./auth0AuthProvider";
import addProjectCommentCommand from "./commands/commit/addProjectsUpdate";
import connectProject from "./commands/commit/connectProejct";
import addSubscriptions from "./commands/commit/subscriptions";
import viewProjectsCommand from "./commands/commit/viewProjects";
import { CommitAPI } from "./commitAPI";
import { getCommitApolloClient, registerCommand } from "./utils";
import path = require("path");

export async function activate(this: any, context: vscode.ExtensionContext) {
  const subscriptions = context.subscriptions;

  subscriptions.push(new Auth0AuthenticationProvider(context));

  await getCommitSessions();

  // Register a command to add comment to Commit Projects
  subscriptions.push(registerCommand(addProjectCommentCommand(context)));
  // Register a command to view Commit Projects in a WebView
  subscriptions.push(registerCommand(viewProjectsCommand(context)));
  // Register Subscription command
  subscriptions.push(registerCommand(addSubscriptions(context)));
  // Register a command to connect a project to Commit
  subscriptions.push(registerCommand(connectProject(context)));

  // Register subscription to update commit session
  subscriptions.push(
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

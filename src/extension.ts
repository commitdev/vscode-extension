import * as vscode from "vscode";
import { Auth0AuthenticationProvider, AUTH_TYPE } from "./auth0AuthProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "Commit Extension" is now active!'
  );

  const subscriptions = context.subscriptions;

  subscriptions.push(new Auth0AuthenticationProvider(context));

  getAuth0Sessions();

  subscriptions.push(
    vscode.authentication.onDidChangeSessions(async (e) => {
      console.log("onDidChangeSessions", e);
      getAuth0Sessions();
    })
  );
}

const getAuth0Sessions = async () => {
  const session = await vscode.authentication.getSession(AUTH_TYPE, [], {
    createIfNone: false,
  });

  if (session) {
    vscode.window.showInformationMessage(
      `Welcome back ${session.account.label}!`
    );
  }
};

// This method is called when your extension is deactivated
export function deactivate() {}

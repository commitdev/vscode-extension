import {
  ApolloClient,
  createHttpLink,
  DefaultOptions,
  InMemoryCache,
} from "@apollo/client/core";
import { setContext } from "@apollo/client/link/context";
import * as fs from "fs";
import fetch from "node-fetch";
import * as vscode from "vscode";
import { API, Project } from "./api";
import { Auth0AuthenticationProvider, AUTH_TYPE } from "./auth0AuthProvider";
import path = require("path");

const COMMIT_GRAPHQL_API_URL = "https://api.commit-staging.dev/graphql";
const COMMIT_API_BASE_URL = "https://app.commit-staging.dev/";

export async function activate(context: vscode.ExtensionContext) {
  const subscriptions = context.subscriptions;

  subscriptions.push(new Auth0AuthenticationProvider(context));

  let session = (await getAuth0Sessions()) as vscode.AuthenticationSession;

  subscriptions.push(
    vscode.authentication.onDidChangeSessions(async (e) => {
      session = (await getAuth0Sessions()) as vscode.AuthenticationSession;
      if (api) {
        api.setUserSession(session);
        console.log("set user session");
      }
    })
  );

  // Setup the API object
  const link = createHttpLink({
    uri: COMMIT_GRAPHQL_API_URL,
    fetch,
  });

  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        Cookie: `helix_session_token=${session.accessToken}`,
        origin: COMMIT_API_BASE_URL,
        referer: COMMIT_API_BASE_URL,
      },
    };
  });

  // default options for the apollo client
  const defaultOptions: DefaultOptions = {
    watchQuery: {
      fetchPolicy: "no-cache",
      errorPolicy: "ignore",
    },
    query: {
      fetchPolicy: "no-cache",
      errorPolicy: "all",
    },
  };

  const client = new ApolloClient({
    link: authLink.concat(link),
    cache: new InMemoryCache(),
    defaultOptions,
  });

  const api = new API(client);
  api.setUserSession(session);

  // Register a command
  let addProjectUpdateDisposable = vscode.commands.registerCommand(
    "commit-extension.addProjectUpdates",
    async () => {
      let projects: Project[] = [];
      try {
        projects = await api.getUserProjects();
      } catch (error: any) {
        vscode.window.showErrorMessage(error.message);
        return;
      }

      if (!projects) {
        vscode.window.showInformationMessage("No projects found");
        return;
      }

      // Show list of projects and get the selection
      const selectedProjectTitle = await vscode.window.showQuickPick(
        projects.map((project: Project) => project.title),
        {
          placeHolder: "Select a project",
        }
      );

      if (!selectedProjectTitle) {
        return;
      }

      // Get the Project Object
      const selectedProject = projects.find(
        (project: { title: string }) => project.title === selectedProjectTitle
      );

      // Open TextInput dialog
      vscode.window
        .showInputBox({
          prompt: "Enter the update you want to add",
          placeHolder: "Implementing new feature ...",
        })
        .then((value) => {
          if (value) {
            try {
              api.updateProject(selectedProject!.id, value);

              vscode.window.showInformationMessage("Update added successfully");
            } catch (e) {
              console.log(e);

              // Show the error message
              vscode.window.showErrorMessage("Unable to add update");
            }
          }
        });
    }
  );

  subscriptions.push(addProjectUpdateDisposable);

  // Register a Webview
  let webviewDisposable = vscode.commands.registerCommand(
    "commit-extension.viewProjects",
    async () => {
      const panel = vscode.window.createWebviewPanel(
        "commitExtension", // Identifies the type of the webview. Used internally
        "Commit Projects", // Title
        vscode.ViewColumn.One,
        {
          enableScripts: true, // Enable javascript in the webview
        }
      );

      // Send message to webview
      const sendMessage = (type: string, message: any) => {
        panel.webview.postMessage({
          command: type,
          data: message,
        });
      };

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
            case "updateProjects":
              try {
                const projects = await api.getUserProjects();
                sendMessage("projects", JSON.stringify(projects));

                // Show the success message
                vscode.window.showInformationMessage("Projects Updated");
              } catch (error: any) {
                vscode.window.showErrorMessage(error.message);
              }
              break;
            case "showMessage":
              vscode.window.showInformationMessage(message.data);
              break;
          }
        },
        undefined,
        context.subscriptions
      );

      // Set the webview's content using vsocde-resource URI
      panel.webview.html = getWebviewContent(context);

      // sendMessage("update", JSON.stringify(await api.getUserProjects()));
    }
  );

  subscriptions.push(webviewDisposable);
}

const getWebviewContent = (context: vscode.ExtensionContext) => {
  // Read the HTML file
  const htmlPath = vscode.Uri.file(
    path.join(context.asAbsolutePath("static"), "webview", "index.html")
  );

  const html = htmlPath.with({ scheme: "vscode-resource" });

  return fs.readFileSync(html.fsPath, "utf8");
};

const getAuth0Sessions = async () => {
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
  // Remove the AUTH_TYPE session
}

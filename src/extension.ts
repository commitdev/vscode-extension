import {
  ApolloClient,
  createHttpLink,
  InMemoryCache,
} from "@apollo/client/core";
import { setContext } from "@apollo/client/link/context";
import fetch from "node-fetch";
import * as vscode from "vscode";
import { API, Project } from "./api";
import { Auth0AuthenticationProvider, AUTH_TYPE } from "./auth0AuthProvider";

const COMMIT_GRAPHQL_API_URL = "https://api.commit-staging.dev/graphql";
const COMMIT_API_BASE_URL = "https://app.commit-staging.dev/";

export async function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "Commit Extension" is now active!'
  );

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

  const client = new ApolloClient({
    link: authLink.concat(link),
    cache: new InMemoryCache(),
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

  return session;
};

// This method is called when your extension is deactivated
export function deactivate() {
  console.log("Commit Extension deactivated");
}

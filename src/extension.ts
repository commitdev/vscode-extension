import {
  ApolloClient,
  createHttpLink,
  gql,
  InMemoryCache,
} from "@apollo/client/core";
import { setContext } from "@apollo/client/link/context";
import fetch from "node-fetch";
import * as vscode from "vscode";
import { Auth0AuthenticationProvider, AUTH_TYPE } from "./auth0AuthProvider";

const COMMIT_GRAPHQL_API_URL = "https://api.commit-staging.dev/graphql";

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "Commit Extension" is now active!'
  );

  const subscriptions = context.subscriptions;

  subscriptions.push(new Auth0AuthenticationProvider(context));

  let session = getAuth0Sessions();

  subscriptions.push(
    vscode.authentication.onDidChangeSessions(async (e) => {
      session = getAuth0Sessions();
    })
  );

  // Register a command
  let addProjectUpdateDisposable = vscode.commands.registerCommand(
    "commit-extension.addProjectUpdates",
    async () => {
      const currentSession = await session;
      const accessToken = currentSession?.accessToken;
      if (!accessToken) {
        vscode.window.showErrorMessage("You must be logged in to do that");
        return;
      }

      const userId = currentSession?.account.id;
      if (!userId) {
        vscode.window.showErrorMessage("You must be logged in to do that");
        return;
      }

      const projects = await getProjects(currentSession);

      if (!projects) {
        vscode.window.showErrorMessage("You must be logged in to do that");
        return;
      }

      // Show list of projects
      const projectTitle = await vscode.window.showQuickPick(
        projects.map((project: { title: string }) => project.title),
        {
          placeHolder: "Select a project",
        }
      );

      if (!projectTitle) {
        return;
      }
      const selectedProject = projects.find(
        (project: { title: string }) => project.title === projectTitle
      );

      if (!selectedProject) {
        return;
      }
      // Open TextInput dialog
      vscode.window
        .showInputBox({
          prompt: "Enter the update you want to add",
          placeHolder: "Implementing new feature ...",
        })
        .then((value) => {
          if (value) {
            updateProject(currentSession, selectedProject.id, value);
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

const updateProject = async (
  session: vscode.AuthenticationSession,
  projectId: string,
  content: string
) => {
  const accessToken = session.accessToken;
  // Create link to GraphQL API
  const link = createHttpLink({
    uri: COMMIT_GRAPHQL_API_URL,
    fetch,
  });

  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        Cookie: `helix_session_token=${accessToken}`,
        origin: "https://app.commit-staging.dev/",
        referer: "https://app.commit-staging.dev/",
      },
    };
  });

  const client = new ApolloClient({
    link: authLink.concat(link),
    cache: new InMemoryCache(),
  });
  const { data } = await client.mutate({
    mutation: gql`
      mutation {
            createProjectUpdate(projectUpdate: {
                projectId : "${projectId}",
                content: "${content}",
            }) {
                ... on ProjectUpdate {
                    id
                }
            }
        }
    `,
  });

  if (data) {
    vscode.window.showInformationMessage("Update added successfully");
  }

  return data;
};

// Function that returns a list of projects
const getProjects = async (session: vscode.AuthenticationSession) => {
  const accessToken = session.accessToken;
  const userId = session.account.id;

  // Create link to GraphQL API
  const link = createHttpLink({
    uri: COMMIT_GRAPHQL_API_URL,
    fetch,
  });

  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        Cookie: `helix_session_token=${accessToken}`,
        origin: "https://app.commit-staging.dev/",
        referer: "https://app.commit-staging.dev/",
      },
    };
  });

  const client = new ApolloClient({
    link: authLink.concat(link),
    cache: new InMemoryCache(),
  });

  const { data } = await client.query({
    query: gql`
      query {
        projects (creatorUserId: "${userId}") {
          items {
            id,
            title
          }
        }
      }
    `,
  });

  // retrun list of key-value pairs with title being the key and id being the value
  return data.projects.items.map((project: { id: string; title: string }) => ({
    id: project.id,
    title: project.title,
  }));
};

// This method is called when your extension is deactivated
export function deactivate() {}

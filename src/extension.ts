import {
  ApolloClient,
  createHttpLink,
  DefaultOptions,
  InMemoryCache,
} from "@apollo/client/core";
import { setContext } from "@apollo/client/link/context";
import fetch from "node-fetch";
import * as vscode from "vscode";
import { Auth0AuthenticationProvider, AUTH_TYPE } from "./auth0AuthProvider";
import addProjectCommentCommand from "./commands/commit/addProjectsUpdate";
import viewProjectsCommand from "./commands/commit/viewProjects";
import { CommitAPI } from "./commitAPI";
import {
  COMMIT_API_BASE_URL,
  COMMIT_GRAPHQL_API_URL,
} from "./common/constants";
import { getCommitApolloClient, registerCommand } from "./utils";

export async function activate(this: any, context: vscode.ExtensionContext) {
  const subscriptions = context.subscriptions;

  subscriptions.push(new Auth0AuthenticationProvider(context));

  let commitSession =
    (await getCommitSessions()) as vscode.AuthenticationSession;

  // Create global state for commit session
  context.globalState.update("commitSession", commitSession);

  // Check is global state has commitAPI already initialized
  if (!context.globalState.get<CommitAPI>("commitAPI")) {
    const commitSession =
      context.globalState.get<vscode.AuthenticationSession>("commitSession");

    if (!commitSession) {
      return;
    }

    const commitApolloClient = await getCommitApolloClient(commitSession);

    // Create commitAPI instance
    const commitAPI = new CommitAPI(commitApolloClient);

    // Set commit session to commitAPI
    commitAPI.setUserSession(commitSession);

    // Add the commitAPI to the global state
    context.globalState.update("commitAPI", commitAPI);
  }

  // Register a command to add comment to Commit Projects
  subscriptions.push(registerCommand(addProjectCommentCommand(context)));
  // Register a command to view Commit Projects in a WebView
  subscriptions.push(registerCommand(viewProjectsCommand(context)));
  // Register subscription to update commit session
  subscriptions.push(
    vscode.authentication.onDidChangeSessions(async (e) => {
      commitSession =
        (await getCommitSessions()) as vscode.AuthenticationSession;

      // Update global state for commit session
      context.globalState.update("commitSession", commitSession);

      // Check if commitAPI is already initialized in global state
      const commitAPI = context.globalState.get<CommitAPI>("commitAPI");

      if (commitAPI) {
        commitAPI.setUserSession(commitSession);
      }
    })
  );
}

// Initialize Commit API
const _initCommitAPI = async (context: vscode.ExtensionContext) => {
  // Get commit session from global state
  const commitSession =
    context.globalState.get<vscode.AuthenticationSession>("commitSession");

  if (!commitSession) {
    return;
  }

  const link = createHttpLink({
    uri: COMMIT_GRAPHQL_API_URL,
    fetch,
  });

  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        cookie: `helix_session_token=${commitSession.accessToken}`,
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

  // Create commitAPI instance
  const commitAPI = new CommitAPI(client);

  // Set commit session to commitAPI
  commitAPI.setUserSession(commitSession);

  // Add the commitAPI to the global state
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

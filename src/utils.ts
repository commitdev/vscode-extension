import {
  ApolloClient,
  createHttpLink,
  DefaultOptions,
  InMemoryCache,
  NormalizedCacheObject,
  split,
} from "@apollo/client/core";
import { setContext } from "@apollo/client/link/context";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import * as fs from "fs";
import { createClient } from "graphql-ws";
import fetch from "node-fetch";
import * as vscode from "vscode";
import { WebSocket } from "ws";
import { API, Commit } from "./@types/git";
import { RegisterCommand, UserInfo } from "./@types/types";
import {
  COMMIT_API_BASE_URL,
  COMMIT_GRAPHQL_API_URL,
  COMMIT_GRAPHQL_WS_API_URL,
} from "./common/constants";
import path = require("path");

export const registerCommand = (
  registerCommend: RegisterCommand
): vscode.Disposable => {
  return vscode.commands.registerCommand(
    registerCommend.command,
    registerCommend.callback
  );
};

export const getCommitApolloClient = async (
  commitSession: vscode.AuthenticationSession
): Promise<ApolloClient<NormalizedCacheObject>> => {
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

  const httpLink = createHttpLink({
    uri: COMMIT_GRAPHQL_API_URL as string,
    fetch,
  });

  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        cookie: `helix_session_token=${commitSession.accessToken}`,
        origin: COMMIT_API_BASE_URL as string,
        referer: COMMIT_API_BASE_URL as string,
      },
    };
  });

  // Construct concat link
  const concatLink = authLink.concat(httpLink);

  // Construct Split link if WebSocket API URL is defined
  let splitLink;
  if (COMMIT_GRAPHQL_WS_API_URL) {
    const wsLink = new GraphQLWsLink(
      createClient({
        webSocketImpl: WebSocket,
        url: COMMIT_GRAPHQL_WS_API_URL as string,
      })
    );

    // Construct the aplit link. This will allow the client to use the link based on the actions
    // being performed. For example, if the action is a subscription, the client will use the
    // wsLink. If the action is a query or mutation, the client will use the httpLink.
    splitLink = split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === "OperationDefinition" &&
          definition.operation === "subscription"
        );
      },
      wsLink,
      authLink.concat(httpLink)
    );
  }

  return new ApolloClient({
    link: splitLink ? splitLink : concatLink,
    cache: new InMemoryCache(),
    defaultOptions,
  });
};

export const getWebviewContent = (context: vscode.ExtensionContext) => {
  // Read the HTML file
  const htmlPath = vscode.Uri.file(
    path.join(context.asAbsolutePath("static"), "webview", "index.html")
  );

  const html = htmlPath.with({ scheme: "vscode-resource" });

  return fs.readFileSync(html.fsPath, "utf8");
};

export const getGitCommits: (
  context: vscode.ExtensionContext
) => Promise<Commit[] | undefined> = async (
  context: vscode.ExtensionContext,
  maxEntries: number = 10
) => {
  const gitAPI = context.workspaceState.get<API>("gitAPI");
  const userInfo = context.workspaceState.get<UserInfo>("commitUserInfo");

  if (!gitAPI) {
    return [];
  }

  // Get Worspace folder
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  // Get the respository in the first workspace folder
  // TODO: At this point this will always pick the the first workspace folder
  // TODO: Add support for multiple workspace folders
  const workspaceFolder = workspaceFolders[0];
  const repository = gitAPI.getRepository(workspaceFolder.uri);

  if (!repository) {
    return [];
  }
  const userCommits = (await repository?.log({ maxEntries })).filter(
    (commit) => {
      return commit.authorEmail === userInfo?.email;
    }
  );

  return userCommits;
};

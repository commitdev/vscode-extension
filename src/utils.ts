import {
  ApolloClient,
  createHttpLink,
  DefaultOptions,
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client/core";
import { setContext } from "@apollo/client/link/context";
import fetch from "node-fetch";
import * as vscode from "vscode";
import {
  COMMIT_API_BASE_URL,
  COMMIT_GRAPHQL_API_URL,
} from "./common/constants";

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

  return new ApolloClient({
    link: authLink.concat(link),
    cache: new InMemoryCache(),
    defaultOptions,
  });
};

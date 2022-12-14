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
import { createClient } from "graphql-ws";
import fetch from "node-fetch";
import * as vscode from "vscode";
import { WebSocket } from "ws";
import {
  COMMIT_API_BASE_URL,
  COMMIT_GRAPHQL_API_URL,
  COMMIT_GRAPHQL_WS_API_URL,
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

import { ApolloClient, gql, NormalizedCacheObject } from "@apollo/client/core";

import * as vscode from "vscode";

export enum SubscriptionType {
  PROJECT_COMMENT = "Project Comments",
  PROJECT_UPDATE = "Project Updates",
}

/**
 * Commit API class for interacting with the commit API
 * @param client Apollo client
 */
export class CommitAPI {
  private apolloClient: ApolloClient<NormalizedCacheObject>;
  private userCommitSession: vscode.AuthenticationSession | null;

  constructor(apolloClient: ApolloClient<NormalizedCacheObject>) {
    this.apolloClient = apolloClient;
    this.userCommitSession = null;
  }

  /**
   * Method to update user commit session
   * @param userCommitSession
   */
  public setUserSession(userCommitSession: vscode.AuthenticationSession) {
    this.userCommitSession = userCommitSession;
  }

  /**
   * Method to subscribe to project events
   * @param eventType : Type of event to subscribe to
   */
  public async subscribeToEvent(eventType: SubscriptionType) {}

  /**
   * Method to create a new comment on existing commit project
   * @param projectId : Project Id to create a comment on
   * @param content : Content of the comment
   */
  public async updateProject(
    projectId: string,
    content: string
  ): Promise<void> {
    // Check if user is logged in
    if (!this.userCommitSession) {
      throw new Error("You need to login to commit");
    }

    try {
      await this.apolloClient.mutate({
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
    } catch (error) {
      console.log(error);
      throw new Error("Error updating project");
    }
  }

  /**
   * Method to get User's commit projects
   * @returns List of projects
   */
  public async getUserProjects(): Promise<[Project]> {
    // Check if user is logged in
    if (!this.userCommitSession) {
      throw new Error("You need to login to commit");
    }
    try {
      const { data } = await this.apolloClient.query({
        query: gql`
            query {
              projects (creatorUserId: "${this.userCommitSession.account.id}") {
                items {
                  id,
                  title
                }
              }
            }
          `,
      });
      if (!data) {
        throw new Error("Unable to get projects");
      }

      if (data.projects.items.length === 0) {
        throw new Error("No projects found");
      }

      return data.projects.items.map((project: Project) => {
        return {
          id: project.id,
          title: project.title,
        };
      }) as any;
    } catch (error) {
      console.log(error);
      throw new Error("Error getting projects");
    }
  }
}

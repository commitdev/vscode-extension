import { ApolloClient, gql, NormalizedCacheObject } from "@apollo/client/core";
import * as vscode from "vscode";

export class CommitAPI {
  private apolloClient: ApolloClient<NormalizedCacheObject>;
  private userCommitSession: vscode.AuthenticationSession | null;

  constructor(apolloClient: ApolloClient<NormalizedCacheObject>) {
    this.apolloClient = apolloClient;
    this.userCommitSession = null;
  }

  public setUserSession(userCommitSession: vscode.AuthenticationSession) {
    this.userCommitSession = userCommitSession;
  }

  public async updateProject(
    projectId: string,
    content: string
  ): Promise<void> {
    if (!this.userCommitSession) {
      throw new Error("You need to login to commit");
    }

    try {
      const { data } = await this.apolloClient.mutate({
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

  public async getUserProjects(): Promise<[Project]> {
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
      });
    } catch (error) {
      console.log(error);
      throw new Error("Error getting projects");
    }
  }
}

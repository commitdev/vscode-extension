import { ApolloClient, gql, NormalizedCacheObject } from "@apollo/client/core";

import * as vscode from "vscode";

export enum SubscriptionType {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PROJECT_COMMENT = "Project Comments",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PROJECT_UPDATE = "Project Updates",
}

/**
 * Commit API class for interacting with the commit API
 * @param client Apollo client
 */
export class CommitAPI {
  private apolloClient: ApolloClient<NormalizedCacheObject>;
  private userCommitSession: vscode.AuthenticationSession | null;
  private userGithuSession: vscode.AuthenticationSession | null;

  constructor(apolloClient: ApolloClient<NormalizedCacheObject>) {
    this.apolloClient = apolloClient;
    this.userCommitSession = null;
    this.userGithuSession = null;
  }

  /**
   * Method to set user github session
   * @param userGithubSession : VSCode Authentication session for github
   */
  public setUserGithubSession(
    userGithubSession: vscode.AuthenticationSession | null
  ) {
    this.userGithuSession = userGithubSession;
  }

  /**
   * Method to update user commit session
   * @param userCommitSession
   */
  public setUserCommitSession(userCommitSession: vscode.AuthenticationSession) {
    this.userCommitSession = userCommitSession;
  }

  public get getUserCommitSession(): vscode.AuthenticationSession | null {
    return this.userCommitSession;
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
  public async addProjectUpdate(
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
      // console.log(error);
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
                  title,
                  problemStatement,
                  status,
                  attachments,
                  content,
                  participants {
                    id
                  },
                  type,
                  urls,
                  organization,
                  attachments,
                  tags {
                    slug
                  }
                  creatorUser {
                    id
                  }
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
          creatorUser: project.creatorUser,
          title: project.title,
          urls: project.urls,
          problemStatement: project.problemStatement,
          status: project.status,
          attachments: project.attachments,
          content: project.content,
          participants: project.participants,
          type: project.type,
          organization: project.organization,
          tags: project.tags.map((tag) => {
            return tag.slug;
          }),
        };
      }) as [Project];
    } catch (error: any) {
      // console.log(error.message);
      throw new Error("Error getting projects");
    }
  }

  public async updateProject(project: Project): Promise<Project | void> {
    // Check if user is logged in
    if (!this.userCommitSession) {
      throw new Error("You need to login to commit");
    }

    try {
      const { data } = await this.apolloClient.mutate({
        mutation: gql`
          mutation UpdateProject($id: ID!, $project: UpdateProject!) {
            updateProject(id: $id, project: $project) {
              ... on Project {
                id
                title
                content
                problemStatement
                status
                attachments
                type
                urls
                organization
                tags {
                  slug
                }
                creatorUser {
                  id
                }
              }
            }
          }
        `,
        variables: {
          id: project.id,
          project: {
            creatorUserId: project.creatorUser.id,
            title: project.title,
            content: project.content,
            problemStatement: project.problemStatement,
            status: project.status,
            participantIds: [],
            tagIds: project.tags,
            attachments: project.attachments,
            type: project.type,
            urls: project.urls,
            organization: project.organization,
          },
        },
      });

      if (!data) {
        throw new Error("Unable to update project");
      }

      return data.updateProject as Project;
    } catch (error: any) {
      // console.log(error);
      throw new Error("Error updating project");
    }
  }
}

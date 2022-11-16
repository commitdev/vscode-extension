abstract class ProjectProvider {
  abstract getAllProjects(): Promise<Project[]>;
  abstract getProject(projecdId: string): Promise<Project>;
  abstract getProjects(userId: string): Promise<Project[]>;
  abstract createProject(project: Project): Promise<Project>;
  abstract addProjectUpdate(projectId: string, content: string): void;
  abstract addProjectComment(projectId: string, content: string): void;
  abstract addProjectLike(projectId: string): void;
}

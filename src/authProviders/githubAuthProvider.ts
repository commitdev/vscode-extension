import { v4 as uuid } from "uuid";
import { AuthenticationSession } from "vscode";
import { AuthProvider } from "../common/authProviderInterface";

export const AUTH_TYPE = "commit-github-app";
const AUTH_NAME = "Commit Github App";
const SESSIONS_SECRET_KEY = `${AUTH_TYPE}.sessions`;

export default class GitHubAuthProvider extends AuthProvider {
  getAuthType(): string {
    return AUTH_TYPE;
  }
  getAuthName(): string {
    return AUTH_NAME;
  }
  getSecretKey(): string {
    return SESSIONS_SECRET_KEY;
  }
  async createSession(scopes: string[]): Promise<AuthenticationSession> {
    try {
      if (!scopes.includes("openid")) {
        scopes.push("openid");
      }

      if (!scopes.includes("email")) {
        scopes.push("email");
      }
      const session: AuthenticationSession = {
        id: uuid(),
        accessToken: "accessToken",
        account: {
          label: "Github Daman",
          id: "githubID",
        },
        scopes: scopes,
      };

      await this.getContext().secrets.store(
        SESSIONS_SECRET_KEY,
        JSON.stringify([session])
      );

      this.getOnDidChangeSessions().fire({
        added: [session],
        removed: [],
        changed: [],
      });

      return session;
    } catch (error) {
      console.log(error);
      throw new Error(`Commit Github authentication failed`);
    }
  }
}

import fetch from "node-fetch";
import { v4 as uuid } from "uuid";
import {
  AuthenticationSession,
  env,
  ProgressLocation,
  Uri,
  window,
} from "vscode";
import { AuthProvider } from "../common/authProviderInterface";
import { COMMIT_GITHUB_APP_CLIENT_ID } from "../common/constants";

export const AUTH_TYPE = "commit-github-app";
const AUTH_NAME = "Commit Github App";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
export const SESSIONS_SECRET_KEY = `${AUTH_TYPE}.sessions`;

export default class GitHubAuthProvider extends AuthProvider {
  private _pendingStates: string[] = [];

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
      if (!scopes.includes("user:email")) {
        scopes.push("user:email");
      }

      if (!scopes.includes("repo")) {
        scopes.push("repo");
      }

      const authDetials: AuthDetails = await this._login(scopes);
      const githuUserInfo: GithuUserInfo = await this._getUserInfo(
        authDetials.accessToken
      );

      const session: AuthenticationSession = {
        id: uuid(),
        accessToken: authDetials.accessToken,
        account: {
          label: githuUserInfo.name,
          id: githuUserInfo.id.toString(),
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
  private _getUserInfo = async (
    accessToken: string
  ): Promise<GithuUserInfo> => {
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get user info");
      }

      return (await response.json()) as GithuUserInfo;
    } catch (error) {
      console.log(error);
      throw new Error(`Commit Github authentication failed`);
    }
  };
  private _login = async (scopes: string[] = []) => {
    return await window.withProgress<AuthDetails>(
      {
        location: ProgressLocation.Notification,
        title: "Signing in to GitHub Commit App...",
        cancellable: true,
      },
      async (_, __) => {
        const stateId = uuid();
        this._pendingStates.push(stateId);

        // Get User Device Code
        const userDeviceCode = await this._getUserDeviceCode(scopes);
        const endTime = Date.now() + userDeviceCode.expiresIn * 1000;

        // Register User device code in browser by opening the verificationUri
        const response = await window.showInformationMessage(
          `Enter the code ${userDeviceCode.userCode} in browser to authenticate Commit`,
          "Copy Code & Open URL"
        );

        if (response === "Copy Code & Open URL") {
          await env.clipboard.writeText(userDeviceCode.userCode);
          await env.openExternal(Uri.parse(userDeviceCode.verificationUri));
        }

        // Poll for access token and return
        try {
          return await this._pollAccessToken(
            endTime,
            userDeviceCode.deviceCode,
            userDeviceCode.interval
          );
        } catch (error) {
          throw new Error("Failed to authenticate");
        } finally {
          this._pendingStates = this._pendingStates.filter(
            (state) => state !== stateId
          );
        }
      }
    );
  };

  private _getUserDeviceCode = async (
    scopes: string[]
  ): Promise<UserDeviceCode> => {
    try {
      // fetch POST to GITHU_DEVICE_CODE_URL with client_id, scope as path params
      const response = await fetch(GITHUB_DEVICE_CODE_URL, {
        method: "POST",
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "Content-Type": "application/json",
          // eslint-disable-next-line @typescript-eslint/naming-convention
          Accept: "application/json",
        },
        body: JSON.stringify({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          client_id: COMMIT_GITHUB_APP_CLIENT_ID,
          scope: scopes.join(","),
        }),
      });

      if (response.status !== 200) {
        console.log(`Response status is not 200: ${response.status}`);
        throw new Error("Failed to authenticate");
      }
      const responseJson = (await response.json()) as any;
      return {
        deviceCode: responseJson.device_code,
        userCode: responseJson.user_code,
        verificationUri: responseJson.verification_uri,
        expiresIn: responseJson.expires_in,
        interval: responseJson.interval,
      } as UserDeviceCode;
    } catch (error) {
      console.log(error);
      throw new Error("Failed to authenticate");
    }
  };

  private async _pollAccessToken(
    endTime: number,
    deviceCode: string,
    interval: number
  ): Promise<AuthDetails> {
    try {
      const nowTime = Date.now() * 1000;
      while (nowTime > endTime) {
        const response = await fetch(
          `https://github.com/login/oauth/access_token`,
          {
            method: "POST",
            headers: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              Accept: "application/json",
            },
            body: new URLSearchParams({
              // eslint-disable-next-line @typescript-eslint/naming-convention
              grant_type: "urn:ietf:params:oauth:grant-type:device_code",
              // eslint-disable-next-line @typescript-eslint/naming-convention
              client_id: COMMIT_GITHUB_APP_CLIENT_ID || "",
              // eslint-disable-next-line @typescript-eslint/naming-convention
              device_code: deviceCode,
            }),
          }
        );

        if (response.status === 200) {
          const responseJson = (await response.json()) as any;
          // eslint-disable-next-line @typescript-eslint/naming-convention
          const { access_token, expires_in } = responseJson;
          if (access_token) {
            return {
              accessToken: access_token,
              expiresIn: expires_in,
            } as AuthDetails;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, interval * 1000));
      }
    } catch (error) {
      console.log(error);
    }

    // Should not go here
    throw new Error("Failed to authenticate");
  }
}

import fetch from "node-fetch";
import { v4 as uuid } from "uuid";
import {
  AuthenticationSession,
  env,
  ProgressLocation,
  Uri,
  window,
} from "vscode";
import {
  AuthDetails,
  CommitPollAccessTokenResponse,
  UserDeviceCode,
  UserInfo,
} from "../@types/types";
import { AuthProvider } from "../common/authProviderInterface";
import {
  COMMIT_API_BASE_URL,
  COMMIT_APP_BASE_URL,
  COMMIT_AUTH0_DOMAIN,
  COMMIT_CLIENT_ID,
} from "../common/constants";

export const AUTH_TYPE = `commit-auth0`;
const AUTH_NAME = `Commit`;
const SESSIONS_SECRET_KEY = `${AUTH_TYPE}.sessions`;

export class Auth0AuthenticationProvider extends AuthProvider {
  private _pendingStates: string[] = [];

  /**
   * Methid get authentication type
   * @returns string
   */
  getAuthType(): string {
    return AUTH_TYPE;
  }

  /**
   * Method to get authentication name
   * @returns string
   */
  getAuthName(): string {
    return AUTH_NAME;
  }

  /**
   * Method to get session secret key
   * @returns string
   */
  getSecretKey(): string {
    return SESSIONS_SECRET_KEY;
  }

  /**
   * Create a new auth session
   * @param scopes
   * @returns
   */
  public async createSession(scopes: string[]): Promise<AuthenticationSession> {
    try {
      // Append the default scopes if does not include openid and email

      if (!scopes.includes("openid")) {
        scopes.push("openid");
      }

      if (!scopes.includes("email")) {
        scopes.push("email");
      }

      const { accessToken, expiresIn } = await this._login(scopes);
      if (!accessToken) {
        // console.log("Invalid access token");
        throw new Error(`Commit login failed`);
      }

      const userInfo: UserInfo = await this._getUserInfo(accessToken);

      const session: AuthenticationSession = {
        id: "commit-" + uuid(),
        accessToken: accessToken,
        account: {
          label: `${userInfo.name} <${userInfo.email}>`,
          id: userInfo.id,
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
    } catch (e) {
      window.showErrorMessage(`${e}`);
      throw e;
    }
  }

  /**
   * Get User Info
   * @param token
   * @returns
   * @private
   */
  private async _getUserInfo(token: string): Promise<UserInfo> {
    // Make POST request to get user info
    try {
      const response = await fetch(
        `${COMMIT_API_BASE_URL}/v1/auth.get-own-user`,
        {
          method: "POST",
          headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "content-type": "application/json",
            cookie: `helix_session_token=${token}`,
            origin: COMMIT_APP_BASE_URL || "",
            referer: COMMIT_APP_BASE_URL || "",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Get user info invalid status: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      return {
        email: "daman@navaventures.io",
        id: data.id,
        name: data.name,
        commits: [],
      };
    } catch (e) {
      throw new Error(`Get user info failed: ${e}`);
    }
  }

  /**
   * Get the device code from Auth0
   */
  private async _registerDeviceCode(scopes: string[]): Promise<UserDeviceCode> {
    try {
      const response = await fetch(`${COMMIT_AUTH0_DOMAIN}/oauth/device/code`, {
        method: "POST",
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          client_id: COMMIT_CLIENT_ID || "",
          scope: scopes.join(" "),
        }),
      });

      if (!response.ok) {
        console.error(
          `Device code invalid status: ${response.statusText} ${response.status}`
        );
        throw new Error(`Device Registration Failed`);
      }

      // Parse the response with underscored keys to camelCase
      const responseJson = (await response.json()) as any;
      return {
        deviceCode: responseJson.device_code,
        expiresIn: responseJson.expires_in,
        interval: responseJson.interval,
        userCode: responseJson.user_code,
        verificationUri: responseJson.verification_uri,
        verificationUriComplete: responseJson.verification_uri_complete,
      } as UserDeviceCode;
    } catch (e) {
      console.error(e);
      throw new Error(`Unable to get Device Code`);
    }
  }

  /**
   * Login to Auth0
   */
  private async _login(scopes: string[] = []) {
    return await window.withProgress<AuthDetails>(
      {
        location: ProgressLocation.Notification,
        title: "Signing in to Commit...",
        cancellable: true,
      },
      async (_, __) => {
        const stateId = uuid();

        this._pendingStates.push(stateId);

        // Get the device Code from Auth0
        const registerDeviceResponse = await this._registerDeviceCode(scopes);
        const endTime = Date.now() + registerDeviceResponse.expiresIn * 1000;

        // Extract the user code from the verificationUriComplete
        const userCode =
          registerDeviceResponse.verificationUriComplete.match(
            /user_code=([^&]+)/
          )?.[1];

        // Show the user code in a message
        window.showInformationMessage(
          `Confirm Device Code: ${userCode} in your browser`
        );

        // Open the verification URL
        await env.openExternal(
          Uri.parse(registerDeviceResponse.verificationUriComplete)
        );

        try {
          // Poll Access Token
          return await this._pollAccessToken(
            endTime,
            registerDeviceResponse.deviceCode,
            registerDeviceResponse.interval
          );
        } finally {
          this._pendingStates = this._pendingStates.filter(
            (s) => s !== stateId
          );
        }
      }
    );
  }

  /**
   * Poll for the access token
   * @param deviceCode
   * @param interval
   * @param expiresIn
   * @returns
   */
  private async _pollAccessToken(
    endTime: number,
    deviceCode: string,
    interval: number
  ): Promise<AuthDetails> {
    const nowTime = Date.now() * 1000;
    while (nowTime > endTime) {
      const response = await fetch(`${COMMIT_AUTH0_DOMAIN}/oauth/token`, {
        method: "POST",
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          // eslint-disable-next-line @typescript-eslint/naming-convention
          client_id: COMMIT_CLIENT_ID || "",
          // eslint-disable-next-line @typescript-eslint/naming-convention
          device_code: deviceCode,
        }),
      });

      if (response.ok) {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { id_token, expires_in } =
          (await response.json()) as CommitPollAccessTokenResponse;
        return {
          accessToken: id_token,
          expiresIn: expires_in,
        } as AuthDetails;
      }

      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    }

    throw new Error("Commit login timed out");
  }
}

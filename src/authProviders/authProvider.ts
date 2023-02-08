import fetch from "node-fetch";
import {
  authentication,
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationSession,
  Disposable,
  env,
  Event,
  EventEmitter,
  ExtensionContext,
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
import {
  COMMIT_API_BASE_URL,
  COMMIT_APP_BASE_URL,
  COMMIT_AUTH0_DOMAIN,
  COMMIT_AUTH_NAME,
  COMMIT_AUTH_TYPE,
  COMMIT_CLIENT_ID,
  COMMIT_SESSIONS_SECRET_KEY,
} from "../common/constants";

export class Auth0AuthProvider implements AuthenticationProvider, Disposable {
  private _secretSessionKey: string = COMMIT_SESSIONS_SECRET_KEY;

  // On Session Change Event Emitter
  private _onDidChangeSessions =
    new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();

  // Disposable
  private _disposable: Disposable;

  constructor(private readonly context: ExtensionContext) {
    this._disposable = Disposable.from(
      authentication.registerAuthenticationProvider(
        COMMIT_AUTH_TYPE,
        COMMIT_AUTH_NAME,
        this,
        { supportsMultipleAccounts: false }
      )
    );
  }

  dispose() {
    this._disposable.dispose();
  }
  /**
   * Event to listen to session changes
   */
  get onDidChangeSessions(): Event<AuthenticationProviderAuthenticationSessionsChangeEvent> {
    return this._onDidChangeSessions.event;
  }

  async getSessions(
    scopes?: readonly string[] | undefined
  ): Promise<readonly AuthenticationSession[]> {
    const allSessions = await this.context.secrets.get(this._secretSessionKey);
    if (!allSessions) {
      return [];
    }

    const sessions = (await JSON.parse(allSessions)) as AuthenticationSession[];
    return sessions;
  }

  async createSession(scopes: string[]): Promise<AuthenticationSession> {
    try {
      if (!scopes.includes("openid")) {
        scopes.push("openid");
      }

      if (!scopes.includes("email")) {
        scopes.push("email");
      }

      // Login
      const { accessToken } = (await this._login(scopes)) as AuthDetails;
      if (!accessToken) {
        throw new Error("Unable to login, not access token found");
      }

      // Get User Info
      const userInfo = (await this._getUserInfo(accessToken)) as UserInfo;

      // Create Session
      const session: AuthenticationSession = {
        id: userInfo.id,
        accessToken: accessToken,
        account: {
          id: userInfo.id,
          label: userInfo.email,
        },
        scopes: scopes,
      };

      // Add the session to secret storage
      await this.context.secrets.store(
        this._secretSessionKey,
        JSON.stringify([session])
      );

      this._onDidChangeSessions.fire({
        added: [session],
        removed: [],
        changed: [],
      });

      return session;
    } catch (error: any) {
      window.showErrorMessage(error.message);
      throw error;
    }
  }

  async removeSessions(): Promise<void> {
    await this.context.secrets.delete(this._secretSessionKey);
    this._onDidChangeSessions.fire({
      added: [],
      removed: [],
      changed: [],
    });
  }

  async removeSession(sessionId: string): Promise<void> {
    const allSessions = await this.context.secrets.get(this._secretSessionKey);
    if (!allSessions) {
      return;
    }

    const sessions = (await JSON.parse(allSessions)) as AuthenticationSession[];
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return;
    }

    await this.context.secrets.delete(this._secretSessionKey);
    this._onDidChangeSessions.fire({
      added: [],
      removed: [session],
      changed: [],
    });
  }

  // Local Methods
  private async _login(scopes: string[] = []) {
    return await window.withProgress<AuthDetails>(
      {
        location: ProgressLocation.Notification,
        title: "Signing in to Commit...",
        cancellable: true,
      },
      async (_, __) => {
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

        // Poll Access Token
        return await this._pollAccessToken(
          endTime,
          registerDeviceResponse.deviceCode,
          registerDeviceResponse.interval
        );
      }
    );
  }

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
        email: data.email,
        id: data.id,
        name: data.name,
        commits: [],
      };
    } catch (e) {
      throw new Error(`Get user info failed: ${e}`);
    }
  }

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

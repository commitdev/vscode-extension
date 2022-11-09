import fetch from "node-fetch";
import { v4 as uuid } from "uuid";
import {
  authentication,
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationSession,
  Disposable,
  env,
  EventEmitter,
  ExtensionContext,
  ProgressLocation,
  Uri,
  UriHandler,
  window,
} from "vscode";

export const AUTH_TYPE = `auth0`;
const AUTH_NAME = `Commit`;
const CLIENT_ID = "6UcJAI6tXW6leADCdqsGqo5Aoo4fL5C8";
const AUTH0_DOMAIN = "https://commit-staging.us.auth0.com";
const COMMIT_API_BASE_URL = "https://api.commit-staging.dev";
const COMMIT_APP_BASE_URL = "https://app.commit-staging.dev";
const SESSIONS_SECRET_KEY = `${AUTH_TYPE}.sessions`;

class UriEventHandler extends EventEmitter<Uri> implements UriHandler {
  public handleUri(uri: Uri) {
    this.fire(uri);
  }
}

type UserInfo = {
  email: string;
  id: string;
  name: string;
};

export class Auth0AuthenticationProvider
  implements AuthenticationProvider, Disposable
{
  private _sessionChangeEmitter =
    new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
  private _disposable: Disposable;
  private _pendingStates: string[] = [];
  private _uriHandler = new UriEventHandler();

  constructor(private readonly context: ExtensionContext) {
    this._disposable = Disposable.from(
      authentication.registerAuthenticationProvider(
        AUTH_TYPE,
        AUTH_NAME,
        this,
        { supportsMultipleAccounts: false }
      )
    );
    window.registerUriHandler(this._uriHandler);
  }

  get onDidChangeSessions() {
    return this._sessionChangeEmitter.event;
  }

  /**
   * Get the existing sessions
   * @param scopes
   * @returns
   */
  public async getSessions(
    scopes?: string[]
  ): Promise<readonly AuthenticationSession[]> {
    const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);

    if (!allSessions) {
      return [];
    }

    return JSON.parse(allSessions);
  }

  /**
   * Create a new auth session
   * @param scopes
   * @returns
   */
  public async createSession(scopes: string[]): Promise<AuthenticationSession> {
    try {
      const token = await this._login(scopes);
      if (!token) {
        throw new Error(`Auth0 login failure`);
      }

      const userInfo = await this._getUserInfo(token);

      const session: AuthenticationSession = {
        id: uuid(),
        accessToken: token,
        account: {
          label: userInfo.name,
          id: userInfo.id,
        },
        scopes: [],
      };

      await this.context.secrets.store(
        SESSIONS_SECRET_KEY,
        JSON.stringify([session])
      );

      this._sessionChangeEmitter.fire({
        added: [session],
        removed: [],
        changed: [],
      });

      return session;
    } catch (e) {
      window.showErrorMessage(`Sign in failed: ${e}`);
      throw e;
    }
  }

  /**
   * Remove an existing session
   * @param sessionId
   */
  public async removeSession(sessionId: string): Promise<void> {
    const sessions = await this.getSessions();
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) {
      return;
    }

    await this.context.secrets.delete(SESSIONS_SECRET_KEY);

    this._sessionChangeEmitter.fire({
      added: [],
      removed: [session],
      changed: [],
    });
  }

  /**
   * Dispose the registered services
   */
  public async dispose() {
    this._disposable.dispose();
  }

  /**
   * Get User Info
   * @param token
   * @returns
   * @private
   */
  private async _getUserInfo(token: string): Promise<UserInfo> {
    // Make POST request to get user info
    const response = await fetch(
      `${COMMIT_API_BASE_URL}/v1/auth.get-own-user`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `helix_session_token=${token}`,
          origin: COMMIT_APP_BASE_URL,
          referer: COMMIT_APP_BASE_URL,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Get user info failed: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return {
      email: data.email,
      id: data.id,
      name: data.name,
    };
  }

  /**
   * Get the device code from Auth0
   */
  private async _registerDeviceCode(scopes: string[]): Promise<{
    userCode: string;
    deviceCode: string;
    verificationUri: string;
    verificationUriComplete: string;
    expiresIn: number;
    interval: number;
  }> {
    const response = await fetch(`${AUTH0_DOMAIN}/oauth/device/code`, {
      method: "POST",
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        scope: scopes.join(" "),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Auth0 device code registration failed: ${response.statusText}`
      );
    }

    // Parse the response with underscored keys to camelCase
    const resposeData = (await response.json()) as any;
    return {
      userCode: resposeData.user_code,
      deviceCode: resposeData.device_code,
      verificationUri: resposeData.verification_uri,
      verificationUriComplete: resposeData.verification_uri_complete,
      expiresIn: resposeData.expires_in,
      interval: resposeData.interval,
    };
  }

  /**
   * Login to Auth0
   */
  private async _login(scopes: string[] = []) {
    return await window.withProgress<string>(
      {
        location: ProgressLocation.Notification,
        title: "Signing in to Commit...",
        cancellable: true,
      },
      async (_, __) => {
        const stateId = uuid();

        this._pendingStates.push(stateId);

        // Add the scopes to the query params
        if (!scopes.includes("openid")) {
          scopes.push("openid");
        }

        if (!scopes.includes("email")) {
          scopes.push("email");
        }

        // Get the device Code from Auth0
        const registerDeviceResponse = await this._registerDeviceCode(scopes);
        const endTime = Date.now() + registerDeviceResponse.expiresIn * 1000;

        // Extract the user code from the verificationUriComplete
        const userCode =
          registerDeviceResponse.verificationUriComplete.match(
            /user_code=([^&]+)/
          )?.[1];

        // Show the user code in a message
        const message = `Sign in to Auth0 with the following code: ${userCode}`;
        const messageItem = await window.showInformationMessage(
          message,
          "Copy Code"
        );

        if (messageItem === "Copy Code") {
          await env.clipboard.writeText(userCode!);
        }

        // Open the verification URL
        await env.openExternal(
          Uri.parse(registerDeviceResponse.verificationUri)
        );

        try {
          // Poll Access Token
          const accessToken = await this._pollAccessToken(
            endTime,
            registerDeviceResponse.deviceCode,
            registerDeviceResponse.interval
          );

          return accessToken;
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
  ): Promise<string> {
    const nowTime = Date.now() * 1000;
    while (nowTime > endTime) {
      const response = await fetch(`${AUTH0_DOMAIN}/oauth/token`, {
        method: "POST",
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          client_id: CLIENT_ID,
          device_code: deviceCode,
        }),
      });

      if (response.ok) {
        const { id_token } = (await response.json()) as {
          access_token: string;
          id_token: string;
          scope: string;
          expires_in: number;
          token_type: string;
        };
        return id_token;
      }

      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    }

    throw new Error("Auth0 login timed out");
  }
}

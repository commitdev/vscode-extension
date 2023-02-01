import jwt_decode from "jwt-decode";
import * as vscode from "vscode";
import {
  AuthenticationProvider,
  AuthenticationProviderAuthenticationSessionsChangeEvent,
  AuthenticationSession,
  Disposable,
  Event,
  EventEmitter,
} from "vscode";
import { DecodedToken } from "../@types/types";

export abstract class AuthProvider
  implements AuthenticationProvider, Disposable
{
  // On Session Change Event Emitter
  private _onDidChangeSessions =
    new EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();

  // Disposable
  private _disposable: Disposable;

  /**
   * Class constructor
   * @param context VSCode Extension Context
   */
  constructor(private readonly context: vscode.ExtensionContext) {
    this._disposable = Disposable.from(
      vscode.authentication.registerAuthenticationProvider(
        this.getAuthType(),
        this.getAuthName(),
        this,
        { supportsMultipleAccounts: false }
      )
    );
  }

  /**
   * Method to get the Auth Type
   * @returns string
   */
  abstract getAuthType(): string;

  /**
   * Method to get the Auth Name
   * @returns string
   */
  abstract getAuthName(): string;

  /**
   * Mthod to get the screts key to extension store
   * @returns string
   */
  abstract getSecretKey(): string;

  /**
   * Method to create a new Session
   * @param scopes List of scopes
   */
  abstract createSession(
    scopes: readonly string[]
  ): Promise<AuthenticationSession>;

  public getContext(): vscode.ExtensionContext {
    return this.context;
  }

  public getOnDidChangeSessions(): EventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent> {
    return this._onDidChangeSessions;
  }

  /**
   * Method to remove a session
   * @param sessionId Id of the session to remove
   * @returns
   */
  public async removeSession(sessionId: string): Promise<void> {
    const sessions = await this.getSessions();
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) {
      return;
    }

    await this.context.secrets.delete(this.getSecretKey());

    this._onDidChangeSessions.fire({
      added: [],
      removed: [session],
      changed: [],
    });
  }

  /**
   * Method to get the existing Sessions
   * @param scopes Scopes to get the sessions for
   * @returns Array of AuthenticationSession
   */
  public async getSessions(
    scopes?: readonly string[] | undefined
  ): Promise<readonly AuthenticationSession[]> {
    const allSessions = await this.context.secrets.get(this.getSecretKey());

    if (!allSessions) {
      return [];
    }

    // Parse the sessions
    const sessions = JSON.parse(allSessions) as AuthenticationSession[];

    // if sessions length is greater than 0
    const validSessions = sessions.filter((session) => {
      if (!session.id.includes("commit-")) {
        return false;
      }
      // Check is access token is expired
      const { accessToken } = session;
      const { exp } = jwt_decode(accessToken) as DecodedToken;

      // If access token is expired, remove the session
      if (exp < Date.now() / 1000) {
        this.removeSession(session.id);
        return;
      }

      return true;
    });

    return validSessions;
  }

  /**
   * Event to listen to session changes
   */
  get onDidChangeSessions(): Event<AuthenticationProviderAuthenticationSessionsChangeEvent> {
    return this._onDidChangeSessions.event;
  }

  /**
   * Dispose the Auth Provider
   */
  dispose() {
    this._disposable.dispose();
  }
}

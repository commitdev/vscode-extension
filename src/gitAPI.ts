import * as vscode from "vscode";
import { API, GitExtension, Repository } from "./@types/git";

export class GitAPI {
  private _gitAPI: API | undefined;
  private _gitExtension: vscode.Extension<GitExtension> | undefined;

  constructor() {
    this._gitExtension =
      vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (this._gitExtension) {
      this._gitAPI = this._gitExtension.exports.getAPI(1);
    }
  }

  public get gitAPI(): API | undefined {
    return this._gitAPI;
  }

  public get gitExtension(): vscode.Extension<GitExtension> | undefined {
    return this._gitExtension;
  }

  public get repositories(): Repository[] {
    return this._gitAPI?.repositories || [];
  }
}

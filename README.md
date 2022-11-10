# vscode-extension README

Commit Visual Studio Code Extension, to manage Projects on app.commit.dev

## Features

Allows adding updates to the projects owned by the users

## Requirements

- Valid Commit account, as this is needed to get Authenticated
- Already existing projects.

## Installing

As this extension is private, you need to install it from the VSIX file using the command line as follows:

```bash
code --install-extension commit-extension-<VERSION NUMBER>.vsix
```

## Getting Started

Once the extension is installed, you need to authenticate with you Commit account. Follow the steps below to Authenticate:

- Authenticate with your Commit account. You can do this by clicking on the User icon on the left side and then clicking on option `Sign in with Commit to use Commit Extension`.
- This will show one-time code as a popup in the bottom right corner. Copy this code by click on `Copy` button.
- Extension will prompt you to open the Commit authentication page in the browser. Click on `Open` button.
- Paste the code in the browser and click on `Sign in` button.
- Once the authentication is successful, close the browser tab and go back to VS Code.
- You will see a message `Welcome <YOUR NAME> to Commit` in the bottom right corner.

Follow the steps below to add an update to your project:

- Press `Ctrl+Shift+P` to open the command palette.
- Type `Commit: Add Project Update` and press `Enter`.
- Select the project for which you want to add an update.
- Type the update message and press `Enter`.
- You will see a message `Update added successfully` in the bottom right corner.

## Known Issues
Following are the known issues with the extension:

- Currently the project structure is not optimized as current version is a POC.
- There is no testing reports for the extension, thus no CI/CD jobs for that as well.

## Feature Roadmap
Following are the features that are planned to be added in the future:

- Add ability to link single Git Project to given workspace.
- Add ability to make other updates such as adding a new project, adding a comment, etc.
- Update Project View to replicate information from Commit Project page.
- Add ability to connect Github repository to the project, in order to pull information from Github repo such as code type, language, code precentage etc.


## Resources

- [Git API](https://github.com/microsoft/vscode/tree/main/extensions/git)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [Commit GraphQL API](https://app.commit.dev/api/graphql)
- [VS Code Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)

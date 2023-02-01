import { Commit } from "./git";

type Project = {
  id: string;
  creatorUser: {
    id: string;
  };
  title: string;
  content: string;
  problemStatement: string;
  status: Object;
  participants: Object[];
  tags: [
    {
      slug: string;
    }
  ];
  type: Object;
  projectUpdates: Object[];
  attachments: string[];
  urls: string[];
  organization: string;
};

// Response types for the GraphQL API
type CommitPollAccessTokenResponse = {
  access_token: string;
  id_token: string;
  scope: string;
  expires_in: number;
  token_type: string;
};

type UserInfo = {
  email: string;
  id: string;
  name: string;
  commits: Commit[];
};

type RegisterCommand = {
  command: string;
  callback: (...args: any[]) => any;
  thisArg?: any;
};

type AuthDetails = {
  accessToken: string;
  expiresIn: number;
};

type UserDeviceCode = {
  deviceCode: string;
  expiresIn: number;
  interval: number;
  verificationUri: string;
  userCode: string;
  verificationUriComplete: string | "";
};

type GithuUserInfo = {
  id: number;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
  url: string;
};

type DecodedToken = {
  exp: number;
  iat: number;
  iss: string;
  sub: string;
  aud: string;
  email: string;
  email_verified: boolean;
};

type WebViewMessageSend = {
  command: string;
  data: any;
};

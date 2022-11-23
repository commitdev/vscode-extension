// Custom Types
type Project = {
  id: string;
  title: string;
};

// Response types for the GraphQL API
type PollAccessTokenResponse = {
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
};

type RegisterCommand = {
  command: string;
  callback: (...args: any[]) => any;
  thisArg?: any;
};

type LoginResponse = {
  accessToken: string;
  expiresIn: number;
};

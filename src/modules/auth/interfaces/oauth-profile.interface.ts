export interface GoogleProfile {
  id: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  photos?: Array<{ value: string }>;
}

export interface GithubProfile {
  id: string;
  username: string;
  emails?: Array<{ value: string }>;
  displayName?: string;
  photos?: Array<{ value: string }>;
}

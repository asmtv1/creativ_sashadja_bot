let miniAppToken: string | null = null;

export function setMiniAppToken(token: string) {
  miniAppToken = token;
}

export function getMiniAppToken(): string | null {
  return miniAppToken;
}

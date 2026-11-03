const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const isValidId = (s: string) => ID_RE.test(s);
export const MAX_PARTICIPANTS = 50;

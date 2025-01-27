export const cleanSubreddits = (subreddits: string[]): string[] => subreddits.map((name) => name.replace(/\s/g, ""));

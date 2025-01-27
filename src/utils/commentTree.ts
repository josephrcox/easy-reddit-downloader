import { JSONcomment } from "../types/output";

const SYMBOLS_ANSI = {
  BRANCH: "├─",
  EMPTY: "",
  INDENT: "  ",
  LAST_BRANCH: "└─",
  VERTICAL: "│ ",
};

const SYMBOLS_ASCII = {
  BRANCH: "|-",
  EMPTY: "",
  INDENT: "  ",
  LAST_BRANCH: "`-",
  VERTICAL: "| ",
};

interface TreeOptions {
  lineAscii?: boolean;
}

const DEFAULT_OPTIONS: TreeOptions = {
  lineAscii: false,
};

function processCommentTree(
  comment: JSONcomment,
  depth: number = 0,
  precedingSymbols: string = "",
  options: TreeOptions = DEFAULT_OPTIONS,
  isLast: boolean = true
): string[] {
  const lines: string[] = [];
  const SYMBOLS = options.lineAscii ? SYMBOLS_ASCII : SYMBOLS_ANSI;

  // Build the current line
  let line = "";

  // Add base indentation and preceding symbols
  if (depth >= 1) {
    line += precedingSymbols;
    line += isLast ? SYMBOLS.LAST_BRANCH : SYMBOLS.BRANCH;
  }

  // Add the comment content
  line += `[${comment.user} | ${comment.votes > 0 ? "+" : ""}${comment.votes}]: ${comment.comment}`;
  lines.push(line);

  // Calculate new preceding symbols for children
  let newPrecedingSymbols = precedingSymbols;
  if (depth >= 1) {
    newPrecedingSymbols = precedingSymbols + (isLast ? SYMBOLS.INDENT : SYMBOLS.VERTICAL);
  } else {
    newPrecedingSymbols = SYMBOLS.INDENT;
  }

  // Process child comments
  if (comment.child && comment.child.length > 0) {
    comment.child.forEach((childComment, index) => {
      const isCurrentLast = index === comment.child.length - 1;
      const childLines = processCommentTree(
        childComment,
        depth + 1,
        newPrecedingSymbols,
        options,
        isCurrentLast
      );
      lines.push(...childLines);
    });
  }

  return lines;
}

export function formatCommentsAsTree(comments: JSONcomment[], options: TreeOptions = DEFAULT_OPTIONS): string {
  return comments
    .map((comment, index) => {
      const result = processCommentTree(comment, 0, "", options);
      // Add single newline between top-level comments, but not after the last one
      return index < comments.length - 1 ? [...result, ""] : result;
    })
    .flat()
    .join("\n");
}

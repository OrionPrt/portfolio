import { createInterface } from "node:readline/promises";

const ENTER = new Set(["\r", "\n", "\u0004"]);
const CTRL_C = "\u0003";
const BACKSPACE = new Set(["\u007f", "\b"]);
const ESCAPE = "\u001b";

/** A visible answer, one line. */
export async function ask(question: string): Promise<string> {
  const reader = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return (await reader.question(question)).trim();
  } finally {
    reader.close();
  }
}

/**
 * A hidden answer (a password): nothing is echoed, and it never goes through
 * the shell's history or arguments. Needs a terminal.
 */
export function askHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) {
    return Promise.reject(
      new Error("a terminal is needed to type a password."),
    );
  }
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();
  return new Promise((resolve, reject) => {
    let answer = "";
    const finish = (settle: () => void) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stdout.write("\n");
      settle();
    };
    function onData(chunk: string) {
      // Arrow and function keys send escape sequences: they are not typed text.
      if (chunk.startsWith(ESCAPE)) {
        return;
      }
      for (const character of chunk) {
        if (ENTER.has(character)) {
          finish(() => {
            resolve(answer);
          });
          return;
        }
        if (character === CTRL_C) {
          finish(() => {
            reject(new Error("cancelled."));
          });
          return;
        }
        answer = BACKSPACE.has(character)
          ? Array.from(answer).slice(0, -1).join("")
          : answer + character;
      }
    }
    stdin.on("data", onData);
  });
}

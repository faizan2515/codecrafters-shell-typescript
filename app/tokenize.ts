type QuoteMode = "none" | "single" | "double";

export function tokenize(
  line: string,
  getVariable?: (name: string) => string | undefined,
): string[] {
  const result: string[] = [];
  let current = "";
  let quoteMode: QuoteMode = "none";

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    // Backslash escaping outside quotes
    if (quoteMode === "none" && char === "\\") {
      i++;

      if (i < line.length) {
        current += line[i];
      }

      continue;
    }

    if (quoteMode === "single") {
      if (char === "'") {
        quoteMode = "none";
      } else {
        current += char;
      }

      continue;
    }

    if (char === "$" && getVariable) {
      const bracedMatch = line
        .slice(i + 1)
        .match(/^\{([A-Za-z_][A-Za-z0-9_]*)\}/);

      if (bracedMatch) {
        current += getVariable(bracedMatch[1]) ?? "";
        i += bracedMatch[0].length;
        continue;
      }

      const variableMatch = line.slice(i + 1).match(/^[A-Za-z_][A-Za-z0-9_]*/);

      if (variableMatch) {
        current += getVariable(variableMatch[0]) ?? "";
        i += variableMatch[0].length;
        continue;
      }
    }

    if (quoteMode === "double") {
      if (char === "\\") {
        const next = line[i + 1];

        if (next === '"' || next === "\\") {
          current += next;
          i++;
        } else {
          current += "\\";
        }
      } else if (char === '"') {
        quoteMode = "none";
      } else {
        current += char;
      }

      continue;
    }

    // Outside quotes
    if (char === "'") {
      quoteMode = "single";
    } else if (char === '"') {
      quoteMode = "double";
    } else if (/\s/.test(char)) {
      if (current.length > 0) {
        result.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    result.push(current);
  }

  return result;
}

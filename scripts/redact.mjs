/**
 * Redact the generated mirror so it publishes the ALGORITHM, not its tuning.
 *
 * The formulas (every function body: how scores, ranks, reputation and payouts
 * are computed) stay verbatim. What is withheld is every tuned value, because
 * knowing the exact thresholds, weights and caps is what lets someone game them:
 *
 *   - Every top-level constant whose value contains a number becomes a
 *     declared-only parameter (`export declare const NAME: type;`): the name
 *     and type stay, the value does not.
 *   - All comments are removed, since prose explaining a value leaks the value.
 *   - A leak guard fails the sync if any numeric literal outside a small set of
 *     structural ones (0, 1, 100, ...) is left anywhere in the output. A tuned
 *     number inlined inside a function must be lifted into a named constant in
 *     the monorepo first, so it is redacted like the rest.
 *
 * Uses the TypeScript compiler (not regex) so strings such as URLs are never
 * mangled, and the type checker to name the type of an unannotated constant.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";

/**
 * Numbers that carry no tuning: identities, unit conversions (percent, basis
 * points, ms, hours), and the weighted draw's hash width (6 bytes = 48 bits).
 */
const STRUCTURAL_NUMBERS = new Set([0, 1, 2, 6, 10, 16, 24, 48, 60, 100, 1000, 10000]);

function containsNumber(node) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isNumericLiteral(n)) {
      found = true;
      return;
    }
    if (ts.isFunctionLike(n)) return; // a helper's body is formula, not a value
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

/** The non-literal type of a value: 50 -> number, "x" -> string, unions too. */
function widen(checker, type) {
  return checker.getWidenedType(checker.getBaseTypeOfLiteralType(type));
}

/**
 * Redact every file under `dir` (paths relative to it) in place. Returns the
 * list of leaks: numeric literals that survived redaction.
 */
export async function redactMirror(dir, files) {
  const paths = files.map((f) => join(dir, f));
  const program = ts.createProgram(paths, {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  });
  const checker = program.getTypeChecker();
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  const f = ts.factory;
  const leaks = [];

  for (const [i, path] of paths.entries()) {
    const source = program.getSourceFile(path);
    if (!source) throw new Error(`redact: cannot parse ${files[i]}`);

    const statements = source.statements.map((stmt) => {
      if (!ts.isVariableStatement(stmt)) return stmt;
      if (!(stmt.declarationList.flags & ts.NodeFlags.Const)) return stmt;
      const decls = stmt.declarationList.declarations;
      if (!decls.some((d) => d.initializer && containsNumber(d.initializer))) return stmt;
      const exported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const declared = decls.map((d) => {
        const type =
          d.type ??
          checker.typeToTypeNode(
            // Widen literal types too: `const X = 50` is typed `50`, which
            // would publish the value as its own type annotation.
            widen(checker, checker.getTypeAtLocation(d.name)),
            undefined,
            ts.NodeBuilderFlags.NoTruncation
          );
        return f.createVariableDeclaration(d.name, undefined, type, undefined);
      });
      return f.createVariableStatement(
        [
          ...(exported ? [f.createModifier(ts.SyntaxKind.ExportKeyword)] : []),
          f.createModifier(ts.SyntaxKind.DeclareKeyword),
        ],
        f.createVariableDeclarationList(declared, ts.NodeFlags.Const)
      );
    });

    const updated = f.updateSourceFile(source, statements);
    const printed = printer.printFile(updated);

    // Leak guard over what will actually be published.
    const check = ts.createSourceFile(path, printed, ts.ScriptTarget.ES2023, true);
    const visit = (n) => {
      if (ts.isNumericLiteral(n)) {
        const value = Number(n.text.replace(/_/g, ""));
        if (!STRUCTURAL_NUMBERS.has(value)) {
          const { line } = check.getLineAndCharacterOfPosition(n.getStart(check));
          leaks.push(`${files[i]}:${line + 1}: ${n.text}`);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(check);

    await writeFile(path, printed);
  }
  return leaks;
}

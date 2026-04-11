const vscode = require("vscode");

const DOCS_URL = "https://bitintx.github.io/monster-lang/";
const CLI_DOCS_URL = `${DOCS_URL}cli.html`;

const HOVER_ENTRIES = new Map(
  Object.entries({
    import: {
      kind: "keyword",
      signature: 'import "path/to/file.mnst";\nimport "path/to/file.mnst" as module;',
      description:
        "Loads another Monster source file. Aliased imports expose functions through a module-style prefix such as `math.add(...)`.",
    },
    extern: {
      kind: "keyword",
      signature: "extern fn name(param: Type) -> Type;",
      description:
        "Declares a function implemented outside Monster, usually by libc or the platform linker.",
    },
    fn: {
      kind: "keyword",
      signature: "fn name(param: Type) -> Type { ... }",
      description: "Declares a Monster function.",
    },
    struct: {
      kind: "keyword",
      signature: "struct Name { field: Type }",
      description:
        "Declares a plain data aggregate with named fields. Struct values can be created with struct literals.",
    },
    enum: {
      kind: "keyword",
      signature: "enum Name { Variant, Payload(Type) }",
      description:
        "Declares a tagged set of variants. Variants may be C-like or carry one payload value.",
    },
    match: {
      kind: "keyword",
      signature: "match value { Variant => expr, Variant(x) => expr }",
      description:
        "Selects an expression branch by enum variant. Payload variants can bind their contained value.",
    },
    let: {
      kind: "keyword",
      signature: "let name: Type = value;\nlet mut name: Type = value;",
      description: "Declares a local variable. Use `mut` when the variable should be assignable.",
    },
    const: {
      kind: "keyword",
      signature: "const NAME: Type = expr;",
      description:
        "Declares a top-level compile-time constant. Current initializers support scalar expressions such as literals, arithmetic, casts, booleans, strings, and sizeof(T).",
    },
    mut: {
      kind: "keyword",
      signature: "let mut name: Type = value;",
      description: "Marks a local binding as mutable, allowing later assignment.",
    },
    return: {
      kind: "keyword",
      signature: "return expr;\nreturn;",
      description: "Returns from the current function. Bare `return;` is for `void` functions.",
    },
    if: {
      kind: "keyword",
      signature: "if condition { ... } else { ... }",
      description: "Runs a block when a `bool` condition is true.",
    },
    else: {
      kind: "keyword",
      signature: "if condition { ... } else { ... }",
      description: "Provides the fallback branch for an `if` expression or statement.",
    },
    while: {
      kind: "keyword",
      signature: "while condition { ... }",
      description: "Repeats a block while a `bool` condition stays true.",
    },
    break: {
      kind: "keyword",
      signature: "break;",
      description: "Exits the nearest `while` loop.",
    },
    continue: {
      kind: "keyword",
      signature: "continue;",
      description: "Skips to the next iteration of the nearest `while` loop.",
    },
    as: {
      kind: "keyword",
      signature: "expr as Type",
      description: "Performs an explicit scalar or pointer-related cast supported by the compiler.",
    },
    sizeof: {
      kind: "keyword",
      signature: "sizeof(Type)",
      description: "Returns the size of a type as a `usize` value.",
    },
    true: {
      kind: "literal",
      signature: "true",
      description: "Boolean true value.",
    },
    false: {
      kind: "literal",
      signature: "false",
      description: "Boolean false value.",
    },
    i32: {
      kind: "type",
      signature: "i32",
      description: "Signed 32-bit integer type.",
    },
    u8: {
      kind: "type",
      signature: "u8",
      description: "Unsigned 8-bit integer type. Useful for bytes and raw file/string buffers.",
    },
    usize: {
      kind: "type",
      signature: "usize",
      description: "Pointer-sized unsigned integer type for lengths, sizes, and indexes.",
    },
    bool: {
      kind: "type",
      signature: "bool",
      description: "Boolean type with values `true` and `false`.",
    },
    str: {
      kind: "type",
      signature: "str",
      description: "String pointer type used for string literals and C-style text buffers.",
    },
    void: {
      kind: "type",
      signature: "void",
      description: "Function return type for functions that do not return a value.",
    },
    print_i32: {
      kind: "builtin",
      signature: "print_i32(value: i32) -> void",
      description: "Prints an `i32` without a trailing newline.",
    },
    print_bool: {
      kind: "builtin",
      signature: "print_bool(value: bool) -> void",
      description: "Prints a `bool` without a trailing newline.",
    },
    print_str: {
      kind: "builtin",
      signature: "print_str(value: str) -> void",
      description: "Prints a string without a trailing newline.",
    },
    print_ln_i32: {
      kind: "builtin",
      signature: "print_ln_i32(value: i32) -> void",
      description: "Prints an `i32` followed by a newline.",
    },
    print_ln_bool: {
      kind: "builtin",
      signature: "print_ln_bool(value: bool) -> void",
      description: "Prints a `bool` followed by a newline.",
    },
    print_ln_str: {
      kind: "builtin",
      signature: "print_ln_str(value: str) -> void",
      description: "Prints a string followed by a newline.",
    },
    read_i32: {
      kind: "builtin",
      signature: "read_i32() -> i32",
      description: "Reads one integer from standard input.",
    },
    read_file: {
      kind: "builtin",
      signature: "read_file(path: str, len_out: *usize) -> *u8",
      description:
        "Reads a whole file into a heap-allocated byte buffer and writes the byte length through `len_out`.",
    },
    write_file: {
      kind: "builtin",
      signature: "write_file(path: str, data: *u8, len: usize) -> i32",
      description: "Writes `len` bytes from `data` into a file and returns a status code.",
    },
    len: {
      kind: "builtin",
      signature: "len(array_or_slice) -> usize",
      description: "Returns the length of a fixed-size array or slice.",
    },
    slice: {
      kind: "builtin",
      signature: "slice(array) -> [T]",
      description: "Creates a slice view over a fixed-size array.",
    },
    strlen: {
      kind: "builtin",
      signature: "strlen(value: str) -> usize",
      description: "Returns the byte length of a null-terminated string.",
    },
    memcmp: {
      kind: "builtin",
      signature: "memcmp(lhs: *u8, rhs: *u8, len: usize) -> i32",
      description: "Compares two byte buffers for `len` bytes.",
    },
    memcpy: {
      kind: "builtin",
      signature: "memcpy(dst: *u8, src: *u8, len: usize) -> *u8",
      description: "Copies `len` bytes from `src` into `dst`.",
    },
    str_eq: {
      kind: "builtin",
      signature: "str_eq(lhs: str, rhs: str) -> bool",
      description: "Returns whether two null-terminated strings have the same bytes.",
    },
    is: {
      kind: "builtin",
      signature: "is(value, Variant) -> bool",
      description: "Checks whether a payload enum value currently has the given variant.",
    },
    payload: {
      kind: "builtin",
      signature: "payload(value, Variant) -> T",
      description: "Extracts the payload from a payload enum variant after you know it matches.",
    },
  })
);

const MANIFEST_HOVER_ENTRIES = new Map(
  Object.entries({
    package: {
      kind: "section",
      signature: "[package]",
      description: "Project identity and entry-point settings for a Monster package.",
    },
    build: {
      kind: "section",
      signature: "[build]",
      description: "Default compiler options used by `mst build` and `mst run`.",
    },
    name: {
      kind: "manifest key",
      signature: 'name = "hello-monster"',
      description: "The package name created by `mst init` and shown in project metadata.",
    },
    entry: {
      kind: "manifest key",
      signature: 'entry = "src/main.mnst"',
      description:
        "The default source file. Commands such as `mst check`, `mst build`, and `mst run` can use this when no input path is passed.",
    },
    profile: {
      kind: "manifest key",
      signature: 'profile = "release"',
      description: "Build profile. Use `release` for optimized builds or `debug` for easier debugging.",
    },
    mode: {
      kind: "manifest key",
      signature: 'mode = "debug"',
      description: "Alias for `profile`, kept for short manifest experiments.",
    },
    "opt-level": {
      kind: "manifest key",
      signature: "opt-level = 2",
      description: "LLVM optimization level. Valid values are `0`, `1`, `2`, and `3`.",
    },
    opt_level: {
      kind: "manifest key",
      signature: "opt_level = 2",
      description: "Underscore spelling for `opt-level`.",
    },
    cpu: {
      kind: "manifest key",
      signature: 'cpu = "generic"',
      description: "Target CPU tuning. Use `generic` for portable builds or `native` for the current machine.",
    },
    release: {
      kind: "manifest value",
      signature: 'profile = "release"',
      description: "Optimized build profile.",
    },
    debug: {
      kind: "manifest value",
      signature: 'profile = "debug"',
      description: "Debug-friendly build profile.",
    },
    generic: {
      kind: "manifest value",
      signature: 'cpu = "generic"',
      description: "Portable CPU target.",
    },
    native: {
      kind: "manifest value",
      signature: 'cpu = "native"',
      description: "Tune output for the current CPU.",
    },
  })
);

function buildHover(word, wordRange, entry, codeLanguage, docsUrl) {
  const markdown = new vscode.MarkdownString();
  markdown.supportHtml = false;
  markdown.appendMarkdown(`**${word}** _${entry.kind}_\n\n`);
  markdown.appendCodeblock(entry.signature, codeLanguage);
  markdown.appendMarkdown(`\n${entry.description}\n\n`);
  markdown.appendMarkdown(`[Monster docs](${docsUrl})`);

  return new vscode.Hover(markdown, wordRange);
}

function createHoverProvider(entries, wordRegex, codeLanguage, docsUrl) {
  return {
    provideHover(document, position) {
      const wordRange = document.getWordRangeAtPosition(position, wordRegex);

      if (!wordRange) {
        return undefined;
      }

      const word = document.getText(wordRange);
      const entry = entries.get(word);

      if (!entry) {
        return undefined;
      }

      return buildHover(word, wordRange, entry, codeLanguage, docsUrl);
    },
  };
}

function activate(context) {
  const monsterProvider = vscode.languages.registerHoverProvider(
    "monster",
    createHoverProvider(HOVER_ENTRIES, /[A-Za-z_][A-Za-z0-9_]*/, "mnst", DOCS_URL)
  );
  const manifestProvider = vscode.languages.registerHoverProvider(
    "monster-manifest",
    createHoverProvider(MANIFEST_HOVER_ENTRIES, /[A-Za-z_][A-Za-z0-9_-]*/, "toml", CLI_DOCS_URL)
  );

  context.subscriptions.push(monsterProvider, manifestProvider);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

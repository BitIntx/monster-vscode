const vscode = require("vscode");
const cp = require("child_process");
const fs = require("fs");
const path = require("path");

const DOCS_URL = "https://bitintx.github.io/monster-lang/";
const CLI_DOCS_URL = `${DOCS_URL}cli.html`;
const STD_IMPORTS = [
  {
    path: "std/assert.mnst",
    detail: "std: fail-fast assertion helpers",
  },
  {
    path: "std/fs.mnst",
    detail: "std: FileBytes helpers around read_file/write_file",
  },
  {
    path: "std/mem.mnst",
    detail: "std: byte-oriented memory helpers",
  },
  {
    path: "std/str.mnst",
    detail: "std: C-style string helpers",
  },
  {
    path: "std/vec_i32.mnst",
    detail: "std: concrete growable VecI32",
  },
];

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
      signature: "let name = value;\nlet name: Type = value;",
      description:
        "Declares a local variable. The type can be inferred from the initializer or written explicitly.",
    },
    const: {
      kind: "keyword",
      signature: "const NAME: Type = expr;",
      description:
        "Declares a top-level compile-time constant. Current initializers support scalar expressions such as literals, arithmetic, casts, booleans, strings, and sizeof(T).",
    },
    mut: {
      kind: "keyword",
      signature: "let mut name = value;\nlet mut name: Type = value;",
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
    defer: {
      kind: "keyword",
      signature: "defer cleanup_call();",
      description:
        "Registers a scope cleanup expression. Deferred expressions must return `void` and run in last-in, first-out order when the block exits, including return, break, and continue paths.",
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
      signature: "write_file(path: str, data: *u8, len: usize) -> void",
      description: "Writes `len` bytes from `data` into a file.",
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
      signature: "memcpy(dst: *u8, src: *u8, len: usize) -> void",
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

const STD_HOVER_ENTRIES = [
  {
    word: "FileBytes",
    kind: "std type",
    signature: "struct FileBytes { data: *u8, len: usize }",
    description: "Owned file bytes returned by `fs_read`. Pair with `defer fs_free(file);`.",
  },
  {
    word: "fs_read",
    kind: "std function",
    signature: "fs_read(path: str) -> FileBytes",
    description: "Reads a whole file into an owned byte buffer and stores the byte length beside it.",
  },
  {
    word: "fs_write",
    kind: "std function",
    signature: "fs_write(path: str, file: FileBytes) -> void",
    description: "Writes a `FileBytes` buffer to a file.",
  },
  {
    word: "fs_free",
    kind: "std function",
    signature: "fs_free(file: FileBytes) -> void",
    description: "Frees the owned buffer inside `FileBytes`. Usually used with `defer`.",
  },
  {
    word: "fs_as_str",
    kind: "std function",
    signature: "fs_as_str(file: FileBytes) -> str",
    description: "Views a file byte buffer as a C-style string.",
  },
  {
    word: "assert_true",
    kind: "std function",
    signature: "assert_true(value: bool) -> void",
    description: "Fails fast with exit code 1 when `value` is false.",
  },
  {
    word: "assert_false",
    kind: "std function",
    signature: "assert_false(value: bool) -> void",
    description: "Fails fast with exit code 1 when `value` is true.",
  },
  {
    word: "assert_i32_eq",
    kind: "std function",
    signature: "assert_i32_eq(expected: i32, actual: i32) -> void",
    description: "Fails fast when two `i32` values differ.",
  },
  {
    word: "assert_usize_eq",
    kind: "std function",
    signature: "assert_usize_eq(expected: usize, actual: usize) -> void",
    description: "Fails fast when two `usize` values differ.",
  },
  {
    word: "assert_str_eq",
    kind: "std function",
    signature: "assert_str_eq(expected: str, actual: str) -> void",
    description: "Fails fast when two strings differ.",
  },
  {
    word: "mem_calloc_u8",
    kind: "std function",
    signature: "mem_calloc_u8(count: usize) -> *u8",
    description: "Allocates zeroed byte storage with `calloc`.",
  },
  {
    word: "mem_free_u8",
    kind: "std function",
    signature: "mem_free_u8(ptr: *u8) -> void",
    description: "Frees a byte pointer allocated by Monster/libc helpers.",
  },
  {
    word: "mem_copy",
    kind: "std function",
    signature: "mem_copy(dst: *u8, src: *u8, len: usize) -> void",
    description: "Copies bytes from `src` to `dst`.",
  },
  {
    word: "mem_cmp",
    kind: "std function",
    signature: "mem_cmp(lhs: *u8, rhs: *u8, len: usize) -> i32",
    description: "Compares two byte buffers.",
  },
  {
    word: "str_len",
    kind: "std function",
    signature: "str_len(value: str) -> usize",
    description: "Returns the byte length of a C-style string.",
  },
  {
    word: "str_is_empty",
    kind: "std function",
    signature: "str_is_empty(value: str) -> bool",
    description: "Returns true when a C-style string has length zero.",
  },
  {
    word: "str_equals",
    kind: "std function",
    signature: "str_equals(lhs: str, rhs: str) -> bool",
    description: "Compares two C-style strings for byte equality.",
  },
  {
    word: "str_copy_to",
    kind: "std function",
    signature: "str_copy_to(dst: *u8, src: str) -> void",
    description: "Copies a string, including its null terminator, into `dst`.",
  },
  {
    word: "VecI32",
    kind: "std type",
    signature: "struct VecI32 { data: *i32, len: i32, cap: i32 }",
    description: "A concrete growable vector for `i32` values.",
  },
  {
    word: "vec_i32_new",
    kind: "std function",
    signature: "vec_i32_new() -> VecI32",
    description: "Creates a growable `VecI32`.",
  },
  {
    word: "vec_i32_push",
    kind: "std function",
    signature: "vec_i32_push(vec: *VecI32, value: i32) -> void",
    description: "Appends one value to a `VecI32`, growing storage when needed.",
  },
  {
    word: "vec_i32_get",
    kind: "std function",
    signature: "vec_i32_get(vec: VecI32, index: i32) -> i32",
    description: "Reads one value from a `VecI32`.",
  },
  {
    word: "vec_i32_free",
    kind: "std function",
    signature: "vec_i32_free(vec: VecI32) -> void",
    description: "Frees the backing storage of a `VecI32`. Usually used with `defer`.",
  },
];

for (const entry of STD_HOVER_ENTRIES) {
  HOVER_ENTRIES.set(entry.word, {
    kind: entry.kind,
    signature: entry.signature,
    description: entry.description,
  });
}

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

const MONSTER_COMPLETION_ENTRIES = [
  {
    label: "print_i32",
    kind: vscode.CompletionItemKind.Function,
    insertText: "print_i32(${1:value})",
    detail: "builtin: print_i32(value: i32) -> void",
  },
  {
    label: "print_bool",
    kind: vscode.CompletionItemKind.Function,
    insertText: "print_bool(${1:value})",
    detail: "builtin: print_bool(value: bool) -> void",
  },
  {
    label: "print_str",
    kind: vscode.CompletionItemKind.Function,
    insertText: "print_str(${1:value})",
    detail: "builtin: print_str(value: str) -> void",
  },
  {
    label: "print_ln_i32",
    kind: vscode.CompletionItemKind.Function,
    insertText: "print_ln_i32(${1:value})",
    detail: "builtin: print_ln_i32(value: i32) -> void",
  },
  {
    label: "print_ln_bool",
    kind: vscode.CompletionItemKind.Function,
    insertText: "print_ln_bool(${1:value})",
    detail: "builtin: print_ln_bool(value: bool) -> void",
  },
  {
    label: "print_ln_str",
    kind: vscode.CompletionItemKind.Function,
    insertText: "print_ln_str(${1:value})",
    detail: "builtin: print_ln_str(value: str) -> void",
  },
  {
    label: "read_i32",
    kind: vscode.CompletionItemKind.Function,
    insertText: "read_i32()",
    detail: "builtin: read_i32() -> i32",
  },
  {
    label: "read_file",
    kind: vscode.CompletionItemKind.Function,
    insertText: "read_file(${1:path}, ${2:len_out})",
    detail: "builtin: read_file(path: str, len_out: *usize) -> *u8",
  },
  {
    label: "write_file",
    kind: vscode.CompletionItemKind.Function,
    insertText: "write_file(${1:path}, ${2:data}, ${3:len})",
    detail: "builtin: write_file(path: str, data: *u8, len: usize) -> void",
  },
  {
    label: "len",
    kind: vscode.CompletionItemKind.Function,
    insertText: "len(${1:value})",
    detail: "builtin: len(array_or_slice) -> usize",
  },
  {
    label: "slice",
    kind: vscode.CompletionItemKind.Function,
    insertText: "slice(${1:array})",
    detail: "builtin: slice(array) -> [T]",
  },
  {
    label: "strlen",
    kind: vscode.CompletionItemKind.Function,
    insertText: "strlen(${1:value})",
    detail: "builtin: strlen(value: str) -> usize",
  },
  {
    label: "memcmp",
    kind: vscode.CompletionItemKind.Function,
    insertText: "memcmp(${1:lhs}, ${2:rhs}, ${3:len})",
    detail: "builtin: memcmp(lhs: *u8, rhs: *u8, len: usize) -> i32",
  },
  {
    label: "memcpy",
    kind: vscode.CompletionItemKind.Function,
    insertText: "memcpy(${1:dst}, ${2:src}, ${3:len})",
    detail: "builtin: memcpy(dst: *u8, src: *u8, len: usize) -> void",
  },
  {
    label: "str_eq",
    kind: vscode.CompletionItemKind.Function,
    insertText: "str_eq(${1:lhs}, ${2:rhs})",
    detail: "builtin: str_eq(lhs: str, rhs: str) -> bool",
  },
  {
    label: "is",
    kind: vscode.CompletionItemKind.Function,
    insertText: "is(${1:value}, ${2:Variant})",
    detail: "builtin: is(value, Variant) -> bool",
  },
  {
    label: "payload",
    kind: vscode.CompletionItemKind.Function,
    insertText: "payload(${1:value}, ${2:Variant})",
    detail: "builtin: payload(value, Variant) -> T",
  },
  {
    label: "sizeof",
    kind: vscode.CompletionItemKind.Function,
    insertText: "sizeof(${1:Type})",
    detail: "builtin: sizeof(Type) -> usize",
  },
  {
    label: "main",
    kind: vscode.CompletionItemKind.Snippet,
    insertText: "fn main() -> i32 {\n    ${1:print_ln_str(\"Hello, Monster!\");}\n    return 0;\n}",
    detail: "snippet: main function",
  },
  {
    label: "mainargs",
    kind: vscode.CompletionItemKind.Snippet,
    insertText: "fn main(argc: i32, argv: **u8) -> i32 {\n    $0\n    return 0;\n}",
    detail: "snippet: main(argc, argv)",
  },
  {
    label: "fn",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "fn ${1:name}(${2}) -> ${3:i32} {\n    $0\n}",
    detail: "keyword: function declaration",
  },
  {
    label: "extern",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "extern fn ${1:name}(${2:param}: ${3:i32}) -> ${4:i32};",
    detail: "keyword: extern function declaration",
  },
  {
    label: "import",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "import \"${1:path/to/file.mnst}\";",
    detail: "keyword: source import",
  },
  {
    label: "importas",
    kind: vscode.CompletionItemKind.Snippet,
    insertText: "import \"${1:path/to/file.mnst}\" as ${2:module};",
    detail: "snippet: aliased import",
  },
  {
    label: "struct",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "struct ${1:Name} {\n    ${2:field}: ${3:i32},\n}",
    detail: "keyword: struct declaration",
  },
  {
    label: "enum",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "enum ${1:Name} {\n    ${2:Variant},\n    ${3:Payload}(${4:i32}),\n}",
    detail: "keyword: enum declaration",
  },
  {
    label: "const",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "const ${1:NAME}: ${2:i32} = ${3:0};",
    detail: "keyword: top-level constant",
  },
  {
    label: "let",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "let ${1:name} = ${2:value};",
    detail: "keyword: inferred local binding",
  },
  {
    label: "let mut",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "let mut ${1:name} = ${2:value};",
    detail: "keyword: inferred mutable local binding",
  },
  {
    label: "let typed",
    kind: vscode.CompletionItemKind.Snippet,
    insertText: "let ${1:name}: ${2:i32} = ${3:0};",
    detail: "snippet: explicitly typed local binding",
  },
  {
    label: "let mut typed",
    kind: vscode.CompletionItemKind.Snippet,
    insertText: "let mut ${1:name}: ${2:i32} = ${3:0};",
    detail: "snippet: explicitly typed mutable local binding",
  },
  {
    label: "if",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "if ${1:condition} {\n    $0\n}",
    detail: "keyword: if statement",
  },
  {
    label: "while",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "while ${1:condition} {\n    $0\n}",
    detail: "keyword: while loop",
  },
  {
    label: "match",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "match ${1:value} {\n    ${2:Variant} => ${3:0},\n    ${4:Other} => ${5:1},\n}",
    detail: "keyword: match expression",
  },
  {
    label: "return",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "return ${1:value};",
    detail: "keyword: return statement",
  },
  {
    label: "break",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "break;",
    detail: "keyword: break statement",
  },
  {
    label: "continue",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "continue;",
    detail: "keyword: continue statement",
  },
  {
    label: "defer",
    kind: vscode.CompletionItemKind.Keyword,
    insertText: "defer ${1:cleanup}(${2});",
    detail: "keyword: function-scope cleanup",
  },
  ...["i32", "u8", "usize", "bool", "str", "void"].map((label) => ({
    label,
    kind: vscode.CompletionItemKind.TypeParameter,
    insertText: label,
    detail: "Monster primitive type",
  })),
  ...["true", "false"].map((label) => ({
    label,
    kind: vscode.CompletionItemKind.Value,
    insertText: label,
    detail: "Monster boolean literal",
  })),
];

MONSTER_COMPLETION_ENTRIES.push(
  ...STD_IMPORTS.map((entry) => ({
    label: `import "${entry.path}"`,
    kind: vscode.CompletionItemKind.Module,
    insertText: `import "${entry.path}";`,
    detail: entry.detail,
  })),
  ...STD_HOVER_ENTRIES.map((entry) => ({
    label: entry.word,
    kind: entry.kind === "std type" ? vscode.CompletionItemKind.Struct : vscode.CompletionItemKind.Function,
    insertText: stdCompletionInsertText(entry),
    detail: `${entry.kind}: ${entry.signature}`,
  }))
);

const MANIFEST_COMPLETION_ENTRIES = [
  {
    label: "manifest",
    kind: vscode.CompletionItemKind.Snippet,
    insertText:
      '[package]\nname = "${1:hello-monster}"\nentry = "${2:src/main.mnst}"\n\n[build]\nprofile = "${3|release,debug|}"\nopt-level = ${4|0,1,2,3|}\ncpu = "${5|generic,native|}"',
    detail: "snippet: complete Monster.toml manifest",
  },
  {
    label: "package",
    kind: vscode.CompletionItemKind.Module,
    insertText: "[package]",
    detail: "manifest section",
  },
  {
    label: "build",
    kind: vscode.CompletionItemKind.Module,
    insertText: "[build]",
    detail: "manifest section",
  },
  {
    label: "name",
    kind: vscode.CompletionItemKind.Property,
    insertText: 'name = "${1:hello-monster}"',
    detail: "manifest key",
  },
  {
    label: "entry",
    kind: vscode.CompletionItemKind.Property,
    insertText: 'entry = "${1:src/main.mnst}"',
    detail: "manifest key",
  },
  {
    label: "profile",
    kind: vscode.CompletionItemKind.Property,
    insertText: 'profile = "${1|release,debug|}"',
    detail: "manifest key",
  },
  {
    label: "opt-level",
    kind: vscode.CompletionItemKind.Property,
    insertText: "opt-level = ${1|0,1,2,3|}",
    detail: "manifest key",
  },
  {
    label: "cpu",
    kind: vscode.CompletionItemKind.Property,
    insertText: 'cpu = "${1|generic,native|}"',
    detail: "manifest key",
  },
  ...["release", "debug", "generic", "native"].map((label) => ({
    label,
    kind: vscode.CompletionItemKind.Value,
    insertText: label,
    detail: "manifest value",
  })),
];

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

function buildCompletionItem(entry, index, docsUrl) {
  const item = new vscode.CompletionItem(entry.label, entry.kind);
  item.insertText = new vscode.SnippetString(entry.insertText);
  item.detail = entry.detail;
  item.sortText = `${String(index).padStart(3, "0")}_${entry.label}`;

  const docsEntry = HOVER_ENTRIES.get(entry.label) || MANIFEST_HOVER_ENTRIES.get(entry.label);
  const documentation = docsEntry?.description;

  if (documentation) {
    const markdown = new vscode.MarkdownString(documentation);
    markdown.appendMarkdown(`\n\n[Monster docs](${docsUrl})`);
    item.documentation = markdown;
  }

  return item;
}

function createCompletionProvider(entries, docsUrl) {
  return {
    provideCompletionItems() {
      return entries.map((entry, index) => buildCompletionItem(entry, index, docsUrl));
    },
  };
}

function stdCompletionInsertText(entry) {
  if (entry.kind === "std type") {
    return entry.word;
  }

  const params = entry.signature.match(/\(([^)]*)\)/)?.[1].trim();

  if (!params) {
    return `${entry.word}()`;
  }

  const placeholders = params.split(",").map((param, index) => {
    const name = param.trim().split(":")[0] || `arg${index + 1}`;
    return `\${${index + 1}:${name}}`;
  });

  return `${entry.word}(${placeholders.join(", ")})`;
}

function createStdImportCompletionProvider() {
  return {
    provideCompletionItems(document, position) {
      const range = getImportPathRange(document, position);

      if (!range) {
        return undefined;
      }

      return STD_IMPORTS.map((entry) => {
        const item = new vscode.CompletionItem(entry.path, vscode.CompletionItemKind.Module);
        item.insertText = entry.path;
        item.range = range;
        item.detail = entry.detail;
        item.documentation = new vscode.MarkdownString(`Import with \`import "${entry.path}";\`.`);
        return item;
      });
    },
  };
}

function getImportPathRange(document, position) {
  const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
  const match = linePrefix.match(/^\s*import\s+"([^"]*)$/);

  if (!match) {
    return undefined;
  }

  const typedPath = match[1];
  const start = position.character - typedPath.length;
  return new vscode.Range(position.line, start, position.line, position.character);
}

function getMonsterConfig() {
  return vscode.workspace.getConfiguration("monster");
}

function getCompilerPath() {
  return getMonsterConfig().get("compilerPath", "mst");
}

function shouldCheckOnSave() {
  return getMonsterConfig().get("checkOnSave", true);
}

function isMonsterDocument(document) {
  return document?.languageId === "monster" && document.uri.scheme === "file";
}

function getActiveMonsterDocument() {
  const editor = vscode.window.activeTextEditor;

  if (!editor || !isMonsterDocument(editor.document)) {
    vscode.window.showWarningMessage("Open a .mnst file first.");
    return undefined;
  }

  return editor.document;
}

function findProjectRoot(filePath) {
  let current = path.dirname(filePath);
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));

  while (true) {
    if (fs.existsSync(path.join(current, "Monster.toml"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  return workspaceFolder?.uri.fsPath || path.dirname(filePath);
}

function shellQuote(value) {
  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  return `'${value.replace(/'/g, "'\\''")}'`;
}

function runMonsterTerminalCommand(subcommand, document, label) {
  const compiler = getCompilerPath();
  const cwd = document ? findProjectRoot(document.uri.fsPath) : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!cwd) {
    vscode.window.showWarningMessage("Open a Monster workspace or .mnst file first.");
    return;
  }

  const args = document ? ` ${subcommand} ${shellQuote(document.uri.fsPath)}` : ` ${subcommand}`;
  const terminal = vscode.window.createTerminal({
    name: label,
    cwd,
  });
  terminal.show();
  terminal.sendText(`${shellQuote(compiler)}${args}`);
}

async function checkCurrentFile(diagnostics, output) {
  const document = getActiveMonsterDocument();

  if (!document) {
    return;
  }

  if (document.isDirty) {
    await document.save();
  }

  await runCheck(document, diagnostics, output, true);
}

async function runCheck(document, diagnostics, output, showOutput) {
  const compiler = getCompilerPath();
  const cwd = findProjectRoot(document.uri.fsPath);
  const label = path.relative(cwd, document.uri.fsPath) || path.basename(document.uri.fsPath);

  return new Promise((resolve) => {
    cp.execFile(
      compiler,
      ["check", document.uri.fsPath],
      {
        cwd,
        timeout: 15000,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const text = [stdout, stderr].filter(Boolean).join("\n").trim();

        if (error) {
          const message =
            error.code === "ENOENT"
              ? `Monster compiler '${compiler}' was not found. Set monster.compilerPath or add mst to PATH.`
              : text || error.message;
          diagnostics.set(document.uri, buildDiagnostics(document, message));
          appendOutput(output, `$ mst check ${label}\n${message}\n`);

          if (showOutput) {
            output.show(true);
            vscode.window.showErrorMessage(`Monster check failed for ${label}.`);
          }
        } else {
          diagnostics.delete(document.uri);
          appendOutput(output, `$ mst check ${label}\n${text || `OK: ${label}`}\n`);

          if (showOutput) {
            vscode.window.showInformationMessage(`Monster check passed: ${label}`);
          }
        }

        resolve();
      }
    );
  });
}

function appendOutput(output, text) {
  output.appendLine(text.trimEnd());
  output.appendLine("");
}

function buildDiagnostics(document, output) {
  const message = output.trim() || "Monster check failed.";
  const range = diagnosticRangeFromMessage(document, message);
  const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
  diagnostic.source = "mst";
  return [diagnostic];
}

function diagnosticRangeFromMessage(document, message) {
  const location =
    message.match(/(?:at|line)\s+(\d+):(\d+)/i) ||
    message.match(/line\s+(\d+)\s+(?:column|col)\s+(\d+)/i) ||
    message.match(/line\s+(\d+)/i);

  if (location) {
    const line = Math.max(Number(location[1]) - 1, 0);
    const column = Math.max(Number(location[2] || 1) - 1, 0);
    const documentLine = Math.min(line, Math.max(document.lineCount - 1, 0));
    const lineText = document.lineAt(documentLine).text;
    const startColumn = Math.min(column, lineText.length);
    const endColumn = Math.min(startColumn + 1, lineText.length);
    return new vscode.Range(documentLine, startColumn, documentLine, endColumn);
  }

  return document.lineAt(0).range;
}

function activate(context) {
  const diagnostics = vscode.languages.createDiagnosticCollection("monster");
  const output = vscode.window.createOutputChannel("Monster");
  const monsterProvider = vscode.languages.registerHoverProvider(
    "monster",
    createHoverProvider(HOVER_ENTRIES, /[A-Za-z_][A-Za-z0-9_]*/, "mnst", DOCS_URL)
  );
  const manifestProvider = vscode.languages.registerHoverProvider(
    "monster-manifest",
    createHoverProvider(MANIFEST_HOVER_ENTRIES, /[A-Za-z_][A-Za-z0-9_-]*/, "toml", CLI_DOCS_URL)
  );
  const monsterCompletionProvider = vscode.languages.registerCompletionItemProvider(
    "monster",
    createCompletionProvider(MONSTER_COMPLETION_ENTRIES, DOCS_URL),
    ".",
    "_"
  );
  const stdImportCompletionProvider = vscode.languages.registerCompletionItemProvider(
    "monster",
    createStdImportCompletionProvider(),
    "\"",
    "/"
  );
  const manifestCompletionProvider = vscode.languages.registerCompletionItemProvider(
    "monster-manifest",
    createCompletionProvider(MANIFEST_COMPLETION_ENTRIES, CLI_DOCS_URL),
    "-",
    "_",
    "\""
  );
  const checkCommand = vscode.commands.registerCommand("monster.checkCurrentFile", () =>
    checkCurrentFile(diagnostics, output)
  );
  const runCommand = vscode.commands.registerCommand("monster.runCurrentFile", async () => {
    const document = getActiveMonsterDocument();
    if (document?.isDirty) {
      await document.save();
    }
    if (document) {
      runMonsterTerminalCommand("run", document, "Monster Run");
    }
  });
  const buildCommand = vscode.commands.registerCommand("monster.buildCurrentFile", async () => {
    const document = getActiveMonsterDocument();
    if (document?.isDirty) {
      await document.save();
    }
    if (document) {
      runMonsterTerminalCommand("build", document, "Monster Build");
    }
  });
  const cleanCommand = vscode.commands.registerCommand("monster.cleanArtifacts", () =>
    runMonsterTerminalCommand("clean", undefined, "Monster Clean")
  );
  const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
    if (isMonsterDocument(document) && shouldCheckOnSave()) {
      runCheck(document, diagnostics, output, false);
    }
  });
  const closeListener = vscode.workspace.onDidCloseTextDocument((document) => {
    diagnostics.delete(document.uri);
  });

  context.subscriptions.push(
    diagnostics,
    output,
    monsterProvider,
    manifestProvider,
    monsterCompletionProvider,
    stdImportCompletionProvider,
    manifestCompletionProvider,
    checkCommand,
    runCommand,
    buildCommand,
    cleanCommand,
    saveListener,
    closeListener
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

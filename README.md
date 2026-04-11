# Monster Language for VS Code

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/monster-lang.monster-language?label=VS%20Marketplace&color=ff8a1f)](https://marketplace.visualstudio.com/items?itemName=monster-lang.monster-language)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/monster-lang.monster-language?label=Installs&color=f29f38)](https://marketplace.visualstudio.com/items?itemName=monster-lang.monster-language)
[![Compiler Repo](https://img.shields.io/badge/compiler-monster--lang-22160b?color=22160b)](https://github.com/BitIntx/monster-lang)
[![License: MIT](https://img.shields.io/badge/license-MIT-ff8a1f)](./LICENSE)

Basic VS Code support for the Monster programming language, `.mnst` source files, and `Monster.toml` project manifests.

This extension is developed alongside the main Monster compiler project:

- Compiler: <https://github.com/BitIntx/monster-lang>
- Extension: <https://github.com/BitIntx/monster-vscode>

## Install

From the VS Code Marketplace:

- <https://marketplace.visualstudio.com/items?itemName=monster-lang.monster-language>

Or from the command line:

```bash
code --install-extension monster-lang.monster-language
```

## What You Get

- `.mnst` and `Monster.toml` file associations
- syntax highlighting for current Monster syntax, including `const`, `struct`, `enum`, payload enums, `match`, `sizeof`, pointers, slices, imports, and `print_ln_*`
- syntax highlighting for `Monster.toml` project manifest sections and build options
- hover help for Monster keywords, primitive types, builtins, and manifest keys
- line comments and bracket rules
- starter snippets for `main`, `mainargs`, `hello`, `import`, `extern`, `const`, `struct`, `enum`, `match`, `if`, and `while`
- Monster file icon support for themes that do not define one already

## Quick Start

Create a Monster project:

```bash
mst init hello-monster
cd hello-monster
mst run
```

```mnst
fn main() -> i32 {
    print_ln_str("Hello, World!");
    return 0;
}
```

```toml
[package]
name = "hello-monster"
entry = "src/main.mnst"

[build]
profile = "release"
opt-level = 2
cpu = "generic"
```

Open a `.mnst` file or `Monster.toml` file and VS Code will automatically switch to the matching Monster language mode.

## Current Scope

Today this extension focuses on the basics:

- syntax coloring
- hover help
- snippets
- file association for `.mnst` and `Monster.toml`
- icon support

Not included yet:

- language server features
- diagnostics from the compiler
- formatting
- go-to-definition or semantic tokens

## Local Development

Open this repository in VS Code and press `F5` to launch an Extension Development Host.

You can also copy or symlink this folder into your local VS Code extensions directory:

- Linux/macOS: `~/.vscode/extensions/monster-language`
- Windows: `%USERPROFILE%\\.vscode\\extensions\\monster-language`

## Packaging

From the repository root:

```bash
npm run package
```

This creates a `.vsix` file that you can install locally in VS Code or upload to the Marketplace.

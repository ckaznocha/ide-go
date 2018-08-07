# Changelog
# 0.11.0
*   Setting changes no longer require you to restart atom.
*   Add setting for `Func Snippet Enabled`.
*   Add setting for `goimports Local Prefix`.
*   Add setting for `Use Binary Pkg Cache`.
*   Add setting for `Format Tool`.
*   Prompt to update older versions of `go-langsrever`.

# 0.10.0
*   `go-plus` is no longer a hard dependency, it will no longer prompt to
    install it if you've set a to go-langserver path manually.
*   Use `range` code formatting. Code format will no longer work unless you have
    the latest version of go-langserver.

# 0.9.0
*   Support tree-sitter
*   Support diagnostics, requires a newer version of go-langserver if you've
    not updated it a while. Enable in the settings, disabled by default.
*   Some refactoring for better types and error handling.

# 0.8.0
*   maintenance

## 0.7.0
*   TypeScript rewrite
*   Add support for signature help

## 0.6.1
*   Fix scope in call to onError

## 0.6.0
*   Better error handling
*   Add option to set the pprof address
*   Upgrade atom-languageclient to 0.8.1

## 0.5.0
*   Upgrade atom-languageclient to 0.8.0
*   Add autocomplete support ([@pbitty](https://github.com/pbitty))

## 0.4.0
*   Downloads missing package dependencies
*   Add support for code formatting

## 0.3.1
*   minor refactoring
*   README update

## 0.3.0
*   Add custom server path setting
*   guard against possible race condition if go-plus methods get called before
    atom-languageclient

## 0.2.0
*   Detect binary and install if missing.

## 0.1.0 - First Release
*   Every feature added
*   Every bug fixed

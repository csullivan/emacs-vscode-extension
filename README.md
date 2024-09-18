# Emacs Mark Mode for VSCode

```
   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
   sudo apt-get install -y nodejs
   npm install
   npm run compile
   npm install -g vsce
   vsce package
```

This VSCode extension brings Emacs-style mark mode to your editor, allowing you to set a mark, highlight text, and perform cut operations using familiar keybindings. Note that the project is in progress and not feature complete.

## Features

- Set a mark using `ctrl+space`
- Remove the mark using `ctrl+g`
- Cut the current selection using `ctrl+w`

## Installation

1. Clone the repository
2. Run `npm install` to install the required dependencies
3. Compile the extension using `npm run compile`
4. Install the extension in VSCode using the `.vsix` file

## Usage

1. Open a text file in VSCode
2. Use `ctrl+space` to set a mark at the current cursor position
3. Move the cursor to select text
4. Cut the selected text with `ctrl+w` or remove the mark using `ctrl+g`

## Requirements

- Visual Studio Code version 1.74.0 or higher

## Development

### Build

Run `npm run compile` to build the extension.

### Lint

Run `npm run lint` to lint the code.

### Watch

Run `npm run watch` to automatically compile the extension when source files change.

## License

This extension is released under the [MIT License](LICENSE).

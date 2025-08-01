# Albert Workflowy Plugin

This is a custom [Albert Launcher](https://albertlauncher.github.io/) plugin that integrates with your [WorkFlowy](https://workflowy.com/) account. It allows you to browse, view, and manage WorkFlowy nodes directly from Albert using a fast easy to use interface.

---

## Features

- Run the install.sh script to install the plugin and its dependencies
- View your Workflowy tree inside Albert (`wf`)
- Navigate into child nodes with autocomplete paths (`wf parent>child`)
- Remove, Edit, Complete any node with a single keystroke (Meta + Enter)
- Automatically suggest creation of new nodes if input doesn't match
- Easily authenticate via `wf auth`
- Uses Sign in with Google for secure email access
- Stores refresh token locally to reduce repeated sign in headaches
- Abstracted to `@google-cloud/local-auth` for more consistent and safer Google implementation
- Uses HTML-to-text parsing for node names
- Uses optimistic cache refreshing for seamless UX
- Comes with complete global CLI interface to control and manage WorkFlowy

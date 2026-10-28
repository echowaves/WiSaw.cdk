# BMad Workflow

Use the installed BMad skills as the sole structured workflow for product and engineering work. Select the most relevant skill for the request, use `bmad-build` for delegated feature or bug-fix implementation, and follow that skill's instructions. Do not invoke other workflow systems or create their artifacts.

## Project Context

- **Tech stack**: React Native 0.81.5, Expo 54.0.25, Expo Router 6.0.15, React 19.1.0
- **State management**: Jotai 2.15.0
- **API**: Apollo Client 4.0.2, GraphQL with WebSocket subscriptions
- **Architecture**: File-based routing (Expo Router), modular screens with reducers and custom hooks
- **Package manager**: npm
- **Dependencies**: Always use exact versions (no `^` or `~` prefixes)
- **Backend repo**: `/Users/dmitry/hacks/wisaw/Wisaw.cdk`
- **API schema**: Refer to GraphQL schema at `https://github.com/echowaves/WiSaw.cdk/blob/main/graphql/schema.graphql` using the GitHub MCP server
- **Complexity limit**: Maximum cyclomatic complexity of 8. Refactor by extracting helpers, using early returns, and breaking down conditionals.
- **Image caching**: Always use `expo-cached-image`
- **Key-value storage**: Always use `expo-storage`
- **Security**: `.env` must never be committed. Secrets must never be hardcoded.

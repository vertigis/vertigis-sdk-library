# VertiGIS SDK Library

This repo contains a library of configuration and routines that are shared between the VertiGIS [Web](https://github.com/vertigis/vertigis-web-sdk) and [Workflow](https://github.com/vertigis/vertigis-workflow-sdk) SDK projects.

## Requirements

-   The latest LTS version of [Node.js](https://nodejs.org/en/download/).
-   A code editor of your choice. We recommend [Visual Studio Code](https://code.visualstudio.com/).

## Testing

To test a generated project (either Web or Workflow):

-   In this project run `npm i` and then `npm link`.
-   In the Web or Workflow SDK project run `npm i` and then `npm link @vertigis/sdk-library`
-   Generate an SDK project with `npm create ...`
-   Then once the project is created navigate to it and run `npm link @vertigis/web-sdk` or `npm link @vertigis/workflow-sdk`
-   Then you can `npm build` `npm start` etc as normal in the project and the code from your development copy will be executed.

To run the tests in development:

-   Perform the first two steps above
-   In `test/e2e/index.js` make the following change (assuming all repos are in the same folder):

```
-- await $`npm pack @vertigis/${process.env.SDK_PLATFORM}-sdk ...
++ await $`npm pack ../vertigis-${process.env.SDK_PLATFORM}-sdk ...
```

-   Now you can run the tests included here against your development copy of either SDK project.


## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contributing guidelines.
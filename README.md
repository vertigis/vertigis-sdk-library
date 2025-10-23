# VertiGIS SDK Library

This repo contains a library of configuration and routines that are shared between the VertiGIS [Web](https://github.com/vertigis/vertigis-web-sdk) and [Workflow](https://github.com/vertigis/vertigis-workflow-sdk) SDK projects.

## Requirements

-   The latest LTS version of [Node.js](https://nodejs.org/en/download/).
-   A code editor of your choice. We recommend [Visual Studio Code](https://code.visualstudio.com/).

## Testing

To test a generated project (either Web or Workflow):

-   Download both this repo and the sdk repo you are interested in.
-   In this repo run `npm i` and then `npm link`.
-   In the Web or Workflow SDK repo run `npm i` and then `npm link @vertigis/sdk-library`
-   Generate an SDK project with `npm create ...`
-   Then once the project is created navigate to it and run `npm link @vertigis/web-sdk` or `npm link @vertigis/workflow-sdk` as appropriate.
-   Then you can `npm build` `npm start` etc as normal in the project and the code from your development copies will be executed.

To run the tests in development:

-   The above setup is sufficent to run the tests from the `web-sdk` or `workflow-sdk` repos. Normally this should be enough.
-   To run in development tests from `sdk-library` against development copies of the sdk repos you need to change the `npm pack` statement in `test/e2e/index.js` to point at your local sdk repos. 
-   Assuming everything is in the same folder, look for this line and change it like this:

```
-- await $`npm pack @vertigis/${process.env.SDK_PLATFORM}-sdk ...
++ await $`npm pack ../vertigis-${process.env.SDK_PLATFORM}-sdk ...
```

-   This will cause `sdk-library` to use packaged code from your development copies to run the tests.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contributing guidelines.
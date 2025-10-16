# Run the three.js viewer

## Run the app locally for development

### Prerequisites

You need to have cloned this repository and installed `npm`.
`npm` can be installed on Ubuntu withe the [instructions from Nodesource](https://deb.nodesource.com/).

To install the dependencies:

1. Go into the `threejs` folder:

    ```bash
    cd threejs
    ```

2. Install the dependencies

    ```bash
    npm ci
    ```

### Run the app

First, you need to put all the latest assets in [/threejs/assets](assets).

To run the app locally for development, you can use one of the commands available with `npm run`:

- Only make it available locally:

    ```bash
    npm run dev
    ```

- With ports to open from another device:

    ```bash
    npm run dev:host
    ```

## Run the app on the server for deployment

The instructions to run the app on the server are in the [specific server README](../server/README.md#web-app).

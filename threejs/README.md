# Run the three.js viewer

## Prerequisites

You need to have cloned this repository and installed `npm`. `npm` can be installed on Ubuntu withe the [instructions from Nodesource](https://deb.nodesource.com/).

## Install and run

1. Go into the `threejs` folder:

    ```bash
    cd threejs
    ```

2. Install the dependencies

    ```bash
    npm ci
    ```

3. Run:
    - Locally:

        ```bash
        npm run dev
        ```

    - With ports to open from another device:

        ```bash
        npm run dev:host
        ```

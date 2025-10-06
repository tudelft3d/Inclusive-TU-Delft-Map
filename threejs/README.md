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

If you have not done it yet, please follow the [instructions to set up connection to the server](../server/README.md#server-connection).

### Installation

Here are the steps to deploy the web page for the first time:

1. Connect to the server:

    ```bash
    ssh inclusivemap
    ```

2. Install `nginx`:

    ```bash
    sudo apt-get install nginx
    ```

3. Clone the repository using `git clone`.
4. Install `npm` by following these [instructions from Nodesource](https://deb.nodesource.com/).
5. Install the dependencies for the app:

    ```bash
    cd Inclusive-TU-Delft-Map/threejs
    npm ci
    ```

6. Set up HTTPS: TODO
7. Copy the site configuration to the right place and link it properly:

    ```bash
    sudo cp ../server/nginx_site /etc/nginx/sites-available/last_version
    sudo ln -s /etc/nginx/sites-available/last_version /etc/nginx/sites-enabled/default
    ```

### Update the app

> [!NOTE]
> The first commands in this section must be run from your local machine.

Here are the instructions to update the app:

1. First, you need to put all the assets in [threejs/assets](assets).
    To do so, if you have them locally and you followed the setup guide, you can run this by replacing `<NETID>` properly:

    ```bash
    scp -r threejs/assets/ <NETID>@inclusivemap:~/Inclusive-TU-Delft-Map/threejs/
    ```

2. Then, everything needs to be done from the server, so you have to connect to it:

    ```bash
    ssh inclusivemap
    ```

3. Pull the latest version on the branch you want:

    ```bash
    cd Inclusive-TU-Delft-Map 
    git checkout <branch>
    git pull
    ```

4. Update `npm` dependencies:

    ```bash
    cd threejs
    npm ci
    ```

5. Generate the build and update the static content of the app:

    ```bash
    npm run build
    rm -r /var/www/last_version/html/
    cp -r dist/* /var/www/last_version/html/
    cp -r assets/* /var/www/last_version/html/assets/
    ```

6. Restart the feedback server if necessary:

    - If not started yet:

        ```bash
        npx pm2 start backend/index.js --name feedback-server --env production
        ```

    - If already started but requires to be updated

        ```bash
        npx pm2 del feedback-server
        npx pm2 start backend/index.js --name feedback-server --env production
        ```

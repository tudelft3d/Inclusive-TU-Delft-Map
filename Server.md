# Server

## Update the map

1. Copy the assets to the server.
    This first step assumes that the local `threejs/assets/` contains the latest assets to use:

    ```bash
    scp -r threejs/assets/ abry@inclusive-map:~/Inclusive-TU-Delft-Map/threejs/
    ```

2. Connect to the server:

    ```bash
    ssh inclusive-map
    ```

3. Create the new website content:

    ```bash
    cd Inclusive-TU-Delft-Map/threejs
    npm run build
    ```

4. Remove the current website content:

    ```bash
    rm -r /var/www/last_version/html/*
    ```

5. Copy the new website content to the right position:

    ```bash
    cp -r dist/* /var/www/last_version/html/
    cp -r assets/* /var/www/last_version/html/assets/
    ```

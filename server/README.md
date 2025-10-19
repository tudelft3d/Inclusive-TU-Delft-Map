# Server

## Server connection

Connection to TU Delft servers requires to either be connected to TU Delft's eduroam or to have [eduVPN](https://tudelft.eduvpn.nl/portal/home) installed and activated.

These instructions are specific to this project.
The jump server used here is `student-linux.tudelft.nl` which is specific to TU Delft students.
For employees, it is `linux-bastion-ex.tudelf.nl`.

Finally, these instructions are Unix-specific.
To have more information about the Windows equivalent, please check [these instructions](https://dear-lipstick-92d.notion.site/SSH-access-to-the-TUD-server-270d786373d98091a096f1a58037a98b).

1. First, set a few variables that will be used later multiple times for simplicity. These variables will disappear once you close the terminal. Replace all the values with the actual values to use:

    ```bash
    export JUMPSERVER=student-linux.tudelft.nl  # or linux-bastion-ex.tudelf.nl for employees
    export NETID=<your-ned-id>                  # your TU Delft NETID
    ```

    In the next commands, we use variables so that you don't have to replace everything by hand.
    For example, every command containing `"$NETID"` will see this replaced by the value you set above.
    After you close the terminal, the variables will be deleted and you will not be able to use these exact commands anymore, unless you export the variables again as shown above.
    But this is expected, you will only need to remember the final command to be able to connect to the server once the whole setup is finished.

    If you are curious to see what the command actually looks like after replacing all the $ variables, you can use see it by replacing `<command>` by the actual command:

    ```bash
    echo <command>
    ```

2. Create an SSH key to connect to the server:

    ```bash
    ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_tudelftlinux_"$NETID" -C "Connect to the jump server of TU Delft"
    ssh-add ~/.ssh/id_ed25519_tudelftlinux_"$NETID"
    ```

3. Copy this key to the jump server. You will have to enter the NETID password:

    ```bash
    ssh-copy-id -i ~/.ssh/id_ed25519_tudelftlinux_"$NETID" "$NETID"@"$JUMPSERVER"
    ```

    You should now be able to connect to the jump server without any password prompt, using this:

    ```bash
    ssh -i /home/alexandre/.ssh/id_ed25519_tudelftlinux_"$NETID" "$NETID"@"$JUMPSERVER"
    ```

4. Copy the key stored in the jump server into your local machine:

    ```bash
    rsync "$NETID"@"$JUMPSERVER":.ssh/id_rsa."$NETID" ~/.ssh/id_rsa_inclusivemap_"$NETID"
    ssh-add ~/.ssh/id_rsa_inclusivemap_"$NETID"
    ```

5. Add a SSH config for quick connection to the server:

    ```bash
    echo \
    "Host tudelft-linux

        Hostname $JUMPSERVER
        
        User $NETID
        
        IdentityFile ~/.ssh/id_ed25519_tudelftlinux_$NETID

    Host inclusivemap

        Hostname inclusivecampusmap01.bk.tudelft.nl
        
        ProxyJump tudelft-linux
        
        User $NETID
        
        IdentityFile ~/.ssh/id_rsa_inclusivemap_"$NETID"
    " >> ~/.ssh/config
    ```

6. Test the connection:

    ```bash
    ssh inclusivemap
    ```

    This is the command you can use from now on to connect to the server quickly!

## Database

For everything related to the database, see [/database/README.md](/database/README.md).

## Web app

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

### Update the map

> [!NOTE]
> The first commands in this section must be run from your local machine.

1. Copy the assets to the server.
    If you have them locally and you followed the setup guide, you can run this by replacing `<NETID>` properly:

    ```bash
    scp -r threejs/assets/ <NETID>@inclusivemap:~/Inclusive-TU-Delft-Map/threejs/
    ```

2. Connect to the server:

    ```bash
    ssh inclusivemap
    cd Inclusive-TU-Delft-Map/threejs
    ```

3. Create the new website content from the branch you want to use (replace `<branch>`):

    ```bash
    git checkout <branch>
    git pull
    npm ci
    npm run build
    ```

4. Replace the current website content:

    ```bash
    rm -r /var/www/last_version/html/*
    cp -r dist/* /var/www/last_version/html/
    cp -r assets/* /var/www/last_version/html/assets/
    ```

5. Restart the feedback server if necessary:

    - If not started yet:

        ```bash
        sudo cp ../server/feedback-service.service /etc/systemd/system/feedback-server.service
        sudo systemctl enable feedback-server.service
        sudo systemctl start feedback-server.service
        ```

    - If already started but requires to be updated

        ```bash
        sudo systemctl restart feedback-server.service
        ```

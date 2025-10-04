# Database Setup

For the database, we use [3D City DB v5](https://docs.3dcitydb.org/1.1/), a database schema based on PostgreSQL and compatible with CityGML 3.0.
If this documentation is unclear, feel free to look into their website which has a very good documentation.
At the time of writing this (September 2025), many of the tools provided in the [previous version of 3D City DB](https://3dcitydb-docs.readthedocs.io/en/latest/) have not yet been ported to this one, so the instructions given here may not be the most straight-forward.

To fully set up the database, you need to:

1. [Set up connection to the server](#server-connection)
2. [Install PostgreSQL](#postgresql)
3. [Install 3D City DB and set up an instance](#3dcitydb)

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
    export HOSTCUSTOMNAME=inclusivemap          # how you will connect to the server after this
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
    rsync "$NETID"@"$JUMPSERVER":.ssh/id_rsa."$NETID" ~/.ssh/id_rsa_"$HOSTCUSTOMNAME"_"$NETID"
    ssh-add ~/.ssh/id_rsa_"$HOSTCUSTOMNAME"_"$NETID"
    ```

5. Add a SSH config for quick connection to the server:

    ```bash
    echo \
    "Host tudelft-linux

        Hostname $JUMPSERVER
        
        User $NETID
        
        IdentityFile ~/.ssh/id_ed25519_tudelftlinux_$NETID

    Host $HOSTCUSTOMNAME

        Hostname inclusivecampusmap01.bk.tudelft.nl
        
        ProxyJump tudelft-linux
        
        User $NETID
        
        IdentityFile ~/.ssh/id_rsa_"$HOSTCUSTOMNAME"_"$NETID"
    " >> ~/.ssh/config
    ```

6. Test the connection:

    ```bash
    ssh "$HOSTCUSTOMNAME"
    ```

    To see what the actual command looks like, you can run:

    ```bash
    echo ssh "$HOSTCUSTOMNAME"
    ```

    This is the command you can use from now on to connect to the server quickly!

## PostgreSQL

### Installation

> [!NOTE]
> All the commands in this section must be run from the server where the database must be installed.

To install PostgreSQL 16 on the server which uses Ubuntu 24.04, we used:

```bash
sudo apt-get install postgresql-16 postgresql-16-postgis-3
```

All the configuration files are stored at `/etc/postgresql/16/main`.

### Set up a user

> [!NOTE]
> All the commands in this section must be run from the server where the database is installed.

To set up a user from the server:

1. Create the user and set the password:

    ```bash
    sudo -u postgres createuser "$USER" -d -r --pwprompt
    ```

2. Create a database with your user name for simplicity:

    ```bash
    createdb "$USER"
    ```

3. Check that the database with the user name was created:

    ```bash
    psql -c "\l"
    ```

### DBeaver

> [!NOTE]
> All the commands in this section can be run from the any laptop that followed the [instructions to connect to the server](#server-connection).

To connect to the database with DBeaver:

1. Go to `Database/New Database Connection` in the top ribbon and select `PostgreSQL`.
2. Click on the green `+ SSH, SSL, ...` button and select `SSH`.
3. Set:
    - `Host/IP`: `inclusivecampusmap01.bk.tudelft.nl`
    - `User Name`: your NETID
    - `Authentication Method`: `Public Key`
    - `Private Key`: the actual path to the SSH key that you copied to `~/.ssh/id_rsa_"$HOSTCUSTOMNAME"_"$NETID"`
4. Open the `Jump servers` part below and click on the button with `+` (`Create new jump host`).
    Now set:
    - `Host/IP`: `student-linux.tudelft.nl` (students) or `linux-bastion-ex.tudelf.nl` (employees)
    - `User Name`: your NETID
    - `Authentication Method`: `Public Key`
    - `Private Key`: the actual path to the SSH key that you copied to `~/.ssh/id_ed25519_tudelftlinux_$NETID`
5. Click on `Test tunnel configuration`.
    If everything was set up correctly, you should see `Connected!`.
    Otherwise, make sure that everything you entered in the previous steps is correct (especially the paths to the SSH keys).
    If it still does not work, make sure that you followed properly the [instructions to connect to the server](#server-connection).
6. Go back to the tab called `Main` and set:
    - `Host`: `127.0.0.1` instead of `localhost`
    - `Port`: `5432`
    - `Username`: your username in the database (check [these instructions](#set-up-a-user) if you have not created a user yet)
    - `Password`: the password corresponding to the username
7. Click on `Test Connection ...`.
    If everything was set up correctly, you should see `Connected`.
    Otherwise, make sure that everything you entered in the previous steps is correct, and look at the error to see if you can identify the problem (e.g. user does not exist, password is wrong, etc).

## 3DCityDB

> [!NOTE]
> All the commands in this section must be run from the server where the database is installed.

### Prerequisites

To install 3D City DB, please follow the [official instructions](https://docs.3dcitydb.org/1.1/download/).

All the commands below use bash and therefore assume a UNIX system, but the equivalent scripts for Windows are also given by 3D City DB.
You just need to replace `unix/<name>.sh` with `windows/<name>.bat`.

Moreover, we use `psql` to run the commands, but they can also be run from a graphical client like pgAdmin.
There are also equivalents of the `.bash`/`.bat` commands as SQL commands that can be run in the same way.

### Creation

Here are the steps to initialise 3D City DB from scratch (assuming that you have PostgreSQL and `psql` installed).

1. Edit the database details in [`citydb-tool-1.1.0/3dcitydb/postgresql/shell-scripts/unix/connection-details.sh`](citydb-tool-1.1.0/3dcitydb/postgresql/shell-scripts/unix/connection-details.sh)
2. Make these variables accessible in your shell:

    ```bash
    source citydb-tool-1.1.0/3dcitydb/postgresql/shell-scripts/unix/connection-details.sh
    ```

3. Create the corresponding database:

    ```bash
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -c "CREATE DATABASE "$CITYDB";"
    ```

    If you get an error similar to this:

    ```text
    psql: error: connection to server at "<PGHOST>" (::1), port <PGPORT> failed: FATAL:  database "<PGUSER>" does not exist
    ```

    then it means that there is no database named like your username, and you can create one with:

    ```bash
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d <existing_database> -c "CREATE DATABASE $PGUSER OWNER $PGUSER;"
    ```

    by replacing <existing_database> with an existing database.
    Otherwise it will be necessary to specify the database to use for all the commands that do not happen on the 3DCityDB database, using the `-d` option of `psql`.

4. Add the necessary PostGIS extensions to handle geometry:

    ```bash
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$CITYDB" -c "CREATE EXTENSION postgis;"
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$CITYDB" -c "CREATE EXTENSION postgis_sfcgal;"
    ```

5. Initialise 3D City DB in the newly created database:

    ```bash
    bash citydb-tool-1.1.0/3dcitydb/postgresql/shell-scripts/unix/create-db.sh
    ```

    You will then be prompted to enter CRS information, with 4 successive prompts.
    In our case for the Netherlands you can use these values in this order:

    - 28992
    - 5109
    - Use default (just press enter)
    - Use default (just press enter)

### Deletion

Here are the steps to completely remove the database.

1. Make sure that the database details in [`citydb-tool-1.1.0/3dcitydb/postgresql/shell-scripts/unix/connection-details.sh`](citydb-tool-1.1.0/3dcitydb/postgresql/shell-scripts/unix/connection-details.sh) are correct.
2. Make these variables accessible in your shell:

    ```bash
    source citydb-tool-1.1.0/3dcitydb/postgresql/shell-scripts/unix/connection-details.sh
    ```

3. Drop 3D City DB:

    ```bash
    bash citydb-tool-1.1.0/3dcitydb/postgresql/shell-scripts/unix/drop-db.sh
    ```

4. Remove the database:

    ```bash
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -c "DROP DATABASE "$CITYDB";"
    ```

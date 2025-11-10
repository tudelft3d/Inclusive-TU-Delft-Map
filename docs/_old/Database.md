# Database Setup

> [!WARNING]
> The content of this file is outdated, as the project does not use a database anymore.
> It is kept only in case future developers decide to use a database, as this can provide useful tips and information.

For the database, we use [3D City DB v5](https://docs.3dcitydb.org/1.1/), a database schema based on PostgreSQL and compatible with CityGML 3.0.
If this documentation is unclear, feel free to look into their website which has a very good documentation.
At the time of writing this (September 2025), many of the tools provided in the [previous version of 3D City DB](https://3dcitydb-docs.readthedocs.io/en/latest/) have not yet been ported to this one, so the instructions given here may not be the most straight-forward.

To fully set up the database, you need to:

1. [Set up connection to the server](../server.md#server-connection)
2. [Install PostgreSQL](#postgresql)
3. [Install 3D City DB and set up an instance](#3dcitydb)

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
> All the commands in this section can be run from the any laptop that followed the [instructions to connect to the server](../server.md#server-connection).

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
    If it still does not work, make sure that you followed properly the [instructions to connect to the server](../server.md#server-connection).
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

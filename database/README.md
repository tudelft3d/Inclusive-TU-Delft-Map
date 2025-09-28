# Database Setup

For the database, we use [3D City DB v5](https://docs.3dcitydb.org/1.1/), a database schema based on PostgreSQL and compatible with CityGML 3.0.
If this documentation is unclear, feel free to look into their website which has a very good documentation.
At the time of writing this (September 2025), many of the tools provided in the [previous version of 3D City DB](https://3dcitydb-docs.readthedocs.io/en/latest/) have not yet been ported to this one, so the instructions given here may not be the most straight-forward.

To fully set up the database, you need to:

1. [Install PostgreSQL](#postgresql)
2. [Install 3D City DB and set up an instance](#3dcitydb)

<!-- ## CLI Setup

To be able to use the `docker` command without `sudo`, first run these two commands to add yourself to the docker group:

```bash
# Join the docker group
sudo usermod -aG docker $USER
# Reload the shell to apply changes
exec bash -l
``` -->

## PostgreSQL

TODO

<!-- ### First Version

To generate the databse, run:

```bash
docker compose -f docker-compose.dev.yml up -d
```

To stop and remove it, run:

```bash
docker compose -f docker-compose.dev.yml down
```

To open the necessary ports to access from outside:

```bash
sudo ufw allow 5437/tcp
sudo ufw reload
```

### Second Version

Create the database:

```bash
# Pull the latest official PostGIS image
docker pull postgis/postgis:latest

# Create a named Docker volume for data persistence
docker volume create pgdata

# Run the container
docker run -d \
  --name inclusive-campus-map \
  -p 5437:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=ILoveTypstHaha \
  -v pgdata:/var/lib/postgresql/data \
  postgis/postgis

# Create the database
docker exec -it inclusive-campus-map psql -h localhost -p 5432 -U postgres -c "CREATE DATABASE map;"
```

Setup the database to listen to outside:

```bash
# Add a line to pg_hba.conf to listen with password
docker exec -it postgis-db bash -c \
  "echo 'host    all             all             0.0.0.0/0               md5' >> /var/lib/postgresql/data/pg_hba.conf"

# Tell Postgres to reload the config
docker exec -u postgres -it postgis-db pg_ctl reload
```

Open the necessary ports to access from outside:

```bash
sudo ufw allow 5437/tcp
sudo ufw reload
``` -->

## 3DCityDB

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

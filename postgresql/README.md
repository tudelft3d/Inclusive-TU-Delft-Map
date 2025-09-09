# Postgres Database

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

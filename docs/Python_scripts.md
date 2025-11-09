# Python Code

## Prerequisites

The recommended way to install and run the code is using [`uv`](https://docs.astral.sh/uv/). Instructions to install it are given on [their website](https://docs.astral.sh/uv/getting-started/installation/).

## Installation

To run the Python scripts, follow these steps:

1. Go to the `src` folder:

    ```bash
    cd src
    ```

2. Create a virtual environment:

    ```bash
    uv venv
    ```

3. Install the dependencies

    ```bash
    uv sync
    ```

To check if the installation is correct, you can run:

```bash
uv run python cli.py --help
```

This should show you the available commands. See the next part to learn more about running commands.

## Run Commands

To run a Python file with `uv`, the easiest is to use:

```bash
uv run python <python_file>
```

Here is what happens. `uv run` allows you to run commands in the context of the environment you have installed with `uv` in your current directory. Anything that comes after it is the actual command. So here you just run `python <python_file>`, which is the standard way to run a Python program.

This program then comes with a CLI interface that allows to run the important steps quickly. To see which commands are available, run:

```bash
uv run python cli.py --help
```

Every command also has its own help, so you can run:

```bash
uv run python cli.py <command> --help
```

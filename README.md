# catfishing-cli

Play [catfishing](https://catfishing.net), the daily Wikipedia category-guessing game, in your terminal.

This is an unofficial fan project. It is not affiliated with catfishing.net.

## Install

```sh
npm install -g .
```

Or link the working copy while you develop:

```sh
npm link
```

Both need Node 18 or newer. The package has no dependencies.

## Play

```sh
catfishing
```

## Commands

| Command | What it does |
| --- | --- |
| `catfishing` | Play today's game |
| `catfishing play 865` | Play a specific day |
| `catfishing play --date 2026-11-04` | Play the day for a date |
| `catfishing archive` | Recent days and their status |
| `catfishing stats` | Lifetime average, streaks, and score spread |
| `catfishing result 865` | Review a saved game |
| `catfishing share` | Print the share line |
| `catfishing help` | Full help |

`today` is an alias for `play`, and `results` is an alias for `result`.

## Options

| Option | Meaning |
| --- | --- |
| `--day N` | Play day N |
| `--date YYYY-MM-DD` | Play the day for a date |
| `--replay` | Start a saved game again |
| `--force` | Overwrite without asking |
| `--flat` | Show categories without grouping |
| `--no-color` | Plain text output |
| `--json` | JSON output for result, archive, stats, and share |
| `--limit N` | Days to show in the archive |
| `--all` | Show the whole archive |

`--replay` asks before replacing a saved game in an interactive terminal. Use `--force` to skip that question, or to replay in a script.

## Saved results

Results live in a single JSON file:

```text
~/.config/catfishing-cli/results.json
```

On Windows it is `%APPDATA%\catfishing-cli\results.json`. Set `CATFISHING_HOME` to use another directory. The file is written atomically and restricted to the current user where the platform supports it. Answers are saved after every question, so quitting or losing the terminal does not lose progress.

Resume an unfinished day by running it again:

```sh
catfishing play 865
```

## Development

```sh
npm test
node bin/catfishing.js play 865
```

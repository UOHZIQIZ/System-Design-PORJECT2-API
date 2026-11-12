# Project Record (PR)
DESN31927 · Project 2: Persistent Data

A small web app for students who want to keep projects, deadlines and progress in one place. Create, read, update and delete records through the web interface or call the same API in Bruno. Records persist in SQLite after refreshes and server restarts.

## Run locally

1. Install Node.js 24 or later and open this folder in VS Code.
2. In the terminal run `npm start`. No third-party packages are required.
3. Open http://127.0.0.1:3000. Start the Node server instead of double-clicking the HTML file: the server provides both the page and its API.
4. Add an project, refresh, change its status, stop and restart the server, then delete it. Verify the saved value at each step.

`frontend/index.html`, `frontend/styles.css` and `frontend/app.js` are the front end. `backend/server.js` serves the website and routes API requests. `backend/projects.js` validates data and runs database queries. `backend/schema.sql` defines the table.

| Method | Path | Purpose |
|---|---|---|
| GET | /api/projects | List projects |
| POST | /api/projects | Create an project |
| GET | /api/projects/:id | Retrieve one project |
| PUT | /api/projects/:id | Replace its editable fields |
| DELETE | /api/projects/:id | Permanently delete it |

For POST and PUT, use `Content-Type: application/json` and send:
```json
{"title":"Architecture diagram","course":"System Design","dueDate":"2026-11-20","status":"in-progress","notes":"Show the API and database."}
```
Use the returned `id` in item requests. No login header is required in this classroom demo.

## Database and deployment

This version uses SQLite (SQL), not MongoDB. Local data is saved in `.data/projects.sqlite`. To deploy, use a Node.js host with a persistent writable disk, set `HOST=0.0.0.0` and `DATA_DIR` to the mounted directory, and run `npm start`. The server reads `PORT` from the environment. Use one instance with the attached disk. Static-only hosting does not run the API. This prototype has one shared project list and no accounts; use sample data for any public demonstration.

See [system design draft](docs/system-design.md) for the architecture, user goals and data model. Finish the research, screenshots, reflection and presentation using your own project evidence. Upload the extracted project files to GitHub; share both the repository and the deployed app link for submission.

## Development provenance

The Node HTTP and SQLite approach was adapted from the earlier standalone API prototype. This project uses a dedicated project table, new endpoints and a new browser interface. The draft implementation and documentation were AI-assisted; record the decisions, changes and tests you personally perform in your process submission.

# Project Record (PR)
DESN31927 · Project 2: Persistent Data

A small web app for students who want to keep projects, deadlines and progress in one place. Create, read, update and delete records through the web interface or call the same API in Bruno. Records persist in MongoDB after refreshes and server restarts.

## Run locally

1. Install Node.js 24 or later and open this folder in VS Code.
2. Run `npm ci` to install the MongoDB Node.js driver.
3. Run `npm run setup:mongodb`. Enter your database name and paste the same complete connection string that works in Compass. The prompt hides the connection string. The script verifies the connection before saving it to the local `.env` file. Do not commit that file.
   - To configure manually, copy `.env.example` to `.env` and set `MONGODB_URI` and `MONGODB_DB` there.
4. Run `npm start`. The server checks the MongoDB connection before opening its HTTP port.
5. Open http://127.0.0.1:3000. Start the Node server instead of double-clicking the HTML file: the server provides both the page and its API.
6. Add a project, refresh, change its status, stop and restart the server, then delete it. Verify the saved value at each step.

`frontend/index.html`, `frontend/styles.css` and `frontend/app.js` are the front end. `backend/server.js` serves the website and routes API requests. `backend/projects.js` validates and stores project records. `backend/database.js` connects to MongoDB.

| Method | Path | Purpose |
|---|---|---|
| GET | /api/projects | List projects |
| POST | /api/projects | Create a project |
| GET | /api/projects/:id | Retrieve one project |
| PUT | /api/projects/:id | Replace its editable fields |
| DELETE | /api/projects/:id | Permanently delete it |

For POST and PUT, use `Content-Type: application/json` and send:
```json
{"title":"Architecture diagram","course":"System Design","dueDate":"2026-11-20","status":"in-progress","tagColor":"blue","notes":"Show the API and database."}
```
Optional `tagColor` values are `red`, `orange`, `yellow`, `green`, `blue` and `purple`. Use an empty string to remove a tag. Omitting the field on update preserves the existing tag. Older records are shown as untagged. The dashboard can filter by tag and status together.

Use the returned `id` in item requests. No login header is required in this classroom demo.

## Database and deployment

MongoDB is the only data store. The default database is `project_record` and the collection is `projects`. The database and collection appear after the first successful write. A project uses a server-generated UUID stored as MongoDB `_id` and returned as `id` in the API. Previous prototype data is not imported automatically.

For deployment, configure `MONGODB_URI` and optionally `MONGODB_DB` as server environment variables. Use a Node.js host that can connect to MongoDB, set `HOST=0.0.0.0`, and run `npm ci` followed by `npm start`. The server reads the host's `PORT` variable. This prototype has one shared project list and no accounts; use sample data for public demonstrations.

See [system design draft](docs/system-design.md) for the architecture, user goals and data model. Finish the research, screenshots, reflection and presentation using your own project evidence. Upload the extracted project files to GitHub; share both the repository and the deployed app link for submission.

## Development provenance

The Node HTTP structure was adapted from an earlier prototype. Project Record uses a dedicated MongoDB collection, project endpoints and a browser interface. The implementation and documentation were AI-assisted; record the decisions, changes and tests you personally perform in your process submission.

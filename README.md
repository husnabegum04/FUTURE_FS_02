# Mini CRM

A simple lead management dashboard with a login screen, lead creation form, lead details, notes, and a recycle-bin style trash flow.

## Features
- Admin login
- Add, edit, and view leads
- Update lead status
- Add follow-up notes
- Move leads to trash
- Restore deleted leads
- Permanently delete leads from trash

## Tech Stack
- Node.js
- Express
- Session-based authentication
- JSON file storage for leads

## Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm start
   ```
3. Open your browser at:
   ```text
   http://localhost:3000
   ```

## Default Login
- Username: admin
- Password: admin123

## Project Structure
- server.js - Express server and API routes
- public/ - Frontend HTML, CSS, and JavaScript
- data/leads.json - Stored lead data

## Notes
The app stores data in a local JSON file, so changes persist between restarts.

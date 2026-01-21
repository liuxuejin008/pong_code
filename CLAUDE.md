# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

##请使用中文输出文案，因为是中国人使用

## Project Overview

This is **Mini-Agile**, a lightweight Agile project management tool with a Flask backend and vanilla JavaScript SPA frontend. It provides organizations, projects, sprints, and Kanban board functionality.

### Tech Stack
- **Backend**: Flask 3.0 + Flask-SQLAlchemy + Flask-Login
- **Database**: SQLite (development)
- **Frontend**: Vanilla JavaScript SPA with Tailwind CSS (via CDN) + Font Awesome + Chart.js
- **Drag & Drop**: Sortable.js library for Kanban board

---

## Development Commands

### Running the Application
```bash
# Activate virtual environment (if not already active)
source .venv/bin/activate  # macOS/Linux
# or
.venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Run development server (debug mode, port 5000)
python app.py
```

The app will be available at `http://localhost:5000`

### Database Operations
- Database file: `instance/mini_agile.db` (auto-created on first run)
- Database schema is initialized automatically in `create_app()` using `db.create_all()`
- To reset the database: Delete the `instance/mini_agile.db` file and restart the app

---

## Architecture

### Backend Structure (Flask)

**Entry Point**: [app.py](app.py)
- `create_app()`: Factory function that configures Flask, initializes extensions, and creates database tables
- All routes are REST API endpoints prefixed with `/api/`
- Authentication handled by Flask-Login with session-based auth
- Frontend served as static files from `/` route pointing to `static/index.html`

**Data Models** ([models.py](models.py)):
- `User`: Authentication and user relationships
- `Organization`: Owner-based organization with many-to-many member relationship
- `Project`: Belongs to organization, has many sprints and issues
- `Sprint`: Time-boxed iterations with status (open/active/closed)
- `Issue`: Tasks with status (todo/doing/done), priority (1-5), and optional assignee
- `organization_members`: Association table for many-to-many User ↔ Organization with role field

**Extensions** ([extensions.py](extensions.py)):
- `db`: SQLAlchemy instance (configured in app.py)
- `login_manager`: Flask-Login instance (configured in app.py)

### Frontend Structure (Vanilla JavaScript SPA)

**Single Page Application**: [static/js/app.js](static/js/app.js)
- No build process or framework - pure JavaScript with a simple router
- `app` object contains all application logic
- API calls through `app.api()` helper with automatic 401 handling
- Navigation handled by `app.navigate(view, data)` which rewrites the `#app-container` DOM

**Key Frontend Concepts**:
- **State Management**: `app.user`, `app.currentOrg`, `app.currentProject`, `app.currentView`
- **Router**: Switch statement in `app.navigate()` handles view routing
- **Views**: `app.views.{login, register, dashboard, orgDetails, projectSprints, board}`
- **Handlers**: Form submission handlers in `app.handlers`
- **Modals**: Reusable modal system in `app.modals` with HTML templates
- **Sidebar**: Dynamically rendered based on current view (dashboard vs project context)

**API Communication**:
- All API calls go through `app.api(endpoint, method, data)`
- Returns JSON response or `null` on error
- Automatic redirect to login on 401 (except for auth endpoints)

---

## Important Patterns

### Database Relationships
- `User.organizations`: Many-to-many via `organization_members` (default lazy='select')
- `User.owned_organizations`: One-to-many with `lazy='dynamic'` (returns query object)
- `Organization.members`: Inverse relationship, also `lazy='dynamic'`
- **Note**: Mixed lazy loading strategies require careful handling when checking membership

### Authentication Flow
1. Frontend calls `app.api('/auth/status')` on init
2. If authenticated, stores user in `app.user` and renders dashboard
3. All API-protected routes use `@login_required` decorator
4. Unauthorized handler returns JSON 401 response (not HTML redirect)

### Kanban Board Drag-and-Drop
- Uses Sortable.js library (loaded via CDN in index.html)
- Three columns: `#todo`, `#doing`, `#done`
- On drop, calls `app.api('/issues/{id}/move', 'POST', {status})`
- Server updates issue status in database

### Date Handling
- Sprint dates stored as Python `date` objects in database
- Frontend sends dates as YYYY-MM-DD strings
- Backend parses with `datetime.strptime(date_str, '%Y-%m-%d').date()`
- Frontend displays dates using `.isoformat()` from backend responses

### Model Serialization
- All models have `to_dict()` methods for JSON serialization
- `to_dict()` includes related object data (e.g., `assignee_name`) to avoid N+1 queries
- Progress calculation in `Sprint.to_dict()` computes percentage based on done/total issues

---

## Adding New Features

### Adding a New API Endpoint
1. Define route in [app.py](app.py) with `@app.route('/api/...', methods=['...'])`
2. Add `@login_required` if authentication required
3. Use `request.get_json()` for POST/PUT data
4. Return `jsonify({...})` with appropriate status code
5. Update frontend to call via `app.api('/...')`

### Adding a New View
1. Add view function to `app.views` in [static/js/app.js](static/js/app.js)
2. Add case to router in `app.navigate()`
3. Update sidebar rendering if navigation context changes
4. Add modal form in `app.modals` if needed for data entry
5. Add handler in `app.handlers` for form submission

### Adding a New Model Field
1. Update model class in [models.py](models.py)
2. Update `to_dict()` method if field should be serialized
3. Delete `instance/mini_agile.db` to recreate database with new schema
4. Update frontend forms and display logic as needed

---

## Configuration Notes

- **SECRET_KEY**: Currently set to `'dev-key-change-this'` in [app.py:10](app.py#L10) - change for production
- **Database**: SQLite at `sqlite:///mini_agile.db` (relative path, stored in `instance/` folder)
- **Static Files**: Served from `static/` folder at root URL path `''`
- **Debug Mode**: Enabled by default in [app.py:265](app.py#L265) (`app.run(debug=True, port=5000)`)

---

## Testing

No test suite is currently configured. When adding tests:
- Consider pytest for backend tests
- Use Flask's test client for API endpoint testing
- Frontend tests would require a headless browser setup (e.g., Playwright/Selenium)

##设计建议
适用场景：强调“敏捷”、“快速”，目标用户更偏向互联网极客、年轻团队。
主体色 (Primary Brand)：
建议使用蓝紫色/靛蓝色。这种颜色比纯蓝更有活力，且在白色背景上更醒目。
色值参考：#5E6AD2 (靛蓝) 或 #6366F1 (Indigo)。
风格关键词：轻盈、通透、无框感。
具体样式建议：
圆角 (Radius)：较大圆角（6px - 8px）。视觉上更柔和、友好。
阴影代替边框：列表可以用轻微的悬浮阴影（Box-shadow）代替生硬的边框线，增加“呼吸感”。
字体：选择字重略大的无衬线字体（如 Inter 或 Roboto），增加现代感。
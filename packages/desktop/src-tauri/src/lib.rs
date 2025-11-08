use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: r#"
                -- Lists table
                CREATE TABLE IF NOT EXISTS lists (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    icon TEXT,
                    color TEXT,
                    "order" INTEGER,
                    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
                    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
                );

                -- Tasks table
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0,
                    completed_at INTEGER,
                    complete_percentage INTEGER,
                    due_date INTEGER,
                    list_id TEXT,
                    list_name TEXT NOT NULL,
                    content TEXT,
                    "order" INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    tags TEXT, -- JSON array
                    priority INTEGER,
                    group_category TEXT NOT NULL DEFAULT 'nodate',
                    FOREIGN KEY (list_id) REFERENCES lists (id) ON DELETE SET NULL
                );

                -- Subtasks table
                CREATE TABLE IF NOT EXISTS subtasks (
                    id TEXT PRIMARY KEY,
                    parent_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0,
                    completed_at INTEGER,
                    due_date INTEGER,
                    "order" INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY (parent_id) REFERENCES tasks (id) ON DELETE CASCADE
                );

                -- Summaries table
                CREATE TABLE IF NOT EXISTS summaries (
                    id TEXT PRIMARY KEY,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    period_key TEXT NOT NULL,
                    list_key TEXT NOT NULL,
                    task_ids TEXT NOT NULL, -- JSON array
                    summary_text TEXT NOT NULL
                );

                -- Settings table
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
                );

                -- Insert default data
                INSERT OR IGNORE INTO lists (id, name, icon, "order")
                VALUES ('inbox-default', 'Inbox', 'inbox', 1);

                INSERT OR IGNORE INTO settings (key, value) VALUES
                ('appearance', '{"themeId":"default-coral","darkMode":"system","interfaceDensity":"default"}'),
                ('preferences', '{"language":"zh-CN","defaultNewTaskDueDate":null,"defaultNewTaskPriority":null,"defaultNewTaskList":"Inbox","confirmDeletions":true}'),
                ('ai', '{"provider":"openai","apiKey":"","model":"","baseUrl":"","availableModels":[]}');

                -- Create indexes
                CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);
                CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
                CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
                CREATE INDEX IF NOT EXISTS idx_subtasks_parent_id ON subtasks(parent_id);
                CREATE INDEX IF NOT EXISTS idx_summaries_period_list ON summaries(period_key, list_key);
            "#,
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:tada.db", migrations)
                .build(),
        )
        // .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
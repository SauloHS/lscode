use base64::Engine as _;
use portable_pty::{ChildKiller, CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

const IGNORED_DIRS: [&str; 6] = [".git", "node_modules", "target", "dist", ".next", "__pycache__"];
const MAX_SEARCH_MATCHES: usize = 2000;
const MAX_SEARCH_FILE_SIZE: u64 = 1_000_000;
const MAX_WALK_RESULTS: usize = 50_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FsEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchMatch {
    path: String,
    line: usize,
    col: usize,
    text: String,
    length: usize,
}

#[tauri::command]
fn list_dir(path: &str) -> Result<Vec<FsEntry>, String> {
    let mut entries: Vec<FsEntry> = fs::read_dir(path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name().to_string_lossy() != ".git")
        .map(|e| FsEntry {
            name: e.file_name().to_string_lossy().into_owned(),
            path: e.path().to_string_lossy().into_owned(),
            is_dir: e.file_type().map(|t| t.is_dir()).unwrap_or(false),
        })
        .collect();
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[tauri::command]
fn read_file(path: &str) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    if bytes[..bytes.len().min(8000)].contains(&0) {
        return Err("binary file".into());
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
fn write_file(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_file(path: &str) -> Result<(), String> {
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, "").map_err(|e| e.to_string())
}

#[tauri::command]
fn create_dir(path: &str) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_path(old_path: &str, new_path: &str) -> Result<(), String> {
    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_path(path: &str) -> Result<(), String> {
    let meta = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}

fn walk(root: &Path, out: &mut Vec<String>) {
    if out.len() >= MAX_WALK_RESULTS {
        return;
    }
    let Ok(entries) = fs::read_dir(root) else { return };
    for entry in entries.flatten() {
        if out.len() >= MAX_WALK_RESULTS {
            break;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        let Ok(ft) = entry.file_type() else { continue };
        if ft.is_dir() {
            if !IGNORED_DIRS.contains(&name.as_str()) {
                walk(&entry.path(), out);
            }
        } else {
            out.push(entry.path().to_string_lossy().into_owned());
        }
    }
}

#[tauri::command]
fn walk_files(root: &str) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    walk(Path::new(root), &mut files);
    Ok(files)
}

fn line_matches(line: &str, needle: &str, case_sensitive: bool) -> Vec<(usize, usize)> {
    let mut hits = Vec::new();
    if needle.is_empty() {
        return hits;
    }
    let (hay, q) = if case_sensitive {
        (line.to_string(), needle.to_string())
    } else {
        (line.to_lowercase(), needle.to_lowercase())
    };
    let mut from = 0;
    while let Some(i) = hay[from..].find(&q) {
        let byte = from + i;
        let col = line[..byte].chars().count() + 1;
        hits.push((col, q.chars().count()));
        from = byte + q.len().max(1);
    }
    hits
}

#[tauri::command]
fn search_files(
    root: &str,
    query: &str,
    case_sensitive: bool,
) -> Result<Vec<SearchMatch>, String> {
    let mut files = Vec::new();
    walk(Path::new(root), &mut files);
    let mut matches = Vec::new();
    for path in files {
        if matches.len() >= MAX_SEARCH_MATCHES {
            break;
        }
        let Ok(meta) = fs::metadata(&path) else { continue };
        if meta.len() > MAX_SEARCH_FILE_SIZE {
            continue;
        }
        let Ok(content) = fs::read_to_string(&path) else { continue };
        for (i, line) in content.lines().enumerate() {
            for (col, length) in line_matches(line, query, case_sensitive) {
                matches.push(SearchMatch {
                    path: path.clone(),
                    line: i + 1,
                    col,
                    text: line.trim().chars().take(300).collect(),
                    length,
                });
                if matches.len() >= MAX_SEARCH_MATCHES {
                    break;
                }
            }
        }
    }
    Ok(matches)
}

struct PtySession {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

#[derive(Default)]
struct PtyState {
    next_id: AtomicU32,
    sessions: Mutex<HashMap<u32, PtySession>>,
}

#[derive(Serialize, Clone)]
struct PtyOutput {
    id: u32,
    data: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PtyExit {
    id: u32,
    code: u32,
}

fn default_shell() -> String {
    if cfg!(windows) {
        "powershell.exe".into()
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "sh".into())
    }
}

#[tauri::command]
fn create_pty(
    app: AppHandle,
    state: State<PtyState>,
    rows: u16,
    cols: u16,
    cwd: Option<String>,
) -> Result<u32, String> {
    let pty = NativePtySystem::default();
    let pair = pty
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(default_shell());
    if let Some(dir) = &cwd {
        cmd.cwd(dir);
    }

    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let killer = child.clone_killer();

    let id = state.next_id.fetch_add(1, Ordering::SeqCst);

    let app_reader = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                    let _ = app_reader.emit("pty-output", PtyOutput { id, data });
                }
                Err(_) => break,
            }
        }
    });

    let app_wait = app.clone();
    std::thread::spawn(move || match child.wait() {
        Ok(status) => {
            let _ = app_wait.emit(
                "pty-exit",
                PtyExit {
                    id,
                    code: status.exit_code(),
                },
            );
        }
        Err(_) => {
            let _ = app_wait.emit(
                "pty-exit",
                PtyExit {
                    id,
                    code: u32::MAX,
                },
            );
        }
    });

    state
        .sessions
        .lock()
        .unwrap()
        .insert(id, PtySession { master: pair.master, writer, killer });
    Ok(id)
}

#[tauri::command]
fn pty_write(state: State<PtyState>, id: u32, data: &str) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions.get_mut(&id).ok_or("pty session not found")?;
    session
        .writer
        .write_all(data.as_bytes())
        .and_then(|_| session.writer.flush())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn pty_resize(state: State<PtyState>, id: u32, rows: u16, cols: u16) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions.get(&id).ok_or("pty session not found")?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn pty_kill(state: State<PtyState>, id: u32) -> Result<(), String> {
    if let Some(mut session) = state.sessions.lock().unwrap().remove(&id) {
        let _ = session.killer.kill();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PtyState::default())
        .invoke_handler(tauri::generate_handler![
            list_dir,
            read_file,
            write_file,
            create_file,
            create_dir,
            rename_path,
            delete_path,
            walk_files,
            search_files,
            create_pty,
            pty_write,
            pty_resize,
            pty_kill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

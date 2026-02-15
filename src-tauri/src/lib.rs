use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[cfg(target_os = "android")]
use jni::objects::{JObject, JString};
#[cfg(target_os = "android")]
use jni::JNIEnv;
#[cfg(target_os = "android")]
use ndk_context::android_context;

/// Базовая папка для файлов приложения. Относительные пути хранятся от неё.
fn files_base_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  #[cfg(target_os = "android")]
  {
    app
      .path()
      .picture_dir()
      .map_err(|e: tauri::Error| e.to_string())
  }
  #[cfg(not(target_os = "android"))]
  {
    app
      .path()
      .app_data_dir()
      .map_err(|e: tauri::Error| e.to_string())
      .map(|p| p.join("files"))
  }
}

#[cfg(target_os = "android")]
fn absolute_path_from_relative(app: &tauri::AppHandle, path: &str) -> Result<PathBuf, String> {
  let base = files_base_dir(app)?;
  let p = PathBuf::from(path);
  Ok(if p.is_absolute() { p } else { base.join(path) })
}

#[cfg(target_os = "android")]
fn set_wallpaper_android(app: &tauri::AppHandle, path: String) -> Result<(), String> {
  let ctx = android_context();
  let vm = unsafe {
    jni::JavaVM::from_raw(ctx.vm() as *mut _).map_err(|e| format!("JavaVM error: {}", e))?
  };
  let mut env = vm
    .attach_current_thread()
    .map_err(|e| format!("JNI attach thread: {}", e))?;
  let context = unsafe { JObject::from_raw(ctx.context() as *mut _) };

  let full = absolute_path_from_relative(app, &path)?;
  let full_str = full
    .to_str()
    .ok_or_else(|| "Invalid path".to_string())?
    .to_string();

  let path_j: JString = env
    .new_string(full_str)
    .map_err(|e| format!("JNI new_string: {}", e))?;

  // Bitmap bitmap = BitmapFactory.decodeFile(path)
  let bitmap_factory = env
    .find_class("android/graphics/BitmapFactory")
    .map_err(|e| format!("Find BitmapFactory: {}", e))?;
  let bitmap = env
    .call_static_method(
      bitmap_factory,
      "decodeFile",
      "(Ljava/lang/String;)Landroid/graphics/Bitmap;",
      &[jni::objects::JValue::Object(&path_j)],
    )
    .map_err(|e| format!("BitmapFactory.decodeFile: {}", e))?
    .l()
    .map_err(|e| format!("Get bitmap object: {}", e))?;

  // WallpaperManager wm = WallpaperManager.getInstance(context)
  let wm_class = env
    .find_class("android/app/WallpaperManager")
    .map_err(|e| format!("Find WallpaperManager: {}", e))?;
  let wm_obj = env
    .call_static_method(
      wm_class,
      "getInstance",
      "(Landroid/content/Context;)Landroid/app/WallpaperManager;",
      &[jni::objects::JValue::Object(&context)],
    )
    .map_err(|e| format!("WallpaperManager.getInstance: {}", e))?
    .l()
    .map_err(|e| format!("Get WallpaperManager object: {}", e))?;

  // wm.setBitmap(bitmap)
  env
    .call_method(
      wm_obj,
      "setBitmap",
      "(Landroid/graphics/Bitmap;)V",
      &[jni::objects::JValue::Object(&bitmap)],
    )
    .map_err(|e| format!("WallpaperManager.setBitmap: {}", e))?;

  Ok(())
}

#[tauri::command]
fn set_device_wallpaper(app: tauri::AppHandle, path: String) -> Result<(), String> {
  #[cfg(target_os = "android")]
  {
    return set_wallpaper_android(&app, path);
  }
  #[cfg(not(target_os = "android"))]
  {
    Err("Only supported on Android".to_string())
  }
}

/// Папка конкретной коллекции: base/collections/{collection_id}
fn collection_dir(app: &tauri::AppHandle, collection_id: &str) -> Result<PathBuf, String> {
  Ok(files_base_dir(app)?.join("collections").join(collection_id))
}

/// Единая структура: на ПК app_data/files/{save_type}, на Android — picture_dir/{save_type}. Оставлено для обратной совместимости.
fn files_dir_for_type(app: &tauri::AppHandle, save_type: &str) -> Result<PathBuf, String> {
  #[cfg(target_os = "android")]
  {
    let base = app
      .path()
      .picture_dir()
      .map_err(|e: tauri::Error| e.to_string())?;
    Ok(base.join(save_type))
  }
  #[cfg(not(target_os = "android"))]
  {
    let base = app
      .path()
      .app_data_dir()
      .map_err(|e: tauri::Error| e.to_string())?;
    Ok(base.join("files").join(save_type))
  }
}

#[tauri::command]
fn get_files_base_path(app: tauri::AppHandle) -> Result<String, String> {
  let base = files_base_dir(&app)?;
  base
    .to_str()
    .map(String::from)
    .ok_or_else(|| "Invalid base path".to_string())
}

#[tauri::command]
fn get_file_name_from_path(app: tauri::AppHandle, path: String) -> Option<String> {
  app.path().file_name(&path)
}

#[tauri::command]
fn save_file_to_app(
  app: tauri::AppHandle,
  save_type: String,
  source_path: Option<String>,
  contents: Option<Vec<u8>>,
  file_name: Option<String>,
) -> Result<String, String> {
  let dir = files_dir_for_type(&app, &save_type)?;
  if cfg!(debug_assertions) {
    log::info!("save_file_to_app: dir = {:?}", dir);
  }
  fs::create_dir_all(&dir).map_err(|e| {
    let msg = format!("create_dir_all {:?}: {}", dir, e);
    log::error!("{}", msg);
    msg
  })?;

  if let Some(ref path) = source_path {
    let name = Path::new(path)
      .file_name()
      .and_then(|n| n.to_str())
      .ok_or_else(|| "Invalid file name".to_string())?;
    let dest = dir.join(name);
    fs::copy(path, &dest).map_err(|e| {
      let msg = format!("copy {} -> {:?}: {}", path, dest, e);
      log::error!("{}", msg);
      msg
    })?;
    return dest
      .to_str()
      .map(String::from)
      .ok_or_else(|| "Invalid path".to_string());
  }

  if let (Some(data), Some(name)) = (contents, file_name) {
    let dest = dir.join(&name);
    fs::write(&dest, &data).map_err(|e| {
      let msg = format!("write {:?} ({} bytes): {}", dest, data.len(), e);
      log::error!("{}", msg);
      msg
    })?;
    return dest
      .to_str()
      .map(String::from)
      .ok_or_else(|| "Invalid path".to_string());
  }

  Err("Need either sourcePath or (contents + file_name)".to_string())
}

/// Сохранить файл в папку коллекции. Возвращает относительный путь: collections/{collection_id}/{file_name}
#[tauri::command]
fn save_file_to_collection(
  app: tauri::AppHandle,
  collection_id: String,
  file_name: String,
  source_path: Option<String>,
  contents: Option<Vec<u8>>,
) -> Result<String, String> {
  let dir = collection_dir(&app, &collection_id)?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

  let name = Path::new(&file_name)
    .file_name()
    .and_then(|n| n.to_str())
    .ok_or_else(|| "Invalid file name".to_string())?
    .to_string();

  if let Some(ref path) = source_path {
    let dest = dir.join(&name);
    fs::copy(path, &dest).map_err(|e| e.to_string())?;
    let relative = format!("collections/{}/{}", collection_id, name);
    return Ok(relative);
  }

  if let Some(data) = contents {
    let dest = dir.join(&name);
    fs::write(&dest, &data).map_err(|e| e.to_string())?;
    let relative = format!("collections/{}/{}", collection_id, name);
    return Ok(relative);
  }

  Err("Need either source_path or contents".to_string())
}

/// Read file content. path — относительный (collections/...) или полный (для совместимости).
#[tauri::command]
fn read_file_from_app(app: tauri::AppHandle, path: String) -> Result<Vec<u8>, String> {
  let base = files_base_dir(&app)?;
  let base_str = base.to_string_lossy().to_string();
  let path_buf = PathBuf::from(&path);
  let full = if path_buf.is_absolute() {
    path_buf
  } else {
    base.join(path)
  };
  let full_str = full.to_string_lossy().to_string();
  if !full_str.starts_with(&base_str) {
    return Err("Path not allowed".to_string());
  }
  fs::read(&full).map_err(|e| e.to_string())
}

/// Удалить файл по относительному или полному пути в пределах base.
#[tauri::command]
fn delete_app_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
  let base = files_base_dir(&app)?;
  let base_str = base.to_string_lossy().to_string();
  let path_buf = PathBuf::from(&path);
  let full = if path_buf.is_absolute() {
    path_buf
  } else {
    base.join(path)
  };
  let full_str = full.to_string_lossy().to_string();
  if !full_str.starts_with(&base_str) {
    return Err("Path not allowed".to_string());
  }
  if full.exists() {
    fs::remove_file(&full).map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_os::init())
    .invoke_handler(tauri::generate_handler![
    get_files_base_path,
    save_file_to_app,
    save_file_to_collection,
    get_file_name_from_path,
    read_file_from_app,
    delete_app_file,
    set_device_wallpaper,
  ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

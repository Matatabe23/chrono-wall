use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[cfg(target_os = "android")]
use jni::objects::{JObject, JString};
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

#[cfg(target_os = "android")]
fn set_wallpaper_android_with_target(
  app: &tauri::AppHandle,
  path: String,
  target: String,
) -> Result<(), String> {
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

  // int SDK_INT = android.os.Build.VERSION.SDK_INT
  let ver_class = env
    .find_class("android/os/Build$VERSION")
    .map_err(|e| format!("Find Build.VERSION: {}", e))?;
  let sdk_int = env
    .get_static_field(ver_class, "SDK_INT", "I")
    .map_err(|e| format!("Get SDK_INT: {}", e))?
    .i()
    .map_err(|e| format!("Read SDK_INT: {}", e))?;

  // Flags (API >= 24)
  let wm_class_for_flags = env
    .find_class("android/app/WallpaperManager")
    .map_err(|e| format!("Find WallpaperManager for flags: {}", e))?;
  let flag_system = env
    .get_static_field(&wm_class_for_flags, "FLAG_SYSTEM", "I")
    .ok()
    .and_then(|v| v.i().ok())
    .unwrap_or(1);
  let flag_lock = env
    .get_static_field(&wm_class_for_flags, "FLAG_LOCK", "I")
    .ok()
    .and_then(|v| v.i().ok())
    .unwrap_or(2);

  let which = target.to_lowercase();
  if which == "home" {
    if sdk_int >= 24 {
      let rect_null = JObject::null();
      env
        .call_method(
          &wm_obj,
          "setBitmap",
          "(Landroid/graphics/Bitmap;Landroid/graphics/Rect;ZI)I",
          &[
            jni::objects::JValue::Object(&bitmap),
            jni::objects::JValue::Object(&rect_null),
            jni::objects::JValue::Bool(0),
            jni::objects::JValue::Int(flag_system),
          ],
        )
        .map_err(|e| format!("WallpaperManager.setBitmap(system): {}", e))?;
    } else {
      env
        .call_method(
          &wm_obj,
          "setBitmap",
          "(Landroid/graphics/Bitmap;)V",
          &[jni::objects::JValue::Object(&bitmap)],
        )
        .map_err(|e| format!("WallpaperManager.setBitmap: {}", e))?;
    }
  } else if which == "lock" {
    if sdk_int >= 24 {
      let rect_null = JObject::null();
      env
        .call_method(
          &wm_obj,
          "setBitmap",
          "(Landroid/graphics/Bitmap;Landroid/graphics/Rect;ZI)I",
          &[
            jni::objects::JValue::Object(&bitmap),
            jni::objects::JValue::Object(&rect_null),
            jni::objects::JValue::Bool(0),
            jni::objects::JValue::Int(flag_lock),
          ],
        )
        .map_err(|e| format!("WallpaperManager.setBitmap(lock): {}", e))?;
    } else {
      return Err("Lock screen wallpaper requires Android 7.0+".to_string());
    }
  } else {
    // both: set home, then lock if possible
    if sdk_int >= 24 {
      let rect_null = JObject::null();
      env
        .call_method(
          &wm_obj,
          "setBitmap",
          "(Landroid/graphics/Bitmap;Landroid/graphics/Rect;ZI)I",
          &[
            jni::objects::JValue::Object(&bitmap),
            jni::objects::JValue::Object(&rect_null),
            jni::objects::JValue::Bool(0),
            jni::objects::JValue::Int(flag_system),
          ],
        )
        .map_err(|e| format!("WallpaperManager.setBitmap(system): {}", e))?;
      env
        .call_method(
          &wm_obj,
          "setBitmap",
          "(Landroid/graphics/Bitmap;Landroid/graphics/Rect;ZI)I",
          &[
            jni::objects::JValue::Object(&bitmap),
            jni::objects::JValue::Object(&JObject::null()),
            jni::objects::JValue::Bool(0),
            jni::objects::JValue::Int(flag_lock),
          ],
        )
        .map_err(|e| format!("WallpaperManager.setBitmap(lock): {}", e))?;
    } else {
      env
        .call_method(
          &wm_obj,
          "setBitmap",
          "(Landroid/graphics/Bitmap;)V",
          &[jni::objects::JValue::Object(&bitmap)],
        )
        .map_err(|e| format!("WallpaperManager.setBitmap: {}", e))?;
    }
  }

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

#[tauri::command]
fn set_device_wallpaper_target(app: tauri::AppHandle, path: String, target: String) -> Result<(), String> {
  #[cfg(target_os = "android")]
  {
    return set_wallpaper_android_with_target(&app, path, target);
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

/// Получить размер экрана Android
#[cfg(target_os = "android")]
fn get_screen_size_android() -> Result<(i32, i32), String> {
  let ctx = android_context();
  let vm = unsafe {
    jni::JavaVM::from_raw(ctx.vm() as *mut _).map_err(|e| format!("JavaVM error: {}", e))?
  };
  let mut env = vm
    .attach_current_thread()
    .map_err(|e| format!("JNI attach thread: {}", e))?;
  let context = unsafe { JObject::from_raw(ctx.context() as *mut _) };

  // DisplayMetrics metrics = context.getResources().getDisplayMetrics()
  let _resources_class = env
    .find_class("android/content/Context")
    .map_err(|e| format!("Find Context: {}", e))?;
  let resources = env
    .call_method(
      context,
      "getResources",
      "()Landroid/content/res/Resources;",
      &[],
    )
    .map_err(|e| format!("getResources: {}", e))?
    .l()
    .map_err(|e| format!("Get Resources object: {}", e))?;

  let display_metrics_class = env
    .find_class("android/util/DisplayMetrics")
    .map_err(|e| format!("Find DisplayMetrics: {}", e))?;
  let metrics = env
    .new_object(display_metrics_class, "()V", &[])
    .map_err(|e| format!("New DisplayMetrics: {}", e))?;

  env
    .call_method(
      resources,
      "getDisplayMetrics",
      "(Landroid/util/DisplayMetrics;)V",
      &[jni::objects::JValue::Object(&metrics)],
    )
    .map_err(|e| format!("getDisplayMetrics: {}", e))?;

  // int width = metrics.widthPixels
  let width = env
    .get_field(&metrics, "widthPixels", "I")
    .map_err(|e| format!("get widthPixels: {}", e))?
    .i()
    .map_err(|e| format!("Get width: {}", e))?;

  // int height = metrics.heightPixels
  let height = env
    .get_field(&metrics, "heightPixels", "I")
    .map_err(|e| format!("get heightPixels: {}", e))?
    .i()
    .map_err(|e| format!("Get height: {}", e))?;

  Ok((width, height))
}

#[tauri::command]
fn get_screen_size() -> Result<(i32, i32), String> {
  #[cfg(target_os = "android")]
  {
    return get_screen_size_android();
  }
  #[cfg(not(target_os = "android"))]
  {
    Err("Only supported on Android".to_string())
  }
}

/// Создать коллекцию. Возвращает уникальный ID коллекции.
#[tauri::command]
fn create_collection(app: tauri::AppHandle, name: String) -> Result<String, String> {
  let collections_dir = files_base_dir(&app)?.join("collections");
  fs::create_dir_all(&collections_dir).map_err(|e| e.to_string())?;

  // Проверяем уникальность названия
  let existing = list_collections(app.clone())?;
  if existing.iter().any(|c| c["name"].as_str() == Some(&name)) {
    return Err(format!("Коллекция с названием '{}' уже существует", name));
  }

  // Генерируем уникальный ID на основе имени и времени
  let sanitized_name = name
    .chars()
    .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
    .collect::<String>();
  let timestamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap()
    .as_secs();
  let collection_id = format!("{}_{}", sanitized_name, timestamp);

  // Проверяем уникальность ID папки
  let mut final_id = collection_id.clone();
  let mut counter = 0;
  while collection_dir(&app, &final_id)?.exists() {
    counter += 1;
    final_id = format!("{}_{}", collection_id, counter);
  }

  // Создаем папку коллекции
  let dir = collection_dir(&app, &final_id)?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

  // Сохраняем метаданные (название) в файл
  let meta_file = dir.join("_meta.json");
  let meta = serde_json::json!({
    "name": name,
    "id": final_id,
    "created_at": timestamp
  });
  fs::write(&meta_file, serde_json::to_string_pretty(&meta).unwrap())
    .map_err(|e| e.to_string())?;

  Ok(final_id)
}

/// Получить список всех коллекций
#[tauri::command]
fn list_collections(app: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
  let collections_dir = files_base_dir(&app)?.join("collections");

  if !collections_dir.exists() {
    return Ok(vec![]);
  }

  let mut collections = Vec::new();
  let entries = fs::read_dir(&collections_dir).map_err(|e| e.to_string())?;

  for entry in entries {
    let entry = entry.map_err(|e| e.to_string())?;
    let path = entry.path();

    if path.is_dir() {
      let collection_id = path
        .file_name()
        .and_then(|n| n.to_str())
        .map(String::from)
        .unwrap_or_default();

      // Читаем метаданные
      let meta_file = path.join("_meta.json");
      if meta_file.exists() {
        if let Ok(content) = fs::read_to_string(&meta_file) {
          if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&content) {
            collections.push(meta);
            continue;
          }
        }
      }

      // Если метаданных нет, создаем базовую структуру
      collections.push(serde_json::json!({
        "id": collection_id,
        "name": collection_id,
        "created_at": 0
      }));
    }
  }

  // Сортируем по дате создания (новые сначала)
  collections.sort_by(|a, b| {
    let a_time = a["created_at"].as_u64().unwrap_or(0);
    let b_time = b["created_at"].as_u64().unwrap_or(0);
    b_time.cmp(&a_time)
  });

  Ok(collections)
}

#[tauri::command]
fn list_collection_files(app: tauri::AppHandle, collection_id: String) -> Result<Vec<String>, String> {
  let dir = collection_dir(&app, &collection_id)?;
  if !dir.exists() {
    return Ok(vec![]);
  }
  let mut files = Vec::new();
  for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    let path = entry.path();
    if path.is_file() {
      if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        if !name.starts_with('_') {
          files.push(format!("collections/{}/{}", collection_id, name));
        }
      }
    }
  }
  files.sort();
  Ok(files)
}

#[tauri::command]
fn delete_collection(app: tauri::AppHandle, collection_id: String) -> Result<(), String> {
  let dir = collection_dir(&app, &collection_id)?;
  if dir.exists() {
    fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
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
    set_device_wallpaper_target,
    create_collection,
    list_collections,
    get_screen_size,
    list_collection_files,
    delete_collection,
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

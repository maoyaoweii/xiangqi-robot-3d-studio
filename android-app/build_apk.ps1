$ErrorActionPreference = "Stop"

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$btDir = Get-ChildItem (Join-Path $sdk "build-tools") -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -Last 1 -ExpandProperty FullName
$bt = if ($btDir) { $btDir } else { Join-Path $sdk "build-tools\36.0.0" }
$androidJar = Join-Path $sdk "platforms\android-34\android.jar"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$rustDir = Join-Path (Split-Path -Parent $root) "rust-studio"
$buildDir = Join-Path $root "build"
if (Test-Path $buildDir) { Remove-Item -Recurse -Force $buildDir }
New-Item -ItemType Directory -Force -Path "$buildDir\classes","$buildDir\dex","$buildDir\apk\lib\arm64-v8a" | Out-Null

$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
Push-Location $rustDir
cargo build --release --target aarch64-linux-android -p xiangqi_android
Pop-Location

$targetCandidates = @(
  $(if ($env:CARGO_TARGET_DIR) { Join-Path $env:CARGO_TARGET_DIR "aarch64-linux-android\release\libxiangqi_android.so" }),
  (Join-Path $rustDir "target\aarch64-linux-android\release\libxiangqi_android.so"),
  (Join-Path $env:USERPROFILE ".cargo\xiangqi_target\aarch64-linux-android\release\libxiangqi_android.so")
) | Where-Object { $_ -and (Test-Path $_) }
$soPath = $targetCandidates | Select-Object -First 1
if (-not $soPath) { throw "Missing libxiangqi_android.so in expected Cargo target directories" }
Copy-Item -Force $soPath "$buildDir\apk\lib\arm64-v8a\libxiangqi_android.so"

$javac = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\javac.exe")) { "$env:JAVA_HOME\bin\javac.exe" } else { "javac" }
$keytool = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\keytool.exe")) { "$env:JAVA_HOME\bin\keytool.exe" } else { "keytool" }

& $javac -encoding UTF-8 -source 1.8 -target 1.8 -bootclasspath $androidJar -d "$buildDir\classes" "$root\src\com\xiangqi\ruststudio\MainActivity.java"
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

$classFiles = Get-ChildItem "$buildDir\classes" -Recurse -Filter "*.class" | ForEach-Object { $_.FullName }
& "$bt\d8.bat" --lib $androidJar --output "$buildDir\dex" @classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

& "$bt\aapt2.exe" link -o "$buildDir\unaligned.apk" --manifest "$root\AndroidManifest.xml" -I $androidJar
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

Copy-Item -Force "$buildDir\dex\classes.dex" "$buildDir\apk\classes.dex"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open("$buildDir\unaligned.apk", [System.IO.Compression.ZipArchiveMode]::Update)
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$buildDir\apk\classes.dex", "classes.dex", [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$buildDir\apk\lib\arm64-v8a\libxiangqi_android.so", "lib/arm64-v8a/libxiangqi_android.so", [System.IO.Compression.CompressionLevel]::NoCompression) | Out-Null
$zip.Dispose()

& "$bt\zipalign.exe" -p -f 4 "$buildDir\unaligned.apk" "$buildDir\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

$keystore = "$buildDir\debug.keystore"
$ErrorActionPreference = "Continue"
& $keytool -genkey -keystore $keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=XiangqiRustStudio,O=OptoLab,C=CN" 2>&1 | Out-Null
$ErrorActionPreference = "Stop"

$outApk = Join-Path $root "XiangqiRustStudio-debug.apk"
& "$bt\apksigner.bat" sign --ks $keystore --ks-pass pass:android --key-pass pass:android --out $outApk "$buildDir\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

Write-Output "APK BUILT SUCCESSFULLY: $outApk ($((Get-Item $outApk).Length) bytes)"

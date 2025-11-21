import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {execSync} from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. 获取命令行参数中的新版本号，或者使用根目录 package.json 的版本
const args = process.argv.slice(2);
let newVersion = args[0];

const rootPackagePath = path.join(rootDir, 'package.json');
const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf-8'));

if (!newVersion) {
    console.log('No version provided in args, using root package.json version.');
    newVersion = rootPackage.version;
} else {
    // 如果提供了参数，先更新根目录 package.json
    console.log(`Updating root package.json to ${newVersion}...`);
    rootPackage.version = newVersion;
    fs.writeFileSync(rootPackagePath, JSON.stringify(rootPackage, null, 2) + '\n');
}

console.log(`🚀 Syncing version ${newVersion} across the workspace...`);

// 定义需要同步的文件路径
const filesToUpdate = [
    // 子包的 package.json
    path.join(rootDir, 'packages/core/package.json'),
    path.join(rootDir, 'packages/web/package.json'),
    path.join(rootDir, 'packages/desktop/package.json'),
    // Tauri 配置文件
    path.join(rootDir, 'packages/desktop/src-tauri/tauri.conf.json'),
];

// 2. 更新 JSON 文件
filesToUpdate.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // 对于 tauri.conf.json，版本号在 .version，其他在 .version (standard)
        // 注意：Tauri v2 的 tauri.conf.json 结构可能有所不同，你提供的文件中在根级
        if (filePath.endsWith('tauri.conf.json')) {
            // 你的 tauri.conf.json 中 version 在根级别，有些版本在 package.version
            content.version = newVersion;
        } else {
            content.version = newVersion;
        }

        fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
        console.log(`✅ Updated ${path.relative(rootDir, filePath)}`);
    } else {
        console.warn(`⚠️ File not found: ${filePath}`);
    }
});

// 3. 特殊处理：Cargo.toml (Rust)
// 使用正则替换，避免破坏 TOML 格式
const cargoPath = path.join(rootDir, 'packages/desktop/src-tauri/Cargo.toml');
if (fs.existsSync(cargoPath)) {
    let cargoContent = fs.readFileSync(cargoPath, 'utf-8');
    // 匹配 [package] 下的 version = "x.x.x"
    // 注意：这不会替换 dependencies 里的 version
    const versionRegex = /^version\s*=\s*".*"/m;
    cargoContent = cargoContent.replace(versionRegex, `version = "${newVersion}"`);
    fs.writeFileSync(cargoPath, cargoContent);
    console.log(`✅ Updated ${path.relative(rootDir, cargoPath)}`);
}

// 4. 特殊处理：APP_VERSION 常量 (packages/core/src/config/app.ts)
const appConfigPath = path.join(rootDir, 'packages/core/src/config/app.ts');
if (fs.existsSync(appConfigPath)) {
    let tsContent = fs.readFileSync(appConfigPath, 'utf-8');
    // 匹配 export const APP_VERSION = '...';
    // 这里我们保留后缀逻辑，或者直接替换整个字符串
    // 假设你想完全替换版本号部分，保留后缀逻辑需要更复杂的解析，这里直接替换整个值
    const appVersionRegex = /export const APP_VERSION = ['"].*['"];/;

    // 如果你想保留 " - AI Settings Edition" 这种后缀，可以手动拼接，或者直接由入参控制
    // 这里简单起见，直接设为纯版本号，或者你可以硬编码后缀
    tsContent = tsContent.replace(appVersionRegex, `export const APP_VERSION = '${newVersion}';`);

    fs.writeFileSync(appConfigPath, tsContent);
    console.log(`✅ Updated ${path.relative(rootDir, appConfigPath)}`);
}

execSync(`git tag v${newVersion}`)

console.log(`🎉 Version sync complete! Run 'pnpm install' to update lockfiles if needed.`);
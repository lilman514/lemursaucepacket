// Windows installer + auto-update settings. Names and IDs come from brand.json.
const brand = require('./brand.json')

const updates = brand.updates.owner && brand.updates.repo

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: brand.appId,
  productName: brand.name,
  executableName: brand.shortName.replace(/[^A-Za-z0-9]+/g, '') + 'Launcher',
  directories: { output: 'dist', buildResources: 'resources' },
  files: ['out/**/*'],
  icon: 'resources/icon.png',
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    artifactName: '${productName}-Setup-${version}.${ext}'
  },
  nsis: {
    // A branded setup wizard: resources/installer.nsh (welcome with requirements, system checks) plus
    // installerSidebar.bmp / installerHeader.bmp from art/process.mjs. Always per-user
    // (%LOCALAPPDATA%\Programs), so there's no admin prompt.
    oneClick: false,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: true,
    runAfterFinish: true,
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
    shortcutName: brand.shortName,
    // Worlds, screenshots and settings survive an uninstall/reinstall.
    deleteAppDataOnUninstall: false
  },
  // Enables electron-updater: releases are published to (and fetched from) this GitHub repo.
  publish: updates ? [{ provider: 'github', owner: brand.updates.owner, repo: brand.updates.repo, releaseType: 'release' }] : null
}

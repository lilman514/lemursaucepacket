; LemurSaucePacket setup wizard, layered on electron-builder's assisted NSIS template
; (node_modules/app-builder-lib/templates/nsis/assistedInstaller.nsh):
;   Welcome (what you need) -> install location -> install -> Finish ("Run LemurSaucePacket").
; Always installs for the current user only, so friends never see an admin prompt.
; The sidebar and header images next to this file come from art/process.mjs.

!include LogicLib.nsh
!include WinVer.nsh
!include x64.nsh

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to LemurSaucePacket"
  !define MUI_WELCOMEPAGE_TEXT "This installs the LemurSaucePacket launcher. It sets up Minecraft, Java and every mod for you, keeps them in sync with the server, and drops you straight into the game.$\r$\n$\r$\nYou'll need:$\r$\n  •  Windows 10 or 11 (64-bit)$\r$\n  •  A Microsoft account that owns Minecraft: Java Edition$\r$\n  •  8 GB of RAM or more (16 GB is best)$\r$\n  •  About 5 GB of free disk space$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; Replaces the template's Finish page to add our text; StartApp is the template's own "Run" action.
!macro customFinishPage
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_TITLE "You're all set"
  !define MUI_FINISHPAGE_TEXT "LemurSaucePacket is installed, with shortcuts on your desktop and in the Start menu.$\r$\n$\r$\nOpen it, sign in with your Microsoft account and press Play. The first launch downloads the game and mods (about 2 GB), so give it a few minutes."
  !define MUI_FINISHPAGE_TEXT_LARGE
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !insertmacro MUI_PAGE_FINISH
!macroend

; Skip the "install for all users / only for me" page: per-user needs no admin rights.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_ICONSTOP "LemurSaucePacket needs Windows 10 or 11." /SD IDOK
    Quit
  ${EndIf}
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "LemurSaucePacket needs a 64-bit version of Windows." /SD IDOK
    Quit
  ${EndIf}

  ; A 150-mod pack wants memory: warn below 8 GB, but let the player decide.
  System::Call "*(i 64, i, l, l, l, l, l, l, l) p .r0"
  System::Call "kernel32::GlobalMemoryStatusEx(p r0)"
  System::Call "*$0(i, i, l .r1)"
  System::Free $0
  System::Int64Op $1 / 1048576
  Pop $1
  ${If} $1 < 7600
    MessageBox MB_ICONEXCLAMATION|MB_OKCANCEL "This PC has $1 MB of memory. LemurSaucePacket is built for 8 GB or more, so the game may run slowly.$\r$\n$\r$\nInstall anyway?" /SD IDOK IDOK lsp_memory_ok
    Quit
    lsp_memory_ok:
  ${EndIf}
!macroend

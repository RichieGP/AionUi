; x64 architecture detection for NSIS installer
; Prevents installation on ARM64 or x86 systems

!include "x64.nsh"

!macro AIONUI_FIND_INSTALLED_APP _RETURN
  nsExec::Exec `"$PowerShellPath" -NoProfile -ExecutionPolicy Bypass -C "if (@(Get-CimInstance -ClassName Win32_Process | ? { $$path = $$_.ExecutablePath; if (-not $$path) { $$path = $$_.Path }; $$_.Name -ieq '${APP_EXECUTABLE_FILENAME}' -and $$path -and [string]::Equals($$path, '$INSTDIR\${APP_EXECUTABLE_FILENAME}', [System.StringComparison]::CurrentCultureIgnoreCase) }).Count -gt 0) { exit 0 } else { exit 1 }"`
  Pop ${_RETURN}
!macroend

!macro AIONUI_STOP_INSTALLED_APP _FORCE
  Push $0
  ${if} ${_FORCE} == 1
    StrCpy $0 "/F"
  ${else}
    StrCpy $0 ""
  ${endIf}

  nsExec::Exec `"$PowerShellPath" -NoProfile -ExecutionPolicy Bypass -C "Get-CimInstance -ClassName Win32_Process | ? { $$path = $$_.ExecutablePath; if (-not $$path) { $$path = $$_.Path }; $$_.Name -ieq '${APP_EXECUTABLE_FILENAME}' -and $$path -and [string]::Equals($$path, '$INSTDIR\${APP_EXECUTABLE_FILENAME}', [System.StringComparison]::CurrentCultureIgnoreCase) } | % { taskkill $0 /PID $$_.ProcessId | Out-Null }"`
  Pop $0
!macroend

!macro AIONUI_STOP_BUNDLED_CHILDREN _FORCE
  Push $0
  ${if} ${_FORCE} == 1
    StrCpy $0 "/F"
  ${else}
    StrCpy $0 ""
  ${endIf}

  nsExec::Exec `"$PowerShellPath" -NoProfile -ExecutionPolicy Bypass -C "$$root = '$INSTDIR\resources\bundled-aioncore\'; Get-CimInstance -ClassName Win32_Process | ? { $$path = $$_.ExecutablePath; if (-not $$path) { $$path = $$_.Path }; $$path -and $$path.StartsWith($$root, [System.StringComparison]::CurrentCultureIgnoreCase) -and @('aioncore.exe', 'node.exe', 'codex-acp.exe') -contains $$_.Name } | % { taskkill $0 /PID $$_.ProcessId | Out-Null }"`
  Pop $0
!macroend

!macro customCheckAppRunning
  ${if} ${isUpdated}
    Sleep 300
  ${endIf}

  !insertmacro AIONUI_FIND_INSTALLED_APP $R0
  ${if} $R0 == 0
    ${if} ${isUpdated}
      Sleep 1000
      Goto doStopAionUiProcess
    ${endIf}
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK doStopAionUiProcess
    Quit

    doStopAionUiProcess:

    DetailPrint "$(appClosing)"

    !insertmacro AIONUI_STOP_INSTALLED_APP 0
    Sleep 300
    StrCpy $R1 0

    loop:
      IntOp $R1 $R1 + 1

      !insertmacro AIONUI_FIND_INSTALLED_APP $R0
      ${if} $R0 == 0
        Sleep 1000
        !insertmacro AIONUI_STOP_INSTALLED_APP 1
        !insertmacro AIONUI_FIND_INSTALLED_APP $R0
        ${if} $R0 == 0
          DetailPrint `Waiting for "${PRODUCT_NAME}" to close.`
          Sleep 2000
        ${else}
          Goto not_running
        ${endIf}
      ${else}
        Goto not_running
      ${endIf}

      ${if} $R1 > 1
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY loop
        Quit
      ${else}
        Goto loop
      ${endIf}
    not_running:
  ${endIf}

  !insertmacro AIONUI_STOP_BUNDLED_CHILDREN 0
  Sleep 300
  !insertmacro AIONUI_STOP_BUNDLED_CHILDREN 1
!macroend

; Check architecture when installer validates install directory
; This is called early in the installer lifecycle and won't conflict with electron-builder
Function .onVerifyInstDir
  ; Block installation on x86 (32-bit) systems first
  ; Must check BEFORE ARM64, since ARM64 with WOW64 may report RunningX64=true
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP \
      "Installation package architecture mismatch$\n$\n\
      This AionUi installer is designed for x64 architecture.$\n$\n\
      Your system is 32-bit architecture. Please download the appropriate version for your architecture.$\n$\n\
      Download: https://github.com/iOfficeAI/AionUi/releases"
    Quit
  ${EndIf}

  ; Block installation on ARM64 systems
  ${If} ${IsNativeARM64}
    MessageBox MB_OK|MB_ICONSTOP \
      "Installation package architecture mismatch$\n$\n\
      This AionUi installer is designed for x64 architecture.$\n$\n\
      Your system is ARM64 architecture. Please download the ARM64 version.$\n$\n\
      Download: https://github.com/iOfficeAI/AionUi/releases"
    Quit
  ${EndIf}
FunctionEnd

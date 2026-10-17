; Portable layout: create portable.txt next to the exe so that the data
; directory resolves to <install dir>\data instead of %APPDATA%\CompassZha
!macro NSIS_HOOK_POSTINSTALL
  FileOpen $0 "$INSTDIR\portable.txt" w
  FileClose $0
!macroend
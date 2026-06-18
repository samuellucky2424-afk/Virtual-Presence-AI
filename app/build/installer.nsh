!macro customInstall
  IfFileExists "$INSTDIR\resources\surevideotool-cam\surevideotool_cam_registrar.exe" 0 customInstallDone

  DetailPrint "Installing Virtual Presence AI virtual camera..."
  nsExec::ExecToLog '"$INSTDIR\resources\surevideotool-cam\surevideotool_cam_registrar.exe" install --all-users'
  Pop $0

  StrCmp $0 "0" customInstallDone
  DetailPrint "All-users virtual camera install failed with exit code $0. Retrying current-user registration..."
  nsExec::ExecToLog '"$INSTDIR\resources\surevideotool-cam\surevideotool_cam_registrar.exe" install'
  Pop $1

  StrCmp $1 "0" customInstallDone
  MessageBox MB_ICONEXCLAMATION|MB_OK "Virtual Presence AI was installed, but the Virtual Presence AI virtual camera setup failed.$\r$\n$\r$\nClose WhatsApp, OBS, Chrome, Zoom, the Windows Camera app, and any app using Virtual Presence AI as a camera. If it still fails, restart Windows and run this installer again.$\r$\n$\r$\nAll-users exit code: $0$\r$\nCurrent-user exit code: $1$\r$\n$\r$\nYou can retry manually from:$\r$\n$INSTDIR\resources\surevideotool-cam\surevideotool_cam_registrar.exe install"

customInstallDone:
!macroend

!macro customUnInstall
  IfFileExists "$INSTDIR\resources\surevideotool-cam\surevideotool_cam_registrar.exe" 0 customUnInstallDone

  DetailPrint "Removing Virtual Presence AI virtual camera..."
  nsExec::ExecToLog '"$INSTDIR\resources\surevideotool-cam\surevideotool_cam_registrar.exe" remove --all-users --unregister-com'
  Pop $0

customUnInstallDone:
!macroend

# Types a command + Enter into the LemurSaucePacket server's console window (the start.bat window), as an admin
# would type it there. Used by panel.mjs. It never stops the server: "stop", "end" and "restart" are refused.
# One command: -Command "...", prints "pid <n>: sent <k> events". With -Serve it stays open and types each line it
# reads on its input, answering each with one line (panel.mjs keeps one open: starting PowerShell takes a second or two).
param([string]$Command = '', [string]$ServerDir = 'C:\LemurSaucePacket-Server', [switch]$Serve)
$code = @'
using System;
using System.Runtime.InteropServices;
public static class LspConsole {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct KEY_EVENT_RECORD { public bool bKeyDown; public ushort wRepeatCount; public ushort wVirtualKeyCode; public ushort wVirtualScanCode; public char UnicodeChar; public uint dwControlKeyState; }
  [StructLayout(LayoutKind.Explicit)]
  public struct INPUT_RECORD { [FieldOffset(0)] public ushort EventType; [FieldOffset(4)] public KEY_EVENT_RECORD KeyEvent; }
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool FreeConsole();
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool AttachConsole(uint pid);
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)] public static extern IntPtr CreateFile(string name, uint access, uint share, IntPtr sec, uint disp, uint flags, IntPtr template);
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool WriteConsoleInput(IntPtr h, INPUT_RECORD[] buf, uint len, out uint written);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern short VkKeyScan(char ch);
  public static string Send(uint pid, string text) {
    FreeConsole();
    if (!AttachConsole(pid)) return "AttachConsole failed: " + Marshal.GetLastWin32Error();
    IntPtr h = CreateFile("CONIN$", 0x40000000 | 0x80000000, 3, IntPtr.Zero, 3, 0, IntPtr.Zero);
    if (h == (IntPtr)(-1)) { FreeConsole(); return "CONIN$ failed: " + Marshal.GetLastWin32Error(); }
    var recs = new INPUT_RECORD[text.Length * 2];
    int i = 0;
    foreach (char ch in text) {
      // The key that types the character on this keyboard: the console reads some key codes as keys ("." is the
      // code of Delete, "-" of Insert), so the character alone isn't enough.
      short scan = ch == '\r' ? (short)13 : VkKeyScan(ch);
      ushort vk = scan == -1 ? (ushort)0 : (ushort)(scan & 0xFF);
      uint shift = scan != -1 && (scan & 0x100) != 0 ? 0x10u : 0u;
      for (int d = 0; d < 2; d++) {
        var r = new INPUT_RECORD();
        r.EventType = 1;
        r.KeyEvent.bKeyDown = d == 0;
        r.KeyEvent.wRepeatCount = 1;
        r.KeyEvent.UnicodeChar = ch;
        r.KeyEvent.wVirtualKeyCode = vk;
        r.KeyEvent.dwControlKeyState = shift;
        recs[i++] = r;
      }
    }
    uint written;
    bool ok = WriteConsoleInput(h, recs, (uint)recs.Length, out written);
    FreeConsole();
    return ok ? "sent " + written + " events" : "WriteConsoleInput failed: " + Marshal.GetLastWin32Error();
  }
}
'@
Add-Type -TypeDefinition $code

function Send-Line([string]$line) {
  $c = $line.Trim()
  if ($c -eq '' -or $c -match '^/?(stop|end|restart)\b') { return "refused: '$line'" }
  # The server's java runs from its own folder (its command line is relative, so match the executable's path).
  $proc = Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object { $_.ExecutablePath -and $_.ExecutablePath -like "$ServerDir\*" } | Select-Object -First 1
  if (-not $proc) { return "no server running from $ServerDir" }
  return ("pid {0}: {1}" -f $proc.ProcessId, [LspConsole]::Send([uint32]$proc.ProcessId, $c + "`r"))
}

if ($Serve) {
  $in = [Console]::In
  while ($null -ne ($line = $in.ReadLine())) {
    [Console]::Out.WriteLine((Send-Line $line))
    [Console]::Out.Flush()
  }
  exit 0
}
$result = Send-Line $Command
Write-Output $result
if ($result -like 'refused*') { exit 2 }
if ($result -like 'no server*') { exit 1 }

# Sets the LemurSaucePacket server's process priority, as Task Manager's "Set priority" does, and turns off Windows'
# power throttling for it (the opposite of Task Manager's "Efficiency mode"). Used by panel.mjs: below normal while it
# pre-builds distant land (the PC's own programs come first), normal while anyone plays.
#
# The throttling matters more than the priority: Windows 11 treats the server, whose console window is never in front,
# as background work and keeps it on a 12th-gen Intel's 8 efficiency cores. The pre-build ran on about 6.5 cores
# that way, and on 19 with throttling off (2026-10-08). Both settings last until the server restarts.
# Prints "pid <n>: <priority>, <throttling>".
param(
  [Parameter(Mandatory = $true)][ValidateSet('Normal', 'BelowNormal')][string]$Priority,
  [string]$ServerDir = 'C:\LemurSaucePacket-Server'
)
$code = @'
using System;
using System.Runtime.InteropServices;
public static class LspQos {
  [StructLayout(LayoutKind.Sequential)]
  public struct PROCESS_POWER_THROTTLING_STATE { public uint Version; public uint ControlMask; public uint StateMask; }
  [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool SetProcessInformation(IntPtr h, int infoClass, ref PROCESS_POWER_THROTTLING_STATE info, uint size);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool CloseHandle(IntPtr h);
  // ProcessPowerThrottling (4) with EXECUTION_SPEED (1) in the control mask and not in the state mask: never throttle.
  public static string FullSpeed(uint pid) {
    IntPtr h = OpenProcess(0x0200, false, pid);
    if (h == IntPtr.Zero) return "throttling unchanged (OpenProcess " + Marshal.GetLastWin32Error() + ")";
    var s = new PROCESS_POWER_THROTTLING_STATE { Version = 1, ControlMask = 0x1, StateMask = 0 };
    bool ok = SetProcessInformation(h, 4, ref s, (uint)Marshal.SizeOf(s));
    int err = Marshal.GetLastWin32Error();
    CloseHandle(h);
    return ok ? "no power throttling" : "throttling unchanged (SetProcessInformation " + err + ")";
  }
}
'@
Add-Type -TypeDefinition $code
$proc = Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object { $_.ExecutablePath -and $_.ExecutablePath -like "$ServerDir\*" } | Select-Object -First 1
if (-not $proc) { Write-Output "no server running from $ServerDir"; exit 1 }
$p = Get-Process -Id $proc.ProcessId
$p.PriorityClass = $Priority
Write-Output ("pid {0}: {1}, {2}" -f $proc.ProcessId, $p.PriorityClass, [LspQos]::FullSpeed([uint32]$proc.ProcessId))

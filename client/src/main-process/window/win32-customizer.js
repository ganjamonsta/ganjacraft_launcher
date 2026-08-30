/**
 * Ganj4Craft Launcher - Win32 Minecraft Window Customizer
 * Принудительно устанавливает заголовок и иконку окна Minecraft на уровне Windows API
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const ICON_PATH = path.join(__dirname, '../../assets/icon.ico');

function customizeMinecraftWindow(pid, title = 'Ganj4Craft Season 4: Cyber & Magic') {
    if (process.platform !== 'win32') return;

    const iconPath = fs.existsSync(ICON_PATH) ? ICON_PATH.replace(/\\/g, '\\\\') : '';
    const safeTitle = title.replace(/'/g, "''");

    const psCommand = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class McWinSetter {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern bool SetWindowText(IntPtr hWnd, string lpString);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr LoadImage(IntPtr hinst, string lpszName, uint uType, int cxDesired, int cyDesired, uint fuLoad);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static void Apply(string title, string iconPath, uint targetPid) {
        IntPtr hIcon = IntPtr.Zero;
        if (!string.IsNullOrEmpty(iconPath) && System.IO.File.Exists(iconPath)) {
            hIcon = LoadImage(IntPtr.Zero, iconPath, 1, 0, 0, 0x00000010 | 0x00000040);
        }

        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            uint pId;
            GetWindowThreadProcessId(hWnd, out pId);
            if (targetPid != 0 && pId != targetPid) return true;

            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            string cur = sb.ToString();
            if (string.IsNullOrEmpty(cur)) return true;

            SetWindowText(hWnd, title);
            if (hIcon != IntPtr.Zero) {
                SendMessage(hWnd, 0x0080, (IntPtr)0, hIcon);
                SendMessage(hWnd, 0x0080, (IntPtr)1, hIcon);
            }
            return true;
        }, IntPtr.Zero);
    }
}
"@ -ErrorAction SilentlyContinue;
[McWinSetter]::Apply('${safeTitle}', '${iconPath}', ${pid || 0});
`;

    exec(`powershell -NoProfile -NonInteractive -Command "${psCommand.replace(/\r?\n/g, ' ')}"`, (err) => {
        if (err) {
            // Silently ignore if PowerShell is restricted
        }
    });
}

module.exports = {
    customizeMinecraftWindow
};

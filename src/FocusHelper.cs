using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace HydraRetro
{
    static class FocusHelper
    {
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
        [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
        [DllImport("user32.dll")] static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
        [DllImport("user32.dll")] static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
        [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
        [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hWnd);
        [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
        [DllImport("user32.dll")] static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        const int SW_MINIMIZE = 6;
        const int SW_RESTORE = 9;
        const int SW_SHOW = 5;
        const int SW_MAXIMIZE = 3;
        static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
        const uint SWP_NOMOVE = 0x0002;
        const uint SWP_NOSIZE = 0x0001;
        const uint SWP_SHOWWINDOW = 0x0040;

        static void ForceForeground(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero) return;
            try
            {
                // Simulate ALT key press/release to bypass Windows Foreground Lock Timeout
                keybd_event(0x12, 0, 0, UIntPtr.Zero);
                keybd_event(0x12, 0, 2, UIntPtr.Zero);
                ShowWindow(hWnd, SW_RESTORE);
                ShowWindow(hWnd, SW_SHOW);
                SetWindowPos(hWnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                SetForegroundWindow(hWnd);
                BringWindowToTop(hWnd);
                SetWindowPos(hWnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                SetForegroundWindow(hWnd);
            }
            catch { }
        }

        static IntPtr FindUiWindow()
        {
            IntPtr found = IntPtr.Zero;
            EnumWindows((hWnd, lParam) =>
            {
                if (!IsWindowVisible(hWnd)) return true;
                var sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string title = sb.ToString();
                if (title.Contains("HydraRetro"))
                {
                    found = hWnd;
                    return false;
                }
                return true;
            }, IntPtr.Zero);
            return found;
        }

        static IntPtr FindEmulatorWindow(uint targetPid)
        {
            IntPtr found = IntPtr.Zero;
            EnumWindows((hWnd, lParam) =>
            {
                uint wpid = 0;
                GetWindowThreadProcessId(hWnd, out wpid);
                if (wpid != targetPid) return true;
                if (!IsWindowVisible(hWnd)) return true;

                var sbClass = new StringBuilder(256);
                GetClassName(hWnd, sbClass, 256);
                string cls = sbClass.ToString();

                var sbTitle = new StringBuilder(256);
                GetWindowText(hWnd, sbTitle, 256);
                string title = sbTitle.ToString();

                if (cls.Contains("UAC_") || cls.Contains("Tooltip") || cls == "_q_titlebar" || cls == "IME" || cls.Contains("Cicero") || string.IsNullOrWhiteSpace(title))
                {
                    return true;
                }

                found = hWnd;
                return false;
            }, IntPtr.Zero);
            return found;
        }

        static void Main(string[] args)
        {
            if (args.Length == 0) return;
            string mode = args[0];

            if (mode == "focus-emu" && args.Length >= 2)
            {
                uint pid = 0;
                uint.TryParse(args[1], out pid);

                // Minimize HydraRetro fullscreen UI so emulator is never hidden behind it
                IntPtr uiWnd = FindUiWindow();
                if (uiWnd != IntPtr.Zero)
                {
                    ShowWindow(uiWnd, SW_MINIMIZE);
                }

                if (pid > 0)
                {
                    for (int i = 0; i < 40; i++)
                    {
                        IntPtr emuWnd = FindEmulatorWindow(pid);
                        if (emuWnd != IntPtr.Zero)
                        {
                            Thread.Sleep(250);
                            ForceForeground(emuWnd);
                            break;
                        }
                        Thread.Sleep(150);
                    }
                }
            }
            else if (mode == "restore-ui")
            {
                IntPtr found = IntPtr.Zero;
                EnumWindows((hWnd, lParam) =>
                {
                    var sb = new StringBuilder(256);
                    GetWindowText(hWnd, sb, 256);
                    string title = sb.ToString();
                    if (title.Contains("HydraRetro"))
                    {
                        found = hWnd;
                        return false;
                    }
                    return true;
                }, IntPtr.Zero);

                if (found != IntPtr.Zero)
                {
                    ShowWindow(found, SW_RESTORE);
                    ShowWindow(found, SW_MAXIMIZE);
                    ForceForeground(found);
                }
            }
        }
    }
}

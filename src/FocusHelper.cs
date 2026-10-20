using System;
using System.Diagnostics;
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
        [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
        [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();

        const int SW_MINIMIZE = 6;
        const int SW_RESTORE = 9;
        const int SW_SHOW = 5;

        static void ForceForeground(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero) return;
            try
            {
                IntPtr foreWnd = GetForegroundWindow();
                uint dummyPid;
                uint foreThread = GetWindowThreadProcessId(foreWnd, out dummyPid);
                uint currentThread = GetCurrentThreadId();

                if (foreThread != currentThread && foreThread != 0)
                {
                    AttachThreadInput(currentThread, foreThread, true);
                    ShowWindow(hWnd, SW_SHOW);
                    BringWindowToTop(hWnd);
                    SetForegroundWindow(hWnd);
                    AttachThreadInput(currentThread, foreThread, false);
                }
                else
                {
                    ShowWindow(hWnd, SW_SHOW);
                    BringWindowToTop(hWnd);
                    SetForegroundWindow(hWnd);
                }
            }
            catch { }
        }

        static IntPtr FindUiWindow()
        {
            IntPtr found = IntPtr.Zero;
            EnumWindows((hWnd, lParam) =>
            {
                if (!IsWindowVisible(hWnd)) return true;
                uint pid = 0;
                GetWindowThreadProcessId(hWnd, out pid);

                var sbTitle = new StringBuilder(256);
                GetWindowText(hWnd, sbTitle, 256);
                string title = sbTitle.ToString();

                var sbClass = new StringBuilder(256);
                GetClassName(hWnd, sbClass, 256);
                string cls = sbClass.ToString();

                if (title.Contains("HydraRetro"))
                {
                    found = hWnd;
                    return false;
                }

                try
                {
                    var p = Process.GetProcessById((int)pid);
                    string pName = p.ProcessName.ToLower();
                    if ((pName == "msedge" || pName == "chrome") && cls == "Chrome_WidgetWin_1" && !string.IsNullOrWhiteSpace(title))
                    {
                        found = hWnd;
                        return false;
                    }
                }
                catch { }

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

                if (cls.Contains("UAC") || cls.Contains("Tooltip") || cls == "_q_titlebar" || cls == "IME" || cls.Contains("Cicero"))
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
                            Thread.Sleep(200);
                            ForceForeground(emuWnd);
                            break;
                        }
                        Thread.Sleep(150);
                    }
                }
            }
            else if (mode == "restore-ui")
            {
                IntPtr uiWnd = FindUiWindow();
                if (uiWnd != IntPtr.Zero)
                {
                    ShowWindow(uiWnd, SW_RESTORE);
                    ForceForeground(uiWnd);
                }
            }
        }
    }
}

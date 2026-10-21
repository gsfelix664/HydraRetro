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
        [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vKey);

        const int SW_MINIMIZE = 6;
        const int SW_RESTORE = 9;
        const int SW_SHOW = 5;
        const int VK_ESCAPE = 0x1B;

        // XInput structs and dynamic loader for universal Windows support
        [StructLayout(LayoutKind.Sequential)]
        struct XINPUT_GAMEPAD
        {
            public ushort wButtons;
            public byte bLeftTrigger;
            public byte bRightTrigger;
            public short sThumbLX;
            public short sThumbLY;
            public short sThumbRX;
            public short sThumbRY;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct XINPUT_STATE
        {
            public uint dwPacketNumber;
            public XINPUT_GAMEPAD Gamepad;
        }

        delegate int XInputGetStateDelegate(int dwUserIndex, ref XINPUT_STATE pState);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        static extern IntPtr LoadLibrary(string lpFileName);

        [DllImport("kernel32.dll", CharSet = CharSet.Ansi, SetLastError = true, ExactSpelling = true)]
        static extern IntPtr GetProcAddress(IntPtr hModule, string procName);

        static XInputGetStateDelegate xinputGetState = null;

        static void InitXInput()
        {
            if (xinputGetState != null) return;
            string[] dlls = new[] { "xinput1_4.dll", "xinput1_3.dll", "xinput9_1_0.dll" };
            foreach (var dll in dlls)
            {
                IntPtr hMod = LoadLibrary(dll);
                if (hMod != IntPtr.Zero)
                {
                    IntPtr pProc = GetProcAddress(hMod, "XInputGetState");
                    if (pProc != IntPtr.Zero)
                    {
                        xinputGetState = (XInputGetStateDelegate)Marshal.GetDelegateForFunctionPointer(pProc, typeof(XInputGetStateDelegate));
                        break;
                    }
                }
            }
        }

        static bool IsBackAndStartPressed()
        {
            if (xinputGetState == null) return false;
            // Check controllers 0 through 3
            for (int i = 0; i < 4; i++)
            {
                XINPUT_STATE state = new XINPUT_STATE();
                if (xinputGetState(i, ref state) == 0)
                {
                    // 0x0020 = BACK (Select/View), 0x0010 = START (Menu)
                    // Also accept L3 (0x0040) + R3 (0x0080) + START (0x0010) as alternative
                    bool backStart = (state.Gamepad.wButtons & 0x0030) == 0x0030;
                    bool thumbStart = (state.Gamepad.wButtons & 0x00D0) == 0x00D0;
                    if (backStart || thumbStart) return true;
                }
            }
            return false;
        }

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

                InitXInput();

                // Minimize HydraRetro fullscreen UI so emulator takes full stage
                IntPtr uiWnd = FindUiWindow();
                if (uiWnd != IntPtr.Zero)
                {
                    ShowWindow(uiWnd, SW_MINIMIZE);
                }

                Process emuProc = null;
                if (pid > 0)
                {
                    try { emuProc = Process.GetProcessById((int)pid); } catch { }

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

                // Background monitoring loop: Hotkey Select+Start or Escape to exit emulator and restore UI
                if (emuProc != null)
                {
                    int hotkeyComboTicks = 0;
                    int escKeyTicks = 0;

                    while (!emuProc.HasExited)
                    {
                        try
                        {
                            // 1. Check Gamepad: Back + Start (Select + Start)
                            if (IsBackAndStartPressed())
                            {
                                hotkeyComboTicks++;
                                // 14 ticks * 50ms = 700ms held
                                if (hotkeyComboTicks >= 14)
                                {
                                    try { emuProc.Kill(); } catch { }
                                    break;
                                }
                            }
                            else
                            {
                                hotkeyComboTicks = 0;
                            }

                            // 2. Check Keyboard: Escape held for 750ms
                            if ((GetAsyncKeyState(VK_ESCAPE) & 0x8000) != 0)
                            {
                                escKeyTicks++;
                                if (escKeyTicks >= 15)
                                {
                                    try { emuProc.Kill(); } catch { }
                                    break;
                                }
                            }
                            else
                            {
                                escKeyTicks = 0;
                            }
                        }
                        catch { }

                        Thread.Sleep(50);
                    }
                }

                // Restore UI when emulator exits (either by hotkey or naturally)
                Thread.Sleep(200);
                uiWnd = FindUiWindow();
                if (uiWnd != IntPtr.Zero)
                {
                    ShowWindow(uiWnd, SW_RESTORE);
                    ForceForeground(uiWnd);
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

---
title: "Debugging network outage using Claude on my phone"
description: "An overnight apt auto-update killed my Ubuntu box's network on reboot. With the machine offline I drove Claude from my phone via screenshots to recover the connection, then Claude Code took five more minutes to find the actual root cause (an NVIDIA postinst dependency bug already on Launchpad) and draft the confirming comment. The post is about what AI does to the shape of a Linux debugging session, not about the bug."
pubDate: '2026-05-21'
heroImage: ../../assets/claude-on-phone.png
---

**TL;DR.** An `unattended-upgrades` run swapped in a new kernel and broke the NVIDIA driver overnight, which cascaded into "no network" on the next reboot. I spent ~15 minutes debugging using Claude off my phone to recover the connection by booting the previous kernel. Once back online, Claude Code took ~5 minutes to walk the package state, find the actual fault, and fix it. Furthermore, in 2 minutes, it located the existing Launchpad bug ([#2115148](https://bugs.launchpad.net/ubuntu/+source/linux-restricted-modules/+bug/2115148)) and drafted the confirming comment.

## The morning signal

[camwatch](/blog/camwatch/)'s GPU pipeline had quietly fallen back to CPU overnight. `nvidia-smi` returned the classic driver/library version mismatch: the kernel module loaded in memory no longer matched the userspace driver on disk. apt history showed why. `unattended-upgrades` had pulled in a new `nvidia-driver-535` plus a new kernel (6.17.0-29-generic) in the same transaction. Standard post-upgrade state. Needs a reboot.

So I rebooted.

## Reboot: no network

First sign was that I could not SSH in from my MacBook Air. My initial guess was that the SSH service hadn't come up. I plugged in the monitor to investigate. The box had actually booted all the way to the Ubuntu desktop, so SSH should have been up too. Then Settings → Wi-Fi reported "No Wi-Fi adapter found", and Ethernet was missing from the network panel as well. That moved my guess from "service didn't start" to "hardware".

I powered the box off, drained the residual power from the network card (hold the power button with the PSU unplugged, the usual ritual), booted again. Still no adapters.

At which point I had a debugging problem: no internet means no Claude on the desktop. Reading `dmesg` and `lsmod` by hand was the alternative, and slow.

## Phone debugging: 15 minutes

Claude on my phone was helpful, and it was enough. Slower than driving Claude Code on the host directly, but workable.

The hypothesis it landed on was that the new kernel might be missing its network modules. The suggested action: reboot, hold Shift at GRUB, pick the previous kernel (6.17.0-23-generic), and try from there.

That hypothesis turned out to be wrong about the cause but right about the action. Booting 6.17.0-23-generic brought the network straight back.

## Back online: Claude Code in 5 minutes

With the connection up I opened Claude Code in a terminal and pointed it at the problem. In about five minutes of back-and-forth it:

1. Ran `dpkg -l | grep -E "^(iF|iU)"` and surfaced three half-configured packages. `linux-modules-nvidia-535-6.17.0-29-generic` was in state `iF` (installed but postinst failed); two siblings sat in `iU` (unpacked, waiting on it).
2. Read `/var/log/apt/term.log` and pulled out the actual failure: the postinst tries to link the NVIDIA `.ko` files at install time and crashes because `scripts/module.lds` is missing under `/usr/src/linux-headers-6.17.0-29-generic/`. The headers package was never installed.
3. Ran `apt-cache show linux-modules-nvidia-535-6.17.0-29-generic` and confirmed: nothing in the dependency chain declares `linux-headers-<kver>-generic`. The postinst needs a file from a package nobody depends on.
4. Searched Launchpad for the error signature, surfaced [Bug #2115148](https://bugs.launchpad.net/ubuntu/+source/linux-restricted-modules/+bug/2115148) against `linux-restricted-modules`, and noted it was already Confirmed with 748 affected users. Same defect on a different driver/kernel pair than the original report.
5. Drafted the three-command fix:
   ```bash
   sudo apt install linux-headers-6.17.0-29-generic
   sudo apt --fix-broken install
   sudo update-initramfs -u -k 6.17.0-29-generic
   ```
6. Drafted a confirming comment with my kernel/driver pair, the term.log excerpt, the apt-cache evidence, and the workaround. I posted it as [comment #55](https://bugs.launchpad.net/ubuntu/+source/linux-restricted-modules/+bug/2115148/comments/55).

Reboot into 6.17.0-29-generic. Network, GPU, camwatch all up. nvidia-smi reports the RTX 3060 at driver 535.309.01.

## What actually broke

The phone-debugging hypothesis (new kernel missing its network modules) was wrong. The new kernel had the network modules on disk. What had really happened was that the NVIDIA postinst failure left `linux-modules-nvidia-535-6.17.0-29-generic` half-configured, and out of that state the next boot into 6.17.0-29-generic did not bring the network adapters up. Installing the headers, re-running the postinst, and regenerating the initramfs cleared it, and the following boot into 6.17.0-29-generic came up with Wi-Fi, Ethernet, and GPU all live.

Symptom and root cause sat in different subsystems. The phone hypothesis fit the visible evidence and produced a working *action* (boot the older kernel), but it never reached the actual fault. That had to wait for Claude Code on the recovered machine.

## What AI did to this debugging session

Two numbers worth putting in front of the rest:

- ~15 minutes on the phone to recover the connection.
- ~5 minutes with Claude Code on the desktop to find the actual root cause and file the bug comment.

Pre-AI, this kind of session was an evening. An hour or two chasing the network-modules theory, another finding the existing Launchpad bug, another writing a comment to a quality I would have actually posted. Possibly a wrong fix in between.

The shift isn't that the model knows things I don't. It is that the bottleneck moved. With Claude in the loop the slow step is feeding it the current state of the system: `dpkg -l`, `term.log`, `apt-cache show`. When the desktop is offline that means literal phone-screenshot copy-paste, awkward but still much faster than reading man pages and bug trackers by hand. Once the desktop is back, Claude Code can read those files directly and the speed jumps another order of magnitude.

---
title: "Agent team, but evolved"
description: "The agent team has evolved: it now runs on tmux instead of Claude Code's native agent view. tmux lets the coordinator fully control the team-member agents, and its session-window-pane hierarchy gives each feature team a clean tree view. My contact surface with the team shrinks further than before."
pubDate: '2026-06-13'
heroImage: ../../assets/agent-team-evolved-hero.png
---

**TL;DR.** The agent team has evolved: it now runs on tmux instead of Claude Code's native agent view. tmux lets the coordinator fully control the team-member agents, and its session-window-pane hierarchy gives each feature team a clean tree view. My contact surface with the team shrinks further than before.

## The pain

The [previous post](/blog/agent-team-but-homemade/) built a homemade agent team out of files: a coordinator Claude session, one implementing session per repo, and mailbox files that wake the other side the moment they grow. It went through two versions and landed on v2, where the sessions talked through single-writer mailboxes and verified-close tickets, and I had stopped being the message bus between them. Then I ran it hard for a while, and three limits surfaced.

First, **concurrent features blurred together.** One coordinator had to hold every feature at once, so designing two things in the same session contaminated each other's context and the conversation got confusing.

Second, **the native view could not group by feature.** I could split the work across more sessions, but Claude Code's agent view lists them in one flat layer, groupable only by status or by working directory, never by the feature I actually cared about.

Third, and worst, **the coordinator could not run the sessions.** A mailbox append only wakes a session that is already running and watching it; a file write cannot cold-start one. So I stood every session up by hand, and when a watch stalled I was the one who had to notice and poke it back to life. The coordinator ran the work; I still ran the team's existence.

## The options

tmux turned out to be the answer, but it was not the first thing I tried. (tmux is a terminal multiplexer: a single program that owns many terminal windows and can both type into them and read them back.) A few other options got weighed and set aside first.

**Native agent teams.** Claude Code has a built-in team mode, but its teammates all share the lead's working directory, so one-session-per-repo is not possible yet (tracked in [anthropics/claude-code#23669](https://github.com/anthropics/claude-code/issues/23669)). For a cross-repo team, not yet.

**A Jira-style board.** I floated replacing the files with a task dashboard. It would break the one trick that makes this cheap: a file append *is* the wake signal, and a dashboard means webhooks or polling, which brings back latency or burns tokens on every check. Kept as a maybe-someday view, not a replacement.

**Native background sessions.** The version I actually tried: launch each session with `claude --bg --name`, prefix the names per feature, and let the agent view gather them. It launched fine but hit two walls. The view still only groups by status or directory, and there is no way to send a prompt to a running background session; only the human can poke it.

The irony is that tmux had already been rejected once, back in v2. tmux drives a terminal by typing into it and reading it back, but a background session does not live in a terminal pane at all, so those keystrokes could never reach it. They were alternative hosting models. v3's move is simply to give that up: stop hosting the agents in the background, and run the whole team inside tmux instead. Once the coordinator and its agents all live in tmux panes, the coordinator can type into any of them, and tmux's nesting (a session holds windows, a window holds panes) gives the feature tree the agent view would not. One session per feature, one window per agent. The roster at the top of this post is exactly that. One substrate solved both problems.

## The proof of concept

I did not trust this until I watched it work, so before building anything real I spent a session testing the pieces. First the obvious check: a Claude session running inside tmux can indeed open new windows and type into them. Then I stood up two dummy agents in tmux windows and put the protocol through its paces.

The first surprise came immediately. The coordinator pasted a boot prompt, pressed Enter, and nothing happened. Two minutes later the agent's outbox was still empty, and a screen dump showed the whole prompt sitting unsent in the input box. tmux can type the text and press Enter in one call, but the Enter arrived while the terminal was still digesting the pasted block, and the submit got swallowed. The fix is almost stupid: type the text, pause a second, then send Enter as its own keystroke.

Most of the other lessons were variations on one theme: driving Claude through tmux means reading a screen built for human eyes. A window named with a space could not be targeted, so windows get addressed by number; tmux renames a window to whatever is running in it unless you switch that off; and a screen capture strips color, so the grey placeholder hint reads exactly like typed input. You learn to judge an agent from the spinner, not the prompt line.

Then the tests proper. Appending to an agent's inbox with no tmux poke at all woke it in about five seconds, on the file watch alone. After nearly two hours idle, a no-poke append still woke it, just slower. A watcher that dies cleanly wakes its agent on the way out, so only a watcher that is frozen goes silently deaf, and that single case is the entire reason the tmux poke exists; I froze one on purpose and confirmed the poke brought the agent back. The numbers came off the live logs, not memory.

## The evolution

v3 ships entirely on top of v2 and rewrites none of it. The mailboxes, the tickets, the single-writer rule, the watch-driven wakes, all unchanged. v3 adds one capability: when the coordinator notices it is running inside tmux, it takes over the session lifecycle, creating, priming, waking, and stopping the agents itself, one tmux session per feature. The agents never find out, because one boots from the identical prompt whether a human or the coordinator typed it. That is what made it safe to ship mid-flight; it could not break a live v2 effort because it changed nothing the agents touch.

Then I used it for real. The cleanest demo was a camwatch fleet health-check: I asked the coordinator to check the system, it launched three agents in tmux, had each run its checks and report back green or red, then ticketed three fixes that the agents deployed and verified themselves while I watched. The first launch even failed on a path problem, and the coordinator retried it without me.

The better proof came from a second effort. One of its agents hung three times over the day, and each time the coordinator restarted it and carried on. I did not notice any of it. From where I sat there was zero friction; I only learned about the three restarts afterward, reading the logs. That is the whole point of v3: the failures happened and never reached me. Not flawless underneath, but frictionless on top, which is the contact surface shrinking exactly the way it was meant to.

There is one thing the coordinator is not allowed to do, and finding it was the sharpest moment. An agent was waiting on my go for a production deploy. Instead of switching to its terminal, I asked the coordinator to send the "approved" keystroke for me, and I authorized it out loud. It was willing, reasoning it was only acting as my keyboard for a decision I had already made. But Claude Code's permission classifier blocked the keystroke and named exactly what it was: cross-session permission laundering, one agent manufacturing the human's prod-deploy approval inside another's session. The coordinator could nudge a stuck agent back to health all day, those keystrokes went through, but forging an irreversible authorization was the one transport it would not be, even with my explicit say-so. The line is not about how important the machine is; it is about who authorizes and how. The coordinator can create, prime, wake, and stop my agents, but it cannot sign for me.

## The takeaway

The more I build this way, the less it feels like operating tools and the more it feels like running a team. There is a coordinator who never writes code, members who own their repos, and a deploy-coordinator role that exists only to ship safely. I did not design that org chart; it is the shape the work kept pulling the agents into, the same one any human team grows. The Jira board I set aside keeps looking better as a view on top, and letting agents talk to each other directly, not only through the coordinator, is the obvious next step. A lot of hard-won experience from running people seems to transfer. Carbon-based and silicon-based intelligence, put to real work, drift toward the same structure.

This is still a workaround with an expiry date. When Claude Code ships per-teammate working directories, the coordinator becomes a real team lead and most of this dissolves into a feature. Until then, files were enough to let a team of agents talk, and a terminal multiplexer was enough to let one of them run the rest.

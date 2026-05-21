<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    activeTask,
    addTask,
    appState,
    bootState,
    completeTask,
    initializeApp,
    observeTasks,
    orientTasks,
    recommendation,
    saveOrientation,
    startRecommendedTask,
    startTask,
    timeoutTask,
  } from "./proto-state";

  let selectedTaskId: string | null = null;
  let title = "";
  let note = "";
  let roiScore = 3;
  let estimatedMinutes = 25;
  let nowMs = Date.now();
  let syncedTaskId: string | null = null;

  const roiOptions = [1, 2, 3, 4, 5];
  const minuteOptions = [10, 25, 45, 90];

  onMount(() => {
    void initializeApp();

    const timer = window.setInterval(() => {
      nowMs = Date.now();
    }, 1000);

    return () => window.clearInterval(timer);
  });

  const unsubscribe = recommendation.subscribe((value) => {
    if (!selectedTaskId) {
      syncDrafts(value?.task ?? null);
    }
  });

  onDestroy(unsubscribe);

  $: pickedTask = selectedTaskId ? $appState.tasks.find((task) => task.id === selectedTaskId) ?? null : null;
  $: focusTask = $activeTask ?? pickedTask ?? $recommendation?.task ?? $observeTasks[0] ?? null;
  $: if (focusTask && focusTask.id !== syncedTaskId) {
    syncDrafts(focusTask);
  }

  async function submitTask() {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    await addTask({ title: trimmed, observeMemo: "" });
    title = "";
    selectedTaskId = null;
  }

  async function saveFocus() {
    if (!focusTask || focusTask.status === "done" || focusTask.status === "act") {
      return;
    }

    await saveOrientation(focusTask.id, {
      roiScore,
      estimatedMinutes,
      orientMemo: note.trim(),
    });
    selectedTaskId = focusTask.id;
  }

  async function startFocus() {
    if (!focusTask) {
      await startRecommendedTask();
      return;
    }

    if (focusTask.status === "observe") {
      await saveFocus();
    }

    await startTask(focusTask.id);
    selectedTaskId = focusTask.id;
  }

  async function resetFocus() {
    if (!$activeTask) {
      return;
    }

    await timeoutTask($activeTask.id, {
      roiScore: $activeTask.roiScore ?? roiScore,
      estimatedMinutes: $activeTask.estimatedMinutes ?? estimatedMinutes,
      orientMemo: note.trim(),
      progressNote: note.trim() || "戻す",
    });
  }

  function choose(taskId: string) {
    selectedTaskId = taskId;
  }

  function syncDrafts(task: typeof focusTask) {
    if (!task) {
      return;
    }

    syncedTaskId = task.id;
    note = task.status === "act" ? task.progressNote ?? "" : task.orientMemo ?? "";
    roiScore = task.roiScore ?? 3;
    estimatedMinutes = task.estimatedMinutes ?? 25;
  }

  function countdown(actDueAt: string | null) {
    if (!actDueAt) {
      return "";
    }

    const remainingMs = new Date(actDueAt).getTime() - nowMs;
    if (remainingMs <= 0) {
      return "00:00";
    }

    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function level(item: { priorityScore: number }, index: number) {
    if (index === 0) {
      return "high";
    }
    if (item.priorityScore >= 3) {
      return "mid";
    }
    return "low";
  }

  function bootTimeLabel(at: string) {
    const date = new Date(at);
    return Number.isNaN(date.getTime()) ? "--:--:--" : date.toLocaleTimeString("ja-JP");
  }

  async function copyBootError() {
    if (!$bootState.error || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText($bootState.error);
  }
</script>

<svelte:head>
  <title>jikko / svelte proto</title>
</svelte:head>

{#if !$appState.ready}
  <main class="stage loading">
    <section class="boot-panel">
      <div class="boot-head">
        <div>
          <p class="boot-kicker">startup</p>
          <h1>{$bootState.message}</h1>
        </div>
        <span class:error={$bootState.phase === "error"} class="boot-phase">{$bootState.phase}</span>
      </div>

      <div class="boot-progress">
        <div class="boot-progress-fill" style={`width: ${$bootState.progress}%`}></div>
      </div>

      <div class="boot-meta">
        <span>{$bootState.progress}%</span>
        {#if $bootState.error}
          <div class="boot-error">
            <strong>{$bootState.error}</strong>
            <button class="minor boot-copy" on:click={() => void copyBootError()} type="button">コピー</button>
          </div>
        {/if}
      </div>

      <div class="boot-log">
        {#each [...$bootState.logs].reverse() as entry (entry.id)}
          <div class="boot-log-entry">
            <span>{bootTimeLabel(entry.at)}</span>
            <strong>{entry.label}</strong>
            {#if entry.detail}
              <p>{entry.detail}</p>
            {/if}
          </div>
        {/each}
      </div>

      {#if $bootState.phase === "error"}
        <div class="boot-actions">
          <button class="major" on:click={() => void initializeApp()} type="button">再試行</button>
        </div>
      {/if}
    </section>
  </main>
{:else}
  <main class="stage">
    <header class="topbar">
      <div class="brand">
        <span>jikko</span>
        <i></i>
      </div>
      <div class="meter">
        <span class:live={$activeTask}></span>
      </div>
    </header>

    <section class:active={$activeTask} class:observe={!$activeTask && focusTask?.status === "observe"} class="hero">
      {#if $activeTask}
        <div class="hero-meta">
          <span>{countdown($activeTask.actDueAt)}</span>
        </div>
        <h1>{$activeTask.title}</h1>
        <textarea bind:value={note} class="field body-note" placeholder="痕跡"></textarea>
        <div class="hero-actions">
          <button class="major" on:click={() => void completeTask($activeTask.id)} type="button">✓</button>
          <button class="minor" on:click={() => void resetFocus()} type="button">↺</button>
        </div>
      {:else if focusTask}
        <div class="hero-meta">
          <span class:glow={$recommendation?.task.id === focusTask.id}></span>
        </div>
        <h1>{focusTask.title}</h1>
        {#if focusTask.observeMemo}
          <p>{focusTask.observeMemo}</p>
        {/if}
        <div class="dial">
          {#each roiOptions as value}
            <button
              aria-label={`roi-${value}`}
              class:filled={roiScore >= value}
              class="dot"
              on:click={() => (roiScore = value)}
              type="button"
            ></button>
          {/each}
        </div>
        <div class="dial span">
          {#each minuteOptions as value}
            <button
              aria-label={`minutes-${value}`}
              class:filled={estimatedMinutes === value}
              class={`bar w-${value}`}
              on:click={() => (estimatedMinutes = value)}
              type="button"
            ></button>
          {/each}
        </div>
        <textarea bind:value={note} class="field" placeholder="軸"></textarea>
        <div class="hero-actions">
          <button class="minor" on:click={() => void saveFocus()} type="button">◎</button>
          <button class="major" on:click={() => void startFocus()} type="button">▶</button>
        </div>
      {:else}
        <h1>空</h1>
      {/if}
    </section>

    <section class="dock observe-dock">
      <div class="strip">
        {#each $observeTasks as task (task.id)}
          <button
            class:selected={focusTask?.id === task.id}
            class="chip"
            on:click={() => choose(task.id)}
            type="button"
          >
            <strong>{task.title}</strong>
          </button>
        {/each}
      </div>
      <form class="capture" on:submit|preventDefault={submitTask}>
        <input bind:value={title} maxlength={120} placeholder="浮いたもの" />
        <button type="submit">＋</button>
      </form>
    </section>

    <section class="dock rank-dock">
      <div class="strip rank-strip">
        {#each $orientTasks as item, index (item.task.id)}
          <button
            class:selected={focusTask?.id === item.task.id}
            class={`rank ${level(item, index)}`}
            on:click={() => choose(item.task.id)}
            type="button"
          >
            <strong>{item.task.title}</strong>
            <div class="scoreline">
              <span style={`--fill:${Math.min(100, Math.max(12, item.priorityScore * 18))}%`}></span>
            </div>
          </button>
        {/each}
      </div>
    </section>
  </main>
{/if}

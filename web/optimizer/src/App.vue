<template>
  <div class="flex flex-col h-screen overflow-hidden">
     <!-- Top Navbar for Global Navigation -->
     <div class="navbar bg-base-100 text-base-content sticky top-0 z-50 shadow-md shrink-0">
        <!-- Mobile Menu (navbar-start) -->
        <div class="navbar-start">
          <div class="dropdown">
            <div tabindex="0" role="button" class="btn btn-ghost lg:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
            </div>
            <ul
              tabindex="-1"
              class="menu dropdown-content bg-base-100 text-base-content rounded-box z-1 mt-3 w-52 p-2 shadow text-base font-bold">
              <NavigationButton label="优化" icon="ri-rocket-2-line" :is-active="currentView === 'optimizer'" @click="currentView = 'optimizer'" />
              <NavigationButton label="配装" icon="ri-settings-3-line" :is-active="currentView === 'build-advisor'" @click="currentView = 'build-advisor'" />
              <NavigationButton label="角色" icon="ri-user-3-line" :is-active="currentView === 'characters'" @click="currentView = 'characters'" />
              <NavigationButton label="队伍" icon="ri-team-line" :is-active="currentView === 'teams'" @click="currentView = 'teams'" />
              <NavigationButton label="音擎" icon="ri-sword-line" :is-active="currentView === 'wengines'" @click="currentView = 'wengines'" />
              <NavigationButton label="驱动盘" icon="ri-disc-line" :is-active="currentView === 'drive-disks'" @click="currentView = 'drive-disks'" />
              <NavigationButton label="存档" icon="ri-folder-3-line" :is-active="currentView === 'saves'" @click="currentView = 'saves'" />
              <NavigationButton v-if="isDev" label="画廊" icon="ri-gallery-line" :is-active="currentView === 'gallery'" @click="currentView = 'gallery'" />
            </ul>
          </div>
          <a class="btn btn-ghost normal-case text-xl font-bold">绝区零优化器</a>
        </div>

        <!-- Desktop Menu (navbar-center) -->
        <div class="navbar-center hidden lg:flex">
          <ul class="menu menu-horizontal px-1 gap-2 text-lg font-bold">
            <NavigationButton label="优化" icon="ri-rocket-2-line" :is-active="currentView === 'optimizer'" @click="currentView = 'optimizer'" />
            <NavigationButton label="配装" icon="ri-settings-3-line" :is-active="currentView === 'build-advisor'" @click="currentView = 'build-advisor'" />
            <NavigationButton label="角色" icon="ri-user-3-line" :is-active="currentView === 'characters'" @click="currentView = 'characters'" />
            <NavigationButton label="队伍" icon="ri-team-line" :is-active="currentView === 'teams'" @click="currentView = 'teams'" />
            <NavigationButton label="音擎" icon="ri-sword-line" :is-active="currentView === 'wengines'" @click="currentView = 'wengines'" />
            <NavigationButton label="驱动盘" icon="ri-disc-line" :is-active="currentView === 'drive-disks'" @click="currentView = 'drive-disks'" />
            <NavigationButton label="存档" icon="ri-folder-3-line" :is-active="currentView === 'saves'" @click="currentView = 'saves'" />
            <NavigationButton v-if="isDev" label="画廊" icon="ri-gallery-line" :is-active="currentView === 'gallery'" @click="currentView = 'gallery'" />
          </ul>
        </div>

        <!-- Right side (navbar-end) - Theme Toggle -->
        <div class="navbar-end gap-1">
          <button
            class="btn btn-ghost btn-circle hidden md:inline-flex"
            @click="showAnnouncement = true"
            aria-label="公告"
            title="公告"
          >
            <i class="ri-notification-3-line text-base"></i>
          </button>
          <a
            class="btn btn-ghost btn-circle"
            href="https://github.com/kawayiYokami/zzz_optimizer/tree/master"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M12 .5C5.73.5.75 5.68.75 12.1c0 5.14 3.32 9.5 7.93 11.04.58.11.79-.26.79-.57 0-.28-.01-1.02-.02-2-3.23.72-3.91-1.61-3.91-1.61-.53-1.38-1.29-1.75-1.29-1.75-1.06-.74.08-.73.08-.73 1.17.08 1.79 1.25 1.79 1.25 1.04 1.83 2.73 1.3 3.39.99.11-.77.41-1.3.74-1.6-2.58-.3-5.29-1.33-5.29-5.91 0-1.31.45-2.38 1.19-3.22-.12-.3-.52-1.53.11-3.18 0 0 .97-.32 3.18 1.23.92-.26 1.9-.39 2.88-.39.98 0 1.96.13 2.88.39 2.21-1.55 3.18-1.23 3.18-1.23.63 1.65.23 2.88.11 3.18.74.84 1.19 1.91 1.19 3.22 0 4.59-2.71 5.61-5.3 5.91.42.37.79 1.1.79 2.23 0 1.61-.01 2.9-.01 3.29 0 .31.21.69.8.57 4.61-1.54 7.92-5.9 7.92-11.04C23.25 5.68 18.27.5 12 .5z"/>
            </svg>
          </a>
          <label class="swap swap-rotate btn btn-ghost btn-circle">
            <input type="checkbox" :checked="isDark" @change="toggleTheme" />
            <svg class="swap-on h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/>
            </svg>
            <svg class="swap-off h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"/>
            </svg>
          </label>
        </div>
     </div>

     <dialog class="modal" :class="{ 'modal-open': showAnnouncement }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">公告</h3>
        <div class="mt-3 text-sm text-base-content/80 leading-relaxed">
          角色 Buff 数据仍在持续校对与补全中。如果你发现某个角色的 Buff 缺失/数值不对/触发条件不对，欢迎在 GitHub 提交 issue 或 PR。
        </div>
        <div class="modal-action">
          <button class="btn" @click="showAnnouncement = false">关闭</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @submit.prevent="showAnnouncement = false">
        <button aria-label="close">close</button>
      </form>
    </dialog>

     <!-- Content with KeepAlive -->
    <div class="flex-1 overflow-y-auto">
      <!-- 显示加载状态 -->
      <div v-if="!isAppInitialized" class="flex items-center justify-center h-full">
        <div class="text-center">
          <span class="loading loading-spinner loading-lg"></span>
          <p class="mt-4 text-base-content/70">{{ loadingStatus }}</p>
        </div>
      </div>
      <!-- 初始化完成后显示视图 -->
      <KeepAlive v-else include="OptimizerView,CharacterView">
        <component :is="activeComponent" />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import OptimizerView from './views/OptimizerView.vue';
import ComponentGallery from './views/ComponentGallery.vue';
import CharacterView from './views/CharacterView.vue';
import TeamView from './views/TeamView.vue';
import DriveDiskView from './views/DriveDiskView.vue';
import WEngineView from './views/WEngineView.vue';
import SaveManagementView from './views/SaveManagementView.vue';
import BuildAdvisorView from './views/BuildAdvisorView.vue';
import NavigationButton from './components/common/NavigationButton.vue';
import { useGameDataStore } from './stores/game-data.store';
import { useSaveStore } from './stores/save.store';
import { dbService } from './services/db.service';
import { dataLoaderService } from './services/data-loader.service';

declare const __DEV__: boolean;
const isDev = __DEV__;

const gameDataStore = useGameDataStore();
const saveStore = useSaveStore();

const VIEW_STORAGE_KEY = 'zzz_optimizer.currentView';
const currentView = ref('optimizer'); // 默认进入优化器
const isDark = ref(false);
const showAnnouncement = ref(false);
const isAppInitialized = ref(false); // 应用初始化状态
const loadingStatus = ref('正在加载游戏数据...'); // 加载状态提示

const activeComponent = computed(() => {
  if (currentView.value === 'gallery') return __DEV__ ? ComponentGallery : OptimizerView;
  if (currentView.value === 'characters') return CharacterView;
  if (currentView.value === 'teams') return TeamView;
  if (currentView.value === 'wengines') return WEngineView;
  if (currentView.value === 'drive-disks') return DriveDiskView;
  if (currentView.value === 'saves') return SaveManagementView;
  if (currentView.value === 'build-advisor') return BuildAdvisorView;
  return OptimizerView;
});

// 主题切换
function toggleTheme() {
  isDark.value = !isDark.value;
  updateTheme();
}

function updateTheme() {
  const html = document.documentElement;
  if (isDark.value) {
    html.setAttribute('data-theme', 'halloween');
    localStorage.setItem('theme', 'halloween');
  } else {
    html.setAttribute('data-theme', 'fantasy');
    localStorage.setItem('theme', 'fantasy');
  }
}

// 初始化主题
onMounted(async () => {
  const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
  if (savedView) currentView.value = savedView;

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    isDark.value = savedTheme === 'halloween';
  } else {
    // 检测系统主题偏好
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  updateTheme();

  // 全局初始化：数据库 → 版本检查 → 游戏数据 → 存档
  try {
    // 1. 初始化数据库服务
    loadingStatus.value = '正在初始化数据库...';
    await dbService.initialize();

    // 2. 检查游戏数据版本（可能触发缓存刷新）
    loadingStatus.value = '正在检查游戏数据版本...';
    await dataLoaderService.checkGameDataVersion();

    // 3. 加载游戏数据（优先从缓存）
    loadingStatus.value = '正在加载游戏数据...';
    await gameDataStore.initialize();

    // 4. 加载存档（包含自动迁移）
    loadingStatus.value = '正在加载存档...';
    await saveStore.loadFromStorage();

    isAppInitialized.value = true;
  } catch (err) {
    console.error('[App] 全局初始化失败:', err);
    loadingStatus.value = '初始化失败，请刷新页面重试';
  }
});

watch(currentView, (v) => {
  localStorage.setItem(VIEW_STORAGE_KEY, v);
});
</script>

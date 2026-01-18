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
              class="menu dropdown-content bg-base-100 text-base-content rounded-box z-1 mt-3 w-52 p-2 shadow">
              <li><a @click="currentView = 'optimizer'" :class="{ 'active': currentView === 'optimizer' }">优化</a></li>
              <li><a @click="currentView = 'characters'" :class="{ 'active': currentView === 'characters' }">角色</a></li>
              <li><a @click="currentView = 'teams'" :class="{ 'active': currentView === 'teams' }">队伍</a></li>
              <li><a @click="currentView = 'wengines'" :class="{ 'active': currentView === 'wengines' }">音擎</a></li>
              <li><a @click="currentView = 'drive-disks'" :class="{ 'active': currentView === 'drive-disks' }">驱动盘</a></li>
              <li><a @click="currentView = 'saves'" :class="{ 'active': currentView === 'saves' }">存档</a></li>
              <li v-if="isDev"><a @click="currentView = 'debug'" :class="{ 'active': currentView === 'debug' }">调试</a></li>
              <li v-if="isDev"><a @click="currentView = 'gallery'" :class="{ 'active': currentView === 'gallery' }">画廊</a></li>
            </ul>
          </div>
          <a class="btn btn-ghost normal-case">ZZZ Optimizer Dev</a>
        </div>

        <!-- Desktop Menu (navbar-center) -->
        <div class="navbar-center hidden lg:flex">
          <ul class="menu menu-horizontal px-1 gap-2">
            <li><a @click="currentView = 'optimizer'" :class="{ 'active': currentView === 'optimizer' }">优化</a></li>
            <li><a @click="currentView = 'characters'" :class="{ 'active': currentView === 'characters' }">角色</a></li>
            <li><a @click="currentView = 'teams'" :class="{ 'active': currentView === 'teams' }">队伍</a></li>
            <li><a @click="currentView = 'wengines'" :class="{ 'active': currentView === 'wengines' }">音擎</a></li>
            <li><a @click="currentView = 'drive-disks'" :class="{ 'active': currentView === 'drive-disks' }">驱动盘</a></li>
            <li><a @click="currentView = 'saves'" :class="{ 'active': currentView === 'saves' }">存档</a></li>
            <li v-if="isDev"><a @click="currentView = 'debug'" :class="{ 'active': currentView === 'debug' }">调试</a></li>
            <li v-if="isDev"><a @click="currentView = 'gallery'" :class="{ 'active': currentView === 'gallery' }">画廊</a></li>
          </ul>
        </div>

        <!-- Right side (navbar-end) - Theme Toggle -->
        <div class="navbar-end">
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

     <!-- Content with KeepAlive -->
    <div class="flex-1 overflow-y-auto">
      <KeepAlive include="OptimizerView,CharacterView">
        <component :is="activeComponent" />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import DebugView from './views/DebugView.vue';
import OptimizerView from './views/OptimizerView.vue';
import ComponentGallery from './views/ComponentGallery.vue';
import CharacterView from './views/CharacterView.vue';
import TeamView from './views/TeamView.vue';
import DriveDiskView from './views/DriveDiskView.vue';
import WEngineView from './views/WEngineView.vue';
import SaveManagementView from './views/SaveManagementView.vue';

const currentView = ref('optimizer'); // 默认进入优化器
const isDark = ref(false);
const isDev = import.meta.env.DEV; // 开发模式标志

const activeComponent = computed(() => {
  if (currentView.value === 'gallery') return ComponentGallery;
  if (currentView.value === 'characters') return CharacterView;
  if (currentView.value === 'teams') return TeamView;
  if (currentView.value === 'wengines') return WEngineView;
  if (currentView.value === 'drive-disks') return DriveDiskView;
  if (currentView.value === 'saves') return SaveManagementView;
  return currentView.value === 'optimizer' ? OptimizerView : DebugView;
});

// 主题切换
function toggleTheme() {
  isDark.value = !isDark.value;
  updateTheme();
}

function updateTheme() {
  const html = document.documentElement;
  if (isDark.value) {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  } else {
    html.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
  }
}

// 初始化主题
onMounted(() => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    isDark.value = savedTheme === 'dark';
  } else {
    // 检测系统主题偏好
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  updateTheme();
});
</script>

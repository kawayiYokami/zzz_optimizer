<template>
  <div class="app">
     <!-- Top Navbar for Global Navigation -->
     <div class="navbar bg-base-100 text-base-content sticky top-0 z-50 shadow-md">
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
              <li><a @click="currentView = 'optimizer'" :class="{ 'active': currentView === 'optimizer' }">优化器</a></li>
              <li><a @click="currentView = 'characters'" :class="{ 'active': currentView === 'characters' }">角色图鉴</a></li>
              <li><a @click="currentView = 'debug'" :class="{ 'active': currentView === 'debug' }">调试工具</a></li>
              <li><a @click="currentView = 'gallery'" :class="{ 'active': currentView === 'gallery' }">组件画廊</a></li>
            </ul>
          </div>
          <a class="btn btn-ghost normal-case">ZZZ Optimizer Dev</a>
        </div>

        <!-- Desktop Menu (navbar-center) -->
        <div class="navbar-center hidden lg:flex">
          <ul class="menu menu-horizontal px-1 gap-2">
            <li><a @click="currentView = 'optimizer'" :class="{ 'active': currentView === 'optimizer' }">优化器</a></li>
            <li><a @click="currentView = 'characters'" :class="{ 'active': currentView === 'characters' }">角色图鉴</a></li>
            <li><a @click="currentView = 'debug'" :class="{ 'active': currentView === 'debug' }">调试工具</a></li>
            <li><a @click="currentView = 'gallery'" :class="{ 'active': currentView === 'gallery' }">组件画廊</a></li>
          </ul>
        </div>

        <!-- Right side (navbar-end) - Optional -->
        <div class="navbar-end">
          <!-- Future: Add buttons here if needed -->
        </div>
     </div>

     <!-- Content with KeepAlive -->
    <KeepAlive include="OptimizerView,CharacterView">
      <component :is="activeComponent" />
    </KeepAlive>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import DebugView from './views/DebugView.vue';
import OptimizerView from './views/OptimizerView.vue';
import ComponentGallery from './views/ComponentGallery.vue';
import CharacterView from './views/CharacterView.vue';

const currentView = ref('optimizer'); // 默认进入优化器

const activeComponent = computed(() => {
  if (currentView.value === 'gallery') return ComponentGallery;
  if (currentView.value === 'characters') return CharacterView;
  return currentView.value === 'optimizer' ? OptimizerView : DebugView;
});
</script>

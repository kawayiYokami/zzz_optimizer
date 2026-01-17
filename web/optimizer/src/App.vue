<template>
  <div class="app">
     <!-- Top Navbar for Global Navigation -->
     <div class="bg-neutral text-neutral-content sticky top-0 z-50 shadow-md">
        <div class="navbar max-w-7xl mx-auto">
           <div class="flex-1">
             <a class="btn btn-ghost normal-case text-xl text-white">ZZZ Optimizer Dev</a>
           </div>
           <div class="flex-none">
             <ul class="menu menu-horizontal px-1 gap-2">
               <li><a @click="currentView = 'optimizer'" :class="{ 'active': currentView === 'optimizer' }">优化器</a></li>
               <li><a @click="currentView = 'debug'" :class="{ 'active': currentView === 'debug' }">调试工具</a></li>
               <li><a @click="currentView = 'gallery'" :class="{ 'active': currentView === 'gallery' }">组件画廊</a></li>
             </ul>
           </div>
        </div>
     </div>

     <!-- Content with KeepAlive -->
    <KeepAlive include="OptimizerView"> 
      <component :is="activeComponent" />
    </KeepAlive>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import DebugView from './views/DebugView.vue';
import OptimizerView from './views/OptimizerView.vue';
import ComponentGallery from './views/ComponentGallery.vue';

const currentView = ref('optimizer'); // 默认进入优化器

const activeComponent = computed(() => {
  if (currentView.value === 'gallery') return ComponentGallery;
  return currentView.value === 'optimizer' ? OptimizerView : DebugView;
});
</script>

<style>
.app {
  min-height: 100vh;
  background-color: #f5f5f5;
}
</style>
<template>
  <li>
    <a 
      @click="handleClick"
      :class="{ 'active bg-neutral text-neutral-content': isActive }"
      class="text-base font-bold"
    >
      <i :class="icon"></i>
      {{ label }}
    </a>
  </li>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string;
  icon: string;
  isActive: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();

function handleClick() {
  emit('click');
}
</script>
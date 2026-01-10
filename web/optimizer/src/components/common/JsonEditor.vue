<template>
  <div class="json-editor">
    <div class="form-control">
      <label class="label">
        <span class="label-text">{{ label }}</span>
      </label>
      <textarea
        class="textarea textarea-bordered h-96 font-mono text-sm"
        v-model="jsonString"
        @input="handleInput"
        placeholder="Enter JSON data..."
      ></textarea>
      <label class="label">
        <span v-if="error" class="label-text-alt text-error">{{ error }}</span>
        <span v-else class="label-text-alt text-success">Valid JSON</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  label?: string;
  modelValue: any;
}

interface Emits {
  (e: 'update:modelValue', value: any): void;
}

const props = withDefaults(defineProps<Props>(), {
  label: 'JSON Editor',
});

const emit = defineEmits<Emits>();

const jsonString = ref('');
const error = ref<string | null>(null);

// 初始化JSON字符串
function initJsonString() {
  try {
    if (props.modelValue === undefined || props.modelValue === null) {
      jsonString.value = '';
      error.value = null;
    } else {
      jsonString.value = JSON.stringify(props.modelValue, null, 2);
      error.value = null;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Invalid JSON';
  }
}

// 处理输入
function handleInput() {
  try {
    if (jsonString.value.trim() === '') {
      emit('update:modelValue', null);
      error.value = null;
    } else {
      const parsed = JSON.parse(jsonString.value);
      emit('update:modelValue', parsed);
      error.value = null;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Invalid JSON';
  }
}

// 监听props变化
watch(
  () => props.modelValue,
  () => {
    initJsonString();
  },
  { deep: true }
);

// 初始化
initJsonString();
</script>

<style scoped>
.json-editor {
  width: 100%;
}
</style>